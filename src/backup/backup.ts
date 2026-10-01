import JSZip from 'jszip';
import {
  SETTINGS_ID,
  db,
  enqueue,
  getSettings,
  pictureHashes,
  type Lesson,
  type Picture,
  type Praise,
  type Settings,
} from '../db';

const FORMAT = 'david-backup';
const VERSION = 1;

interface PictureEntry {
  id: string;
  word: string;
  builtIn: boolean;
  createdAt: number;
  image: { file: string; type: string };
  media?: { kind: 'audio' | 'video'; mimeType: string; file: string; type: string };
}

interface PraiseEntry {
  id: string;
  mimeType: string;
  createdAt: number;
  file: string;
  type: string;
}

interface BackupData {
  format: typeof FORMAT;
  version: number;
  exportedAt: number;
  pictures: PictureEntry[];
  lessons: Lesson[];
  praises: PraiseEntry[];
  settings: Settings;
}

const ext = (type: string) => {
  const sub = type.split(';')[0].split('/')[1] ?? 'bin';
  return sub.replace('svg+xml', 'svg').replace(/[^a-z0-9]/gi, '') || 'bin';
};

/** Build a zip blob with data.json plus every image / recording as a file. */
export async function exportBackup(): Promise<Blob> {
  const zip = new JSZip();
  const [pictures, lessons, praises, settings] = await Promise.all([
    db.pictures.toArray(),
    db.lessons.toArray(),
    db.praises.toArray(),
    getSettings(),
  ]);

  const picEntries = pictures.map((p): PictureEntry => {
    const imgFile = `images/${p.id}.${ext(p.image.type)}`;
    zip.file(imgFile, p.image);
    const entry: PictureEntry = {
      id: p.id,
      word: p.word,
      builtIn: p.builtIn,
      createdAt: p.createdAt,
      image: { file: imgFile, type: p.image.type },
    };
    if (p.media) {
      const type = p.media.blob.type || p.media.mimeType;
      const file = `media/${p.id}.${ext(type)}`;
      zip.file(file, p.media.blob);
      entry.media = { kind: p.media.kind, mimeType: p.media.mimeType, file, type };
    }
    return entry;
  });

  const praiseEntries = praises.map((pr): PraiseEntry => {
    const type = pr.blob.type || pr.mimeType;
    const file = `praises/${pr.id}.${ext(type)}`;
    zip.file(file, pr.blob);
    return { id: pr.id, mimeType: pr.mimeType, createdAt: pr.createdAt, file, type };
  });

  const data: BackupData = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    pictures: picEntries,
    lessons,
    praises: praiseEntries,
    settings,
  };
  zip.file('data.json', JSON.stringify(data, null, 2));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}

export const backupFileName = () => `david-backup-${new Date().toISOString().slice(0, 10)}.zip`;

/** Share via the Web Share API if it supports files; otherwise trigger a download. */
export async function shareOrDownload(blob: Blob, name: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], name, { type: 'application/zip' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') throw e;
    }
  }
  downloadBlob(blob, name);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ImportSummary {
  pictures: number;
  lessons: number;
  praises: number;
}

/** Read a backup zip and summarize it (validates format) without writing. */
export async function readBackup(file: Blob): Promise<{ zip: JSZip; data: BackupData }> {
  const zip = await JSZip.loadAsync(file);
  const json = zip.file('data.json');
  if (!json) throw new Error('לא נמצא data.json בקובץ');
  const data = JSON.parse(await json.async('string')) as BackupData;
  if (data.format !== FORMAT) throw new Error('הקובץ אינו גיבוי של האפליקציה');
  return { zip, data };
}

/** Replace all existing data with the backup's contents. */
export async function importBackup(zip: JSZip, data: BackupData): Promise<ImportSummary> {
  const blobOf = async (file: string, type: string) => {
    const f = zip.file(file);
    if (!f) throw new Error(`חסר קובץ: ${file}`);
    const buf = await f.async('arraybuffer');
    return new Blob([buf], { type });
  };

  const pictures: Picture[] = [];
  for (const e of data.pictures ?? []) {
    const pic: Picture = {
      id: e.id,
      word: e.word,
      builtIn: !!e.builtIn,
      createdAt: e.createdAt ?? Date.now(),
      image: await blobOf(e.image.file, e.image.type),
    };
    if (e.media) {
      pic.media = {
        kind: e.media.kind,
        mimeType: e.media.mimeType,
        blob: await blobOf(e.media.file, e.media.type || e.media.mimeType),
      };
    }
    pictures.push(pic);
  }
  const praises: Praise[] = [];
  for (const e of data.praises ?? []) {
    praises.push({
      id: e.id,
      mimeType: e.mimeType,
      createdAt: e.createdAt ?? Date.now(),
      blob: await blobOf(e.file, e.type || e.mimeType),
    });
  }
  const lessons = (data.lessons ?? []).map((l) => ({ ...l, createdAt: l.createdAt ?? Date.now() }));

  await db.transaction('rw', [db.pictures, db.lessons, db.praises, db.settings, db.outbox], async () => {
    const [oldPics, oldLessonIds, oldPraises] = await Promise.all([
      db.pictures.toArray(),
      db.lessons.toCollection().primaryKeys(),
      db.praises.toArray(),
    ]);
    await Promise.all([db.pictures.clear(), db.lessons.clear(), db.praises.clear(), db.settings.clear()]);
    await db.pictures.bulkAdd(pictures);
    await db.lessons.bulkAdd(lessons);
    await db.praises.bulkAdd(praises);
    if (data.settings) await db.settings.put({ ...data.settings, key: 'settings' });

    const picIds = new Set(pictures.map((p) => p.id));
    const lessonIds = new Set(lessons.map((l) => l.id));
    const praiseIds = new Set(praises.map((p) => p.id));
    for (const p of oldPics) if (!picIds.has(p.id)) await enqueue('pictures', p.id, 'delete', pictureHashes(p));
    for (const id of oldLessonIds) if (!lessonIds.has(id)) await enqueue('lessons', id, 'delete');
    for (const p of oldPraises)
      if (!praiseIds.has(p.id)) await enqueue('praises', p.id, 'delete', p.hash ? [p.hash] : undefined);
    for (const id of picIds) await enqueue('pictures', id, 'put');
    for (const id of lessonIds) await enqueue('lessons', id, 'put');
    for (const id of praiseIds) await enqueue('praises', id, 'put');
    await enqueue('settings', SETTINGS_ID, 'put');
  });

  return { pictures: pictures.length, lessons: lessons.length, praises: praises.length };
}
