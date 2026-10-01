import Dexie, { type EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ---------- Types ----------

export type MediaKind = 'audio' | 'video';

export interface PictureMedia {
  kind: MediaKind;
  blob: Blob;
  mimeType: string;
  /** SHA-256 of `blob`, filled in by sync. */
  hash?: string;
}

export interface Picture {
  id: string;
  word: string;
  image: Blob;
  /** SHA-256 of `image`, filled in by sync. */
  imageHash?: string;
  media?: PictureMedia;
  builtIn: boolean;
  createdAt: number;
}

export interface Lesson {
  id: string;
  name: string;
  /** Ordered picture ids, at most MAX_LESSON_PICTURES. */
  pictureIds: string[];
  createdAt: number;
}

export interface Praise {
  id: string;
  blob: Blob;
  mimeType: string;
  /** SHA-256 of `blob`, filled in by sync. */
  hash?: string;
  createdAt: number;
}

export interface Settings {
  /** Voice must exceed noise baseline RMS by this factor (higher = less sensitive). */
  micSensitivity: number;
  /** Listening window per attempt, in seconds. */
  listenSeconds: number;
  /** Show the front camera as a mirror during play. */
  showMirror: boolean;
}

interface SettingsRow extends Settings {
  key: 'settings';
}

export type SyncTable = 'pictures' | 'lessons' | 'praises' | 'settings';

export interface OutboxEntry {
  seq?: number;
  /** `${table}:${id}` */
  key: string;
  table: SyncTable;
  id: string;
  op: 'put' | 'delete';
  /** Blob hashes the deleted record referenced, for Storage cleanup. */
  hashes?: string[];
}

export interface SyncMetaRow {
  key: string;
  value: unknown;
}

export const MAX_LESSON_PICTURES = 8;
export const DEFAULT_SETTINGS: Settings = { micSensitivity: 3, listenSeconds: 6, showMirror: false };

// ---------- Database ----------

export class DavidDB extends Dexie {
  pictures!: EntityTable<Picture, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  praises!: EntityTable<Praise, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  syncMeta!: EntityTable<SyncMetaRow, 'key'>;

  constructor() {
    super('david');
    this.version(1).stores({
      pictures: 'id, word, builtIn, createdAt',
      lessons: 'id, name, createdAt',
      praises: 'id, createdAt',
      settings: 'key',
    });
    this.version(2).stores({
      outbox: '++seq, key',
      syncMeta: 'key',
    });
  }
}

export const db = new DavidDB();

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ---------- Sync outbox ----------

/** Settings live under this id in the cloud. */
export const SETTINGS_ID = 'main';

type OutboxListener = () => void;
const outboxListeners = new Set<OutboxListener>();

/** Called after every local mutation is committed. Returns an unsubscribe function. */
export function onOutboxChange(fn: OutboxListener): () => void {
  outboxListeners.add(fn);
  return () => outboxListeners.delete(fn);
}

function notifyOutbox() {
  // Fire after the surrounding transaction commits.
  setTimeout(() => outboxListeners.forEach((fn) => fn()), 0);
}

/** Record a local change for the sync engine. Call inside the mutation's transaction. */
export async function enqueue(table: SyncTable, id: string, op: 'put' | 'delete', hashes?: string[]): Promise<void> {
  await db.outbox.add({ key: `${table}:${id}`, table, id, op, ...(hashes?.length ? { hashes } : {}) });
  notifyOutbox();
}

export const pictureHashes = (p?: Picture): string[] =>
  p ? [p.imageHash, p.media?.hash].filter((h): h is string => !!h) : [];

/** Ask the browser not to evict our data. Call once on startup. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ---------- Pictures ----------

export type NewPicture = Omit<Picture, 'id' | 'createdAt' | 'builtIn'> & { builtIn?: boolean };

export async function addPicture(p: NewPicture): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.pictures, db.outbox, async () => {
    await db.pictures.add({ ...p, builtIn: p.builtIn ?? false, id, createdAt: Date.now() });
    await enqueue('pictures', id, 'put');
  });
  return id;
}

export async function updatePicture(
  id: string,
  changes: Partial<Omit<Picture, 'id' | 'createdAt'>>,
): Promise<void> {
  const c: Partial<Picture> = { ...changes };
  if (c.image && !('imageHash' in changes)) c.imageHash = undefined;
  await db.transaction('rw', db.pictures, db.outbox, async () => {
    await db.pictures.update(id, c);
    await enqueue('pictures', id, 'put');
  });
}

/** Remove the recording from a picture. */
export async function clearPictureMedia(id: string): Promise<void> {
  await db.transaction('rw', db.pictures, db.outbox, async () => {
    await db.pictures.where('id').equals(id).modify((p) => {
      delete p.media;
    });
    await enqueue('pictures', id, 'put');
  });
}

export const getPicture = (id: string) => db.pictures.get(id);

/** All pictures, newest first. */
export const listPictures = () => db.pictures.orderBy('createdAt').reverse().toArray();

/** Deletes a picture and removes it from every lesson. */
export async function deletePicture(id: string): Promise<void> {
  await db.transaction('rw', db.pictures, db.lessons, db.outbox, async () => {
    const pic = await db.pictures.get(id);
    await db.pictures.delete(id);
    await enqueue('pictures', id, 'delete', pictureHashes(pic));
    const touched = await db.lessons.filter((l) => l.pictureIds.includes(id)).toArray();
    for (const l of touched) {
      await db.lessons.update(l.id, { pictureIds: l.pictureIds.filter((pid) => pid !== id) });
      await enqueue('lessons', l.id, 'put');
    }
  });
}

// ---------- Lessons ----------

const clampIds = (ids: string[]) => Array.from(new Set(ids)).slice(0, MAX_LESSON_PICTURES);

export async function addLesson(name: string, pictureIds: string[] = []): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.lessons, db.outbox, async () => {
    await db.lessons.add({ id, name, pictureIds: clampIds(pictureIds), createdAt: Date.now() });
    await enqueue('lessons', id, 'put');
  });
  return id;
}

export async function renameLesson(id: string, name: string): Promise<void> {
  await updateLesson(id, { name });
}

/** Replace the ordered picture list (deduped, truncated to 8). */
export async function setLessonPictures(id: string, pictureIds: string[]): Promise<void> {
  await updateLesson(id, { pictureIds: clampIds(pictureIds) });
}

async function updateLesson(id: string, changes: Partial<Lesson>): Promise<void> {
  await db.transaction('rw', db.lessons, db.outbox, async () => {
    await db.lessons.update(id, changes);
    await enqueue('lessons', id, 'put');
  });
}

export const deleteLesson = (id: string) =>
  db.transaction('rw', db.lessons, db.outbox, async () => {
    await db.lessons.delete(id);
    await enqueue('lessons', id, 'delete');
  });
export const getLesson = (id: string) => db.lessons.get(id);
export const listLessons = () => db.lessons.orderBy('createdAt').toArray();

/** Resolves a lesson's pictures in order, skipping missing ones. */
export async function getLessonPictures(lessonId: string): Promise<Picture[]> {
  const lesson = await db.lessons.get(lessonId);
  if (!lesson) return [];
  const pics = await db.pictures.bulkGet(lesson.pictureIds);
  return pics.filter((p): p is Picture => !!p);
}

// ---------- Praises ----------

export async function addPraise(blob: Blob, mimeType: string = blob.type): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.praises, db.outbox, async () => {
    await db.praises.add({ id, blob, mimeType, createdAt: Date.now() });
    await enqueue('praises', id, 'put');
  });
  return id;
}

export const deletePraise = (id: string) =>
  db.transaction('rw', db.praises, db.outbox, async () => {
    const pr = await db.praises.get(id);
    await db.praises.delete(id);
    await enqueue('praises', id, 'delete', pr?.hash ? [pr.hash] : undefined);
  });
export const listPraises = () => db.praises.orderBy('createdAt').toArray();

/** Random praise, avoiding `excludeId` (e.g. the previous one) when possible. */
export async function randomPraise(excludeId?: string): Promise<Praise | undefined> {
  const all = await db.praises.toArray();
  const pool = all.length > 1 ? all.filter((p) => p.id !== excludeId) : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...stripKey(row) };
}

export async function updateSettings(changes: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, db.outbox, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...changes, key: 'settings' });
    await enqueue('settings', SETTINGS_ID, 'put');
  });
}

export function stripKey(row?: SettingsRow): Partial<Settings> {
  if (!row) return {};
  const { key: _key, ...rest } = row;
  return rest;
}

// ---------- Remote writes (sync engine only; never enqueue) ----------

export type RemoteRow =
  | { table: 'pictures'; row: Picture }
  | { table: 'lessons'; row: Lesson }
  | { table: 'praises'; row: Praise }
  | { table: 'settings'; row: Settings };

const SYNC_TABLES = () => [db.pictures, db.lessons, db.praises, db.settings, db.outbox];

/** Apply a remote upsert or delete, unless a local change for that id is still pending. */
export async function applyRemote(table: SyncTable, id: string, change: RemoteRow | null): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(), async () => {
    if ((await db.outbox.where('key').equals(`${table}:${id}`).count()) > 0) return;
    if (!change) {
      if (table === 'settings') await db.settings.delete('settings');
      else await db[table].delete(id);
      return;
    }
    switch (change.table) {
      case 'pictures':
        await db.pictures.put(change.row);
        break;
      case 'lessons':
        await db.lessons.put(change.row);
        break;
      case 'praises':
        await db.praises.put(change.row);
        break;
      case 'settings':
        await db.settings.put({ ...DEFAULT_SETTINGS, ...change.row, key: 'settings' });
        break;
    }
  });
}

/** Wipe local content and the outbox (used for "use cloud data"). */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(), async () => {
    await Promise.all([db.pictures.clear(), db.lessons.clear(), db.praises.clear(), db.settings.clear(), db.outbox.clear()]);
  });
}

/** Enqueue an upsert for every local record (first link / merge). */
export async function enqueueAll(): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(), async () => {
    for (const t of ['pictures', 'lessons', 'praises'] as const) {
      const ids = (await db[t].toCollection().primaryKeys()) as string[];
      for (const id of ids) await enqueue(t, id, 'put');
    }
    if (await db.settings.get('settings')) await enqueue('settings', SETTINGS_ID, 'put');
  });
}

// ---------- React hooks (live, re-render on DB change) ----------

export const usePictures = () => useLiveQuery(listPictures, []);
export const usePicture = (id: string | undefined) =>
  useLiveQuery(() => (id ? db.pictures.get(id) : undefined), [id]);
export const useLessons = () => useLiveQuery(listLessons, []);
export const useLesson = (id: string | undefined) =>
  useLiveQuery(() => (id ? db.lessons.get(id) : undefined), [id]);
export const useLessonPictures = (lessonId: string | undefined) =>
  useLiveQuery(() => (lessonId ? getLessonPictures(lessonId) : []), [lessonId]);
export const usePraises = () => useLiveQuery(listPraises, []);
/** Always returns settings (defaults until loaded). */
export const useSettings = (): Settings => useLiveQuery(getSettings, [], DEFAULT_SETTINGS);
