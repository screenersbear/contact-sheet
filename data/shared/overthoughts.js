// Overthoughts' own database, and a shoot's reflection kept there. (The
// reflection helpers are from before reflections stayed in The Eye; unused.)
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { finish, open, rows, hasText, nowIso, todayStr } = parts;

  // ---------- Overthoughts' own database ----------
  const OT = 'overthoughts';
  let otOpening = null;
  function overthoughts() {
    if (!otOpening) {
      otOpening = open(OT, 1, (db) => {
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('kind', 'kind');
        entries.createIndex('shootId', 'shootId');
        db.createObjectStore('images'); // an entry's photos, keyed by its id: [{ src, caption }], as The Eye's Journal kept them
        db.createObjectStore('reviews', { keyPath: 'id' }); // 'month-2026-11', 'year-2026'
        const links = db.createObjectStore('links', { keyPath: 'id' });
        links.createIndex('from', ['fromApp', 'fromId']);
        links.createIndex('to', ['toApp', 'toId']);
      }).then((db) => {
        db.onclose = () => { otOpening = null; };
        return db;
      });
      otOpening.catch(() => { otOpening = null; });
    }
    return otOpening;
  }
  const linkId = (fromApp, fromId, toApp, toId) => `${fromApp}:${fromId}>${toApp}:${toId}`;
  const reflectionId = (shootId) => `reflection-${shootId}`;
  // ---------- A shoot's reflection, from The Eye ----------
  // `shoot` is The Eye's shoot; `name` how The Eye shows it. Every shoot that's
  // been shot gets an entry (an empty one waits for its reflection), so the
  // weekly log can list the week's shoots the way The Eye's Journal did.
  function reflectionFromShoot(shoot, name, was, at) {
    const base = was || {};
    return {
      ...base,
      id: reflectionId(shoot.id),
      kind: 'reflection',
      shootId: shoot.id,
      shootName: name || base.shootName || 'Untitled shoot',
      date: shoot.date || base.date || todayStr(),
      shootStatus: shoot.status || '',
      archived: !!shoot.archived,
      wentRight: shoot.whatWentRight || '',
      couldBeBetter: shoot.couldBeBetter || '',
      takeaway: shoot.lessonsLearned || '',
      tags: base.tags || [],
      from: 'the-eye',
      editedIn: 'the-eye',
      createdAt: base.createdAt || shoot.capturedAt || nowIso(),
      updatedAt: at || shoot.reflectionUpdatedAt || base.updatedAt || nowIso(),
    };
  }
  async function saveReflections(list) { // [{ shoot, name, at }]: at, when it was changed (now, from The Eye)
    if (!list.length) return;
    const db = await overthoughts();
    const before = new Map((await rows(db, 'entries')).filter(([, e]) => e.kind === 'reflection').map(([, e]) => [e.id, e]));
    const entries = [], links = [];
    list.forEach(({ shoot, name, at }) => {
      const e = reflectionFromShoot(shoot, name, before.get(reflectionId(shoot.id)), at);
      entries.push(e);
      links.push({ id: linkId('the-eye', shoot.id, OT, e.id), fromApp: 'the-eye', fromId: shoot.id, toApp: OT, toId: e.id, type: 'reflection', createdAt: (before.get(e.id) && before.get(e.id).createdAt) || nowIso() });
    });
    const tx = db.transaction(['entries', 'links'], 'readwrite');
    entries.forEach((e) => tx.objectStore('entries').put(e));
    links.forEach((l) => tx.objectStore('links').put(l));
    return finish(tx);
  }
  // A shoot deleted in The Eye: its entry goes too, unless something was
  // written in it (then it stays, as the only copy of those words).
  async function dropReflections(shootIds) {
    const db = await overthoughts();
    const ids = new Set(shootIds.map(reflectionId));
    const gone = (await rows(db, 'entries')).map(([, e]) => e)
      .filter((e) => ids.has(e.id) && !hasText(e.wentRight) && !hasText(e.couldBeBetter) && !hasText(e.takeaway));
    if (!gone.length) return;
    const links = (await rows(db, 'links')).map(([, l]) => l).filter((l) => gone.some((e) => e.id === l.toId));
    const tx = db.transaction(['entries', 'links'], 'readwrite');
    gone.forEach((e) => tx.objectStore('entries').delete(e.id));
    links.forEach((l) => tx.objectStore('links').delete(l.id));
    return finish(tx);
  }
  async function reflections() {
    const db = await overthoughts();
    return (await rows(db, 'entries')).map(([, e]) => e).filter((e) => e.kind === 'reflection');
  }

  Object.assign(parts, { overthoughts, linkId, reflectionId, saveReflections, dropReflections, reflections });
})();
