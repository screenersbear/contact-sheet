// The Journal moves from The Eye to Overthoughts, once.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const {
    finish, rows, getOne, hasText, nowIso, todayStr, store, overthoughts, reflectionId,
    saveReflections, openEyePhotos, eyeState, eyeShootName
  } = parts;

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

  Object.assign(parts, { journalMoved, somethingToMove, moveJournal });
})();
