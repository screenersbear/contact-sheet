// The notebook: floating shut on white, open at its first two pages, and
// zoomed into the Table of contents. Routes: #/ (shut), #/book (open),
// #/contents. Each draft is a chapter.
import { listProjects, deleteProject } from './db.js';
import { confirmSheet, sheetIsOpen } from './ui.js';
import { ICONS } from './icons.js';
import { esc, shortDate, isIOS, isStandalone } from './util.js';
import { pageWord } from './model.js';

const TIP_KEY = 'contact-sheet-home-tip';
const RATIO = 1000 / 1360; // the notebook art's width over its height
const PER_PAGE = 6;
const STACK = 16; // sheets drawn for the thickness of the shut book
const TURN_MS = 560;

export function modeOfHash(h) {
  return h === '/contents' ? 'toc' : h === '/book' ? 'open' : 'closed';
}
const currentMode = () => modeOfHash((location.hash || '#/').slice(1) || '/');

export function mountBook(view, startMode, onNew) {
  document.body.dataset.route = 'book';
  view.innerHTML = `
    <div class="nb no-anim" data-mode="${startMode}">
      <div class="nb-ground"></div>
      <div class="nb-float">
        <div class="nb-book">
          <div class="nb-stack">
            ${Array.from({ length: STACK }, (_, i) => `<i style="--i:${i + 1}"></i>`).join('')}
            <b style="--i:${STACK + 1}"></b>
          </div>
          <div class="nb-block"></div>
          <div class="nb-words nb-new"><span class="nb-plus">${ICONS.plus}</span><span class="nb-word">New chapter</span></div>
          <div class="nb-leaf">
            <div class="nb-front"></div>
            <div class="nb-inside">
              <div class="nb-words"><span class="nb-word">Table of contents</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="nb-toc" hidden>
        <div class="nb-toc-area">
          <div class="nb-sheet" data-sheet><div class="nb-sheet-in" data-page></div></div>
          <div data-tip></div>
        </div>
        <nav class="ed-tools" aria-label="Contents">
          <button type="button" class="tool" data-toc="back"><span class="tool-icon">${ICONS.back}</span><span class="tool-label">Back</span></button>
          <button type="button" class="tool" data-toc="new"><span class="tool-icon">${ICONS.plus}</span><span class="tool-label">New chapter</span></button>
        </nav>
      </div>
    </div>`;

  const root = view.querySelector('.nb');
  const toc = root.querySelector('.nb-toc');
  const sheet = root.querySelector('[data-sheet]');
  const pageEl = root.querySelector('[data-page]');
  const tipEl = root.querySelector('[data-tip]');
  let geo = { W: 300, H: 400, k: 0.6 };
  let timer = 0;
  let destroyed = false;
  let chapters = [];
  let thumbs = new Map();
  let tocPage = 0;
  let turning = false;
  let swipe = null;
  let swiped = false;

  function measure() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const W = Math.min(vw * 0.84, vh * 0.68 * RATIO, 460);
    const H = W / RATIO;
    const k = Math.min(1, (vw - 14) / (2 * W), (vh * 0.82) / H);
    const kz = Math.min((vw - 8) / W, (vh - 90) / H);
    geo = { W, H, k };
    root.style.setProperty('--W', `${W}px`);
    root.style.setProperty('--H', `${H}px`);
    root.style.setProperty('--k', String(k));
    root.style.setProperty('--kz', String(kz));
    // The contents page sits centred above its bottom bar.
    const bar = toc.querySelector('.ed-tools');
    const barH = toc.hidden ? 56 : bar.offsetHeight;
    root.style.setProperty('--toc-up', `${-barH / 2}px`);
  }

  const pageCount = () => Math.max(1, Math.ceil(chapters.length / PER_PAGE));

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
        <button type="button" class="toc-x" data-del="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">${ICONS.x}</button>
      </div>`;
  }

  function pageHtml(n) {
    const rows = chapters.slice(n * PER_PAGE, (n + 1) * PER_PAGE).map(rowHtml).join('');
    const total = pageCount();
    return `
      <h2 class="nb-head">Table of contents</h2>
      <div class="toc-list">${rows || '<p class="toc-empty">No chapters yet.</p>'}</div>
      <div class="toc-foot">${total > 1 ? `${n + 1} / ${total}` : ''}</div>`;
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
    pageEl.innerHTML = pageHtml(tocPage);
    const showTip = (() => {
      if (!isIOS() || isStandalone()) return false;
      try {
        return localStorage.getItem(TIP_KEY) !== 'off';
      } catch {
        return true;
      }
    })();
    tipEl.innerHTML = showTip
      ? `<p class="toc-tip"><b>Keep your chapters safe:</b> add Contact Sheet to your Home Screen. Safari can clear the photos of sites that aren't on it. <button type="button" class="text-btn" data-tip-off>Got it</button></p>`
      : '';
  }

  // The leaf hinges on the spine, off the right of this page: the next page
  // swings in over this one, and going back swings this one away.
  function turnToc(dir) {
    const to = tocPage + dir;
    if (turning || to < 0 || to >= pageCount()) return;
    const oldHtml = pageHtml(tocPage);
    const newHtml = pageHtml(to);
    tocPage = to;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pageEl.innerHTML = newHtml;
      return;
    }
    turning = true;
    const leaf = document.createElement('div');
    leaf.className = 'nb-sheet toc-leaf';
    leaf.innerHTML = `<div class="nb-sheet-in">${dir > 0 ? newHtml : oldHtml}</div><i class="toc-shade"></i>`;
    if (dir < 0) pageEl.innerHTML = newHtml;
    sheet.appendChild(leaf);
    const timing = { duration: TURN_MS, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' };
    const swing = [{ transform: 'rotateY(100deg)' }, { transform: 'rotateY(0deg)' }];
    const dim = [{ opacity: 0.32 }, { opacity: 0 }];
    if (dir < 0) {
      swing.reverse();
      dim.reverse();
    }
    const run = leaf.animate(swing, timing);
    leaf.querySelector('.toc-shade').animate(dim, timing);
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      if (dir > 0 && !destroyed) pageEl.innerHTML = newHtml;
      leaf.remove();
      turning = false;
    };
    const guard = setTimeout(finish, TURN_MS + 300);
    run.finished.then(finish, finish);
  }

  function setMode(next, instant = false) {
    clearTimeout(timer);
    root.classList.toggle('no-anim', instant);
    if (next === 'toc') {
      drawToc();
      root.dataset.mode = 'toc';
      const show = () => {
        toc.hidden = false;
        root.classList.add('is-reading');
      };
      if (instant) show();
      else timer = setTimeout(show, 760);
    } else {
      toc.hidden = true;
      root.classList.remove('is-reading');
      root.dataset.mode = next;
    }
    if (instant) setTimeout(() => root.classList.remove('no-anim'), 60);
  }

  function startNew() {
    setMode('new');
    timer = setTimeout(async () => {
      const made = await onNew();
      if (!made && !destroyed) setMode(currentMode());
    }, 620);
  }

  // Any new touch, anywhere on the book, is a fresh start.
  root.addEventListener('pointerdown', () => (swiped = false), true);
  sheet.addEventListener('pointerdown', (e) => {
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  sheet.addEventListener('pointerup', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy)) return;
    swiped = true;
    turnToc(dx < 0 ? 1 : -1);
  });
  sheet.addEventListener('pointercancel', () => (swipe = null));

  function onKey(e) {
    if (root.dataset.mode !== 'toc' || sheetIsOpen()) return;
    if (e.key === 'ArrowRight') turnToc(1);
    else if (e.key === 'ArrowLeft') turnToc(-1);
  }
  document.addEventListener('keydown', onKey);

  root.addEventListener('click', async (e) => {
    // The end of a swipe is not a tap on whatever it finished over.
    if (swiped || turning) {
      swiped = false;
      e.preventDefault();
      return;
    }
    const t = e.target.closest('[data-toc]');
    if (t) {
      if (t.dataset.toc === 'back') location.hash = '#/book';
      else startNew();
      return;
    }
    if (e.target.closest('[data-tip-off]')) {
      try {
        localStorage.setItem(TIP_KEY, 'off');
      } catch {}
      tipEl.innerHTML = '';
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const name = del.closest('.toc-row').querySelector('.toc-name').textContent;
      const ok = await confirmSheet({
        title: 'Delete chapter?',
        message: `<b>${esc(name)}</b> and its photos will be deleted from this device. Photos in your camera roll stay where they are.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (ok) {
        await deleteProject(del.dataset.del);
        drawToc();
      }
      return;
    }
    if (e.target.closest('.nb-toc')) return;
    // On the book itself, where the tap landed says what it means.
    const mode = root.dataset.mode;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dy = Math.abs(e.clientY - cy);
    if (mode === 'closed') {
      if (Math.abs(e.clientX - cx) <= geo.W / 2 && dy <= geo.H / 2) location.hash = '#/book';
    } else if (mode === 'open') {
      const dx = e.clientX - cx;
      if (Math.abs(dx) > geo.W * geo.k || dy > (geo.H * geo.k) / 2) location.hash = '#/';
      else if (dx < 0) location.hash = '#/contents';
      else startNew();
    }
  });

  window.addEventListener('resize', measure);
  measure();
  setMode(startMode, true);

  return {
    setMode,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      document.removeEventListener('keydown', onKey);
      releaseThumbs();
      delete document.body.dataset.route;
    },
  };
}
