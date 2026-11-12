// The notebook: floating shut on white with its two tabs, then open at the
// Table of contents. Routes: #/ (shut), #/contents. Each draft is a chapter.
import { listProjects } from './db.js';
import { openSheet, sheetIsOpen } from './ui.js';
import { ICONS } from './icons.js';
import { esc, shortDate, isIOS, isStandalone } from './util.js';
import { pageWord } from './model.js';
import { openNotebookExport } from './export.js';
import { OUT, RIM, bookSize, bookLeft } from './frame.js';
import { playFlip } from './flip.js';
import { mountStickers, openStickers } from './stickers.js';
import { makeTurnable } from './turn.js';
import { navHtml, mountNav } from './navicon.js';

const TIP_KEY = 'contact-sheet-home-tip';
const RATIO = 1000 / 1360; // the notebook art's width over its height
const PER_PAGE = 6;
const STACK = 16; // sheets drawn for the thickness of the shut book
const TURNED = (20 * Math.PI) / 180; // the shut book's turn; matches style.css
const PERSPECTIVE = 1100; // matches .nb in style.css
const TAB_OUT = 0.06; // how far the tabs stick out, of the book's width
const OPEN_MS = 860; // the cover swinging open and the book zooming in
const ZOOM_MS = 760;
const BOOK_KEY = 'contact-sheet-book'; // also read in index.html, before the first paint
const START_KEY = 'contact-sheet-start'; // 'first' opens on the Table of contents
const TABS = [['toc', 'Table of contents'], ['new', 'New chapter']];
const COLORS = [
  ['orange', 'Orange'],
  ['mango', 'Mango'],
  ['berry', 'Berry'],
  ['fern', 'Fern'],
  ['ocean', 'Ocean'],
  ['ink', 'Black'],
];

function useBook(name) {
  document.documentElement.dataset.book = name;
  try {
    localStorage.setItem(BOOK_KEY, name);
  } catch {}
}

// Resolves once the notebook's art can paint, so the shut book appears whole.
// Never waits long: a slow file shouldn't keep the notebook away.
function artReady() {
  const book = document.documentElement.dataset.book || 'orange';
  const ready = ['cover', 'block'].map((part) => {
    const img = new Image();
    img.src = `art/${book}-${part}.webp`;
    return img.decode().catch(() => {});
  });
  if (document.fonts && document.fonts.load) ready.push(document.fonts.load('16px Mansalva').catch(() => {}));
  return Promise.race([Promise.all(ready), new Promise((done) => setTimeout(done, 1200))]);
}

export function startsOnFirstPage() {
  try {
    return localStorage.getItem(START_KEY) === 'first';
  } catch {
    return false;
  }
}

// The sun beside the shut notebook: one sheet, laid out like Ref Notebook's,
// with this app's own settings.
function openOptions(stickers) {
  const now = document.documentElement.dataset.book;
  const first = startsOnFirstPage();
  const s = openSheet({
    title: 'Options',
    className: 'sheet-small sheet-options',
    body: `
      <span class="field-label">App color</span>
      <div class="opt-colors">
        ${COLORS.map(([key, name]) => `
          <button type="button" class="opt-color" data-color="${key}" aria-pressed="${key === now}">
            <span class="opt-book" style="background-image:url(art/${key}-cover.webp)"></span>
            <span>${name}</span>
          </button>`).join('')}
      </div>
      <span class="field-label opt-gap">Stickers</span>
      <button type="button" class="btn secondary opt-wide" data-stickers>Stickers</button>
      <span class="field-label opt-gap">Always start</span>
      <div class="opt-seg" role="group" aria-label="Always start">
        <button type="button" data-start="notebook" aria-pressed="${!first}">In the notebook</button>
        <button type="button" data-start="first" aria-pressed="${first}">On the first page</button>
      </div>
      <span class="field-label opt-gap">Export</span>
      <button type="button" class="btn secondary opt-wide" data-pdf>Whole notebook as PDF</button>`,
  });
  s.body.addEventListener('click', (e) => {
    const color = e.target.closest('[data-color]');
    if (color) {
      useBook(color.dataset.color);
      s.body.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b === color)));
      return;
    }
    const start = e.target.closest('[data-start]');
    if (start) {
      try {
        localStorage.setItem(START_KEY, start.dataset.start);
      } catch {}
      s.body.querySelectorAll('[data-start]').forEach((b) => b.setAttribute('aria-pressed', String(b === start)));
      return;
    }
    // Placing a sticker happens on the cover, so Options goes once a shape is picked.
    if (e.target.closest('[data-stickers]')) openStickers(stickers, () => s.close());
    else if (e.target.closest('[data-pdf]')) {
      s.close();
      openNotebookExport();
    }
  });
}

export function modeOfHash(h) {
  return h === '/contents' || h === '/book' ? 'toc' : 'closed';
}
const currentMode = () => modeOfHash((location.hash || '#/').slice(1) || '/');

export function mountBook(view, startMode, onNew) {
  document.body.dataset.route = 'book';
  view.innerHTML = `
    <div class="nb no-anim${startMode === 'closed' ? ' is-waiting' : ''}" data-mode="${startMode}">
      <div class="nb-probe"></div>
      <div class="nb-ground"></div>
      <div class="nb-float">
        <div class="nb-book">
          <div class="nb-stack">
            ${Array.from({ length: STACK }, (_, i) => `<i style="--i:${i + 1}"></i>`).join('')}
            <b style="--i:${STACK + 1}"></b>
            <u class="nb-box is-spine"></u>
            <u class="nb-box is-top"></u>
            <u class="nb-box is-bottom"></u>
          </div>
          <div class="nb-side-tabs">
            ${TABS.map(([key, name], i) => `<i class="is-${key}" style="--t:${i};--i:${5 + i * 6}"><span>${name}</span></i>`).join('')}
          </div>
          <div class="nb-block"></div>
          <div class="nb-leaf">
            <div class="nb-front"></div>
            <div class="nb-inside"></div>
          </div>
        </div>
      </div>
      <div class="nb-tabhits">
        ${TABS.map(([key, name]) => `<button type="button" class="nb-tabhit" data-tab="${key}" aria-label="${name}"></button>`).join('')}
      </div>
      <div class="nb-toc" hidden>
        <div class="nb-open" data-tocbook>
          <span></span><span></span>
          <i class="nb-spine"></i>
          <div class="toc-page is-left" data-left></div>
          <div class="toc-page is-right" data-right></div>
        </div>
        <nav class="ed-tools" aria-label="Contents">
          ${navHtml()}
          <button type="button" class="tool" data-toc="new"><span class="tool-icon">${ICONS.plus}</span><span class="tool-label">New chapter</span></button>
        </nav>
      </div>
    </div>
    <button type="button" class="nb-sun" aria-label="App options">${ICONS.sun}</button>`;

  const root = view.querySelector('.nb');
  // Beside the notebook, not in it: there from the start, while the
  // notebook waits for its art to fade in.
  const sun = view.querySelector('.nb-sun');
  const toc = root.querySelector('.nb-toc');
  const probe = root.querySelector('.nb-probe');
  const tocBook = root.querySelector('[data-tocbook]');
  const leftEl = root.querySelector('[data-left]');
  const rightEl = root.querySelector('[data-right]');
  const sideTabs = root.querySelector('.nb-side-tabs');
  const tabHits = root.querySelector('.nb-tabhits');
  const stickers = mountStickers(root, root.querySelector('.nb-front'));
  let geo = { W: 300, H: 400 };
  let page = 300; // one page of the open notebook, from the spine out
  let two = false; // both pages in view at once
  let left = OUT;
  let frameH = 700;
  let maxPan = 0;
  let pan = 0;
  let timer = 0;
  let destroyed = false;
  let chapters = [];
  let thumbs = new Map();
  let tocPage = 0;
  let turning = false;
  let swipe = null;
  let swiped = false;
  let showTip = false;

  // The shut book is the same size as Documenting Fictions' shut book.
  function shutBook(vw, vh) {
    const cos = Math.cos(TURNED);
    const sin = Math.sin(TURNED);
    const seenOf = (W) => {
      const depth = (STACK + 1) * W * 0.0112;
      return [[-W / 2, 0], [W / 2, 0], [-W / 2, -depth], [W / 2 + W * TAB_OUT, -depth * 0.7]].map(
        ([x, d]) => ((x * cos - d * sin) * PERSPECTIVE) / (PERSPECTIVE - (x * sin + d * cos)),
      );
    };
    const W = Math.min(vw * 0.78, vh * 0.66 * RATIO, 460);
    // Turned, the near side looks bigger and the pages and tabs show down the
    // right, so what you see would sit right of the middle. This slides it
    // back by half that difference.
    const seen = seenOf(W);
    return { W, shutX: -(Math.min(...seen) + Math.max(...seen)) / 2 / cos };
  }

  function measure() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const frame = probe.getBoundingClientRect();
    frameH = frame.height;
    const size = bookSize(vw, frameH);
    two = size.two;
    page = size.one;
    left = bookLeft(vw, page);
    maxPan = Math.max(0, 2 * page + 2 * left - vw);
    const { W, shutX } = shutBook(vw, vh);
    const H = W / RATIO;
    geo = { W, H };
    const kx = page / W;
    const ky = frameH / H;
    const set = (k, v) => root.style.setProperty(k, v);
    set('--W', `${W}px`);
    set('--H', `${H}px`);
    set('--shut-x', `${shutX}px`);
    // Zoomed in, a page lands exactly on the frame the contents draw.
    set('--kx', String(kx));
    set('--ky', String(ky));
    set('--rx', `${RIM / kx}px`);
    set('--ry', `${RIM / ky}px`);
    set('--toc-x', `${left + page - vw / 2}px`);
    set('--new-x', `${left + page - maxPan - vw / 2}px`);
    set('--toc-y', `${frame.top + frameH / 2 - vh / 2}px`);
    set('--page', `${page}px`);
    tocBook.style.width = `${2 * page}px`;
    showCamera(panOf(tocPage));
  }

  // Where the tabs land on screen with the book shut. Measured in that pose
  // in one go, before anything paints: the tabs themselves are turned in 3D.
  function placeTabHits() {
    const mode = root.dataset.mode;
    const still = root.classList.contains('no-anim');
    root.classList.add('no-anim');
    root.dataset.mode = 'closed';
    const rects = [...sideTabs.children].map((el) => el.getBoundingClientRect());
    [...tabHits.children].forEach((hit, i) => {
      const r = rects[i];
      const above = i ? (rects[i - 1].bottom + r.top) / 2 : r.top - 6;
      const below = i < rects.length - 1 ? (r.bottom + rects[i + 1].top) / 2 : r.bottom + 6;
      hit.style.cssText = `left:${r.left - 8}px;right:0;top:${above}px;height:${below - above}px`;
    });
    root.dataset.mode = mode;
    if (!still) root.classList.remove('no-anim');
    void root.offsetWidth;
  }

  const pageCount = () => Math.max(1, Math.ceil(chapters.length / PER_PAGE));
  const panOf = (n) => (two || n % 2 === 0 ? 0 : maxPan);
  const spreadOf = (n) => Math.floor(n / 2);

  // The notebook slides under the screen: left page, then right page.
  function showCamera(x, ms = 0) {
    pan = x;
    tocBook.style.transition = ms ? `transform ${ms}ms cubic-bezier(.22,.61,.36,1)` : 'none';
    tocBook.style.transform = `translateX(${left - x}px)`;
  }

  function rowHtml(p) {
    const u = thumbs.get(p.id);
    return `
      <div class="toc-row">
        <a class="toc-open" href="#/edit/${esc(p.id)}" draggable="false">
          <span class="toc-thumb">${u ? `<img src="${u}" alt="" draggable="false" />` : ''}</span>
          <span class="toc-text">
            <span class="toc-name">${esc(p.name)}</span>
            <span class="toc-meta">${p.slides} ${esc(pageWord(p, p.slides !== 1))} · ${esc(shortDate(p.updatedAt))}</span>
          </span>
        </a>
      </div>`;
  }

  function pageHtml(n) {
    const total = pageCount();
    if (n >= total) return '';
    const rows = chapters.slice(n * PER_PAGE, (n + 1) * PER_PAGE).map(rowHtml).join('');
    const tip = n === 0 && showTip
      ? `<p class="toc-tip"><b>Keep your chapters safe:</b> add Contact Sheet to your Home Screen. Safari can clear the photos of sites that aren't on it. <button type="button" class="text-btn" data-tip-off>Got it</button></p>`
      : '';
    return `
      <h2 class="nb-head">Table of contents</h2>
      <div class="toc-list">${rows || '<p class="toc-empty">No chapters yet.</p>'}</div>
      ${tip}
      <div class="toc-foot">${total > 1 ? `${n + 1} / ${total}` : ''}</div>`;
  }

  function drawPages() {
    const first = spreadOf(tocPage) * 2;
    leftEl.innerHTML = pageHtml(first);
    rightEl.innerHTML = pageHtml(first + 1);
    root.classList.toggle('at-right', panOf(tocPage) > 0);
  }

  function releaseThumbs() {
    thumbs.forEach((u) => URL.revokeObjectURL(u));
    thumbs = new Map();
  }

  async function drawToc() {
    const projects = await listProjects();
    if (destroyed) return;
    releaseThumbs();
    chapters = projects;
    chapters.forEach((p) => p.thumb && thumbs.set(p.id, URL.createObjectURL(p.thumb)));
    tocPage = Math.min(tocPage, pageCount() - 1);
    showTip = (() => {
      if (!isIOS() || isStandalone()) return false;
      try {
        return localStorage.getItem(TIP_KEY) !== 'off';
      } catch {
        return true;
      }
    })();
    drawPages();
    showCamera(panOf(tocPage));
  }

  // Goes to a page the way a chapter does: across to the other side of the
  // spread, or a page turn to the next one.
  function goPage(n) {
    if (turning) return;
    // Swiping back from the first page shuts the notebook.
    if (n < 0) {
      location.hash = '#/';
      return;
    }
    if (n >= pageCount()) {
      showCamera(panOf(tocPage), 240);
      return;
    }
    const from = spreadOf(tocPage);
    const to = spreadOf(n);
    if (from === to) {
      tocPage = n;
      root.classList.toggle('at-right', panOf(n) > 0);
      showCamera(panOf(n), 260);
      return;
    }
    const x0 = pan;
    const x1 = panOf(n);
    tocPage = n;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawPages();
      showCamera(x1);
      return;
    }
    turning = true;
    const face = (k) => {
      const el = document.createElement('div');
      el.innerHTML = `<div class="toc-page is-face">${pageHtml(k)}</div>`;
      return el;
    };
    playFlip({
      host: tocBook,
      rect: { left: RIM, top: RIM, width: 2 * (page - RIM), height: frameH - 2 * RIM },
      oldL: from * 2,
      newL: to * 2,
      face,
      onStep: (t) => showCamera(x0 + (x1 - x0) * t),
      onDone: () => (turning = false),
    });
    drawPages();
  }
  const step = (dir) => goPage(two ? (spreadOf(tocPage) + dir) * 2 : tocPage + dir);

  function setMode(next, instant = false) {
    nav.reset();
    if (next !== 'closed') {
      stickers.drop();
      turn.reset();
    }
    clearTimeout(timer);
    const wasShut = root.dataset.mode === 'closed';
    root.classList.toggle('no-anim', instant);
    if (next === 'toc') {
      drawToc();
      root.dataset.mode = 'toc';
      const show = () => {
        toc.hidden = false;
        root.classList.add('is-reading');
      };
      if (instant) show();
      else timer = setTimeout(show, wasShut ? OPEN_MS : ZOOM_MS);
    } else {
      toc.hidden = true;
      root.classList.remove('is-reading');
      if (next === 'closed') {
        tocPage = 0;
        root.classList.remove('at-right');
      }
      root.dataset.mode = next;
    }
    if (instant) setTimeout(() => root.classList.remove('no-anim'), 60);
  }

  function startNew() {
    const wasShut = root.dataset.mode === 'closed';
    setMode('new');
    timer = setTimeout(async () => {
      const made = await onNew();
      if (!made && !destroyed) setMode(currentMode());
    }, wasShut ? OPEN_MS : 620);
  }

  // Any new touch, anywhere on the book, is a fresh start.
  root.addEventListener('pointerdown', () => (swiped = false), true);
  // Shut, the notebook can be turned by hand.
  const turn = makeTurnable(root, {
    size: () => geo.W,
    onMoved: () => (swiped = true),
    canStart: (e) =>
      root.dataset.mode === 'closed' &&
      !root.classList.contains('is-sticking') &&
      Math.abs(e.clientX - window.innerWidth / 2) <= geo.W * 0.62 &&
      Math.abs(e.clientY - window.innerHeight / 2) <= geo.H * 0.56,
  });
  // The navigation icon on the bottom row: its left triangle shuts the book.
  const nav = mountNav(toc.querySelector('.ed-tools'), {
    onShut: () => (location.hash = '#/'),
    onSwiped: () => (swiped = true),
  });
  tocBook.addEventListener('pointerdown', (e) => {
    if (turning) return;
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, base: pan, moved: false, samples: [] };
  });
  tocBook.addEventListener('pointermove', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (!swipe.moved) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      swipe.moved = true;
      // Only now: held from the start, a tap on a row would never reach it.
      try {
        tocBook.setPointerCapture(e.pointerId);
      } catch {}
    }
    swipe.samples.push({ t: e.timeStamp, x: e.clientX });
    if (swipe.samples.length > 6) swipe.samples.shift();
    if (two) return;
    // The page follows the finger, and gives a little past the last one.
    const hi = spreadOf(tocPage) * 2 + 1 < pageCount() ? maxPan : 0;
    const x = swipe.base - dx;
    showCamera(x < 0 ? x * 0.4 : x > hi ? hi + (x - hi) * 0.4 : x);
  });
  tocBook.addEventListener('pointerup', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const was = swipe;
    swipe = null;
    if (!was.moved) return;
    swiped = true;
    const dx = e.clientX - was.x;
    const a = was.samples[0];
    const b = was.samples[was.samples.length - 1];
    const v = a && b && b.t > a.t && e.timeStamp - b.t < 60 ? (b.x - a.x) / (b.t - a.t) : 0;
    const flick = Math.abs(v) > 0.35 && Math.sign(v) === Math.sign(dx);
    if (Math.abs(dx) > (two ? 36 : page * 0.28) || flick) step(dx < 0 ? 1 : -1);
    else showCamera(panOf(tocPage), 240);
  });
  tocBook.addEventListener('pointercancel', () => {
    if (swipe && swipe.moved) showCamera(panOf(tocPage), 240);
    swipe = null;
  });

  function onKey(e) {
    if (root.dataset.mode !== 'toc' || sheetIsOpen()) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }
  document.addEventListener('keydown', onKey);

  sun.addEventListener('click', () => {
    if (root.dataset.mode === 'closed' && !root.classList.contains('is-sticking')) openOptions(stickers);
  });

  root.addEventListener('click', async (e) => {
    // Placing a sticker: the cover and tabs wait until OK.
    if (root.classList.contains('is-sticking')) return;
    // The end of a swipe is not a tap on whatever it finished over.
    if (swiped || turning) {
      swiped = false;
      e.preventDefault();
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      if (tab.dataset.tab === 'toc') location.hash = '#/contents';
      else startNew();
      return;
    }
    const t = e.target.closest('[data-toc]');
    if (t) {
      if (t.dataset.toc === 'shut') nav.shut();
      else if (t.dataset.toc === 'first') {
        if (tocPage) goPage(0);
      } else startNew();
      return;
    }
    if (e.target.closest('[data-tip-off]')) {
      try {
        localStorage.setItem(TIP_KEY, 'off');
      } catch {}
      showTip = false;
      drawPages();
      return;
    }
    if (e.target.closest('.nb-toc')) return;
    // The cover opens straight to the contents.
    if (root.dataset.mode === 'closed') {
      const dx = Math.abs(e.clientX - window.innerWidth / 2);
      const dy = Math.abs(e.clientY - window.innerHeight / 2);
      if (dx <= geo.W / 2 && dy <= geo.H / 2) location.hash = '#/contents';
    }
  });

  const refit = () => {
    measure();
    placeTabHits();
  };
  window.addEventListener('resize', refit);
  measure();
  setMode(startMode, true);
  placeTabHits();
  Promise.race([Promise.all([artReady(), stickers.ready]), new Promise((done) => setTimeout(done, 1500))]).then(() => root.classList.remove('is-waiting'));

  return {
    setMode,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', refit);
      document.removeEventListener('keydown', onKey);
      releaseThumbs();
      stickers.destroy();
      nav.destroy();
      delete document.body.dataset.route;
    },
  };
}
