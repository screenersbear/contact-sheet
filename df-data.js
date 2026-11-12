// Documenting Fictions: the data helpers every notebook shares.
//
// The master copy is shared/df-data.js in the suite; tools/sync.py copies it
// into each notebook's folder as df-data.js, so a notebook copied out on its
// own still has it. Edit this one, then run the sync.
//
// Each notebook keeps its own database, named for it: ref-notebook,
// contact-sheet, the-eye's starky-moodboards (its photos; its shoots are in
// localStorage, dailies_state_v1) and overthoughts. What one notebook hands
// another (a shoot's reflection, from The Eye to Overthoughts) is written
// into the other's database with a link saying where it came from:
// { id, fromApp, fromId, toApp, toId, type, createdAt }.
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

  // ---------- Handing a file over ----------
  // The share sheet where there is one (Save to Files on a phone), else a download.
  async function saveFile(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
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
    exportDb, importDb, saveFile, pickFile,
    inSuite, notebookUrl,
  };
})();
