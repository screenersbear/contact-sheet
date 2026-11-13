// Documenting Fictions: the data helpers every notebook shares. This file:
// IndexedDB made a little plainer, plus small helpers (dates, ids, where the
// notebooks are). Loaded first; the files after it are in df-data.js's list.
//
// The master copies are in shared/data/ in the suite; tools/sync.py copies
// them into each notebook's data/shared/ folder, so a notebook copied out on
// its own still has them. Edit those, then run the sync.
//
// Each notebook keeps its own database, named for it: ref-notebook,
// contact-sheet, the-eye's starky-moodboards (its photos; its shoots are in
// localStorage, dailies_state_v1) and overthoughts. What one notebook hands
// another (a Ref board sent to a shoot in The Eye) goes in a database of its
// own, df-links, as a link saying where it came from and where it went:
// { id, fromApp, fromId, toApp, toId, type, createdAt }.
//
// The files share their inner helpers through window.DFDataParts; what the
// notebooks use is window.DFData, put together last by df-data.js.
(function () {
  'use strict';
  const parts = (window.DFDataParts = {});

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
  // ---------- Where the notebooks are ----------
  const inSuite = () => !!window.DF_SUITE;
  // A link into another notebook of the suite (null on its own).
  const notebookUrl = (id, params) => (inSuite() ? `../${id}/${params ? `?${new URLSearchParams(params)}` : ''}` : null);

  Object.assign(parts, {
    ask, finish, open, rows, getOne, putMany, deleteOne, hasText, nowIso, todayStr, uid, store,
    inSuite, notebookUrl
  });
})();
