// The year (round 2, connect/15): how the circle went, for the year page on
// the shelf. Each notebook writes its own numbers for each year, a moment
// after each change (when it tells the person list): Rounds the people
// pitched, the yeses and WHAT LED TO WORK (rounds/data/year-tally.js), Ref
// the boards made, The Eye the shoots shot, Layouts the layouts made. Kept on
// this phone, one key per notebook, written only by that notebook:
// { at, years: { '2026': { boards: 9 }, ... } } (Rounds' years also carry
// led: rows, ready to draw). Nothing here reads a notebook's database.
// window.DFYear.
(function () {
  'use strict';
  const { nowIso } = window.DFDataParts;
  const KEY = (app) => `df-year-${app}`;
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const isYear = (y) => /^\d{4}$/.test(y);
  const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0);
  // The year of a day or a time ('2026-11-15', '2026-11-15T10:00:00Z'), '' for none.
  const yearOf = (day) => (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day) ? day.slice(0, 4) : '');

  // How many of the items fall in each year, by their day: { '2026': 9 }.
  function countByYear(items, dayOf) {
    const out = {};
    for (const x of Array.isArray(items) ? items : []) {
      const y = x ? yearOf(dayOf(x)) : '';
      if (y) out[y] = (out[y] || 0) + 1;
    }
    return out;
  }
  // { boards: { '2026': 9 } } turned round: { '2026': { boards: 9 } }.
  function byYear(counts) {
    const out = {};
    for (const [name, years] of Object.entries(counts || {})) {
      for (const [y, n] of Object.entries(years || {})) (out[y] = out[y] || {})[name] = n;
    }
    return out;
  }
  // The Eye's shoots that were shot (captured, or anything after), by their day.
  const SHOT = ['captured', 'waiting_for_selects', 'editing', 'rough_cut', 'client_review', 'revisions', 'delivered'];
  const shootsByYear = (shoots) => countByYear((Array.isArray(shoots) ? shoots : []).filter((s) => s && SHOT.includes(s.status)), (s) => s.date);

  // A led row as Rounds draws it: { title, line, bg, icon }.
  const cleanRow = (r) => (plain(r) && typeof r.title === 'string' && r.title.trim()
    ? { title: r.title.trim(), line: String(r.line ?? '').trim(), bg: String(r.bg ?? ''), icon: String(r.icon ?? '') } : null);
  function cleanYears(years) {
    const out = {};
    for (const [y, v] of Object.entries(plain(years) ? years : {})) {
      if (!isYear(y) || !plain(v)) continue;
      const one = {};
      for (const [k, n] of Object.entries(v)) {
        if (k === 'led') one.led = (Array.isArray(n) ? n : []).map(cleanRow).filter(Boolean);
        else if (count(n)) one[k] = n;
      }
      out[y] = one;
    }
    return out;
  }
  function publishYear(app, years) {
    const clean = cleanYears(years);
    try { localStorage.setItem(KEY(app), JSON.stringify({ at: nowIso(), years: clean })); } catch (e) { /* storage full or blocked: the year page just doesn't know */ }
    return clean;
  }
  function readYear(app) {
    try {
      const v = JSON.parse(localStorage.getItem(KEY(app)));
      return v && plain(v.years) ? cleanYears(v.years) : {};
    } catch (e) { return {}; }
  }

  // The year page's numbers, in the loop's order, each under its notebook's mark.
  const ROWS = [
    { app: 'rounds', key: 'pitched', one: 'person pitched', many: 'people pitched' },
    { app: 'rounds', key: 'yes', one: 'said yes', many: 'said yes' },
    { app: 'ref', key: 'boards', one: 'board made', many: 'boards made' },
    { app: 'the-eye', key: 'shoots', one: 'shoot', many: 'shoots' },
    { app: 'contact-sheet', key: 'posts', one: 'post', many: 'posts' },
  ];
  // One year as the page shows it: { year, rows: [{ app, n, words }], led }.
  function yearView(year) {
    const y = String(year);
    const of = (app) => readYear(app)[y] || {};
    const rows = ROWS.map((r) => { const n = count(of(r.app)[r.key]); return { app: r.app, n, words: n === 1 ? r.one : r.many }; });
    return { year: y, rows, led: of('rounds').led || [] };
  }
  // The year the page shows on a day: this one in December, else last year's.
  // Nothing before the first December there was a page for (2026).
  const FIRST = 2026;
  function yearShown(today) {
    const y = Number(yearOf(today));
    if (!y) return null;
    const shown = today.slice(5, 7) === '12' ? y : y - 1;
    return shown >= FIRST ? shown : null;
  }

  window.DFYear = { yearOf, countByYear, byYear, shootsByYear, publishYear, readYear, ROWS, yearView, yearShown };
})();
