// The notebook: floating shut on white with its two tabs. Opened, it zooms in
// until its first page covers the screen, and the home page (every layout)
// is a plain page that scrolls. Routes: #/ (shut), #/contents.
// Its contents and what touching it does are in book-*.js beside this one.
import { ICONS } from '../components/icons.js';
import { mountStickers } from '../components/stickers.js';
import { RATIO, STACK, TURNED, PERSPECTIVE, TAB_OUT, RIM, OVER, OPEN_MS, ZOOM_MS, TABS, artReady, currentMode } from './book-sizes.js';
import { addContents } from './book-contents.js';
import { addTouch } from './book-touch.js';


export function mountBook(view, startMode, onNew) {
  const ed = {  }; // what this screen's parts share (see the files it adds)
  Object.assign(ed, { startNew });
  document.body.dataset.route = 'book';
  view.innerHTML = `
    <div class="nb no-anim${startMode === 'closed' ? ' is-waiting' : ' cover-later'}" data-mode="${startMode}">
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
        <div class="toc-page" data-tocbook data-left></div>
      </div>
    </div>
    <button type="button" class="nb-sun" aria-label="App options">${ICONS.sun}</button>`;

  const root = view.querySelector('.nb'); ed.root = root;
  // Beside the notebook, not in it: there from the start, while the
  // notebook waits for its art to fade in.
  const sun = view.querySelector('.nb-sun'); ed.sun = sun;
  const toc = root.querySelector('.nb-toc'); ed.toc = toc;
  const tocBook = root.querySelector('[data-tocbook]'); ed.tocBook = tocBook;
  const leftEl = root.querySelector('[data-left]'); ed.leftEl = leftEl;
  const sideTabs = root.querySelector('.nb-side-tabs');
  const tabHits = root.querySelector('.nb-tabhits');
  const stickers = mountStickers(root, root.querySelector('.nb-front')); ed.stickers = stickers;
  ed.geo = { W: 300, H: 400 };
  let timer = 0;
  ed.destroyed = false;
  ed.chapters = [];
  ed.thumbs = new Map();
  ed.swipe = null;
  ed.swiped = false;
  ed.showTip = false;

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
    const { W, shutX } = shutBook(vw, vh);
    const H = W / RATIO;
    ed.geo = { W, H };
    // Zoomed in, a page reaches OVER past three edges of the screen and the
    // spine lies along the fourth.
    const kx = (vw + OVER) / W;
    const ky = (vh + 2 * OVER) / H;
    const set = (k, v) => root.style.setProperty(k, v);
    set('--W', `${W}px`);
    set('--H', `${H}px`);
    set('--shut-x', `${shutX}px`);
    set('--kx', String(kx));
    set('--ky', String(ky));
    set('--rx', `${RIM / kx}px`);
    set('--ry', `${RIM / ky}px`);
    // The contents open on the left-hand page (the spine on the right edge),
    // a new chapter on the right-hand one (the spine on the left edge).
    set('--toc-x', `${vw / 2}px`);
    set('--new-x', `${-vw / 2}px`);
    set('--toc-y', '0px');
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
  addContents(ed);

  // Swiping back (right) from the contents shuts the notebook.
  const step = (dir) => {
    if (dir < 0) location.hash = '#/';
  }; ed.step = step;

  function setMode(next, instant = false) {
    if (next !== 'closed') {
      stickers.drop();
      ed.turn.reset();
    }
    clearTimeout(timer);
    const wasShut = root.dataset.mode === 'closed';
    if (next === 'closed') root.classList.remove('cover-later');
    root.classList.toggle('no-anim', instant);
    if (next === 'toc') {
      ed.drawToc();
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
      root.dataset.mode = next;
    }
    if (instant) setTimeout(() => root.classList.remove('no-anim'), 60);
  }

  function startNew() {
    const wasShut = root.dataset.mode === 'closed';
    setMode('new');
    timer = setTimeout(async () => {
      const made = await onNew();
      if (!made && !ed.destroyed) setMode(currentMode());
    }, wasShut ? OPEN_MS : 620);
  }
  addTouch(ed);

  const refit = () => {
    measure();
    placeTabHits();
  };
  window.addEventListener('resize', refit);
  measure();
  setMode(startMode, true);
  placeTabHits();
  if (startMode === 'closed') {
    Promise.race([Promise.all([artReady(), stickers.ready]), new Promise((done) => setTimeout(done, 1500))]).then(() => root.classList.remove('is-waiting'));
  } else {
    // Opened at a page (as it always is in Documenting Fictions), the cover is
    // turned away, so its art isn't put on until the book starts to shut
    // (setMode). It's fetched once the page has loaded, ready for then, rather
    // than holding up the page that's actually showing.
    const warm = () => setTimeout(artReady, 0);
    if (document.readyState === 'complete') warm();
    else window.addEventListener('load', warm, { once: true });
  }

  return {
    setMode,
    destroy() {
      ed.destroyed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', refit);
      document.removeEventListener('keydown', ed.onKey);
      ed.releaseThumbs();
      stickers.destroy();
      delete document.body.dataset.route;
    },
  };
}
