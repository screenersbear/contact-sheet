// How the notebooks connect (round 2, connect/NOTES.md): each notebook hands
// one thing to the next and the work goes round: Ref to The Eye (a mood
// board), The Eye to Layouts (the finals) and to Rounds (the shoot's people),
// Layouts to Rounds (the people in a post), Rounds to Ref (a new client).
// Every hand-off is a link in df-links (links.js), so no notebook writes
// into another's database. One that arrives shows once, as a slip at the top
// of the receiving list, until it's opened or tucked away (NOT NOW); while
// it waits, the notebook has a slip on its cover on the shelf. Each hand-off
// has a switch (the shelf's Options, HOW THEY CONNECT), all on unless turned
// off; off, it simply doesn't happen. window.DFConnect.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { linksWhere, saveLink, nowIso } = parts;

  // The hand-offs in the loop's order. type: the link's type in df-links;
  // waiting: what a slip on the shelf says is there.
  const HANDOFFS = [
    { key: 'moodboards', from: 'ref', to: 'the-eye', type: 'moodboard', name: 'Mood boards', line: "A board sent to a shoot stays live until it's shot." },
    { key: 'finals', from: 'the-eye', to: 'contact-sheet', type: 'finals', name: 'Final images', line: 'Delivered finals arrive, with two posts made.', waiting: 'finals from The Eye' },
    { key: 'people', from: 'the-eye', to: 'rounds', type: 'people', name: "The shoot's people", line: 'Talent and team come in with a thank-you ready.' },
    { key: 'posts', from: 'contact-sheet', to: 'rounds', type: 'post-people', name: 'New posts', line: 'When a post goes up, a nudge for the people in it.', waiting: 'a new post from Layouts' },
    { key: 'clients', from: 'rounds', to: 'ref', type: 'new-client', name: 'New clients', line: 'A yes, or someone asking to shoot, starts a board.', waiting: 'a new client from Rounds' },
  ];
  const handoff = (type) => HANDOFFS.find((h) => h.type === type) || null;

  // Each notebook's own pair of colours and its small mark (24 x 24), as the
  // slips and the HOW THEY CONNECT rows show them.
  const NOTEBOOKS = {
    ref: { name: 'Ref', bg: '#0A4FD6', fg: '#FFAFAB' },
    'the-eye': { name: 'The Eye', bg: '#FFD100', fg: '#313D45' },
    'contact-sheet': { name: 'Layouts', bg: '#CC2E8A', fg: '#E2E600' },
    rounds: { name: 'Rounds', bg: '#313D45', fg: '#FFD100' },
  };
  const MARKS = {
    ref: '<g transform="translate(12 12) rotate(45) translate(-6 -6)"><rect width="6" height="6" fill="#FFAFAB"/><rect x="6" width="6" height="6" fill="#FFFFFF"/><rect y="6" width="6" height="6" fill="#FFFFFF"/><rect x="6" y="6" width="6" height="6" fill="#FFAFAB"/></g>',
    'the-eye': '<circle cx="12" cy="12" r="6.5" fill="none" stroke="#313D45" stroke-width="3"/>',
    'contact-sheet': '<rect x="5" y="6" width="3.6" height="12" fill="#E2E600"/><rect x="10.2" y="8.4" width="3.6" height="9.6" fill="#FFFFFF"/><rect x="15.4" y="10.3" width="3.6" height="7.7" fill="#E2E600"/>',
    rounds: '<path d="M5 17 A7 7 0 0 1 19 17" fill="none" stroke="#FFD100" stroke-width="2.2"/><circle cx="6" cy="13.2" r="2" fill="#14BFA0"/><circle cx="12" cy="10" r="1.6" fill="#FFFFFF"/><circle cx="18" cy="13.2" r="1.3" fill="#14BFA0"/>',
  };
  const markSvg = (app, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${MARKS[app] || ''}</svg>`;
  // A notebook's mark on its colour, 20 px square.
  const miniHtml = (app) => `<span class="df-mini" style="background:${(NOTEBOOKS[app] || {}).bg || '#E1E1DC'}" aria-hidden="true">${markSvg(app)}</span>`;
  // From one notebook to another: the two minis with an arrow between.
  const ARROW = '<svg class="df-arrow" viewBox="0 0 16 10" width="16" height="10" aria-hidden="true"><path d="M1 5h12M9 1.5 13 5 9 8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const pairHtml = (from, to) => `<span class="df-pair">${miniHtml(from)}${ARROW}${miniHtml(to)}</span>`;

  // ---------- The switches ----------
  // Kept on this phone for every notebook in the suite (they share its storage).
  const SWITCHES = 'df-connect';
  function switches() {
    try {
      const v = JSON.parse(localStorage.getItem(SWITCHES));
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  const connectOn = (key) => switches()[key] !== false;
  function setConnect(key, on) {
    try { localStorage.setItem(SWITCHES, JSON.stringify({ ...switches(), [key]: !!on })); } catch (e) { /* storage blocked: stays as it was */ }
  }

  // ---------- Slips ----------
  const isWaiting = (l) => !!handoff(l.type) && !!handoff(l.type).waiting && !l.openedAt && !l.tuckedAt;
  // The hand-offs waiting in a notebook, newest first.
  const slipsFor = async (app) => (await linksWhere({ toApp: app })).filter(isWaiting).reverse();
  // Its main button pressed (openedAt) or NOT NOW (tuckedAt): it doesn't show again.
  const openSlip = (l) => saveLink({ ...l, openedAt: nowIso() });
  const tuckSlip = (l) => saveLink({ ...l, tuckedAt: nowIso() });
  // For the shelf: what's waiting in each notebook, newest first,
  // { app: [{ from, what }, ...] }.
  async function waitingByApp() {
    const out = {};
    for (const l of (await linksWhere()).filter(isWaiting).reverse()) (out[l.toApp] = out[l.toApp] || []).push({ from: l.fromApp, what: handoff(l.type).waiting });
    return out;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // TODAY, or the day it came ('14 Nov'), as the slip's corner says it.
  function whenWords(iso, now = new Date()) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const same = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return same ? 'Today' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // A slip, the same in every notebook: FROM <NOTEBOOK> in the sender's
  // colours, the day, a title, one dim line, what it brought (body, markup),
  // then one main button in the receiving notebook's colour and NOT NOW.
  const sender = (app) => NOTEBOOKS[app] || { name: app, bg: '#E1E1DC', fg: '#313D45' };
  // The notched tag, FROM <NOTEBOOK> in the sender's colours with its mark.
  const tagHtml = (app) => `<span class="df-slip-tag" style="background:${sender(app).bg};color:${sender(app).fg}">${markSvg(app, 18)}From ${esc(sender(app).name)}</span>`;
  function slipHtml({ link, title, line, body = '', main, mainClass = '' }) {
    return `<section class="df-slip" data-slip="${esc(link.id)}" aria-label="From ${esc(sender(link.fromApp).name)}">
      <div class="df-slip-head">${tagHtml(link.fromApp)}<span class="df-slip-when">${esc(whenWords(link.createdAt))}</span></div>
      <p class="df-slip-title">${esc(title)}</p>
      ${line ? `<p class="df-slip-line">${esc(line)}</p>` : ''}${body}
      <div class="df-slip-actions"><button type="button" class="df-slip-main ${mainClass}" data-slip-open>${esc(main)}</button><button type="button" class="df-slip-later" data-slip-later>Not now</button></div>
    </section>`;
  }

  // ---------- What passes ----------
  // An Instagram handle as typed (@name, a profile address, or the name), cleaned.
  function cleanHandle(v) {
    const t = String(v ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, '');
    return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : '';
  }
  const named = (x) => !!x && typeof x.name === 'string' && x.name.trim() !== '';
  // A shoot's credits from The Eye, for a caption: its talent and team, each
  // with an Instagram handle when there is one.
  function shootCredits(shoot) {
    const insta = (list) => cleanHandle(((list || []).find((h) => h && h.platform === 'instagram') || {}).handle);
    return {
      talent: ((shoot && shoot.talents) || []).filter(named).map((t) => ({ name: t.name.trim(), handle: insta(t.socialHandles) })),
      team: ((shoot && shoot.teamMembers) || []).filter(named).map((m) => ({
        role: String(m.role || '').trim(), name: m.name.trim(),
        handle: (m.socialPlatform || 'instagram') === 'instagram' ? cleanHandle(m.socialHandle) : '',
      })),
    };
  }
  const listWords = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  // A post's caption: the shoot's title, then the credits ("Rooftop portraits
  // with June Park @junepark.jpg. Hair and makeup @iryna.hmua.").
  function captionFor(title, credits) {
    const c = credits || {};
    const who = (c.talent || []).map((t) => (t.handle ? `${t.name} @${t.handle}` : t.name));
    const head = `${String(title || '').trim() || 'New work'}${who.length ? ` with ${listWords(who)}` : ''}.`;
    const team = (c.team || []).map((m) => `${m.role || 'With'} ${m.handle ? `@${m.handle}` : m.name}.`);
    return [head, ...team].join(' ');
  }
  // Everyone tagged in a caption, each once, as typed.
  const handlesIn = (text) => [...new Set((String(text || '').match(/(^|[^\w.@])@([A-Za-z0-9._]{1,30})/g) || []).map((m) => m.replace(/^[^@]*@/, '').replace(/\.+$/, '')))].filter(Boolean);

  const DAY = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  // A shoot's record in The Eye (connect/02): what it passed on (its finals
  // to Layouts, its people to Rounds) and what came in (a board from Ref).
  // Each row opens the thing in the other notebook: { app, params }.
  function passedOnRows(links, shootId) {
    const passed = [];
    const came = [];
    for (const l of links) {
      if (l.fromApp === 'the-eye' && l.fromId === shootId && l.type === 'finals') {
        passed.push({ from: 'the-eye', to: 'contact-sheet', title: `${plural(l.count || 0, 'final', 'finals')} to Layouts`, line: l.madeAt ? `${postsWord((l.postIds || []).length || 2)} made, waiting there.` : 'Waiting there.', app: 'contact-sheet', params: { posts: l.id } });
      } else if (l.fromApp === 'the-eye' && l.fromId === shootId && l.type === 'people') {
        const names = l.names || [];
        passed.push({ from: 'the-eye', to: 'rounds', title: `${plural(names.length, 'person', 'people')} to Rounds`, line: `${names.join(', ').replace(/\.$/, '')}. ${names.length === 1 ? 'A thank-you' : 'Thank-yous'} ready.`, app: 'rounds', params: { at: 'people' } });
      } else if (l.toApp === 'the-eye' && l.toId === shootId && l.type === 'moodboard') {
        const when = DAY(l.frozenAt || l.drawnAt || l.importedAt || l.updatedAt);
        came.push({ from: 'ref', to: 'the-eye', title: l.name || 'Mood board', line: `Mood board from Ref${when ? `, as of ${when}` : ''}.`, app: 'ref', params: l.importedAt ? null : { board: l.fromId } });
      }
    }
    // The finals first, then the people (as in connect/02), whichever passed first.
    const order = (r) => (r.to === 'contact-sheet' ? 0 : 1);
    return { passed: passed.sort((a, b) => order(a) - order(b)), came };
  }

  // ---------- Finals into posts (Layouts, connect/03) ----------
  // Which finals go in the two posts, by their place in The Eye's list (the
  // order they were added): a carousel of up to 5 starting with the first
  // (the cover), the rest spread through the set so it isn't five of one
  // look; the single is the first one left over. One final makes only the
  // single; up to five make only the carousel.
  function pickPosts(n) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    if (count === 0) return { carousel: [], single: null };
    if (count === 1) return { carousel: [], single: 0 };
    if (count <= 5) return { carousel: [...Array(count).keys()], single: null };
    const carousel = [0, 1, 2, 3, 4].map((i) => Math.round((i * count) / 5));
    return { carousel, single: [...Array(count).keys()].find((i) => !carousel.includes(i)) };
  }
  const postsWord = (n) => (n === 1 ? 'A post' : n === 2 ? 'Two posts' : `${n} posts`);
  // The slip's line: "12 finals. Two posts made from them, ready to look over."
  const postsLine = (finals, posts) => `${plural(finals, 'final', 'finals')}. ${postsWord(posts)} made from ${finals === 1 ? 'it' : 'them'}, ready to look over.`;
  // The page's title: "Two posts from Rooftop portraits".
  const postsTitle = (posts, title) => `${postsWord(posts)} from ${String(title || '').trim() || 'the shoot'}`;

  // The rows of a record (passedOnRows), each a link to the other notebook
  // when it has an address (row.href), a plain row when it hasn't.
  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function recordHtml(rows) {
    const row = (r) => {
      const inner = `${pairHtml(r.from, r.to)}<span class="df-record-words"><span class="df-record-title">${esc(r.title)}</span><span class="df-record-line">${esc(r.line)}</span></span>`;
      return r.href
        ? `<a class="df-record-row" href="${esc(r.href)}">${inner}<span class="df-record-chev">${CHEV}</span></a>`
        : `<div class="df-record-row">${inner}</div>`;
    };
    return `<div class="df-record">${rows.map(row).join('')}</div>`;
  }

  window.DFConnect = {
    HANDOFFS, NOTEBOOKS, handoff, connectOn, setConnect, slipsFor, openSlip, tuckSlip, waitingByApp,
    whenWords, slipHtml, tagHtml, markSvg, miniHtml, pairHtml, cleanHandle, shootCredits, captionFor, handlesIn, passedOnRows, recordHtml, pickPosts, postsLine, postsTitle,
  };
})();
