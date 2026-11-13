// Restoring a backup: reading the zip and putting each database back.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { ask, finish, open, ZIP, MANIFEST, CHUNK, BATCH, PART_NAME, dbNames, readZip } = parts;

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
    const zip = { has: (n) => use.some((z) => z.has(n)), get: (n) => use.find((z) => z.has(n)).get(n) };
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
        let batch = [];
        const sizes = { n: 0 };
        const write = async () => {
          const tx = db.transaction(n, 'readwrite');
          const os = tx.objectStore(n);
          // Each row is kept under the key it went in with: a row of an
          // auto-increment store that had none is given one here.
          batch.forEach(([k, v]) => {
            const r = keyPath == null ? os.put(v, k) : os.put(v);
            r.onsuccess = () => keep[n].add(keyText(r.result));
          });
          await finish(tx);
          batch = [];
          sizes.n = 0;
        };
        for (const [pk, pv] of part.stores[n].rows || []) {
          const k = await unzipValue(pk, b.zip, sizes);
          const v = await unzipValue(pv, b.zip, sizes);
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

  Object.assign(parts, { restoreZip });
})();
