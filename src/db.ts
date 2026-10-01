import Dexie, { type EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ---------- Types ----------

export type MediaKind = 'audio' | 'video';

export interface PictureMedia {
  kind: MediaKind;
  blob: Blob;
  mimeType: string;
}

export interface Picture {
  id: string;
  word: string;
  image: Blob;
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
  createdAt: number;
}

export interface Settings {
  /** Voice must exceed noise baseline RMS by this factor (higher = less sensitive). */
  micSensitivity: number;
  /** Listening window per attempt, in seconds. */
  listenSeconds: number;
}

interface SettingsRow extends Settings {
  key: 'settings';
}

export const MAX_LESSON_PICTURES = 8;
export const DEFAULT_SETTINGS: Settings = { micSensitivity: 3, listenSeconds: 6 };

// ---------- Database ----------

export class DavidDB extends Dexie {
  pictures!: EntityTable<Picture, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  praises!: EntityTable<Praise, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor() {
    super('david');
    this.version(1).stores({
      pictures: 'id, word, builtIn, createdAt',
      lessons: 'id, name, createdAt',
      praises: 'id, createdAt',
      settings: 'key',
    });
  }
}

export const db = new DavidDB();

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

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
  await db.pictures.add({ ...p, builtIn: p.builtIn ?? false, id, createdAt: Date.now() });
  return id;
}

export async function updatePicture(
  id: string,
  changes: Partial<Omit<Picture, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.pictures.update(id, changes);
}

/** Remove the recording from a picture. */
export async function clearPictureMedia(id: string): Promise<void> {
  await db.pictures.where('id').equals(id).modify((p) => {
    delete p.media;
  });
}

export const getPicture = (id: string) => db.pictures.get(id);

/** All pictures, newest first. */
export const listPictures = () => db.pictures.orderBy('createdAt').reverse().toArray();

/** Deletes a picture and removes it from every lesson. */
export async function deletePicture(id: string): Promise<void> {
  await db.transaction('rw', db.pictures, db.lessons, async () => {
    await db.pictures.delete(id);
    await db.lessons.toCollection().modify((l) => {
      l.pictureIds = l.pictureIds.filter((pid) => pid !== id);
    });
  });
}

// ---------- Lessons ----------

const clampIds = (ids: string[]) => Array.from(new Set(ids)).slice(0, MAX_LESSON_PICTURES);

export async function addLesson(name: string, pictureIds: string[] = []): Promise<string> {
  const id = newId();
  await db.lessons.add({ id, name, pictureIds: clampIds(pictureIds), createdAt: Date.now() });
  return id;
}

export async function renameLesson(id: string, name: string): Promise<void> {
  await db.lessons.update(id, { name });
}

/** Replace the ordered picture list (deduped, truncated to 8). */
export async function setLessonPictures(id: string, pictureIds: string[]): Promise<void> {
  await db.lessons.update(id, { pictureIds: clampIds(pictureIds) });
}

export const deleteLesson = (id: string) => db.lessons.delete(id);
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
  await db.praises.add({ id, blob, mimeType, createdAt: Date.now() });
  return id;
}

export const deletePraise = (id: string) => db.praises.delete(id);
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
  const current = await getSettings();
  await db.settings.put({ ...current, ...changes, key: 'settings' });
}

function stripKey(row?: SettingsRow): Partial<Settings> {
  if (!row) return {};
  const { key: _key, ...rest } = row;
  return rest;
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
