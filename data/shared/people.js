// One person for all four notebooks (round 2, connect/08): The Eye's talent
// and team, Rounds' people, the handles in Layouts' captions and the person
// a Ref board is for are one person, one record. Kept in a database of its
// own, df-people, like df-links, which every notebook adds to and none owns:
//   people  { id, name, instagram, tiktok, keys, sigs, maybe, apart,
//             createdAt, updatedAt, editedAt }
//   things  what each notebook has with people in it (people-things.js)
// Each notebook keeps its own copy of a person (The Eye's talent, Rounds'
// person) as it always has: nothing here changes a notebook's own data. This
// list joins the copies up. Someone is matched on their Instagram (or TikTok)
// handle, then on their name when nothing says otherwise. When it isn't clear
// (the same name with different handles, or more than one person of that
// name) they're kept apart and Starky is asked: "Same person?" on the person
// page. Each place a person was found (a Rounds person, or a name with its
// handles) is remembered (sigs), so they're found the same way next time.
// Part of window.DFData.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { finish, open, rows, getOne, hasText, nowIso, uid } = parts;

  // ---------- Matching ----------
  // A handle from what was typed or pasted: "@maya.rr", "maya.rr" or a link
  // to the profile (as Rounds reads one).
  function cleanHandle(t) {
    let s = String(t ?? '').trim();
    const m = s.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i);
    if (m) s = m[1];
    return s.replace(/^@+/, '').replace(/\s+/g, '');
  }
  const nameKey = (name) => `name:${name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  // Every key a person can be found by: ig:maya.rr, tt:maya, name:maya r.
  function personKeys(f) {
    const ig = cleanHandle(f.instagram).toLowerCase();
    const tt = cleanHandle(f.tiktok).toLowerCase();
    return [ig && `ig:${ig}`, tt && `tt:${tt}`, hasText(f.name) && nameKey(f.name)].filter(Boolean);
  }
  // Where a person was found: a Rounds person by its id, anything else by its name and handles.
  const sigOf = (f) => (f.roundsId ? `rounds:${f.roundsId}` : personKeys(f).join('|'));
  const lower = (h) => cleanHandle(h).toLowerCase();
  // Two handles that can't both be theirs: the same name, but different handles.
  const clashes = (a, b) => (!!lower(a.instagram) && !!lower(b.instagram) && lower(a.instagram) !== lower(b.instagram))
    || (!!lower(a.tiktok) && !!lower(b.tiktok) && lower(a.tiktok) !== lower(b.tiktok));

  // Who in records this is: { match } when sure, else { match: null, maybe }
  // (the people of that name it might be). Found the same way before; then
  // a handle; then the only person of that name, when no handle says no.
  function placePerson(records, f) {
    const sig = sigOf(f);
    const before = records.find((r) => r.sigs.includes(sig));
    if (before) return { match: before, maybe: [] };
    const handles = personKeys(f).filter((k) => !k.startsWith('name:'));
    const byHandle = records.find((r) => handles.some((k) => r.keys.includes(k)));
    if (byHandle) return { match: byHandle, maybe: [] };
    if (!hasText(f.name)) return { match: null, maybe: [] };
    const named = records.filter((r) => r.keys.includes(nameKey(f.name)));
    if (named.length === 1 && !clashes(named[0], f)) return { match: named[0], maybe: [] };
    return { match: null, maybe: named.map((r) => r.id) };
  }
  const union = (a, b) => [...new Set([...a, ...b])];
  // A person found again: their keys and where they were found are added; a
  // name or handle they didn't have is filled in. Rounds is where people are
  // kept up, so its name and handles win, unless the person page changed
  // them since (editedAt).
  function addTo(r, f, now) {
    const fromRounds = !!f.roundsId && (!r.editedAt || String(f.at || '') > r.editedAt);
    const pick = (k, v) => (fromRounds && hasText(v) ? v.trim() : r[k] || (hasText(v) ? v.trim() : ''));
    const next = {
      ...r,
      name: pick('name', f.name),
      instagram: pick('instagram', cleanHandle(f.instagram)),
      tiktok: pick('tiktok', cleanHandle(f.tiktok)),
      keys: union(r.keys, personKeys(f)),
      sigs: union(r.sigs, [sigOf(f)]),
    };
    next.keys = union(next.keys, personKeys(next));
    return JSON.stringify(next) === JSON.stringify(r) ? r : { ...next, updatedAt: now };
  }
  function newRecord(f, now, makeId, maybe) {
    return { id: makeId(), name: String(f.name ?? '').trim(), instagram: cleanHandle(f.instagram), tiktok: cleanHandle(f.tiktok), keys: personKeys(f), sigs: [sigOf(f)], maybe, apart: [], createdAt: now, updatedAt: now };
  }
  // Everyone found ({ name, instagram, tiktok, roundsId?, at? }), placed
  // among the records: { records, changed (the records new or changed) }.
  // Someone with no name and no handle is left out.
  function gatherInto(records, found, now = nowIso(), makeId = uid) {
    const all = records.map((r) => ({ ...r }));
    const changed = new Map();
    for (const f of found) {
      if (!f || !personKeys(f).length) continue;
      const { match, maybe } = placePerson(all, f);
      const r = match ? addTo(match, f, now) : newRecord(f, now, makeId, maybe);
      if (match && r === match) continue;
      if (match) all[all.indexOf(match)] = r; else all.push(r);
      changed.set(r.id, r);
    }
    return { records: all, changed: [...changed.values()] };
  }
  // Who a name in a notebook is (or null): as placePerson, for finding only.
  const findPerson = (records, f) => (f && personKeys(f).length ? placePerson(records, f).match : null);
  // The people Starky is asked about: [a, b], each pair once, both still here
  // and not said to be different people.
  function maybePairs(records) {
    const byId = new Map(records.map((r) => [r.id, r]));
    const out = [];
    records.forEach((r) => r.maybe.forEach((id) => {
      const o = byId.get(id);
      if (o && !r.apart.includes(id) && !out.some(([a, b]) => (a === o && b === r) || (a === r && b === o))) out.push([o, r]);
    }));
    return out;
  }
  // "Same person": gone's keys and finds join keep, and anything that said
  // gone now says keep. Returns every record that changed, and gone.
  function mergeRecords(records, keepId, goneId, now = nowIso()) {
    const keep = records.find((r) => r.id === keepId);
    const gone = records.find((r) => r.id === goneId);
    if (!keep || !gone || keep === gone) return { changed: [], gone: null };
    const swap = (ids) => [...new Set(ids.map((id) => (id === goneId ? keepId : id)))];
    const notKeep = (ids) => swap(ids).filter((id) => id !== keepId);
    const merged = {
      ...keep,
      instagram: keep.instagram || gone.instagram,
      tiktok: keep.tiktok || gone.tiktok,
      keys: union(keep.keys, gone.keys),
      sigs: union(keep.sigs, gone.sigs),
      maybe: notKeep(union(keep.maybe, gone.maybe)),
      apart: notKeep(union(keep.apart, gone.apart)),
      updatedAt: now,
    };
    const others = records.filter((r) => r !== keep && r !== gone && [...r.maybe, ...r.apart].includes(goneId))
      .map((r) => ({ ...r, maybe: swap(r.maybe), apart: swap(r.apart), updatedAt: now }));
    return { changed: [merged, ...others], gone };
  }
  // "Not the same": each keeps the other in apart, and isn't asked about again.
  function apartRecords(a, b, now = nowIso()) {
    const mark = (r, id) => ({ ...r, apart: union(r.apart, [id]), maybe: r.maybe.filter((x) => x !== id), updatedAt: now });
    return [mark(a, b.id), mark(b, a.id)];
  }
  // Changed on the person page: the new name and handles, the old keys kept
  // (each notebook's copy still says the old ones until it takes the new).
  function editRecord(r, f, now = nowIso()) {
    const next = { ...r, name: hasText(f.name) ? f.name.trim() : r.name, instagram: cleanHandle(f.instagram), tiktok: cleanHandle(f.tiktok), editedAt: now, updatedAt: now };
    return { ...next, keys: union(r.keys, personKeys(next)) };
  }

  // ---------- Storage ----------
  const PEOPLE = 'df-people';
  // Version 1: the upgrade only runs when the database is first made, so the stores are always new.
  const openPeople = () => open(PEOPLE, 1, (db) => {
    db.createObjectStore('people', { keyPath: 'id' });
    db.createObjectStore('things', { keyPath: 'key' });
  });
  async function withPeople(fn) {
    const db = await openPeople();
    try { return await fn(db); } finally { db.close(); }
  }
  const peopleAll = () => withPeople(async (db) => (await rows(db, 'people')).map(([, r]) => r));
  const getPerson = (id) => withPeople((db) => getOne(db, 'people', String(id)));
  const writePeople = (db, put, drop = []) => {
    const tx = db.transaction('people', 'readwrite');
    put.forEach((r) => tx.objectStore('people').put(r));
    drop.forEach((id) => tx.objectStore('people').delete(id));
    return finish(tx);
  };
  // Everyone found, added to the list: every record, after.
  const gatherPeople = (found) => withPeople(async (db) => {
    const { records, changed } = gatherInto((await rows(db, 'people')).map(([, r]) => r), found);
    if (changed.length) await writePeople(db, changed);
    return records;
  });
  // Starky's answer to "Same person?": the two become one (a kept), or stay apart.
  const answerSame = (aId, bId, same) => withPeople(async (db) => {
    const all = (await rows(db, 'people')).map(([, r]) => r);
    const a = all.find((r) => r.id === aId);
    const b = all.find((r) => r.id === bId);
    if (!a || !b) return null;
    if (!same) { await writePeople(db, apartRecords(a, b)); return a; }
    const { changed } = mergeRecords(all, aId, bId);
    await writePeople(db, changed, [bId]);
    return changed[0];
  });
  // Who a name in a notebook is (or null), and their page on the shelf
  // (null outside the suite, where there's no shelf).
  const personFor = async (f) => findPerson(await peopleAll(), f);
  const personUrl = (id) => (parts.inSuite() ? `../?person=${encodeURIComponent(id)}` : null);
  const editPerson = (id, f) => withPeople(async (db) => {
    const r = await getOne(db, 'people', id);
    if (!r) return null;
    const next = editRecord(r, f);
    await writePeople(db, [next]);
    return next;
  });

  Object.assign(parts, {
    cleanHandle, nameKey, personKeys, sigOf, placePerson, gatherInto, findPerson, maybePairs,
    mergeRecords, apartRecords, editRecord, openPeople, withPeople, peopleAll, getPerson,
    gatherPeople, answerSame, editPerson, personFor, personUrl
  });
})();
