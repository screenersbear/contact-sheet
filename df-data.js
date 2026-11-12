// Documenting Fictions: the data helpers every notebook shares.
//
// The master copy is shared/df-data.js in the suite; tools/sync.py copies it
// into each notebook's folder as df-data.js, so a notebook copied out on its
// own still has it. Edit this one, then run the sync.
//
// Each notebook keeps its own database, named for it: ref-notebook,
// contact-sheet, the-eye's starky-moodboards (its photos; its shoots are in
// localStorage, dailies_state_v1) and overthoughts. What one notebook hands
// another (a Ref board sent to a shoot in The Eye) goes in a database of its
// own, df-links, as a link saying where it came from and where it went:
// { id, fromApp, fromId, toApp, toId, type, createdAt }. (The reflection
// helpers below are from before reflections stayed in The Eye; unused.)
(function () {
  'use strict';

  // ---------- IndexedDB, a little plainer ----------
  const ask = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const finish = (tx) => new Promise((ok, no) => {
    tx.oncomplete = () => ok();
    tx.onabort = tx.onerror = () => no(tx.error || new Error("That wasn't saved."));
  });
  function open(name, version, upgrade) {
    return new Promise((ok, no) => {
      const r = indexedDB.open(name, version);
      if (upgrade) r.onupgradeneeded = (e) => upgrade(r.result, e.oldVersion, r.transaction);
      r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); ok(db); };
      r.onerror = () => no(r.error);
      r.onblocked = () => no(new Error("Close this app's other tabs and try again."));
    });
  }
  // Every row of a store, with its key (stores with keys of their own and stores without).
  function rows(db, store) {
    return new Promise((ok, no) => {
      const out = [];
      const r = db.transaction(store).objectStore(store).openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) { ok(out); return; } out.push([c.key, c.value]); c.continue(); };
      r.onerror = () => no(r.error);
    });
  }
  const getOne = (db, store, key) => ask(db.transaction(store).objectStore(store).get(key));
  async function putMany(db, store, list) { // list of values, or [key, value] pairs for stores without a keyPath
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    list.forEach((v) => { if (os.keyPath) os.put(v); else os.put(v[1], v[0]); });
    return finish(tx);
  }
  async function deleteOne(db, store, key) { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); return finish(tx); }

  const hasText = (v) => typeof v === 'string' && v.trim() !== '';
  const nowIso = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  // ---------- Overthoughts' own database ----------
  const OT = 'overthoughts';
  let otOpening = null;
  function overthoughts() {
    if (!otOpening) {
      otOpening = open(OT, 1, (db) => {
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('kind', 'kind');
        entries.createIndex('shootId', 'shootId');
        db.createObjectStore('images'); // an entry's photos, keyed by its id: [{ src, caption }], as The Eye's Journal kept them
        db.createObjectStore('reviews', { keyPath: 'id' }); // 'month-2026-11', 'year-2026'
        const links = db.createObjectStore('links', { keyPath: 'id' });
        links.createIndex('from', ['fromApp', 'fromId']);
        links.createIndex('to', ['toApp', 'toId']);
      }).then((db) => {
        db.onclose = () => { otOpening = null; };
        return db;
      });
      otOpening.catch(() => { otOpening = null; });
    }
    return otOpening;
  }
  const linkId = (fromApp, fromId, toApp, toId) => `${fromApp}:${fromId}>${toApp}:${toId}`;
  const reflectionId = (shootId) => `reflection-${shootId}`;

  // ---------- A shoot's reflection, from The Eye ----------
  // `shoot` is The Eye's shoot; `name` how The Eye shows it. Every shoot that's
  // been shot gets an entry (an empty one waits for its reflection), so the
  // weekly log can list the week's shoots the way The Eye's Journal did.
  function reflectionFromShoot(shoot, name, was, at) {
    const base = was || {};
    return {
      ...base,
      id: reflectionId(shoot.id),
      kind: 'reflection',
      shootId: shoot.id,
      shootName: name || base.shootName || 'Untitled shoot',
      date: shoot.date || base.date || todayStr(),
      shootStatus: shoot.status || '',
      archived: !!shoot.archived,
      wentRight: shoot.whatWentRight || '',
      couldBeBetter: shoot.couldBeBetter || '',
      takeaway: shoot.lessonsLearned || '',
      tags: base.tags || [],
      from: 'the-eye',
      editedIn: 'the-eye',
      createdAt: base.createdAt || shoot.capturedAt || nowIso(),
      updatedAt: at || shoot.reflectionUpdatedAt || base.updatedAt || nowIso(),
    };
  }
  async function saveReflections(list) { // [{ shoot, name, at }]: at, when it was changed (now, from The Eye)
    if (!list.length) return;
    const db = await overthoughts();
    const before = new Map((await rows(db, 'entries')).filter(([, e]) => e.kind === 'reflection').map(([, e]) => [e.id, e]));
    const entries = [], links = [];
    list.forEach(({ shoot, name, at }) => {
      const e = reflectionFromShoot(shoot, name, before.get(reflectionId(shoot.id)), at);
      entries.push(e);
      links.push({ id: linkId('the-eye', shoot.id, OT, e.id), fromApp: 'the-eye', fromId: shoot.id, toApp: OT, toId: e.id, type: 'reflection', createdAt: (before.get(e.id) && before.get(e.id).createdAt) || nowIso() });
    });
    const tx = db.transaction(['entries', 'links'], 'readwrite');
    entries.forEach((e) => tx.objectStore('entries').put(e));
    links.forEach((l) => tx.objectStore('links').put(l));
    return finish(tx);
  }
  // A shoot deleted in The Eye: its entry goes too, unless something was
  // written in it (then it stays, as the only copy of those words).
  async function dropReflections(shootIds) {
    const db = await overthoughts();
    const ids = new Set(shootIds.map(reflectionId));
    const gone = (await rows(db, 'entries')).map(([, e]) => e)
      .filter((e) => ids.has(e.id) && !hasText(e.wentRight) && !hasText(e.couldBeBetter) && !hasText(e.takeaway));
    if (!gone.length) return;
    const links = (await rows(db, 'links')).map(([, l]) => l).filter((l) => gone.some((e) => e.id === l.toId));
    const tx = db.transaction(['entries', 'links'], 'readwrite');
    gone.forEach((e) => tx.objectStore('entries').delete(e.id));
    links.forEach((l) => tx.objectStore('links').delete(l.id));
    return finish(tx);
  }
  async function reflections() {
    const db = await overthoughts();
    return (await rows(db, 'entries')).map(([, e]) => e).filter((e) => e.kind === 'reflection');
  }

  // ---------- The Eye's own data, read from where it keeps it ----------
  const EYE_STATE = 'dailies_state_v1';
  const EYE_IDB = 'starky-moodboards';
  const openEyePhotos = () => open(EYE_IDB, 1, (db) => { if (!db.objectStoreNames.contains('images')) db.createObjectStore('images'); });
  function eyeState() {
    const raw = store.get(EYE_STATE);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  const eyeShootName = (s, mode) => {
    const t = (s.talents || []).find((x) => hasText(x.name));
    const talent = t ? t.name : '';
    return mode === 'title' ? (s.title || talent || 'Untitled shoot') : (talent || s.title || 'Untitled shoot');
  };
  // The same file The Eye's own "Back up all data" makes, so its Restore reads it.
  async function eyeBackupFile() {
    const state = eyeState();
    if (!state) return null;
    const db = await openEyePhotos();
    const images = Object.fromEntries(await rows(db, 'images'));
    db.close();
    const payload = { version: 1, exportedAt: nowIso(), state, images };
    return new File([JSON.stringify(payload)], `starky-backup-${todayStr()}.json`, { type: 'application/json' });
  }

  // The Eye's backup file (or the reflections file it saves for Overthoughts), read.
  async function readEyeFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't from The Eye."); }
    if (!data || !data.state || !Array.isArray(data.state.shoots)) throw new Error("That file isn't from The Eye.");
    return { state: data.state, images: data.images || {} };
  }

  // ---------- The Journal moves to Overthoughts (once) ----------
  // Copies, never moves: The Eye's own Journal and reflections stay where they
  // were (and in its backups). Nothing is marked done until every copy has
  // been read back and matches.
  const MOVED_KEY = 'overthoughts-journal-moved';
  const journalMoved = () => !!store.get(MOVED_KEY);
  function journalToMove(from) {
    const st = from ? from.state : eyeState();
    if (!st) return { entries: [], shoots: [], state: null };
    const entries = (Array.isArray(st.journalEntries) ? st.journalEntries : []).filter((e) => e && e.id && !e.sourceShootId);
    const post = ['captured', 'waiting_for_selects', 'editing', 'rough_cut', 'client_review', 'revisions', 'delivered'];
    const shoots = (Array.isArray(st.shoots) ? st.shoots : []).filter((s) => s && s.id && (post.includes(s.status) || hasText(s.whatWentRight) || hasText(s.couldBeBetter) || hasText(s.lessonsLearned)));
    return { entries, shoots, state: st };
  }
  const somethingToMove = () => { const m = journalToMove(); return m.entries.length + m.shoots.length > 0; };
  function freeFromJournal(e) {
    const day = /^\d{4}-\d{2}-\d{2}/.test(e.createdAt || '') ? e.createdAt.slice(0, 10) : todayStr();
    return {
      id: e.id, kind: 'free', date: day, title: e.title || '', body: e.body || '', tags: Array.isArray(e.tags) ? e.tags : [],
      takeaway: '', shootId: null, from: 'the-eye', createdAt: e.createdAt || nowIso(), updatedAt: e.updatedAt || e.createdAt || nowIso(),
    };
  }
  // `from`: The Eye's backup file, read ({ state, images }), for a copy of
  // Overthoughts that isn't beside The Eye. Can be brought in more than once:
  // nothing already here is ever written over.
  async function moveJournal(from) {
    if (!from && journalMoved()) return { already: true };
    const { entries, shoots, state } = journalToMove(from);
    const db = await overthoughts();
    const have = new Map((await rows(db, 'entries')).map(([, e]) => [e.id, e]));
    // Photos on the Journal's entries.
    let photos = [];
    if (entries.length && from) {
      photos = entries.map((e) => [e.id, (from.images || {})[`${e.id}__journal`]]).filter(([, v]) => Array.isArray(v) && v.length);
    } else if (entries.length) {
      const eye = await openEyePhotos();
      photos = (await Promise.all(entries.map(async (e) => [e.id, await getOne(eye, 'images', `${e.id}__journal`)]))).filter(([, v]) => Array.isArray(v) && v.length);
      eye.close();
    }
    const free = entries.filter((e) => !have.has(e.id)).map(freeFromJournal); // a second run never overwrites what's been written since
    const tx = db.transaction(['entries', 'images', 'links'], 'readwrite');
    free.forEach((e) => tx.objectStore('entries').put(e));
    photos.filter(([id]) => !have.has(id)).forEach(([id, v]) => tx.objectStore('images').put(v, id));
    await finish(tx);
    await saveReflections(shoots.filter((s) => !have.has(reflectionId(s.id))).map((s) => ({ shoot: s, name: eyeShootName(s, state && state.titleDisplayMode) })));
    // Read it all back before calling it done.
    const after = new Map((await rows(db, 'entries')).map(([, e]) => [e.id, e]));
    const pics = new Map(await rows(db, 'images'));
    const wrong = [];
    entries.forEach((e) => {
      const got = after.get(e.id);
      if (!got || (!have.has(e.id) && (got.body !== (e.body || '') || got.title !== (e.title || '')))) wrong.push(e.id);
    });
    photos.forEach(([id, v]) => { if (!have.has(id) && (!pics.has(id) || pics.get(id).length !== v.length)) wrong.push(id); });
    shoots.forEach((s) => {
      const got = after.get(reflectionId(s.id));
      if (!got || (!have.has(got.id) && (got.takeaway !== (s.lessonsLearned || '') || got.wentRight !== (s.whatWentRight || '') || got.couldBeBetter !== (s.couldBeBetter || '')))) wrong.push(s.id);
    });
    if (wrong.length) throw new Error(`${wrong.length} of them didn't copy over properly, so nothing was marked as moved. The Eye still has all of it.`);
    if (!from) store.set(MOVED_KEY, nowIso());
    return { entries: entries.length, reflections: shoots.filter((s) => hasText(s.whatWentRight) || hasText(s.couldBeBetter) || hasText(s.lessonsLearned)).length };
  }

  // ---------- A whole database as one file, and back ----------
  // Photos (Blobs) go in as data URLs, so the file is plain JSON. Built in
  // pieces, so a big notebook never has to be one string in memory.
  const blobToDataUrl = (b) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(b); });
  async function pack(v) {
    if (v instanceof Blob) return { __blob: await blobToDataUrl(v), type: v.type, name: v.name || undefined, lastModified: v.lastModified || undefined };
    if (v instanceof ArrayBuffer) return { __buf: await blobToDataUrl(new Blob([v])) };
    if (ArrayBuffer.isView(v)) return { __view: v.constructor.name, __buf: await blobToDataUrl(new Blob([v])) };
    if (v instanceof Date) return { __date: v.toISOString() };
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await pack(x)); return out; }
    if (v && typeof v === 'object') { const out = {}; for (const k of Object.keys(v)) out[k] = await pack(v[k]); return out; }
    return v;
  }
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
  // `extra` rides along (small things kept in localStorage, say).
  async function exportDb(dbName, { app, filename, extra } = {}) {
    const db = await open(dbName);
    const parts = [`{"app":${JSON.stringify(app || dbName)},"database":${JSON.stringify(dbName)},"version":${db.version},"exportedAt":${JSON.stringify(nowIso())},"extra":${JSON.stringify(extra || {})},"stores":{`];
    const names = [...db.objectStoreNames];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const os = db.transaction(name).objectStore(name);
      const meta = { keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes: [...os.indexNames].map((n) => { const ix = os.index(n); return { name: n, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry }; }) };
      parts.push(`${i ? ',' : ''}${JSON.stringify(name)}:{"meta":${JSON.stringify(meta)},"rows":[`);
      const list = await rows(db, name);
      for (let j = 0; j < list.length; j++) parts.push(`${j ? ',' : ''}${JSON.stringify([await pack(list[j][0]), await pack(list[j][1])])}`);
      parts.push(']}');
    }
    parts.push('}}');
    db.close();
    return new File(parts, filename || `${app || dbName}-${todayStr()}.json`, { type: 'application/json' });
  }
  // Puts everything in a file made by exportDb back. `replace` clears each
  // store first; otherwise rows are added over what's there (same key, file wins).
  async function importDb(file, dbName, { replace = true, app } = {}) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't a notebook backup."); }
    if (!data || !data.stores || (app && data.app !== app) || data.database !== dbName) throw new Error('That file is a backup of a different notebook.');
    const db = await open(dbName);
    const names = Object.keys(data.stores).filter((n) => db.objectStoreNames.contains(n));
    const unpacked = {};
    for (const n of names) {
      unpacked[n] = [];
      for (const [k, v] of data.stores[n].rows) unpacked[n].push([await unpack(k), await unpack(v)]);
    }
    const tx = db.transaction(names, 'readwrite');
    names.forEach((n) => {
      const os = tx.objectStore(n);
      if (replace) os.clear();
      unpacked[n].forEach(([k, v]) => { if (os.keyPath) os.put(v); else os.put(v, k); });
    });
    await finish(tx);
    db.close();
    return { extra: data.extra || {}, counts: Object.fromEntries(names.map((n) => [n, unpacked[n].length])) };
  }

  // ---------- A notebook as a zip, and back ----------
  // The backups the notebooks make now (and the shelf's, of all four): a
  // plain .zip the phone never holds in memory. backup.json says what's in
  // every store, and each photo goes in as a file of its own:
  //   { format: 'df-backup', version: 1, app, kind ('notebook' or 'suite'), exportedAt, extra,
  //     databases: { [name]: { version, stores: { [store]: { meta, rows: [[key, value]] } } } },
  //     local: { [localStorage key]: text } }
  // In a row, a photo is { __file: 'files/000012', as, ... }: as 'blob' (with
  // type, name, lastModified), 'buf', 'view' (with view, the typed array's
  // name) or 'text' (a long string, like The Eye's photos). Photos stored as
  // Blobs go in as they are: they're on disk already. Ones kept as bytes or
  // text are first put in a scratch database of the backup's own, a few at a
  // time, so they're on disk too when the zip is put together from them.
  // Safari keeps whatever it has read of a Blob in memory for as long as that
  // Blob is kept, so a photo's checksum is worked out from a second copy of
  // its row, read and let go, and the zip is made of copies never read.
  // A phone hands a file over through the share sheet, which reads all of it
  // into memory (three times over, in Safari), so there a big backup is made
  // as a few files of PART at most, saved one tap each; each has part.json
  // ({ format: 'df-backup-part', id, part, of }), the first has backup.json
  // too (parts: { id, of }), and they're picked together to restore.
  // Restoring, each photo is copied out of the zip a few MB at a time and
  // they go in a few at a time. Contact Sheet's first zips (format
  // 'contact-sheet-backup', one database) read the same way. Backups made the
  // first way (one .json, exportDb above) still go back in with importDb.
  const ZIP = { format: 'df-backup', version: 1 };
  const MANIFEST = 'backup.json';
  const CHUNK = 4 * 1024 * 1024; // read and copied this much at a time
  const BATCH = 24 * 1024 * 1024; // stored this much at a time
  const PAGE = 10; // rows read at a time
  const BIG_TEXT = 64 * 1024; // a string longer than this goes in as a file
  const MAX32 = 0xffffffff; // the mark for "in the zip64 extra instead"
  const ZIP_LIMIT = MAX32; // sizes and places from here on need zip64
  const SCRATCH = 'df-backup-scratch-';
  const PART = 200 * 1024 * 1024; // the most a phone is handed at once
  const PART_NAME = 'part.json';

  const dbNames = async () => (indexedDB.databases ? new Set((await indexedDB.databases()).map((d) => d.name)) : null);
  const dropDb = (name) => new Promise((ok) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => ok(); });

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  // Read as a stream, a little at a time, so what's been read is let go of
  // as it goes (pieces read as slices piled up before they were freed).
  const crcAdd = (c, bytes) => { for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return c; };
  const crcBytes = (bytes) => (crcAdd(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
  async function crcOf(blob, onBytes = () => {}) {
    let c = 0xffffffff;
    const eat = (bytes) => {
      c = crcAdd(c, bytes);
      onBytes(bytes.length);
    };
    if (typeof blob.stream === 'function') {
      const reader = blob.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        eat(value);
      }
    } else {
      for (let at = 0; at < blob.size; at += CHUNK) eat(new Uint8Array(await blob.slice(at, at + CHUNK).arrayBuffer()));
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  // 64-bit numbers as two halves (sizes past 4 GB need them).
  const set64 = (dv, at, n) => { dv.setUint32(at, n % 0x100000000, true); dv.setUint32(at + 4, Math.floor(n / 0x100000000), true); };
  const get64 = (dv, at) => dv.getUint32(at, true) + dv.getUint32(at + 4, true) * 0x100000000;

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // entries: [{ name, blob }], stored as they are. The Blob that comes back is
  // made of the entries' own Blobs.
  async function zipOf(entries, onBytes) {
    const enc = new TextEncoder();
    const { time, date } = dosTime(new Date());
    const parts = [];
    const central = [];
    let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.name);
      const size = e.blob.size;
      const crc = e.crc != null ? e.crc : await crcOf(e.blob, onBytes);
      const big = size >= ZIP_LIMIT;
      const far = offset >= ZIP_LIMIT;
      const local = new DataView(new ArrayBuffer(30 + (big ? 20 : 0)));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, big ? 45 : 20, true);
      local.setUint16(6, 0x0800, true); // names are UTF-8
      local.setUint16(8, 0, true); // stored
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, big ? MAX32 : size, true);
      local.setUint32(22, big ? MAX32 : size, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, big ? 20 : 0, true);
      if (big) {
        local.setUint16(30, 0x0001, true);
        local.setUint16(32, 16, true);
        set64(local, 34, size);
        set64(local, 42, size);
      }
      // The local header's name goes after its fixed part, before the extra.
      const fixed = new Uint8Array(local.buffer, 0, 30);
      const extra = new Uint8Array(local.buffer, 30);
      parts.push(fixed, name, extra, e.blob);

      const wide = big || far;
      const cen = new DataView(new ArrayBuffer(46 + (wide ? 28 : 0)));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, wide ? 45 : 20, true);
      cen.setUint16(6, wide ? 45 : 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, time, true);
      cen.setUint16(14, date, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, wide ? MAX32 : size, true);
      cen.setUint32(24, wide ? MAX32 : size, true);
      cen.setUint16(28, name.length, true);
      cen.setUint16(30, wide ? 28 : 0, true);
      cen.setUint32(42, wide ? MAX32 : offset, true);
      if (wide) {
        cen.setUint16(46, 0x0001, true);
        cen.setUint16(48, 24, true);
        set64(cen, 50, size);
        set64(cen, 58, size);
        set64(cen, 66, offset);
      }
      central.push(new Uint8Array(cen.buffer, 0, 46), name, new Uint8Array(cen.buffer, 46));
      offset += 30 + name.length + extra.length + size;
    }
    const cenSize = central.reduce((n, p) => n + p.byteLength, 0);
    const tail = [];
    if (offset >= ZIP_LIMIT || cenSize >= ZIP_LIMIT || entries.length >= 0xffff) {
      const z = new DataView(new ArrayBuffer(56 + 20));
      z.setUint32(0, 0x06064b50, true);
      set64(z, 4, 44);
      z.setUint16(12, 45, true);
      z.setUint16(14, 45, true);
      set64(z, 24, entries.length);
      set64(z, 32, entries.length);
      set64(z, 40, cenSize);
      set64(z, 48, offset);
      z.setUint32(56, 0x07064b50, true);
      set64(z, 64, offset + cenSize);
      z.setUint32(72, 1, true);
      tail.push(z);
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, Math.min(entries.length, 0xffff), true);
    end.setUint16(10, Math.min(entries.length, 0xffff), true);
    end.setUint32(12, Math.min(cenSize, MAX32), true);
    end.setUint32(16, Math.min(offset, MAX32), true);
    tail.push(end);
    return new Blob([...parts, ...central, ...tail], { type: 'application/zip' });
  }

  // The files in a zip, read from its end; each is cut out of `file` when asked for.
  async function readZip(file) {
    const view = async (at, n) => new DataView(await file.slice(at, at + n).arrayBuffer());
    const tailLen = Math.min(file.size, 22 + 0xffff);
    const tail = await view(file.size - tailLen, tailLen);
    let e = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("That file isn't a notebook backup.");
    let count = tail.getUint16(e + 10, true);
    let cenSize = tail.getUint32(e + 12, true);
    let cenAt = tail.getUint32(e + 16, true);
    if ((count === 0xffff || cenSize === MAX32 || cenAt === MAX32) && e >= 20 && tail.getUint32(e - 20, true) === 0x07064b50) {
      const z = await view(get64(tail, e - 20 + 8), 56);
      count = get64(z, 32);
      cenSize = get64(z, 40);
      cenAt = get64(z, 48);
    }
    const cen = await view(cenAt, cenSize);
    const dec = new TextDecoder();
    const byName = new Map();
    for (let p = 0, i = 0; i < count && p + 46 <= cenSize; i++) {
      if (cen.getUint32(p, true) !== 0x02014b50) break;
      const method = cen.getUint16(p + 10, true);
      let packed = cen.getUint32(p + 20, true);
      let size = cen.getUint32(p + 24, true);
      const nameLen = cen.getUint16(p + 28, true);
      const extraLen = cen.getUint16(p + 30, true);
      const noteLen = cen.getUint16(p + 32, true);
      let at = cen.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cen.buffer, cen.byteOffset + p + 46, nameLen));
      // Zip64: the sizes and place that didn't fit, in this order.
      for (let x = p + 46 + nameLen; x + 4 <= p + 46 + nameLen + extraLen;) {
        const id = cen.getUint16(x, true);
        const len = cen.getUint16(x + 2, true);
        if (id === 0x0001) {
          let y = x + 4;
          if (size === MAX32) { size = get64(cen, y); y += 8; }
          if (packed === MAX32) { packed = get64(cen, y); y += 8; }
          if (at === MAX32) { at = get64(cen, y); }
        }
        x += 4 + len;
      }
      byName.set(name, { method, packed, size, at });
      p += 46 + nameLen + extraLen + noteLen;
    }
    return {
      has: (name) => byName.has(name),
      async get(name) {
        const f = byName.get(name);
        if (!f) throw new Error('Part of that backup is missing.');
        const head = await view(f.at, 30);
        const start = f.at + 30 + head.getUint16(26, true) + head.getUint16(28, true);
        const part = file.slice(start, start + f.packed);
        if (f.method === 0) return part;
        // Zipped up again somewhere, squeezed: opened up as it's read.
        if (f.method === 8 && typeof DecompressionStream === 'function') return new Response(part.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
        throw new Error("That backup was changed after it was saved and can't be read.");
      },
    };
  }

  // Where a backup keeps its photos made of bytes or text until the zip is
  // saved: entries wait here in memory until there's a batch, then they're
  // stored, and once they all are, swapped for the stored copies (files on
  // disk). Not straight after each batch: in Safari a copy read back as soon
  // as it's written keeps its bytes in memory (750 MB for 960 MB of photos;
  // read back at the end, nothing).
  function scratch() {
    const name = `${SCRATCH}${Date.now()}-${uid().slice(0, 8)}`;
    let db = null;
    let waiting = [];
    let size = 0;
    let stored = [];
    const flush = async () => {
      if (!waiting.length) return;
      if (!db) db = await open(name, 1, (d) => d.createObjectStore('f'));
      const list = waiting;
      waiting = [];
      size = 0;
      const tx = db.transaction('f', 'readwrite');
      list.forEach((e) => tx.objectStore('f').put(e.blob, e.name));
      await finish(tx);
      list.forEach((e) => { e.size = e.blob.size; e.blob = null; });
      stored = stored.concat(list);
    };
    return {
      add(e) { waiting.push(e); size += e.blob.size; },
      full: () => size >= BATCH,
      flush,
      // Everything stored, then the stored copies in.
      async readBack() {
        await flush();
        for (let i = 0; i < stored.length; i += PAGE) {
          const read = db.transaction('f').objectStore('f');
          const list = stored.slice(i, i + PAGE);
          const got = await Promise.all(list.map((e) => ask(read.get(e.name))));
          list.forEach((e, j) => {
            if (!(got[j] instanceof Blob) || got[j].size !== e.size) throw new Error("The backup couldn't be put together. Try again.");
            e.blob = got[j];
          });
        }
        stored = [];
      },
      async drop() { if (db) db.close(); db = null; await dropDb(name); },
    };
  }
  // Scratch left by a backup that never finished (the app was closed), an hour on.
  async function sweepScratch() {
    const names = await dbNames().catch(() => null);
    if (!names) return;
    for (const n of names) {
      const m = typeof n === 'string' && n.startsWith(SCRATCH) ? /^(\d+)-/.exec(n.slice(SCRATCH.length)) : null;
      if (m && Date.now() - Number(m[1]) > 3600000) dropDb(n);
    }
  }

  // Values into backup.json, the photos in them set aside as files, each
  // with its checksum. w is the same value read a second time: a Blob's
  // checksum is read from that copy (see above).
  function zipPacker(files, spare) {
    const put = (blob, crc, as, more) => {
      const e = { name: `files/${String(files.length).padStart(6, '0')}`, blob, crc };
      files.push(e);
      if (as !== 'blob') spare.add(e);
      return { __file: e.name, as, ...more };
    };
    const pack = async (v, w) => {
      if (v instanceof Blob) return put(v, await crcOf(w instanceof Blob && w.size === v.size ? w : v), 'blob', { type: v.type || '', name: v.name || undefined, lastModified: v.lastModified || undefined });
      if (v instanceof ArrayBuffer) return put(new Blob([v]), crcBytes(new Uint8Array(v)), 'buf');
      if (ArrayBuffer.isView(v)) { const u = new Uint8Array(v.buffer, v.byteOffset, v.byteLength); return put(new Blob([u]), crcBytes(u), 'view', { view: v.constructor.name }); }
      if (typeof v === 'string' && v.length > BIG_TEXT) { const u = new TextEncoder().encode(v); return put(new Blob([u], { type: 'text/plain' }), crcBytes(u), 'text'); }
      if (v instanceof Date) return { __date: v.toISOString() };
      if (Array.isArray(v)) { const out = []; for (let i = 0; i < v.length; i++) out.push(await pack(v[i], Array.isArray(w) ? w[i] : undefined)); return out; }
      if (v && typeof v === 'object') { const out = {}; for (const k of Object.keys(v)) out[k] = await pack(v[k], w && typeof w === 'object' ? w[k] : undefined); return out; }
      return v;
    };
    return pack;
  }
  async function rowCount(dbName) {
    const db = await open(dbName);
    try {
      let n = 0;
      for (const s of [...db.objectStoreNames]) n += await ask(db.transaction(s).objectStore(s).count());
      return n;
    } finally {
      db.close();
    }
  }
  const hasBlob = (v) => v instanceof Blob || (Array.isArray(v) ? v.some(hasBlob) : !!v && typeof v === 'object' && !(v instanceof ArrayBuffer) && !ArrayBuffer.isView(v) && !(v instanceof Date) && Object.values(v).some(hasBlob));
  // One database's stores and rows, read a few rows at a time (rows with
  // photos stored as files twice: one copy for the zip, one to read the
  // checksums from).
  async function zipDb(dbName, pack, spare, onRow) {
    const db = await open(dbName);
    try {
      const out = { version: db.version, stores: {} };
      for (const s of [...db.objectStoreNames]) {
        const os = db.transaction(s).objectStore(s);
        const meta = { keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes: [...os.indexNames].map((n) => { const ix = os.index(n); return { name: n, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry }; }) };
        const list = [];
        let range = null;
        for (;;) {
          const page = db.transaction(s).objectStore(s);
          const [keys, vals] = await Promise.all([ask(page.getAllKeys(range, PAGE)), ask(page.getAll(range, PAGE))]);
          let twins = [];
          if (vals.some(hasBlob)) {
            const again = db.transaction(s).objectStore(s);
            const [k2, v2] = await Promise.all([ask(again.getAllKeys(range, PAGE)), ask(again.getAll(range, PAGE))]);
            if (k2.length === keys.length && k2.every((k, i) => indexedDB.cmp(k, keys[i]) === 0)) twins = v2; // the same rows (or no twins: checksums from the copy itself)
          }
          for (let i = 0; i < keys.length; i++) { list.push([await pack(keys[i]), await pack(vals[i], twins[i])]); onRow(); }
          if (spare.full()) await spare.flush();
          if (keys.length < PAGE) break;
          range = IDBKeyRange.lowerBound(keys[keys.length - 1], true);
        }
        out.stores[s] = { meta, rows: list };
      }
      return out;
    } finally {
      db.close();
    }
  }
  // A phone hands files over through the share sheet; elsewhere they're
  // downloaded (read a little at a time, so a backup can be one file).
  function handsOverByShare() {
    try {
      return !!(navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [new File([''], 'backup.zip', { type: 'application/zip' })] }));
    } catch (e) {
      return false;
    }
  }
  const sizeText = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.max(1, Math.round(n / 1e6))} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

  // The backup: { parts (Files), size, release(i), done }, or null when
  // there's nothing to back up. One part, unless it's to be handed to a
  // phone's share sheet and is bigger than PART. release(i) once part i is
  // saved; done() once they all are, or the backup's given up on: two
  // minutes on (a download may still be reading it), the scratch is cleared.
  // `databases` that aren't on this device are left out (opening one would
  // make it); `local` is localStorage keys to bring along. onProgress(0..1)
  // while the rows are read, the long part.
  async function zipBackup({ app, kind = 'notebook', databases = [], local = [], extra = {}, filename, partSize = handsOverByShare() ? PART : Infinity, onProgress = () => {} } = {}) {
    sweepScratch();
    const files = [];
    const spare = scratch();
    try {
      const have = await dbNames();
      const use = databases.filter((n) => !have || have.has(n));
      let total = 0;
      for (const n of use) total += await rowCount(n);
      let did = 0;
      const pack = zipPacker(files, spare);
      const dbs = {};
      for (const n of use) dbs[n] = await zipDb(n, pack, spare, () => onProgress(Math.min(1, ++did / (total || 1))));
      const loc = {};
      for (const k of local) {
        let v = null;
        try { v = localStorage.getItem(k); } catch (e) { /* private mode */ }
        if (v != null) loc[k] = await pack(v);
      }
      if (!Object.keys(dbs).length && !Object.keys(loc).length) { await spare.drop(); return null; }
      await spare.readBack();
      // Into parts of partSize at most (a photo bigger than that gets one of its own).
      const groups = [[]];
      let size = 0;
      for (const e of files) {
        const last = groups[groups.length - 1];
        if (last.length && size + e.blob.size > partSize) { groups.push([e]); size = e.blob.size; } else { last.push(e); size += e.blob.size; }
      }
      const of = groups.length;
      const id = uid();
      const manifest = { ...ZIP, app, kind, exportedAt: nowIso(), extra, parts: { id, of }, databases: dbs, local: loc };
      const json = (o) => { const u = new TextEncoder().encode(JSON.stringify(o)); return { blob: new Blob([u], { type: 'application/json' }), crc: crcBytes(u) }; };
      const base = (filename || `${app}-backup-${todayStr()}.zip`).replace(/\.zip$/i, '');
      const parts = [];
      for (let i = 0; i < of; i++) {
        const head = [{ name: PART_NAME, ...json({ format: 'df-backup-part', id, part: i + 1, of }) }];
        if (i === 0) head.unshift({ name: MANIFEST, ...json(manifest) });
        parts.push(new File([await zipOf([...head, ...groups[i]])], of === 1 ? `${base}.zip` : `${base} (${i + 1} of ${of}).zip`, { type: 'application/zip' }));
      }
      return {
        parts,
        size: parts.reduce((n, f) => n + f.size, 0),
        release(i) { parts[i] = null; groups[i].forEach((e) => { e.blob = null; }); },
        done: (wait = 120000) => new Promise((ok) => setTimeout(() => spare.drop().then(ok), wait)),
      };
    } catch (err) {
      await spare.drop();
      throw err;
    }
  }
  // Handing a backup over, a file a tap: { label, note, tap() } for the
  // button and the line above it. tap() resolves true once the last file's
  // been saved (false if that one was cancelled or there are more to go).
  function backupSteps(made) {
    const n = made.parts.length;
    const share = handsOverByShare();
    let next = 0;
    return {
      get label() { return n === 1 ? 'Save the backup' : `Save file ${Math.min(next + 1, n)} of ${n}`; },
      note: n === 1 ? `Ready: ${sizeText(made.size)}.` : `Ready: ${sizeText(made.size)}, in ${n} files. Save all ${n} to the same place: they go back in together.`,
      async tap() {
        if (next >= n) return true;
        const how = await saveFile(made.parts[next], { share });
        if (how === 'cancelled') return false;
        made.release(next);
        next += 1;
        return next >= n;
      },
    };
  }

  // True for a zip (a backup made by zipBackup); the first kind is JSON.
  async function isZipFile(file) {
    const b = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  }
  // A backup opened (its one zip, or all the files it was saved as), and
  // checked before anything is changed: what kind it is, and every file it
  // names there.
  async function openBackupZip(input) {
    const bad = () => new Error("That file isn't a notebook backup.");
    const zips = [];
    for (const f of Array.isArray(input) ? input : [input]) {
      try { zips.push(await readZip(f)); } catch (e) { throw bad(); }
    }
    const head = zips.find((z) => z.has(MANIFEST));
    const partOf = async (z) => { try { return JSON.parse(await (await z.get(PART_NAME)).text()); } catch (e) { return null; } };
    if (!head) {
      const p = zips.length && zips[0].has(PART_NAME) ? await partOf(zips[0]) : null;
      if (p && p.of > 1) throw new Error(`That backup is in ${p.of} files, and the first one wasn't picked. Pick all ${p.of} together.`);
      throw bad();
    }
    let m;
    try { m = JSON.parse(await (await head.get(MANIFEST)).text()); } catch (e) { throw bad(); }
    if (m && m.format === 'contact-sheet-backup' && m.database && m.stores) {
      m = { ...ZIP, app: m.app || 'contact-sheet', kind: 'notebook', exportedAt: m.exportedAt, extra: m.extra || {}, databases: { [m.database]: { version: m.version, stores: m.stores } }, local: {} };
    }
    if (!m || m.format !== ZIP.format || !m.databases) throw bad();
    if (m.version > ZIP.version) throw new Error('That backup was made by a newer version of the notebooks. Update this app, then try again.');
    let use = [head];
    const of = (m.parts && m.parts.of) || 1;
    if (of > 1) {
      const got = new Map();
      for (const z of zips) {
        const p = z.has(PART_NAME) ? await partOf(z) : null;
        if (p && p.id === m.parts.id) got.set(p.part, z);
      }
      if (got.size < of) throw new Error(`That backup is in ${of} files, and ${got.size} of them ${got.size === 1 ? 'was' : 'were'} picked. Pick all ${of} together.`);
      use = [...got.values()];
    }
    const zip = { has: (n) => use.some((z) => z.has(n)), get: (n) => (use.find((z) => z.has(n)) || head).get(n) };
    const names = [];
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') { if (typeof v.__file === 'string') names.push(v.__file); else Object.values(v).forEach(walk); }
    };
    walk(m.databases);
    walk(m.local || {});
    if (names.some((n) => !zip.has(n))) throw new Error('Part of that backup is missing, so nothing was changed.');
    return { manifest: m, zip };
  }
  // Safari keeps only which file a stored Blob came from, not which piece of
  // it: a piece of the backup stored as it is comes back as the start of the
  // whole backup. So each photo is copied out first, a few MB at a time, and
  // only the copy is stored.
  async function copiedOut(part, v) {
    const chunks = [];
    for (let at = 0; at < part.size; at += CHUNK) chunks.push(new Blob([await part.slice(at, at + CHUNK).arrayBuffer()]));
    const type = v.type || '';
    return v.name != null ? new File(chunks, v.name, { type, lastModified: v.lastModified || Date.now() }) : new Blob(chunks, { type });
  }
  // A value out of backup.json, its photos read out of the zip. `sizes.n`
  // adds up how much was read.
  async function unzipValue(v, zip, sizes) {
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await unzipValue(x, zip, sizes)); return out; }
    if (v && typeof v === 'object') {
      if (typeof v.__file === 'string') {
        const part = await zip.get(v.__file);
        sizes.n += part.size;
        const as = v.as || (v.buf ? 'buf' : v.view ? 'view' : 'blob');
        if (as === 'text') return part.text();
        if (as === 'buf' || as === 'view') {
          const buf = await part.arrayBuffer();
          return as === 'view' && typeof self[v.view] === 'function' ? new self[v.view](buf) : buf;
        }
        return copiedOut(part, v);
      }
      if (typeof v.__date === 'string') return new Date(v.__date);
      const out = {};
      for (const k of Object.keys(v)) out[k] = await unzipValue(v[k], zip, sizes);
      return out;
    }
    return v;
  }
  const keyText = (k) => JSON.stringify(k instanceof Date ? { d: k.getTime() } : k);
  const atPath = (v, p) => p.split('.').reduce((o, f) => (o == null ? o : o[f]), v);
  // One database swapped for its part of the backup. Rows go in a few at a
  // time over what's there; once they're all in, whatever the backup doesn't
  // have is taken out. A database this device doesn't have yet is made as
  // the backup says it was.
  async function unzipDb(b, dbName, onRow) {
    const part = b.manifest.databases[dbName];
    const have = await dbNames();
    const fresh = have ? !have.has(dbName) : false;
    const db = await open(dbName, fresh ? part.version || 1 : undefined, fresh ? (made) => {
      for (const [name, s] of Object.entries(part.stores)) {
        if (made.objectStoreNames.contains(name)) continue;
        const m = s.meta || {};
        const os = made.createObjectStore(name, m.keyPath == null ? { autoIncrement: !!m.autoIncrement } : { keyPath: m.keyPath, autoIncrement: !!m.autoIncrement });
        (m.indexes || []).forEach((ix) => os.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique, multiEntry: !!ix.multiEntry }));
      }
    } : null);
    try {
      const names = Object.keys(part.stores).filter((n) => db.objectStoreNames.contains(n));
      const keep = {};
      for (const n of names) {
        keep[n] = new Set();
        const keyPath = db.transaction(n).objectStore(n).keyPath;
        const keyOf = (k, v) => (keyPath == null ? k : Array.isArray(keyPath) ? keyPath.map((p) => atPath(v, p)) : atPath(v, keyPath));
        let batch = [];
        const sizes = { n: 0 };
        const write = async () => {
          const tx = db.transaction(n, 'readwrite');
          const os = tx.objectStore(n);
          batch.forEach(([k, v]) => { if (keyPath == null) os.put(v, k); else os.put(v); });
          await finish(tx);
          batch = [];
          sizes.n = 0;
        };
        for (const [pk, pv] of part.stores[n].rows || []) {
          const k = await unzipValue(pk, b.zip, sizes);
          const v = await unzipValue(pv, b.zip, sizes);
          keep[n].add(keyText(keyOf(k, v)));
          batch.push([k, v]);
          if (sizes.n >= BATCH || batch.length >= 40) await write();
          onRow();
        }
        if (batch.length) await write();
      }
      for (const n of names) {
        const keys = await ask(db.transaction(n).objectStore(n).getAllKeys());
        const gone = keys.filter((k) => !keep[n].has(keyText(k)));
        if (!gone.length) continue;
        const tx = db.transaction(n, 'readwrite');
        gone.forEach((k) => tx.objectStore(n).delete(k));
        await finish(tx);
      }
      return Object.fromEntries(names.map((n) => [n, (part.stores[n].rows || []).length]));
    } finally {
      db.close();
    }
  }
  // Puts `databases` back from a backup (a zip, or all of the files it was
  // saved as: `file` can be a list; the ones it has; none of them
  // is an error, unless `kind` says which backup it has to be). Resolves
  // with { manifest, extra, counts, local(key) }, local(key) the text kept
  // for that localStorage key, or null. check(local), when given, runs
  // before anything is changed and throws if the file won't do. If it stops
  // partway, restoring again finishes it.
  async function restoreZip(file, { databases = [], kind, check, onProgress = () => {} } = {}) {
    const b = await openBackupZip(file);
    if (kind && b.manifest.kind !== kind) throw new Error(kind === 'suite' ? "That file isn't a backup of all four. A single notebook's backup goes back in from that notebook's options." : 'That file is a backup of a different notebook.');
    const want = databases.filter((n) => b.manifest.databases[n]);
    if (!want.length && !kind) throw new Error('That file is a backup of a different notebook.');
    const local = async (key) => {
      const v = (b.manifest.local || {})[key];
      return v == null ? null : typeof v === 'string' ? v : unzipValue(v, b.zip, { n: 0 });
    };
    if (check) await check(local);
    const rowsIn = (n) => Object.values(b.manifest.databases[n].stores).reduce((m, s) => m + (s.rows || []).length, 0);
    const total = want.reduce((n, d) => n + rowsIn(d), 0) || 1;
    let did = 0;
    const counts = {};
    try {
      for (const n of want) counts[n] = await unzipDb(b, n, () => onProgress(++did / total));
    } catch (err) {
      console.error(err);
      throw new Error("The backup didn't all go in. Restore it again to finish it.");
    }
    return { manifest: b.manifest, extra: b.manifest.extra || {}, counts, local };
  }

  // ---------- Links: a Ref board sent to a shoot in The Eye ----------
  // Its own database, df-links, so neither notebook writes into the other's:
  //   links     { id, fromApp, fromId, toApp, toId, type, createdAt, updatedAt,
  //               name, pageCount, photoCount, drawnAt, drawnOf, frozenAt, importedAt, pending }
  //   pictures  (key: the link's id) { cover, pages: [...] }, each { type, bytes }
  // A board on a shoot: type 'moodboard', from 'ref' (the board's id) to
  // 'the-eye' (the shoot's id). Its pages are kept as pictures (drawnAt: when
  // they were made). Ref draws them again while the shoot is still to come;
  // once the shoot is shot The Eye sets frozenAt and they never change again.
  // A board that came in as a file (importedAt) is fixed from the start.
  // drawnOf: a key of how the board looked when drawn (Ref's to compare);
  // pending: Ref's + New shoot from this board, until The Eye makes the shoot.
  // Pictures are kept as bytes, not Blobs: Safari's stored Blobs break when
  // a record is saved again.
  const LINKS = 'df-links';
  const openLinks = () => open(LINKS, 1, (db) => {
    if (!db.objectStoreNames.contains('links')) db.createObjectStore('links', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('pictures')) db.createObjectStore('pictures');
  });
  async function withLinks(fn) {
    const db = await openLinks();
    try { return await fn(db); } finally { db.close(); }
  }
  // Every link matching all of the fields given, e.g. { toApp: 'the-eye', toId }.
  const linksWhere = (match = {}) => withLinks(async (db) => (await rows(db, 'links'))
    .map(([, l]) => l)
    .filter((l) => Object.keys(match).every((k) => l[k] === match[k]))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  const getLink = (id) => withLinks((db) => getOne(db, 'links', id));
  // Saves a link (made or changed), and its pictures with it when given.
  const saveLink = (link, pictures) => withLinks((db) => {
    const now = nowIso();
    const l = { ...link, id: link.id || uid(), createdAt: link.createdAt || now, updatedAt: now };
    const tx = db.transaction(['links', 'pictures'], 'readwrite');
    tx.objectStore('links').put(l);
    if (pictures) tx.objectStore('pictures').put(pictures, l.id);
    return finish(tx).then(() => l);
  });
  const linkPictures = (id) => withLinks((db) => getOne(db, 'pictures', id));
  const dropLinks = (ids) => withLinks((db) => {
    const tx = db.transaction(['links', 'pictures'], 'readwrite');
    ids.forEach((id) => { tx.objectStore('links').delete(id); tx.objectStore('pictures').delete(id); });
    return finish(tx);
  });
  const pictureUrl = (p) => (p && p.bytes ? URL.createObjectURL(new Blob([p.bytes], { type: p.type || 'image/jpeg' })) : '');

  // A board as one file, for a Ref and a The Eye that don't share a phone's
  // storage (each installed on its own): the same pictures, in a versioned
  // JSON file. Built in pieces, so a big board is never one string.
  const BOARD_FILE = { app: 'ref', kind: 'ref-board', version: 1 };
  async function boardFile(about, pictures) {
    const url = (p) => blobToDataUrl(new Blob([p.bytes], { type: p.type || 'image/jpeg' }));
    const head = { ...BOARD_FILE, exportedAt: nowIso(), board: { id: about.id, name: about.name, pageCount: about.pageCount, photoCount: about.photoCount, updatedAt: about.updatedAt } };
    const parts = [JSON.stringify(head).slice(0, -1), ',"cover":', JSON.stringify(pictures.cover ? await url(pictures.cover) : null), ',"pages":['];
    for (const [i, p] of pictures.pages.entries()) parts.push(i ? ',' : '', JSON.stringify(await url(p)));
    parts.push(']}');
    const safe = String(about.name || 'Mood board').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Mood board';
    return new File(parts, `${safe} (board).json`, { type: 'application/json' });
  }
  // Reads a board file back: { board, pictures }, or throws saying what's wrong.
  async function readBoardFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't a board from Ref."); }
    if (!data || data.kind !== BOARD_FILE.kind || !Array.isArray(data.pages)) throw new Error("That file isn't a board from Ref.");
    if (data.version > BOARD_FILE.version) throw new Error('That board was made by a newer Ref. Update this app and try again.');
    const picture = async (u) => {
      if (typeof u !== 'string' || !u.startsWith('data:image/')) return null;
      const b = await (await fetch(u)).blob();
      return { type: b.type || 'image/jpeg', bytes: await b.arrayBuffer() };
    };
    const pages = (await Promise.all(data.pages.map(picture))).filter(Boolean);
    if (!pages.length) throw new Error('That board has no pages in it.');
    const b = data.board || {};
    return {
      board: { id: typeof b.id === 'string' ? b.id : null, name: hasText(b.name) ? b.name : 'Mood board', pageCount: pages.length, photoCount: Number(b.photoCount) || 0 },
      pictures: { cover: (await picture(data.cover)) || pages[0], pages },
    };
  }

  // ---------- Handing a file over ----------
  // The share sheet where there is one (Save to Files on a phone), else a download.
  async function saveFile(file, { share = true } = {}) {
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  }
  // Asks for files (as many as wanted); resolves with them, [] if none.
  function pickFiles(accept = 'application/json,.json') {
    return new Promise((ok) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.multiple = true; input.style.display = 'none';
      input.addEventListener('change', () => { ok(input.files ? [...input.files] : []); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }
  // Asks for a file; resolves with it, or null if none was picked.
  function pickFile(accept = 'application/json,.json') {
    return new Promise((ok) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.style.display = 'none';
      input.addEventListener('change', () => { ok(input.files && input.files[0] ? input.files[0] : null); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }

  // ---------- Where the notebooks are ----------
  const inSuite = () => !!window.DF_SUITE;
  // A link into another notebook of the suite (null on its own).
  const notebookUrl = (id, params) => (inSuite() ? `../${id}/${params ? `?${new URLSearchParams(params)}` : ''}` : null);

  window.DFData = {
    open, rows, getOne, putMany, deleteOne, hasText, todayStr, uid, nowIso,
    overthoughts, reflectionId, linkId, saveReflections, dropReflections, reflections,
    eyeState, eyeShootName, eyeBackupFile, readEyeFile,
    journalMoved, somethingToMove, moveJournal,
    exportDb, importDb, saveFile, pickFile, pickFiles,
    zipBackup, backupSteps, isZipFile, restoreZip, sizeText,
    inSuite, notebookUrl,
    linksWhere, getLink, saveLink, linkPictures, dropLinks, pictureUrl, boardFile, readBoardFile,
  };
})();
