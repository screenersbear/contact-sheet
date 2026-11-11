// The notebook: floating shut on white, open at its first two pages, and
// zoomed into the Table of contents. Routes: #/ (shut), #/book (open),
// #/contents. Each draft is a chapter.
import { listProjects, deleteProject } from './db.js';
import { confirmSheet } from './ui.js';
import { ICONS } from './icons.js';
import { esc, shortDate, isIOS, isStandalone } from './util.js';
import { pageWord } from './model.js';

const BOOK_KEY = 'contact-sheet-book';
const TIP_KEY = 'contact-sheet-home-tip';
const RATIO = 1000 / 1360; // the notebook art's width over its height
export const BOOKS = ['leather', 'orange'];

export function bookName() {
  try {
    const b = localStorage.getItem(BOOK_KEY);
    return BOOKS.includes(b) ? b : 'leather';
  } catch {
    return 'leather';
  }
}

export function useBook(name) {
  document.documentElement.dataset.book = name;
  try {
    localStorage.setItem(BOOK_KEY, name);
  } catch {}
}

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
          <div class="nb-block"></div>
          <div class="nb-words nb-new"><span class="nb-plus">${ICONS.plus}</span><span class="nb-word">New chapter</span></div>
          <div class="nb-leaf">
            <div class="nb-front"></div>
            <div class="nb-inside">
              <div class="nb-words"><span class="nb-word">Table of contents</span><span class="nb-rule"></span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="nb-pick" role="radiogroup" aria-label="Notebook">
        ${BOOKS.map((b) => `<button type="button" class="nb-chip" data-book="${b}" aria-label="${b} notebook"><img src="art/${b}-cover.webp" alt="" draggable="false" /></button>`).join('')}
      </div>
      <div class="nb-toc" hidden>
        <div class="nb-toc-area">
          <div class="nb-sheet">
            <div class="nb-sheet-in">
              <h2 class="nb-head">Table of contents</h2>
              <div class="toc-list" data-list></div>
            </div>
          </div>
        </div>
        <nav class="ed-tools" aria-label="Contents">
          <button type="button" class="tool" data-toc="back"><span class="tool-icon">${ICONS.back}</span><span class="tool-label">Back</span></button>
          <button type="button" class="tool" data-toc="new"><span class="tool-icon">${ICONS.plus}</span><span class="tool-label">New chapter</span></button>
        </nav>
      </div>
    </div>`;

  const root = view.querySelector('.nb');
  const toc = root.querySelector('.nb-toc');
  const listEl = root.querySelector('[data-list]');
  let geo = { W: 300, H: 400, k: 0.6 };
  let timer = 0;
  let destroyed = false;
  let urls = [];

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

  function markChip() {
    const name = bookName();
    root.querySelectorAll('.nb-chip').forEach((c) => c.classList.toggle('is-on', c.dataset.book === name));
  }

  async function drawToc() {
    const projects = await listProjects();
    if (destroyed) return;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    const showTip = (() => {
      if (!isIOS() || isStandalone()) return false;
      try {
        return localStorage.getItem(TIP_KEY) !== 'off';
      } catch {
        return true;
      }
    })();
    const rows = projects.map((p) => {
      let thumb = '';
      if (p.thumb) {
        const u = URL.createObjectURL(p.thumb);
        urls.push(u);
        thumb = `<img src="${u}" alt="" draggable="false" />`;
      }
      return `
        <div class="toc-row">
          <a class="toc-open" href="#/edit/${esc(p.id)}">
            <span class="toc-thumb">${thumb}</span>
            <span class="toc-text">
              <span class="toc-name">${esc(p.name)}</span>
              <span class="toc-meta">${p.slides} ${esc(pageWord(p, p.slides !== 1))} · ${esc(shortDate(p.updatedAt))}</span>
            </span>
          </a>
          <button type="button" class="toc-x" data-del="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">${ICONS.x}</button>
        </div>`;
    });
    listEl.innerHTML = `
      ${rows.join('') || '<p class="toc-empty">No chapters yet.</p>'}
      ${showTip ? `<p class="toc-tip"><b>Keep your chapters safe:</b> add Contact Sheet to your Home Screen. Safari can clear the photos of sites that aren't on it. <button type="button" class="text-btn" data-tip>Got it</button></p>` : ''}`;
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

  root.addEventListener('click', async (e) => {
    const chip = e.target.closest('.nb-chip');
    if (chip) {
      useBook(chip.dataset.book);
      markChip();
      return;
    }
    const t = e.target.closest('[data-toc]');
    if (t) {
      if (t.dataset.toc === 'back') location.hash = '#/book';
      else startNew();
      return;
    }
    if (e.target.closest('[data-tip]')) {
      try {
        localStorage.setItem(TIP_KEY, 'off');
      } catch {}
      e.target.closest('.toc-tip').remove();
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
  markChip();
  setMode(startMode, true);

  return {
    setMode,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      urls.forEach((u) => URL.revokeObjectURL(u));
      delete document.body.dataset.route;
    },
  };
}
