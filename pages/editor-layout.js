// The editor's zoom and layout: how big the notebook is, where its pages sit,
// and going from one spread to the next (the pages slide, no page turn).
import { SLIDE_W, MAX_SLIDES } from '../data/formats.js';
import { spreadOf, spreadCount } from '../data/spreads.js';
import { clamp } from '../components/util.js';
import { OUT, RIM, GAP, PEEK, bookSize, bookLeft } from '../components/frame.js';
import { ROOM, lineH } from './editor-sizes.js';

export function addLayout(ed) {
  Object.assign(ed, { wsSize, fitZ, layout, placeBook, setZoom, visibleSlide, pageX, scrollToX, showSlide, fitTo, fitIfNeeded, flipTo, turnPage, toUnits });
  // ---------- Zoom and layout ----------
  function wsSize() {
    return { w: ed.ws.clientWidth || 360, h: ed.ws.clientHeight || 480 };
  }
  // The notebook is the same size in every chapter and in the contents; the
  // photos fit inside it.
  const sizes = () => bookSize(wsSize().w, ed.nbEl.offsetHeight);
  function fitZ(mode) {
    const { h } = wsSize();
    const g = sizes();
    const room = (mode === 'all' ? g.both : g.one) - RIM - GAP;
    return Math.max(0.02, Math.min(room / SLIDE_W, (h - 2 * ROOM) / ed.H()));
  }
  // One notebook page, from the spine out.
  function pageW() {
    const g = sizes();
    if (ed.zoomFit === 'all') return g.both;
    if (ed.zoomFit === 'one') return g.one;
    return Math.max(SLIDE_W * ed.z + RIM + GAP, g.both);
  }
  const minZ = () => fitZ('all') * 0.85; ed.minZ = minZ;
  const maxZ = () => fitZ('one') * 4; ed.maxZ = maxZ;

  function layout() {
    const { w, h } = wsSize();
    const sw = SLIDE_W * ed.z;
    const total = ed.p.slides * sw;
    const sh = ed.H() * ed.z;
    const both = 2 * sw;
    ed.spread = clamp(ed.spread, 0, spreadCount(ed.p) - 1);
    const pw = pageW();
    ed.bookX = bookLeft(w, pw);
    ed.pageLeft = ed.bookX + pw - sw; // the two pages meet at the spine
    ed.margX = ed.pageLeft - ed.spread * both;
    // The photos sit in the middle, with room above for their labels.
    const room = Math.max(ROOM, (h - sh) / 2);
    ed.margY = Math.max(lineH(), Math.round(room));
    ed.inner.style.width = `${2 * pw + 2 * ed.bookX}px`;
    ed.inner.style.height = `${Math.max(h, sh + ed.margY + room)}px`;
    ed.strip.style.left = `${ed.margX}px`;
    ed.strip.style.top = `${ed.margY}px`;
    ed.strip.style.width = `${total}px`;
    ed.strip.style.height = `${sh}px`;
    ed.strip.style.background = ed.p.background;
    // Only the two pages lying open show.
    const a = ed.spread * both;
    const b = Math.min(total, a + both);
    ed.strip.style.clipPath = `inset(0 ${total - b}px 0 ${a}px)`;
    ed.nbEl.style.width = `${2 * pw}px`;
    // Everything below the photos stays inside the notebook's edges.
    ed.editorEl.style.setProperty('--ed-in', `${2 * pw + 2 * OUT <= w + 1 ? ed.bookX + RIM + GAP : PEEK}px`);
    placeBook();
    placeAdd();
    placeName();
  }

  // The notebook stays put up and down and slides with the pages side to side.
  function placeBook(extra = 0) {
    const t = `translateX(${ed.bookX - ed.ws.scrollLeft - extra}px)`;
    ed.nbEl.style.transform = t;
  }

  // The chapter name sits in the middle of the space under the photos.
  function placeName() {
    const { h } = wsSize();
    const lh = lineH();
    const under = Math.min(h, ed.margY + ed.H() * ed.z);
    const mid = Math.min((under + h) / 2, h - lh / 2);
    // Kept above the tray.
    let top = Math.round(ed.ws.offsetTop + mid - lh / 2);
    if (top + lh > ed.ws.offsetTop + h) top = ed.ws.offsetTop + h - lh;
    ed.nameEl.style.top = `${top}px`;
    // Zoomed in, the photos reach behind it and it needs a backing.
    ed.nameEl.classList.toggle('is-over', ed.ws.offsetTop + under > top);
  }

  // The add-a-slide button stays in the bottom-right corner of the page, so
  // it never scrolls out of reach and stays clear of the seams. It lives
  // outside the scroller, so the strip scrolls under it.
  function placeAdd() {
    ed.addBtn.hidden = ed.p.slides >= MAX_SLIDES;
    if (ed.addBtn.hidden) return;
    const { w, h } = wsSize();
    const edge = parseFloat(ed.editorEl.style.getPropertyValue('--ed-in')) || PEEK;
    ed.addBtn.style.left = `${ed.ws.offsetLeft + w - 44 - edge}px`;
    ed.addBtn.style.top = `${ed.ws.offsetTop + h - 44 - 4}px`;
  }

  function setZoom(nz, cx, cy) {
    const r = ed.ws.getBoundingClientRect();
    if (cx === undefined) {
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    }
    const u = toUnits(cx, cy);
    ed.z = clamp(nz, minZ(), maxZ());
    ed.zoomFit = null;
    ed.renderStrip();
    ed.ws.scrollLeft = ed.margX + u.x * ed.z - (cx - r.left);
    ed.ws.scrollTop = ed.margY + u.y * ed.z - (cy - r.top);
    ed.renderTools();
  }

  const firstPage = () => ed.spread * 2; ed.firstPage = firstPage;
  const lastPage = () => Math.min(ed.p.slides - 1, ed.spread * 2 + 1); ed.lastPage = lastPage;

  function visibleSlide() {
    if (ed.zoomFit === 'all' && ed.touched !== null && spreadOf(ed.touched) === ed.spread && ed.touched < ed.p.slides) return ed.touched;
    const { w } = wsSize();
    const k = Math.floor((ed.ws.scrollLeft + w / 2 - ed.margX) / (SLIDE_W * ed.z));
    return clamp(k, firstPage(), lastPage());
  }

  // Where the scroller sits to centre a page of the open spread.
  function pageX(k) {
    const { w } = wsSize();
    const max = Math.max(0, ed.inner.offsetWidth - w);
    // A page at a time, the notebook always lands in the same place.
    if (ed.zoomFit === 'one') return k % 2 ? max : 0;
    return clamp(ed.pageLeft + ((k % 2) + 0.5) * SLIDE_W * ed.z - w / 2, 0, max);
  }

  function scrollToX(x, ms = 260) {
    ed.stopInertia();
    const from = ed.ws.scrollLeft;
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / ms, 0, 1);
      ed.ws.scrollLeft = from + (x - from) * (1 - (1 - t) ** 3);
      ed.inertia = t < 1 ? requestAnimationFrame(step) : 0;
    };
    ed.inertia = requestAnimationFrame(step);
  }

  // Goes to a page: turns to its spread if it is on another one.
  function showSlide(k) {
    if (spreadOf(k) !== ed.spread) flipTo(spreadOf(k), k);
    else if (ed.zoomFit !== 'all') scrollToX(pageX(k));
  }

  function fitTo(mode, slide = visibleSlide()) {
    ed.zoomFit = mode;
    ed.z = fitZ(mode);
    ed.spread = spreadOf(slide);
    ed.renderStrip();
    ed.ws.scrollLeft = mode === 'one' ? pageX(slide) : 0;
    ed.ws.scrollTop = Math.max(0, (ed.inner.offsetHeight - wsSize().h) / 2);
    ed.renderTools();
  }

  function fitIfNeeded() {
    if (ed.zoomFit) {
      ed.spread = clamp(ed.spread, 0, spreadCount(ed.p) - 1);
      const k = visibleSlide();
      ed.z = fitZ(ed.zoomFit);
      ed.renderStrip();
      if (ed.zoomFit === 'one') ed.ws.scrollLeft = pageX(k);
    } else {
      ed.z = clamp(ed.z, minZ(), maxZ());
    }
  }

  // ---------- Going to another spread ----------
  // No page turn: the pages slide away and the next ones slide in from the
  // side they are on.
  function flipTo(s, page = s * 2) {
    if (ed.flipping || ed.destroyed) return;
    s = clamp(s, 0, spreadCount(ed.p) - 1);
    if (s === ed.spread) return;
    ed.flipping = true;
    ed.stopInertia();
    ed.touched = null;
    ed.sel = null;
    ed.photoMode = false;
    ed.placeSel();
    ed.renderTools();
    ed.renderAdjust();
    const land = (k) => (ed.zoomFit === 'one' ? pageX(k) : ed.zoomFit === 'all' ? 0 : ed.ws.scrollLeft);
    const dir = s > ed.spread ? 1 : -1;
    const swap = () => {
      ed.spread = s;
      ed.renderStrip();
      ed.ws.scrollLeft = land(page);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      swap();
      ed.flipping = false;
      return;
    }
    const shift = Math.round(Math.min(wsSize().w, 480) * 0.3);
    const ease = 'cubic-bezier(.3, .6, .3, 1)';
    ed.inner.style.transition = `transform 130ms ${ease}, opacity 130ms linear`;
    ed.inner.style.transform = `translateX(${-dir * shift}px)`;
    ed.inner.style.opacity = '0';
    setTimeout(() => {
      if (ed.destroyed) return;
      swap();
      ed.inner.style.transition = 'none';
      ed.inner.style.transform = `translateX(${dir * shift}px)`;
      void ed.inner.offsetWidth;
      ed.inner.style.transition = `transform 240ms ${ease}, opacity 180ms linear`;
      ed.inner.style.transform = '';
      ed.inner.style.opacity = '';
      setTimeout(() => {
        ed.inner.style.transition = '';
        ed.flipping = false;
      }, 250);
    }, 130);
  }

  // One page on, or back: across the spread, or over to the next one.
  function turnPage(dir) {
    if (ed.flipping) return;
    if (ed.zoomFit === 'one') {
      const k = visibleSlide() + dir;
      if (k >= 0 && k < ed.p.slides) showSlide(k);
    } else if (ed.spread + dir >= 0 && ed.spread + dir < spreadCount(ed.p)) {
      flipTo(ed.spread + dir);
    }
  }

  function toUnits(cx, cy) {
    const r = ed.strip.getBoundingClientRect();
    return { x: (cx - r.left) / ed.z, y: (cy - r.top) / ed.z };
  }
}
