// A whole database as one file (JSON), and back.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { finish, open, rows, nowIso, todayStr } = parts;

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
    try {
      const names = Object.keys(data.stores).filter((n) => db.objectStoreNames.contains(n));
      if (!names.length) throw new Error('That file is a backup of a different notebook.');
      const unpacked = {};
      for (const n of names) {
        unpacked[n] = [];
        for (const [k, v] of data.stores[n].rows) unpacked[n].push([await unpack(k), await unpack(v)]);
      }
      const tx = db.transaction(names, 'readwrite');
      const done = finish(tx);
      try {
        names.forEach((n) => {
          const os = tx.objectStore(n);
          if (replace) os.clear();
          unpacked[n].forEach(([k, v]) => { if (os.keyPath) os.put(v); else os.put(v, k); });
        });
      } catch (e) {
        tx.abort(); // a row a store can't take at all: nothing goes in, not even the clear
      }
      await done;
      return { extra: data.extra || {}, counts: Object.fromEntries(names.map((n) => [n, unpacked[n].length])) };
    } finally {
      db.close();
    }
  }

  Object.assign(parts, { blobToDataUrl, exportDb, importDb });
})();
