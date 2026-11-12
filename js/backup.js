// The whole notebook as one file, and back, without the phone ever holding
// it in memory. The file is a plain .zip: backup.json says what's in every
// store, and each photo, video and preview goes in as its own file, just as
// it's stored. Saving, the zip is put together from the stored files
// themselves (only their checksums are read, a piece at a time); restoring,
// each one is cut straight out of the backup file. A notebook full of photos
// and videos can be gigabytes: kept as text, the way backups were first
// made, it was too much for an iPhone and the page fell over.
//
// Backups made the first way (one .json) still restore (df-data.js).
import { openDb } from './db.js';

const DB_NAME = 'contact-sheet';
const FORMAT = 'contact-sheet-backup';
const MANIFEST = 'backup.json';
const CHUNK = 4 * 1024 * 1024;
const MAX32 = 0xffffffff; // the mark for "in the zip64 extra instead"
const LIMIT = MAX32; // sizes and places from here on need zip64

function rows(db, store) {
  return new Promise((ok, no) => {
    const out = [];
    const r = db.transaction(store).objectStore(store).openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) { ok(out); return; } out.push([c.key, c.value]); c.continue(); };
    r.onerror = () => no(r.error);
  });
}

// ---------- Values in and out of backup.json ----------
// A Blob becomes a pointer to its file in the zip; nothing is read.
function packer(files) {
  const add = (blob) => {
    const name = `files/${String(files.length).padStart(6, '0')}`;
    files.push({ name, blob });
    return name;
  };
  const pack = (v) => {
    if (v instanceof Blob) return { __file: add(v), type: v.type || '', name: v.name || undefined, lastModified: v.lastModified || undefined };
    if (v instanceof ArrayBuffer) return { __file: add(new Blob([v])), buf: true };
    if (ArrayBuffer.isView(v)) return { __file: add(new Blob([v])), view: v.constructor.name };
    if (v instanceof Date) return { __date: v.toISOString() };
    if (Array.isArray(v)) return v.map(pack);
    if (v && typeof v === 'object') { const out = {}; for (const k of Object.keys(v)) out[k] = pack(v[k]); return out; }
    return v;
  };
  return pack;
}
// Safari keeps only which file a stored Blob came from, not which piece of
// it: a piece of the backup stored as it is comes back as the start of the
// whole backup. So each photo is copied out of the file first, a few MB at
// a time, and only that copy is stored (as a File again if it was one).
// `sizes` adds up what was copied.
async function copied(part, v) {
  const chunks = [];
  for (let at = 0; at < part.size; at += CHUNK) chunks.push(new Blob([await part.slice(at, at + CHUNK).arrayBuffer()]));
  const type = v.type || '';
  return v.name != null ? new File(chunks, v.name, { type, lastModified: v.lastModified || Date.now() }) : new Blob(chunks, { type });
}
async function unpack(v, fileOf, sizes = { n: 0 }) {
  if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await unpack(x, fileOf, sizes)); return out; }
  if (v && typeof v === 'object') {
    if (typeof v.__file === 'string') {
      const part = await fileOf(v.__file);
      sizes.n += part.size;
      if (v.buf || v.view) {
        const buf = await part.arrayBuffer();
        return v.view && typeof self[v.view] === 'function' ? new self[v.view](buf) : buf;
      }
      return copied(part, v);
    }
    if (typeof v.__date === 'string') return new Date(v.__date);
    const out = {}; for (const k of Object.keys(v)) out[k] = await unpack(v[k], fileOf, sizes); return out;
  }
  return v;
}

// ---------- A zip that points at its files ----------
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
async function crcOf(blob, onBytes) {
  let c = 0xffffffff;
  const eat = (bytes) => {
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
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
    const crc = await crcOf(e.blob, onBytes);
    const big = size >= LIMIT;
    const far = offset >= LIMIT;
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
  if (offset >= LIMIT || cenSize >= LIMIT || entries.length >= 0xffff) {
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
  if (e < 0) throw new Error("That file isn't a Contact Sheet backup.");
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

// ---------- Save and restore ----------
// Resolves with the backup as a File. onProgress(0..1) while the photos'
// checksums are worked out.
export async function makeBackup({ extra = {}, onProgress = () => {} } = {}) {
  const db = await openDb();
  const files = [];
  const pack = packer(files);
  const stores = {};
  for (const name of db.objectStoreNames) {
    const os = db.transaction(name).objectStore(name);
    const meta = { keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes: [...os.indexNames].map((n) => { const ix = os.index(n); return { name: n, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry }; }) };
    stores[name] = { meta, rows: (await rows(db, name)).map(([k, v]) => [pack(k), pack(v)]) };
  }
  const manifest = { format: FORMAT, app: 'contact-sheet', database: DB_NAME, version: db.version, exportedAt: new Date().toISOString(), extra, stores };
  const entries = [{ name: MANIFEST, blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) }, ...files];
  const total = entries.reduce((n, e) => n + e.blob.size, 0) || 1;
  let done = 0;
  const zip = await zipOf(entries, (n) => { done += n; onProgress(Math.min(1, done / total)); });
  const day = new Date();
  const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  return new File([zip], `contact-sheet-backup-${stamp}.zip`, { type: 'application/zip' });
}

// True for a backup made by makeBackup (a zip); the first kind is JSON.
export async function isZipBackup(file) {
  const b = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

// Everything in Contact Sheet swapped for what's in the backup. Rows go in a
// few at a time (so only a few photos are ever held at once), over what's
// there; once they're all in, whatever the backup doesn't have is taken out.
// If it stops partway, what was there is still there, with some of the
// backup over it, and restoring again finishes it. Resolves with its `extra`.
const BATCH_BYTES = 24 * 1024 * 1024;
export async function restoreBackup(file, onProgress = () => {}) {
  const zip = await readZip(file);
  if (!zip.has(MANIFEST)) throw new Error("That file isn't a Contact Sheet backup.");
  let data;
  try { data = JSON.parse(await (await zip.get(MANIFEST)).text()); } catch { throw new Error("That file isn't a Contact Sheet backup."); }
  if (!data || data.format !== FORMAT || data.database !== DB_NAME || !data.stores) throw new Error('That file is a backup of a different notebook.');
  const fileOf = (name) => zip.get(name);
  const db = await openDb();
  const write = (store, rowsIn) => new Promise((ok, no) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const [k, v] of rowsIn) { if (os.keyPath) os.put(v); else os.put(v, k); }
    tx.oncomplete = () => ok();
    tx.onabort = tx.onerror = () => no(tx.error);
  });
  try {
    const names = Object.keys(data.stores).filter((n) => db.objectStoreNames.contains(n));
    const total = names.reduce((n, s) => n + data.stores[s].rows.length, 0) || 1;
    let done = 0;
    const keep = {};
    for (const n of names) {
      keep[n] = new Set();
      const keyPath = db.transaction(n).objectStore(n).keyPath;
      const keyOf = (k, v) => (keyPath == null ? k : Array.isArray(keyPath) ? keyPath.map((p) => v[p]) : v[keyPath]);
      let batch = [];
      const sizes = { n: 0 };
      for (const [pk, pv] of data.stores[n].rows) {
        const k = await unpack(pk, fileOf, sizes);
        const v = await unpack(pv, fileOf, sizes);
        keep[n].add(JSON.stringify(keyOf(k, v)));
        batch.push([k, v]);
        if (sizes.n >= BATCH_BYTES || batch.length >= 40) {
          await write(n, batch);
          batch = [];
          sizes.n = 0;
        }
        onProgress(++done / total);
      }
      if (batch.length) await write(n, batch);
    }
    // Then out with whatever the backup didn't have.
    for (const n of names) {
      const keys = await new Promise((ok, no) => { const r = db.transaction(n).objectStore(n).getAllKeys(); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      const gone = keys.filter((k) => !keep[n].has(JSON.stringify(k)));
      if (gone.length) await new Promise((ok, no) => {
        const tx = db.transaction(n, 'readwrite');
        gone.forEach((k) => tx.objectStore(n).delete(k));
        tx.oncomplete = () => ok();
        tx.onabort = tx.onerror = () => no(tx.error);
      });
    }
    return { extra: data.extra || {}, counts: Object.fromEntries(names.map((n) => [n, data.stores[n].rows.length])) };
  } catch (err) {
    console.error(err);
    throw new Error("The backup didn't all go in. Restore it again to finish it.");
  }
}

