import { liveQuery } from 'dexie';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getBlob, getMetadata, ref, uploadBytes } from 'firebase/storage';
import {
  DEFAULT_SETTINGS,
  SETTINGS_ID,
  applyRemote,
  clearLocalData,
  db,
  enqueueAll,
  onOutboxChange,
  stripKey,
  type OutboxEntry,
  type Picture,
  type Praise,
  type RemoteRow,
  type SyncTable,
} from '../db';
import { firebase, isFirebaseConfigured } from './firebase';

// ---------- Status store ----------

export type SyncState = 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  email?: string;
  pending: number;
  lastSync?: number;
  error?: string;
  /** Both this device and the cloud have data; waiting for the user's choice. */
  needsLinkChoice: boolean;
}

let status: SyncStatus = {
  state: isFirebaseConfigured ? 'signed-out' : 'disabled',
  pending: 0,
  needsLinkChoice: false,
};
const listeners = new Set<() => void>();

function setStatus(changes: Partial<SyncStatus>) {
  status = { ...status, ...changes };
  listeners.forEach((fn) => fn());
}

export const getSyncStatus = () => status;
export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- Meta helpers ----------

const getMeta = async <T>(key: string): Promise<T | undefined> => (await db.syncMeta.get(key))?.value as T | undefined;
const setMeta = (key: string, value: unknown) => db.syncMeta.put({ key, value });

const TABLES: SyncTable[] = ['pictures', 'lessons', 'praises', 'settings'];

interface Cursor {
  s: number;
  n: number;
}

// ---------- Engine lifecycle ----------

let started = false;
let user: User | undefined;
let active = false;
let pullUnsubs: Unsubscribe[] = [];
let linkResolver: ((choice: 'cloud' | 'merge') => void) | undefined;

/** Start watching Auth; sync runs whenever a user is signed in. Safe to call once at startup. */
export function startSync(): void {
  if (started) return;
  started = true;
  const fb = firebase();
  if (!fb) return;

  liveQuery(() => db.outbox.count()).subscribe({ next: (pending) => setStatus({ pending }) });

  onAuthStateChanged(fb.auth, (u) => {
    stop();
    user = u ?? undefined;
    if (!u) {
      setStatus({ state: 'signed-out', email: undefined, error: undefined, needsLinkChoice: false });
      return;
    }
    setStatus({ email: u.email ?? undefined, error: undefined });
    void begin(u);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  onOutboxChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 1000);
  });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => active && setStatus({ state: 'offline' }));
  window.addEventListener('focus', () => void push());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void push());
}

function stop() {
  active = false;
  pullUnsubs.forEach((u) => u());
  pullUnsubs = [];
  linkResolver = undefined;
}

async function begin(u: User) {
  try {
    if ((await getMeta<string>('linkedUid')) !== u.uid) await firstLink(u);
    if (user !== u) return;
    active = true;
    startPull(u);
    await push();
  } catch (e) {
    fail(e);
  }
}

/** Resolve the first-link choice shown in the Sync screen. */
export function chooseLink(choice: 'cloud' | 'merge'): void {
  linkResolver?.(choice);
}

/** Manual "sync now": restart pulling and push the outbox. */
export function syncNow(): void {
  if (!user || !active) return;
  pullUnsubs.forEach((u) => u());
  pullUnsubs = [];
  startPull(user);
  void push();
}

async function firstLink(u: User) {
  setStatus({ state: 'syncing' });
  const localCount = (await db.pictures.count()) + (await db.lessons.count()) + (await db.praises.count());
  const fs = firebase()!.firestore;
  let cloudHasData = false;
  for (const t of ['pictures', 'lessons', 'praises'] as const) {
    const snap = await getDocs(query(collection(fs, 'users', u.uid, t), where('deleted', '==', false), limit(1)));
    if (!snap.empty) {
      cloudHasData = true;
      break;
    }
  }

  let choice: 'cloud' | 'merge' = 'merge';
  if (cloudHasData && localCount === 0) choice = 'cloud';
  else if (cloudHasData) {
    setStatus({ needsLinkChoice: true, state: 'idle' });
    choice = await new Promise((resolve) => (linkResolver = resolve));
    setStatus({ needsLinkChoice: false, state: 'syncing' });
  }
  if (user !== u) return;

  await db.syncMeta.clear();
  if (choice === 'cloud') await clearLocalData();
  else {
    await db.outbox.clear();
    await enqueueAll();
  }
  await setMeta('linkedUid', u.uid);
}

function fail(e: unknown) {
  console.warn('sync error', e);
  setStatus({ state: navigator.onLine ? 'error' : 'offline', error: (e as Error)?.message || String(e) });
}

// ---------- Blobs ----------

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const blobRef = (uid: string, hash: string) => ref(firebase()!.storage, `users/${uid}/blobs/${hash}`);

async function ensureUploaded(uid: string, hash: string, blob: Blob) {
  const metaKey = `blob:${hash}`;
  if (await getMeta<boolean>(metaKey)) return;
  const r = blobRef(uid, hash);
  try {
    await getMetadata(r);
  } catch (e) {
    if ((e as { code?: string })?.code !== 'storage/object-not-found') throw e;
    await uploadBytes(r, blob, { contentType: blob.type || undefined });
  }
  await setMeta(metaKey, true);
}

async function downloadBlob(uid: string, hash: string, type: string): Promise<Blob> {
  const b = await getBlob(blobRef(uid, hash));
  await setMeta(`blob:${hash}`, true);
  return new Blob([b], { type });
}

/** Delete blobs from Storage once no local record references them. */
async function collectBlobs(uid: string, hashes: string[]) {
  const [pics, praises] = await Promise.all([db.pictures.toArray(), db.praises.toArray()]);
  const used = new Set<string>();
  for (const p of pics) [p.imageHash, p.media?.hash].forEach((h) => h && used.add(h));
  for (const p of praises) if (p.hash) used.add(p.hash);
  for (const h of hashes) {
    if (used.has(h)) continue;
    try {
      await deleteObject(blobRef(uid, h));
    } catch (e) {
      if ((e as { code?: string })?.code !== 'storage/object-not-found') throw e;
    }
    await db.syncMeta.delete(`blob:${h}`);
  }
}

// ---------- Push ----------

let pushing = false;
let pushAgain = false;

async function push(): Promise<void> {
  const u = user;
  if (!u || !active) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  if (!navigator.onLine) {
    setStatus({ state: 'offline' });
    return;
  }
  pushing = true;
  setStatus({ state: 'syncing', error: undefined });
  try {
    do {
      pushAgain = false;
      for (;;) {
        if (user !== u || !active) return;
        const entry = await db.outbox.orderBy('seq').first();
        if (!entry) break;
        await pushEntry(u.uid, entry);
      }
    } while (pushAgain);
    setStatus({ state: 'idle', lastSync: Date.now() });
  } catch (e) {
    fail(e);
  } finally {
    pushing = false;
  }
}

async function pushEntry(uid: string, entry: OutboxEntry) {
  const same = await db.outbox.where('key').equals(entry.key).toArray();
  const maxSeq = Math.max(...same.map((e) => e.seq!));
  const hashes = same.flatMap((e) => e.hashes ?? []);
  const fs = firebase()!.firestore;
  const docRef = doc(fs, 'users', uid, entry.table, entry.id);

  const data = await docData(uid, entry.table, entry.id);
  if (data) await setDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  else await setDoc(docRef, { deleted: true, updatedAt: serverTimestamp() });

  await db.outbox.where('key').equals(entry.key).and((e) => e.seq! <= maxSeq).delete();
  if (hashes.length) await collectBlobs(uid, hashes);
}

/** Build the Firestore doc for a local record (uploading its blobs), or null if it's gone. */
async function docData(uid: string, table: SyncTable, id: string): Promise<DocumentData | null> {
  switch (table) {
    case 'pictures': {
      const p = await db.pictures.get(id);
      if (!p) return null;
      const imageHash = p.imageHash ?? (await sha256(p.image));
      const mediaHash = p.media ? (p.media.hash ?? (await sha256(p.media.blob))) : undefined;
      if (imageHash !== p.imageHash || mediaHash !== p.media?.hash) {
        await db.pictures.where('id').equals(id).modify((row) => {
          if (row.image === p.image) row.imageHash = imageHash;
          if (row.media && mediaHash && row.media.blob === p.media?.blob) row.media.hash = mediaHash;
        });
      }
      await ensureUploaded(uid, imageHash, p.image);
      if (p.media && mediaHash) await ensureUploaded(uid, mediaHash, p.media.blob);
      return {
        word: p.word,
        builtIn: p.builtIn,
        createdAt: p.createdAt,
        imageHash,
        imageType: p.image.type,
        media: p.media
          ? { kind: p.media.kind, mimeType: p.media.mimeType, hash: mediaHash, type: p.media.blob.type }
          : null,
        deleted: false,
      };
    }
    case 'lessons': {
      const l = await db.lessons.get(id);
      if (!l) return null;
      return { name: l.name, pictureIds: l.pictureIds, createdAt: l.createdAt, deleted: false };
    }
    case 'praises': {
      const pr = await db.praises.get(id);
      if (!pr) return null;
      const hash = pr.hash ?? (await sha256(pr.blob));
      if (hash !== pr.hash) await db.praises.update(id, { hash });
      await ensureUploaded(uid, hash, pr.blob);
      return { mimeType: pr.mimeType, hash, type: pr.blob.type, createdAt: pr.createdAt, deleted: false };
    }
    case 'settings': {
      const row = await db.settings.get('settings');
      return { ...DEFAULT_SETTINGS, ...stripKey(row), deleted: false };
    }
  }
}

// ---------- Pull ----------

function startPull(u: User) {
  const fs = firebase()!.firestore;
  for (const table of TABLES) {
    let chain = Promise.resolve();
    let unsub: Unsubscribe | undefined;
    let cancelled = false;
    void getMeta<Cursor>(`cursor:${table}`).then((c) => {
      if (cancelled || user !== u) return;
      const q = query(
        collection(fs, 'users', u.uid, table),
        where('updatedAt', '>', c ? new Timestamp(c.s, c.n) : new Timestamp(0, 0)),
        orderBy('updatedAt'),
      );
      unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          const docs = snap.docChanges()
            .filter((ch) => ch.type !== 'removed' && !ch.doc.metadata.hasPendingWrites)
            .map((ch) => ch.doc);
          if (!docs.length) return;
          chain = chain.then(() => applyDocs(u, table, docs)).catch(fail);
        },
        fail,
      );
    });
    pullUnsubs.push(() => {
      cancelled = true;
      unsub?.();
    });
  }
}

async function applyDocs(u: User, table: SyncTable, docs: QueryDocumentSnapshot[]) {
  let cursor = await getMeta<Cursor>(`cursor:${table}`);
  for (const d of docs) {
    if (user !== u) return;
    const data = d.data();
    const ts = data.updatedAt as Timestamp | null;
    if (!ts) continue;
    if (cursor && ts.seconds * 1e9 + ts.nanoseconds <= cursor.s * 1e9 + cursor.n) continue;
    const localId = table === 'settings' ? SETTINGS_ID : d.id;
    await applyRemote(table, localId, data.deleted ? null : await toLocal(u.uid, table, d.id, data));
    cursor = { s: ts.seconds, n: ts.nanoseconds };
    await setMeta(`cursor:${table}`, cursor);
  }
  setStatus({ lastSync: Date.now() });
}

async function toLocal(uid: string, table: SyncTable, id: string, data: DocumentData): Promise<RemoteRow> {
  switch (table) {
    case 'pictures': {
      const local = await db.pictures.get(id);
      const image =
        local && local.imageHash === data.imageHash
          ? local.image
          : await downloadBlob(uid, data.imageHash, data.imageType ?? '');
      const row: Picture = {
        id,
        word: data.word,
        builtIn: !!data.builtIn,
        createdAt: data.createdAt ?? Date.now(),
        image,
        imageHash: data.imageHash,
      };
      if (data.media) {
        const m = data.media;
        const blob =
          local?.media?.hash === m.hash ? local!.media!.blob : await downloadBlob(uid, m.hash, m.type || m.mimeType);
        row.media = { kind: m.kind, mimeType: m.mimeType, blob, hash: m.hash };
      }
      return { table, row };
    }
    case 'lessons':
      return {
        table,
        row: { id, name: data.name, pictureIds: data.pictureIds ?? [], createdAt: data.createdAt ?? Date.now() },
      };
    case 'praises': {
      const local = await db.praises.get(id);
      const blob =
        local && local.hash === data.hash ? local.blob : await downloadBlob(uid, data.hash, data.type || data.mimeType);
      const row: Praise = { id, blob, mimeType: data.mimeType, hash: data.hash, createdAt: data.createdAt ?? Date.now() };
      return { table, row };
    }
    case 'settings': {
      const { updatedAt: _u, deleted: _d, ...rest } = data;
      return { table, row: { ...DEFAULT_SETTINGS, ...rest } };
    }
  }
}
