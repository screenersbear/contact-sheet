// Back up (15 Nov): what's behind the Back up sheet on the shelf and in
// every notebook's Options (shared/components/backup-sheet.js). Just one
// notebook, or all four; and Restore, which takes either kind.
//
// A zip (df-data.js's zipBackup: the same format and the same splitting into
// a few files on a phone as before), put together from what's stored, so the
// phone never holds it all in memory. What goes in is in backup-books.js;
// .json backups made the first way go back in by backup-json.js.
// A notebook's own Restore takes its part out of a backup of all four too.
(function () {
  'use strict';
  const D = window.DFData;
  const B = window.DFBackups;
  if (!D || !B || !B.readJson) return;
  const { BOOKS, DBS, EYE_DB, EYE_STATE, existing, readJson, restoreJson, otherBook, noPart } = B;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  // { parts, size, release, done } (df-data.js's zipBackup), or null with
  // nothing to back up. `only` (an app id): just that notebook, the very
  // backup its own Options made before. Otherwise all four.
  async function makeBackup(onProgress, only) {
    if (only) {
      const b = BOOKS[only];
      return D.zipBackup({
        app: only,
        databases: b.dbs,
        local: b.local,
        extra: b.book ? { book: ls.get(b.book) || '' } : {},
        filename: `${only}-backup-${D.todayStr()}.zip`,
        onProgress,
      });
    }
    const have = await existing();
    const eye = !!ls.get(EYE_STATE);
    const dbs = DBS.map((n) => n.db).filter((n) => !have || have.has(n));
    if (eye) dbs.push(EYE_DB);
    if (!dbs.length) return null;
    return D.zipBackup({
      app: 'documenting-fictions',
      kind: 'suite',
      databases: dbs,
      local: [...(eye ? [EYE_STATE] : []), ...DBS.filter((n) => n.book).map((n) => n.book)],
      filename: `documenting-fictions-backup-${D.todayStr()}.zip`,
      onProgress,
    });
  }

  // The Eye's shoots and journal from a backup: checked before anything is
  // changed. `needed`: when there have to be some (The Eye on its own).
  const eyeCheck = (needed, app) => async (local) => {
    const st = await local(EYE_STATE);
    if (st == null) { if (needed) throw noPart(app); return; }
    let ok = false;
    try { ok = Array.isArray(JSON.parse(st).shoots); } catch (e) { /* not JSON */ }
    if (!ok) throw new Error("The Eye's part of that file isn't right. Nothing was changed.");
  };
  async function putEyeState(r) {
    const st = await r.local(EYE_STATE);
    if (st == null) return;
    localStorage.setItem(EYE_STATE, st); // throws if it doesn't fit, and the restore says so
    const p = JSON.parse(st).presentation;
    if (p && p.color) ls.set('df-app-color', p.color);
  }

  // A backup zip back in (its one file, or all the files it was saved as).
  // `only` (an app id): just that notebook's part, from a backup of it or
  // of all four, with the others left as they are. Otherwise a backup of
  // all four: every database it has (each swapped for its part), then the
  // cover colours and The Eye's shoots and journal.
  async function restoreZip(files, onProgress, only) {
    if (only) {
      const b = BOOKS[only];
      const r = await D.restoreZip(files, { databases: b.dbs, onProgress, check: only === 'the-eye' ? eyeCheck(true, only) : undefined });
      const book = b.book && ((r.extra && r.extra.book) || (await r.local(b.book)));
      if (book) ls.set(b.book, book);
      if (only === 'the-eye') await putEyeState(r);
      return;
    }
    const r = await D.restoreZip(files, { kind: 'suite', databases: [...DBS.map((n) => n.db), EYE_DB], onProgress, check: eyeCheck(false) });
    for (const n of DBS) {
      const book = n.book ? await r.local(n.book) : null;
      if (book) ls.set(n.book, book);
    }
    await putEyeState(r);
  }

  // What a picked backup is, read without changing anything: { all: true }
  // for one of all four, { app } for one notebook's. Throws when it isn't a
  // backup, or is of a notebook that's no longer here (Overthoughts).
  async function whatsIn(files) {
    const list = Array.isArray(files) ? files : [files];
    if (!list.length) throw new Error("That file isn't a Documenting Fictions backup.");
    let got;
    if (await D.isZipFile(list[0])) {
      const m = await D.backupManifest(list);
      got = m.kind === 'suite' ? { all: true } : { app: m.app };
    } else {
      const { all, app } = await readJson(list[0]);
      got = all ? { all: true } : { app };
    }
    if (!got.all && !BOOKS[got.app]) throw otherBook();
    return got;
  }

  // Restore: a zip or a .json, of all four or of one notebook; `only` (an
  // app id) puts back just that notebook's part.
  async function restore(files, { only, onProgress = () => {} } = {}) {
    const list = Array.isArray(files) ? files : [files];
    if (list.length && (await D.isZipFile(list[0]))) return restoreZip(list, onProgress, only);
    return restoreJson(list[0], only);
  }

  Object.assign(B, { makeBackup, restoreZip, whatsIn, restore });
})();
