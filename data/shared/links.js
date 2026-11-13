// Links between notebooks: a Ref board sent to a shoot in The Eye, and the
// board file that carries it.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { finish, open, rows, getOne, hasText, nowIso, uid, blobToDataUrl } = parts;

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
  // Version 1: the upgrade only runs when the database is first made, so the stores are always new.
  const openLinks = () => open(LINKS, 1, (db) => {
    db.createObjectStore('links', { keyPath: 'id' });
    db.createObjectStore('pictures');
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

  Object.assign(parts, {
    linksWhere, getLink, saveLink, linkPictures, dropLinks, pictureUrl, boardFile,
    readBoardFile
  });
})();
