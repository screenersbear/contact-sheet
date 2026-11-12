// Storage module. The only file that knows about IndexedDB: screens ask for
// projects, templates and photos through these functions, so a sync backend
// can slot in here later without touching them.
//
// Every record carries a UUID `id`, `createdAt` and `updatedAt`, which is
// what a later sync would merge on.
//
// Stores:
//   projects   drafts. Layout (ratio, slides, frames...) plus photoIds, the
//              project's photo tray, and thumb, a small preview Blob.
//   templates  saved layouts with no photos.
//   photos     one record per imported photo: the untouched original file
//              (for export), a downscaled preview (for editing) and a small
//              thumb (for the tray). Indexed by projectId.
//   meta       small app settings, keyed by `key`.
import { uuid, nowISO } from './util.js';

const DB_NAME = 'contact-sheet';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) {
        const s = db.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the database: step aside so it can.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close Contact Sheet in your other tabs, then try again.'));
  });
  return dbPromise;
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => (result = r), reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage was interrupted'));
  });
}

const getAll = (store) => tx([store], 'readonly', (t) => done(t.objectStore(store).getAll()));
const getOne = (store, id) => tx([store], 'readonly', (t) => done(t.objectStore(store).get(id)));

function stamp(rec) {
  const now = nowISO();
  return { ...rec, id: rec.id || uuid(), createdAt: rec.createdAt || now, updatedAt: now };
}

// ---------- Projects ----------

export async function listProjects() {
  const all = await getAll('projects');
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export const getProject = (id) => getOne('projects', id);

export async function saveProject(p) {
  const rec = stamp(p);
  await tx(['projects'], 'readwrite', (t) => t.objectStore('projects').put(rec));
  return rec;
}

// Thumb only: not an edit, so the draft keeps its place in the list.
export async function saveProjectThumb(id, thumb) {
  await tx(['projects'], 'readwrite', async (t) => {
    const s = t.objectStore('projects');
    const p = await done(s.get(id));
    if (p) s.put({ ...p, thumb });
  });
}

export async function deleteProject(id) {
  await tx(['projects', 'photos'], 'readwrite', async (t) => {
    t.objectStore('projects').delete(id);
    const photos = t.objectStore('photos');
    const keys = await done(photos.index('projectId').getAllKeys(id));
    keys.forEach((k) => photos.delete(k));
  });
}

// A copy of a draft with its own copies of the photos, so deleting either
// one never takes the other's photos with it.
export async function duplicateProject(id, name) {
  const p = await getProject(id);
  if (!p) return null;
  const photos = await photosForProject(id);
  const newId = uuid();
  const map = {};
  const copies = photos.map((ph) => {
    map[ph.id] = uuid();
    return { ...ph, id: map[ph.id], projectId: newId };
  });
  const now = nowISO();
  const copy = {
    ...p,
    id: newId,
    name,
    createdAt: now,
    updatedAt: now,
    photoIds: (p.photoIds || []).filter((x) => map[x]).map((x) => map[x]),
    frames: p.frames.map((f) => ({ ...f, photoId: f.photoId && map[f.photoId] ? map[f.photoId] : null })),
  };
  await tx(['projects', 'photos'], 'readwrite', (t) => {
    t.objectStore('projects').put(copy);
    const s = t.objectStore('photos');
    copies.forEach((c) => s.put(c));
  });
  return copy;
}

// ---------- Photos ----------

export async function addPhoto(rec) {
  const r = stamp(rec);
  await tx(['photos'], 'readwrite', (t) => t.objectStore('photos').put(r));
  return r;
}

export const getPhoto = (id) => getOne('photos', id);

export function photosForProject(projectId) {
  return tx(['photos'], 'readonly', (t) => done(t.objectStore('photos').index('projectId').getAll(projectId)));
}

// Photos taken out of a project's tray stay stored until the project next
// opens (so undo can bring them back); this clears them then.
export async function deleteUnlistedPhotos(projectId, keepIds) {
  const keep = new Set(keepIds);
  await tx(['photos'], 'readwrite', async (t) => {
    const s = t.objectStore('photos');
    const keys = await done(s.index('projectId').getAllKeys(projectId));
    keys.filter((k) => !keep.has(k)).forEach((k) => s.delete(k));
  });
}

// ---------- Templates ----------

export async function listTemplates() {
  const all = await getAll('templates');
  return all.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export const getTemplate = (id) => getOne('templates', id);

export async function saveTemplate(t) {
  const rec = stamp(t);
  await tx(['templates'], 'readwrite', (x) => x.objectStore('templates').put(rec));
  return rec;
}

export async function saveTemplates(list) {
  const recs = list.map(stamp);
  await tx(['templates'], 'readwrite', (x) => {
    const s = x.objectStore('templates');
    recs.forEach((r) => s.put(r));
  });
  return recs;
}

export const deleteTemplate = (id) => tx(['templates'], 'readwrite', (t) => t.objectStore('templates').delete(id));

// ---------- Settings ----------

export async function getMeta(key, fallback = null) {
  const r = await getOne('meta', key);
  return r ? r.value : fallback;
}

export const setMeta = (key, value) => tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ key, value }));

// Ask the browser not to clear stored photos when space runs low.
export function askToPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch {}
}
