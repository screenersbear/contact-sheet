// Backups made the first way, one .json file, going back in (backups.js
// restores the zips): a notebook's own (df-data.js's exportDb, or The Eye's
// { state, images }) or one of all four (kind 'suite-backup':
//   { app: 'documenting-fictions', kind: 'suite-backup', version: 1, exportedAt,
//     notebooks: { ref, 'the-eye', 'contact-sheet', rounds, links, stickers } },
// a part null if that notebook had nothing). One from before the stickers
// has no stickers part and leaves them as they are; none has a people part.
// An Overthoughts part, from before it was taken out (15 Nov), is skipped.
(function () {
  'use strict';
  const D = window.DFData;
  const B = window.DFBackups;
  if (!D || !B) return;
  const { BOOKS, DBS, EYE_DB, EYE_STATE } = B;
  const NOT_A_BACKUP = "That file isn't a Documenting Fictions backup.";
  const ls = { set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

  // Which databases are there already. Opening one that isn't would make an
  // empty one, which its notebook would then trip over.
  async function existing() {
    if (!indexedDB.databases) return null; // can't tell: isNew() looks at each one
    return new Set((await indexedDB.databases()).map((d) => d.name));
  }
  // Whether a notebook's database is new on this device. Where the browser
  // can't list them, opening it says: a new one starts from version 0, and
  // that first opening is called off, so it can be made from the backup.
  async function isNew(name, have) {
    if (have) return !have.has(name);
    try {
      // Asked for no version, an existing one opens as it is: this only runs for a new one.
      const db = await D.open(name, undefined, (made, old, tx) => tx.abort());
      db.close();
      return false;
    } catch (e) {
      if (e && e.name === 'AbortError') return true;
      throw e;
    }
  }

  // df-data.js keeps its unpacking to itself; this is the same thing.
  async function unpack(v) {
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await unpack(x)); return out; }
    if (v && typeof v === 'object') {
      if (typeof v.__blob === 'string') {
        const b = await (await fetch(v.__blob)).blob();
        return v.name ? new File([b], v.name, { type: v.type || b.type, lastModified: v.lastModified || Date.now() }) : new Blob([b], { type: v.type || b.type });
      }
      if (typeof v.__buf === 'string') {
        const buf = await (await (await fetch(v.__buf)).blob()).arrayBuffer();
        return v.__view && typeof self[v.__view] === 'function' ? new self[v.__view](buf) : buf;
      }
      if (typeof v.__date === 'string') return new Date(v.__date);
      const out = {}; for (const k of Object.keys(v)) out[k] = await unpack(v[k]); return out;
    }
    return v;
  }

  // Puts one notebook's database back from its part, exactly as it was: its
  // stores are cleared first. The slow part (turning data URLs back into
  // photos) is done before the write opens, or the write would close on the
  // wait. A notebook never opened on this device gets its database made from
  // what the backup says it looked like.
  async function putBack(n, data, have) {
    const unpacked = {};
    for (const [name, s] of Object.entries(data.stores)) {
      unpacked[name] = [];
      for (const [k, v] of s.rows || []) unpacked[name].push([await unpack(k), await unpack(v)]);
    }
    const fresh = await isNew(n.db, have);
    const db = await D.open(n.db, fresh ? data.version : undefined, fresh ? (made) => {
      for (const [name, s] of Object.entries(data.stores)) {
        if (made.objectStoreNames.contains(name)) continue;
        const m = s.meta || {};
        const os = made.createObjectStore(name, m.keyPath == null ? { autoIncrement: !!m.autoIncrement } : { keyPath: m.keyPath, autoIncrement: !!m.autoIncrement });
        (m.indexes || []).forEach((ix) => os.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique, multiEntry: !!ix.multiEntry }));
      }
    } : null);
    try {
      const names = Object.keys(unpacked).filter((s) => db.objectStoreNames.contains(s));
      if (names.length) {
        const tx = db.transaction(names, 'readwrite');
        const done = new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = tx.onerror = () => no(tx.error || new Error("That wasn't restored.")); });
        try {
          names.forEach((s) => {
            const os = tx.objectStore(s);
            os.clear();
            unpacked[s].forEach(([k, v]) => { if (os.keyPath) os.put(v); else os.put(v, k); });
          });
        } catch (e) {
          tx.abort(); // a row the store can't take at all: nothing goes in, not even the clear
        }
        await done;
      }
    } finally {
      db.close();
    }
    if (n.book && data.extra && data.extra.book) ls.set(n.book, data.extra.book);
  }

  // The Eye, the way its own Restore does it: the shoots and journal into
  // localStorage (it tidies them up as it opens), the photos into its
  // database, key by key.
  const eyeOk = (part) => !!(part && part.state && Array.isArray(part.state.shoots));
  async function putBackEye(part) {
    if (!eyeOk(part)) throw new Error("The Eye's part of that file isn't right.");
    const db = await D.open(EYE_DB, 1, (made) => { if (!made.objectStoreNames.contains('images')) made.createObjectStore('images'); });
    try {
      const tx = db.transaction('images', 'readwrite');
      Object.entries(part.images || {}).forEach(([k, v]) => tx.objectStore('images').put(v, k));
      await new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = tx.onerror = () => no(tx.error || new Error("The Eye's photos weren't restored.")); });
    } finally {
      db.close();
    }
    localStorage.setItem(EYE_STATE, JSON.stringify(part.state)); // throws if it doesn't fit, and the restore says so
    if (part.state.presentation && part.state.presentation.color) ls.set('df-app-color', part.state.presentation.color);
  }

  // What a .json backup is: { all: true } for one of all four, or { app }
  // for one notebook's. Throws for anything else.
  async function readJson(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { throw new Error(NOT_A_BACKUP); }
    if (data && data.kind === 'suite-backup' && data.notebooks && typeof data.notebooks === 'object') return { data, all: true };
    const n = data && data.stores ? DBS.find((x) => x.db === data.database && BOOKS[x.id]) : null;
    if (n) return { data, app: n.id };
    if (eyeOk(data)) return { data, app: 'the-eye' };
    throw new Error(NOT_A_BACKUP);
  }
  const noPart = (app) => new Error(`That backup has nothing from ${BOOKS[app].name}.`);
  const otherBook = () => new Error('That file is a backup of a different notebook.');

  // A .json backup back in: all of it, or just `only`'s part (an app id)
  // with the other notebooks left as they are. Every part it puts back is
  // checked before anything is written.
  async function restoreJson(file, only) {
    const { data, all, app } = await readJson(file);
    if (!all) {
      if (only && only !== app) throw otherBook();
      if (app === 'the-eye') return putBackEye(data);
      return putBack(DBS.find((n) => n.id === app), data, await existing());
    }
    // Just one notebook: its databases' parts (The Eye's are its photos and
    // the boards sent to its shoots, as its own backup has them).
    const nb = data.notebooks;
    const dbs = DBS.filter((n) => nb[n.id] && (!only || BOOKS[only].dbs.includes(n.db)));
    const eye = (!only || only === 'the-eye') && nb['the-eye'];
    if (only && !(only === 'the-eye' ? eye : dbs.length)) throw noPart(only);
    for (const n of dbs) {
      if (!nb[n.id].stores || nb[n.id].database !== n.db) throw new Error(`The ${n.id} part of that file isn't right. Nothing was changed.`);
    }
    if (eye && !eyeOk(eye)) throw new Error("The Eye's part of that file isn't right. Nothing was changed.");
    const have = await existing();
    for (const n of dbs) await putBack(n, nb[n.id], have);
    if (eye) await putBackEye(eye);
  }

  // One notebook's part of a .json backup of all four, as a .json of its
  // own: what that notebook's own Restore reads.
  async function partFile(file, app) {
    const { data, all } = await readJson(file);
    const part = all ? data.notebooks[app] : null;
    if (!part) return file;
    return new File([JSON.stringify(part)], `${app}-backup.json`, { type: 'application/json' });
  }

  Object.assign(B, { existing, readJson, restoreJson, partFile, otherBook, noPart });
})();
