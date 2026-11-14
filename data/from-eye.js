// Finals from The Eye made into posts (round 2, connect/03). When a shoot's
// finals have been passed on (a 'finals' link in df-links, made by The
// Eye), Layouts copies them in and makes two drafts, both 3:4: a carousel
// and a single (which finals go where: DFConnect.pickPosts), each with a
// caption from the shoot. Nothing is ever posted: they wait in the list.
// The Eye's finals are only read, from its storage on this phone.
import { saveProject, photosForProject } from './db.js';
import { importFiles } from './photos.js';
import { stripLayout } from './templates.js';
import { previewCanvas } from '../components/render.js';
import { loadImage, canvasToBlob } from '../components/util.js';

const EYE_PHOTOS = 'starky-moodboards';
const D = () => window.DFData;
const C = () => window.DFConnect;
const ready = () => !!(D() && C() && D().linksWhere);

// A shoot's finals as The Eye keeps them ([{ src }], [] when there are none).
// Opened the way The Eye opens it (version 1, with its one store), so it's
// never left without that store if Layouts happens to open it first.
export function eyeFinals(shootId) {
  return new Promise((done) => {
    let req;
    try { req = indexedDB.open(EYE_PHOTOS, 1); } catch { done([]); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('images');
    req.onerror = () => done([]);
    req.onblocked = () => done([]);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const get = db.transaction('images').objectStore('images').get(`${shootId}__final`);
        get.onsuccess = () => {
          db.close();
          const v = get.result;
          done(Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? { src: x } : x)).filter((x) => x && x.src) : []);
        };
        get.onerror = () => { db.close(); done([]); };
      } catch { db.close(); done([]); }
    };
  });
}

// A final (a data address) as a file, as if picked from the phone.
async function asFile(src, name) {
  const blob = await (await fetch(src)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

// The home page's strip of a post (as the editor makes it, editor.js).
async function thumbOf(p, photos) {
  const urls = [];
  try {
    const map = {};
    for (const ph of photos) {
      const u = URL.createObjectURL(ph.preview);
      urls.push(u);
      map[ph.id] = { photo: ph, src: await loadImage(u) };
    }
    const c = previewCanvas(p, (pid) => map[pid] || null, { height: 200, count: Math.min(3, p.slides), gap: 11 });
    const ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    const blob = await canvasToBlob(c, 'image/jpeg', 0.8);
    c.width = c.height = 0;
    return blob;
  } catch {
    return null;
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

// One post: the project, then its photos copied in, then its layout.
async function makePost(link, finals, picks, kind) {
  const title = String(link.title || '').trim() || 'New work';
  const p = await saveProject({
    name: `${title}, ${kind}`, photoIds: [], thumb: null, ...stripLayout([]),
    caption: link.caption || '', fromEye: link.id, post: kind,
  });
  const files = await Promise.all(picks.map((i) => asFile(finals[i].src, `${title} ${i + 1}.jpg`)));
  const { photos } = await importFiles(p.id, files);
  const ids = photos.map((ph) => ph.id);
  const made = { ...p, ...stripLayout(ids), photoIds: ids };
  made.thumb = await thumbOf(made, photos);
  return saveProject(made);
}

// Makes the posts for one link; gives their ids. A link already done, or
// with no finals left to read, makes none.
async function postsFor(link) {
  const finals = await eyeFinals(link.fromId);
  const { carousel, single } = C().pickPosts(finals.length);
  // The single first, so the carousel sits above it in the list (newest first).
  const one = single !== null ? await makePost(link, finals, [single], 'single') : null;
  const many = carousel.length ? await makePost(link, finals, carousel, 'carousel') : null;
  return [many, one].filter(Boolean).map((p) => p.id);
}

// Every hand-off of finals not made into posts yet, made now (once each,
// even if Layouts opens twice at once). Gives how many were made.
let running = null;
export function makePostsFromEye() {
  if (!ready()) return Promise.resolve(0);
  if (!running) {
    running = (async () => {
      let n = 0;
      const waiting = (await D().linksWhere({ toApp: 'contact-sheet', type: 'finals' })).filter((l) => !l.madeAt);
      for (const l of waiting) {
        const now = await D().getLink(l.id);
        if (!now || now.madeAt) continue;
        const postIds = await postsFor(now);
        await D().saveLink({ ...now, madeAt: new Date().toISOString(), postIds });
        n += 1;
      }
      return n;
    })().finally(() => { running = null; });
  }
  return running;
}

// The posts made from a hand-off, with their photos ({ link, posts: [{ p, photos }] }),
// or null when it's gone.
export async function postsOf(linkId, getProject) {
  if (!ready()) return null;
  const link = await D().getLink(linkId);
  if (!link) return null;
  const posts = [];
  for (const id of link.postIds || []) {
    const p = await getProject(id);
    if (p) posts.push({ p, photos: await photosForProject(id) });
  }
  return { link, posts };
}
