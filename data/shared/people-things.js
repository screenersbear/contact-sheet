// What each notebook has with people in it, for the person page (round 2,
// connect/08) and search from the shelf (14): The Eye's shoots, Rounds'
// people, Ref's boards, Layouts' layouts. Each notebook writes its own
// things into df-people (people.js) as it opens and saves, the way it tells
// the shelf what's waiting, and the people in them join the one list of
// people. Nothing here reads or writes a notebook's own database.
//   things  { key ('<app>:<id>'), app, id, kind, title, line, day, people,
//             params, covers, more, at }
// people: [{ name, instagram, tiktok, role, roundsId, at }]; params open it
// in its notebook; covers: up to four small pictures ({ type, bytes }), or a
// function giving them, asked only when the thing is new or its coverKey
// changed (a notebook's pictures aren't read again on every save); more:
// anything else the person page shows (Rounds' next move, a group).
// Part of window.DFData.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { finish, rows, hasText, nowIso, withPeople, gatherInto, personKeys, sigOf } = parts;

  const APPS = ['rounds', 'ref', 'the-eye', 'contact-sheet']; // the loop's order
  const text = (v) => (hasText(v) ? v.trim() : '');
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  function cleanPerson(p) {
    if (!plain(p)) return null;
    const out = { name: text(p.name), instagram: text(p.instagram), tiktok: text(p.tiktok) };
    if (!personKeys(out).length) return null;
    if (hasText(p.role)) out.role = p.role.trim();
    if (hasText(p.roundsId)) { out.roundsId = p.roundsId; out.at = String(p.at || ''); }
    return out;
  }
  const isPicture = (c) => plain(c) && Object.prototype.toString.call(c.bytes) === '[object ArrayBuffer]';
  const pictures = (list) => (Array.isArray(list) ? list : []).filter(isPicture).slice(0, 4);
  // A picture kept as a data: address (The Eye keeps them so), as bytes; null if it isn't one.
  function pictureOf(url) {
    const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(String(url || ''));
    if (!m) return null;
    try {
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { type: m[1], bytes: bytes.buffer };
    } catch (e) { return null; }
  }
  // Everyone on a shoot in The Eye: its talent, then its team, each with
  // their handles and what they did.
  const named = (x) => plain(x) && hasText(x.name);
  const handleOn = (list, platform) => ((Array.isArray(list) ? list : []).find((h) => h && h.platform === platform) || {}).handle || '';
  function shootPeople(shoot) {
    const talent = (shoot.talents || []).filter(named).map((t) => ({ name: t.name.trim(), instagram: handleOn(t.socialHandles, 'instagram'), tiktok: handleOn(t.socialHandles, 'tiktok'), role: 'Talent' }));
    const team = (shoot.teamMembers || []).filter(named).map((m) => {
      const on = m.socialPlatform || 'instagram';
      return { name: m.name.trim(), instagram: on === 'instagram' ? m.socialHandle || '' : '', tiktok: on === 'tiktok' ? m.socialHandle || '' : '', role: text(m.role) || 'Team' };
    });
    return [...talent, ...team];
  }
  // One thing as a notebook gave it, kept only if it has an id and a title.
  function cleanThing(app, x) {
    if (!plain(x) || !hasText(String(x.id ?? '')) || !hasText(x.title)) return null;
    return {
      key: `${app}:${x.id}`, app, id: String(x.id), kind: text(x.kind) || 'thing',
      title: x.title.trim(), line: text(x.line), day: isDay(x.day) ? x.day.slice(0, 10) : '',
      people: (Array.isArray(x.people) ? x.people : []).map(cleanPerson).filter(Boolean),
      params: plain(x.params) ? x.params : null,
      covers: typeof x.covers === 'function' ? x.covers : pictures(x.covers),
      coverKey: text(x.coverKey),
      more: plain(x.more) ? x.more : {},
    };
  }
  // What a thing says, to tell whether it changed (its pictures by their coverKey).
  const sayOf = (t) => JSON.stringify([t.kind, t.title, t.line, t.day, t.people, t.params, t.more, t.coverKey, typeof t.covers === 'function' ? '' : t.covers.map((c) => c.bytes.byteLength)]);

  // A notebook's things, all of them: what it no longer has goes, and the
  // people in them join the list. Returns { things, people } (every record).
  // Only what's new or changed is written (and only its pictures asked for).
  const publishThings = (app, list) => withPeople(async (db) => {
    const at = nowIso();
    const had = (await rows(db, 'things')).map(([, t]) => t);
    const before = new Map(had.filter((t) => t.app === app).map((t) => [t.key, t]));
    const mine = [];
    const fresh = [];
    for (const x of Array.isArray(list) ? list : []) {
      const t = cleanThing(app, x);
      if (!t) continue;
      const old = before.get(t.key);
      if (old && old.say === sayOf(t)) { mine.push(old); continue; }
      const say = sayOf(t);
      const covers = typeof t.covers === 'function' ? pictures(await t.covers()) : t.covers;
      const made = { ...t, covers, say, at };
      mine.push(made);
      fresh.push(made);
    }
    const keep = new Set(mine.map((t) => t.key));
    const { records, changed } = gatherInto((await rows(db, 'people')).map(([, r]) => r), mine.flatMap((t) => t.people), at);
    const tx = db.transaction(['things', 'people'], 'readwrite');
    [...before.values()].filter((t) => !keep.has(t.key)).forEach((t) => tx.objectStore('things').delete(t.key));
    fresh.forEach((t) => tx.objectStore('things').put(t));
    changed.forEach((r) => tx.objectStore('people').put(r));
    await finish(tx);
    return { things: [...had.filter((t) => t.app !== app), ...mine], people: records };
  });
  const thingsAll = () => withPeople(async (db) => (await rows(db, 'things')).map(([, t]) => t));

  // A notebook deleted someone (Rounds' DELETE, 16 Nov; f: as it lists
  // them). Its things with them go now, and their record too, unless another
  // notebook still has them: then only this notebook's find of them goes.
  // Returns 'gone', 'kept', or null when the list never had them.
  const forgetPerson = (app, f) => withPeople(async (db) => {
    const sig = sigOf(f);
    const r = (await rows(db, 'people')).map(([, x]) => x).find((x) => x.sigs.includes(sig));
    if (!r) return null;
    const things = (await rows(db, 'things')).map(([, t]) => t);
    const mine = things.filter((t) => t.app === app && t.people.some((p) => sigOf(p) === sig));
    const kept = { ...r, sigs: r.sigs.filter((x) => x !== sig), updatedAt: nowIso() };
    const still = things.some((t) => !mine.includes(t) && isIn(kept, t));
    const tx = db.transaction(['things', 'people'], 'readwrite');
    mine.forEach((t) => tx.objectStore('things').delete(t.key));
    if (still) tx.objectStore('people').put(kept); else tx.objectStore('people').delete(r.id);
    await finish(tx);
    return still ? 'kept' : 'gone';
  });

  // ---------- For the person page ----------
  // The things a person is in: someone in them was placed with this person.
  const isIn = (person, t) => t.people.some((p) => person.sigs.includes(sigOf(p)));
  // Newest first (by day; those without one last), in loop order: { app: things }.
  function thingsFor(person, things) {
    const out = Object.fromEntries(APPS.map((a) => [a, []]));
    things.filter((t) => out[t.app] && isIn(person, t)).sort((a, b) => b.day.localeCompare(a.day) || a.title.localeCompare(b.title))
      .forEach((t) => out[t.app].push(t));
    return out;
  }
  // Their role, from the newest shoot that gives one ("Talent", "Makeup").
  function roleOf(person, things) {
    for (const t of thingsFor(person, things)['the-eye']) {
      const p = t.people.find((x) => person.sigs.includes(sigOf(x)) && x.role);
      if (p) return p.role;
    }
    return '';
  }
  // Everything the person page shows: { person, byApp, role, rounds (their
  // Rounds thing, if any), maybe (people Starky's asked about) }, or null.
  async function personView(id) {
    const [records, things] = await Promise.all([parts.peopleAll(), thingsAll()]);
    const person = records.find((r) => r.id === id);
    if (!person) return null;
    const byApp = thingsFor(person, things);
    const maybe = parts.maybePairs(records).filter((pair) => pair.includes(person)).map(([a, b]) => (a === person ? b : a));
    return { person, byApp, role: roleOf(person, things), rounds: byApp.rounds.find((t) => t.kind === 'person') || null, maybe };
  }

  // ---------- Search, from the shelf ----------
  // Words without case or accents: "José" finds "jose".
  const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hasAll = (hay, words) => words.every((w) => hay.includes(w));
  // People first (their name or handles), then each notebook's things (their
  // title, line or the people in them, or anything a person found is in), in
  // loop order. Empty words find nothing.
  function searchIn(records, things, q) {
    const words = fold(q).replace(/@/g, '').split(/\s+/).filter(Boolean);
    const out = { people: [], byApp: Object.fromEntries(APPS.map((a) => [a, []])) };
    if (!words.length) return out;
    out.people = records.filter((r) => hasAll(fold([r.name, r.instagram, r.tiktok].join(' ')), words)).sort((a, b) => a.name.localeCompare(b.name));
    const theirs = (t) => out.people.some((r) => isIn(r, t));
    things.filter((t) => out.byApp[t.app] && (theirs(t) || hasAll(fold([t.title, t.line, ...t.people.map((p) => `${p.name} ${p.instagram} ${p.tiktok}`)].join(' ')), words)))
      .sort((a, b) => b.day.localeCompare(a.day) || a.title.localeCompare(b.title))
      .forEach((t) => out.byApp[t.app].push(t));
    return out;
  }
  // Search from the shelf: as searchIn, each person with their role and their
  // Rounds thing (their group and photo): { people: [{ person, role, rounds }], byApp }.
  async function searchAll(q) {
    const [records, things] = await Promise.all([parts.peopleAll(), thingsAll()]);
    const found = searchIn(records, things, q);
    const roundsOf = (person) => things.find((t) => t.app === 'rounds' && t.kind === 'person' && isIn(person, t)) || null;
    return { ...found, people: found.people.map((person) => ({ person, role: roleOf(person, things), rounds: roundsOf(person) })) };
  }

  Object.assign(parts, { PEOPLE_APPS: APPS, pictureOf, shootPeople, cleanThing, publishThings, thingsAll, forgetPerson, thingsFor, roleOf, personView, searchIn, searchAll });
})();
