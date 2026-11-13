// Touching the notebook: turning it by hand while it's shut, the bottom
// row's icon, swiping the contents sideways, the keys, and its buttons.
import { sheetIsOpen } from '../components/sheet.js';
import { makeTurnable } from './cover-spin.js';
import { mountNav } from '../components/navicon.js';
import { TIP_KEY } from './book-sizes.js';
import { openOptions } from './options.js';

export function addTouch(ed) {
  Object.assign(ed, { onKey });
  // Any new touch, anywhere on the book, is a fresh start.
  ed.root.addEventListener('pointerdown', () => (ed.swiped = false), true);
  // Shut, the notebook can be turned by hand.
  const turn = makeTurnable(ed.root, {
    size: () => ed.geo.W,
    onMoved: () => (ed.swiped = true),
    canStart: (e) =>
      ed.root.dataset.mode === 'closed' &&
      !ed.root.classList.contains('is-sticking') &&
      Math.abs(e.clientX - window.innerWidth / 2) <= ed.geo.W * 0.62 &&
      Math.abs(e.clientY - window.innerHeight / 2) <= ed.geo.H * 0.56,
  }); ed.turn = turn;
  // The navigation icon on the bottom row: its left triangle shuts the book.
  const nav = mountNav(ed.toc.querySelector('.ed-tools'), {
    onShut: () => (location.hash = '#/'),
    onSwiped: () => (ed.swiped = true),
  }); ed.nav = nav;
  // A sideways swipe on the contents; up and down it scrolls.
  ed.tocBook.addEventListener('pointerdown', (e) => {
    ed.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, samples: [] };
  });
  ed.tocBook.addEventListener('pointermove', (e) => {
    if (!ed.swipe || ed.swipe.id !== e.pointerId) return;
    const dx = e.clientX - ed.swipe.x;
    const dy = e.clientY - ed.swipe.y;
    if (!ed.swipe.moved) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      ed.swipe.moved = true;
      // Only now: held from the start, a tap on a row would never reach it.
      try {
        ed.tocBook.setPointerCapture(e.pointerId);
      } catch {}
    }
    ed.swipe.samples.push({ t: e.timeStamp, x: e.clientX });
    if (ed.swipe.samples.length > 6) ed.swipe.samples.shift();
  });
  ed.tocBook.addEventListener('pointerup', (e) => {
    if (!ed.swipe || ed.swipe.id !== e.pointerId) return;
    const was = ed.swipe;
    ed.swipe = null;
    if (!was.moved) return;
    ed.swiped = true;
    const dx = e.clientX - was.x;
    const a = was.samples[0];
    const b = was.samples[was.samples.length - 1];
    const v = a && b && b.t > a.t && e.timeStamp - b.t < 60 ? (b.x - a.x) / (b.t - a.t) : 0;
    const flick = Math.abs(v) > 0.35 && Math.sign(v) === Math.sign(dx);
    if (Math.abs(dx) > window.innerWidth * 0.28 || flick) ed.step(dx < 0 ? 1 : -1);
  });
  ed.tocBook.addEventListener('pointercancel', () => {
    ed.swipe = null;
  });

  function onKey(e) {
    if (ed.root.dataset.mode !== 'toc' || sheetIsOpen()) return;
    if (e.key === 'ArrowRight') ed.step(1);
    else if (e.key === 'ArrowLeft') ed.step(-1);
  }
  document.addEventListener('keydown', onKey);

  ed.sun.addEventListener('click', () => {
    if (ed.root.dataset.mode === 'closed' && !ed.root.classList.contains('is-sticking')) openOptions(ed.stickers);
  });
  // Inside Documenting Fictions: Options from the menu at the top of the contents.
  ed.root.addEventListener('click', (e) => {
    if (e.target.closest('[data-app-menu]') && ed.root.dataset.mode === 'toc' && !sheetIsOpen()) { e.stopPropagation(); openOptions(ed.stickers); }
  }, true);

  ed.root.addEventListener('click', async (e) => {
    // Placing a sticker: the cover and tabs wait until OK.
    if (ed.root.classList.contains('is-sticking')) return;
    // The end of a swipe is not a tap on whatever it finished over.
    if (ed.swiped) {
      ed.swiped = false;
      e.preventDefault();
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      if (tab.dataset.tab === 'toc') location.hash = '#/contents';
      else ed.startNew();
      return;
    }
    const t = e.target.closest('[data-toc]');
    if (t) {
      if (t.dataset.toc === 'shut') nav.shut();
      else if (t.dataset.toc === 'first') ed.leftEl.scrollTo({ top: 0, behavior: 'smooth' });
      else ed.startNew();
      return;
    }
    if (e.target.closest('[data-tip-off]')) {
      try {
        localStorage.setItem(TIP_KEY, 'off');
      } catch {}
      ed.showTip = false;
      ed.drawPages();
      return;
    }
    if (e.target.closest('.nb-toc')) return;
    // The cover opens straight to the contents.
    if (ed.root.dataset.mode === 'closed') {
      const dx = Math.abs(e.clientX - window.innerWidth / 2);
      const dy = Math.abs(e.clientY - window.innerHeight / 2);
      if (dx <= ed.geo.W / 2 && dy <= ed.geo.H / 2) location.hash = '#/contents';
    }
  });
}
