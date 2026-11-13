// Saving a backup: the notebooks' databases packed into a zip (in parts on
// a phone), and the steps for handing it over.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const {
    ask, finish, open, nowIso, todayStr, uid, ZIP, MANIFEST, BATCH, PAGE, BIG_TEXT, SCRATCH,
    PART, PART_NAME, dbNames, dropDb, crcBytes, crcOf, zipOf, saveFile
  } = parts;

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

  Object.assign(parts, { sizeText, zipBackup, backupSteps, isZipFile });
})();
