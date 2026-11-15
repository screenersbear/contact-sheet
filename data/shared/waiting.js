// What's waiting in each notebook, for the shelf's floating ! and its
// preview (round 2, connect/16 and 17): the hand-offs not yet opened or
// tucked away (df-links, connect.js), then the notebook's own items. Each
// notebook writes its own items for itself (Rounds: the day's cards; The
// Eye: its Today items), with the days each is for, so the shelf knows what
// today holds without opening it. Nothing here writes into a notebook's
// database. window.DFWaiting.
(function () {
  'use strict';
  const { nowIso, todayStr } = window.DFDataParts;
  const C = window.DFConnect;

  // ---------- A notebook's own items ----------
  // Kept on this phone, one key per notebook, written only by that notebook:
  // { at, items: [{ title, line, from, until, params }] }. from and until are
  // days ('2026-11-15'); without until, an item stays from its day on (a
  // deadline gone by stays until it's dealt with). params open it there.
  const KEY = (app) => `df-waiting-${app}`;
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const text = (s) => String(s ?? '').trim();
  function cleanItem(x) {
    if (!x || !text(x.title) || !isDay(x.from)) return null;
    const item = { title: text(x.title), line: text(x.line), from: x.from };
    if (isDay(x.until)) item.until = x.until;
    if (x.params && typeof x.params === 'object') item.params = x.params;
    return item;
  }
  function publishWaiting(app, items) {
    const clean = (Array.isArray(items) ? items : []).map(cleanItem).filter(Boolean);
    try { localStorage.setItem(KEY(app), JSON.stringify({ at: nowIso(), items: clean })); } catch (e) { /* storage full or blocked: the shelf just doesn't know */ }
    return clean;
  }
  function readOwn(app) {
    try {
      const v = JSON.parse(localStorage.getItem(KEY(app)));
      return v && Array.isArray(v.items) ? v.items.map(cleanItem).filter(Boolean) : [];
    } catch (e) { return []; }
  }
  // Its items for today (or the day given), in the order it wrote them.
  const ownWaiting = (app, today = todayStr()) => readOwn(app).filter((x) => x.from <= today && (!x.until || today <= x.until));

  // ---------- Rows for the preview ----------
  // A hand-off: the two minis with an arrow, what it is, who sent it and
  // when ("From The Eye, today"). It opens the notebook, where its slip is.
  function handoffTitle(l) {
    if (l.type === 'finals') return C.postsTitle(((l.postIds || []).length) || 2, l.title);
    if (l.type === 'new-client') return `${text(l.name) || 'Someone'} said yes`;
    return text(l.title) || C.handoff(l.type).waiting;
  }
  function handoffRow(l) {
    const when = C.whenWords(l.createdAt);
    const sender = (C.NOTEBOOKS[l.fromApp] || { name: l.fromApp }).name;
    return { kind: 'handoff', from: l.fromApp, to: l.toApp, title: handoffTitle(l), line: `From ${sender}${when ? `, ${when === 'Today' ? 'today' : when}` : ''}`, params: null };
  }
  const ownRow = (app, x) => ({ kind: 'own', from: app, to: app, title: x.title, line: x.line, params: x.params || null });

  // Everything waiting in a notebook: its hand-offs, newest first, then its
  // own items for today.
  async function waitingIn(app, today = todayStr()) {
    const links = await C.slipsFor(app);
    return [...links.map(handoffRow), ...ownWaiting(app, today).map((x) => ownRow(app, x))];
  }
  // The same for every notebook: { app: rows }.
  async function waitingAll(apps, today = todayStr()) {
    const out = {};
    for (const app of apps) out[app] = await waitingIn(app, today);
    return out;
  }
  // What the ! says to a screen reader: "Layouts: 2 things waiting".
  const waitingLabel = (name, n) => `${name}: ${n} ${n === 1 ? 'thing' : 'things'} waiting`;

  window.DFWaiting = { publishWaiting, ownWaiting, handoffTitle, handoffRow, waitingIn, waitingAll, waitingLabel };
})();
