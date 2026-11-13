// The zip file format: writing a zip and reading one, plus the names and
// sizes the zip backup uses.
(function () {
  'use strict';
  const parts = window.DFDataParts;

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
  const CHUNK = 4 * 1024 * 1024;
 // read and copied this much at a time
  const BATCH = 24 * 1024 * 1024;
 // stored this much at a time
  const PAGE = 10;
 // rows read at a time
  const BIG_TEXT = 64 * 1024;
 // a string longer than this goes in as a file
  const MAX32 = 0xffffffff;
 // the mark for "in the zip64 extra instead"
  const ZIP_LIMIT = MAX32;
 // sizes and places from here on need zip64
  const SCRATCH = 'df-backup-scratch-';
  const PART = 200 * 1024 * 1024;
 // the most a phone is handed at once
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
  async function crcOf(blob) {
    let c = 0xffffffff;
    const eat = (bytes) => { c = crcAdd(c, bytes); };
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
  // entries: [{ name, blob, crc }], stored as they are, each with its CRC
  // already worked out. The Blob that comes back is made of the entries' own Blobs.
  async function zipOf(entries) {
    const enc = new TextEncoder();
    const { time, date } = dosTime(new Date());
    const parts = [];
    const central = [];
    let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.name);
      const size = e.blob.size;
      const { crc } = e;
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
      // Only asked for names has() found: openBackupZip checks every one first.
      async get(name) {
        const f = byName.get(name);
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

  Object.assign(parts, {
    ZIP, MANIFEST, CHUNK, BATCH, PAGE, BIG_TEXT, SCRATCH, PART, PART_NAME, dbNames, dropDb,
    crcBytes, crcOf, zipOf, readZip
  });
})();
