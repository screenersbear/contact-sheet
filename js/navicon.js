// The navigation icon on the contents' bottom row, the same idea as Callback's:
// one icon with a little triangle beside it. The triangle on the left shuts
// the notebook, as in Documenting Fictions and Ref Notebook: a tap on it does,
// or a swipe along the bar to the right, the icon sliding over to the shut book
// as the finger goes. Nothing is right of the contents, so the right triangle
// stays hidden (its room keeps the icon over its name). A tap on the icon goes
// back to the first page.
import { ICONS } from './icons.js';

const STEP = 30; // px from one icon to the next on the strip
const SLIDE_MS = 200;
// How far the finger goes to bring the shut book all the way in. Let go past
// half of it (the name says Close by then) and the notebook shuts.
const far = () => Math.min(window.innerWidth * 0.25, 120);
const TRI = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M2.3 1.5Q5.6 3.8 8.7 6.1 5.5 8.3 2.2 10.5 2.5 6 2.3 1.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';

export const navHtml = () => `
  <div class="tool nb-nav">
    <div class="slider">
      <button type="button" class="slide-arrow is-prev" data-toc="shut" aria-label="Close the notebook">${TRI}</button>
      <button type="button" class="slide-now" data-toc="first" aria-label="Table of contents, first page"><span class="slide-strip" aria-hidden="true" style="transform: translateX(-${STEP}px)"><span class="slide-icon">${ICONS.shut}</span><span class="slide-icon">${ICONS.contents}</span></span></button>
      <button type="button" class="slide-arrow is-next is-off" tabindex="-1" aria-hidden="true" disabled>${TRI}</button>
    </div>
  </div>`;

// bar: the whole bottom row (a swipe anywhere along it counts). onShut: shuts
// the notebook. onSwiped: a swipe has started, so the tap it ends in is not one.
export function mountNav(bar, { onShut, onSwiped }) {
  const strip = bar.querySelector('.nb-nav .slide-strip');
  let drag = null;
  let busy = false;
  let timer = 0;

  // x: how far the strip has moved right from rest (contents showing). The
  // shut book's icon sits one STEP to the left, so x = STEP shows it.
  const to = (x, moving = false) => {
    strip.classList.toggle('is-moving', moving);
    strip.style.transform = `translateX(${(x - STEP).toFixed(1)}px)`;
  };
  // Toward the shut book the strip follows the finger, giving a little past
  // it; the other way there's nothing, so it gives a little and stops.
  const along = (dx) => {
    const f = far();
    if (dx <= 0) return -6 * (1 - Math.exp(dx / 40));
    if (dx <= f) return (STEP * dx) / f;
    return STEP + 6 * (1 - Math.exp(-(dx - f) / 40));
  };

  function shut() {
    if (busy) return;
    busy = true;
    to(STEP, true);
    clearTimeout(timer);
    timer = setTimeout(onShut, SLIDE_MS);
  }
  function reset() {
    clearTimeout(timer);
    busy = false;
    drag = null;
    to(0);
  }

  bar.addEventListener('pointerdown', (e) => {
    if (busy || e.button) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, dx: 0, v: 0, t: e.timeStamp, lx: e.clientX };
  });
  bar.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        return;
      }
      d.moved = true;
      onSwiped();
      try {
        bar.setPointerCapture(e.pointerId);
      } catch {}
    }
    d.v = (e.clientX - d.lx) / Math.max(1, e.timeStamp - d.t);
    d.lx = e.clientX;
    d.t = e.timeStamp;
    d.dx = dx;
    to(along(dx));
  });
  const end = (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    if (!d.moved) return;
    onSwiped();
    const flick = d.v > 0.45 && d.dx > 24;
    if (e.type === 'pointerup' && (along(d.dx) > STEP / 2 || flick)) shut();
    else to(0, true);
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);

  return { shut, reset, destroy: () => clearTimeout(timer) };
}
