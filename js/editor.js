// The editor: slides are the pages of a notebook, two to a spread, with one
// strip behind them and frames that can sit across the spine of a spread.
// Moving past a spread turns the page. Below are the photo tray and the tools.
//
// The strip is plain HTML: each frame is a box holding an <img> of the
// photo's editing copy, placed with the same maths the export uses
// (model.js), so what you see is what exports. The area around the strip
// and everything drawn over the photos stays grey, white or black, so the
// colours of the photos are never thrown off by the app's own.
import {
  SLIDE_W, MAX_SLIDES, MIN_FRAME, LAYOUT_KEYS, SAFE_TOP, SAFE_BOTTOM,
  slideH, isStory, isPrint, pageWord, pageTitle, newFrame, defaultCrop, placement, clampedCrop, cssTransform, rotatedCrop,
  anchorSlide, insertSlide, removeSlide, moveSlide, copySlideLayout, slideBox, borderBands,
  snapTargets, nearest, templateFromProject, SLIDE_LAYOUTS, layoutRects, applySlideLayout, layoutOfSlide,
  framesWithinSlide, spreadOf, spreadCount, keepInSpreads,
} from './model.js';
import {
  getProject, saveProject, saveProjectThumb, photosForProject, deleteUnlistedPhotos,
  listTemplates, saveTemplate, askToPersist,
} from './db.js';
import { importFiles, pickFiles } from './photos.js';
import { previewCanvas } from './render.js';
import { openExport } from './export.js';
import { openSheet, choiceSheet, promptSheet, toast, sheetIsOpen } from './ui.js';
import { ICONS } from './icons.js';
import { esc, clamp, debounce, canvasToBlob, loadImage } from './util.js';

const SNAP_PX = 9;
const EDGE_X = 16; // how much notebook shows around the pages
const EDGE_Y = 14;
const NAME_H = 34; // the chapter name under the notebook
const FLIP_MS = 620;
const SAFE_KEY = 'contact-sheet-safe-zone';
const SNAP_KEYS = ['name', ...LAYOUT_KEYS, 'frames', 'photoIds'];

export async function mountEditor(view, id) {
  const loaded = await getProject(id);
  if (!loaded) {
    location.hash = '#/';
    return () => {};
  }
  const p = loaded;
  const recs = await photosForProject(id);

  // ---------- Photos ----------
  const photos = {};
  const previewUrl = {};
  const thumbUrl = {};
  const previewImg = {};
  recs.forEach((r) => (photos[r.id] = r));
  p.photoIds = (p.photoIds || []).filter((x) => photos[x]);
  p.frames.forEach((f) => {
    if (f.photoId && !photos[f.photoId]) f.photoId = null;
    if (!f.crop) f.crop = defaultCrop();
  });
  // Photos taken out of the tray last time are gone for good now.
  const keep = new Set([...p.photoIds, ...p.frames.map((f) => f.photoId).filter(Boolean)]);
  if (recs.some((r) => !keep.has(r.id))) deleteUnlistedPhotos(id, [...keep]).catch(() => {});
  p.frames.forEach((f) => {
    if (f.photoId && !p.photoIds.includes(f.photoId)) p.photoIds.push(f.photoId);
  });

  const urlOf = (pid) => previewUrl[pid] || (previewUrl[pid] = URL.createObjectURL(photos[pid].preview));
  const thumbOf = (pid) => thumbUrl[pid] || (thumbUrl[pid] = URL.createObjectURL(photos[pid].thumb || photos[pid].preview));
  function previewImage(pid) {
    if (!previewImg[pid]) previewImg[pid] = loadImage(urlOf(pid));
    return previewImg[pid];
  }
  // Editing copies for drawing previews (thumbs, slide list, grid).
  async function previewSources() {
    const ids = [...new Set(p.frames.map((f) => f.photoId).filter((x) => x && photos[x]))];
    const imgs = await Promise.all(ids.map((pid) => previewImage(pid).catch(() => null)));
    const map = {};
    ids.forEach((pid, i) => imgs[i] && (map[pid] = { photo: photos[pid], src: imgs[i] }));
    return (pid) => map[pid] || null;
  }

  // ---------- State ----------
  let sel = null;
  let photoMode = false;
  let z = 0.3;
  let zoomFit = 'one';
  let showSafe = true;
  try {
    showSafe = localStorage.getItem(SAFE_KEY) !== 'off';
  } catch {}
  let margX = 24;
  let margY = 32;
  let pageLeft = 24; // where the spread's left page starts
  let spread = 0; // the two pages lying open
  let flipping = false;
  let touched = null; // the page last tapped, when both are in view
  let dropTarget = null;
  let destroyed = false;

  const H = () => slideH(p);
  const frameById = (fid) => p.frames.find((f) => f.id === fid);
  const selFrame = () => (sel ? frameById(sel) : null);
  // No frame may run across a page flip; a trimmed photo keeps its place.
  function holdSpreads() {
    if (!keepInSpreads(p)) return;
    p.frames.forEach((f) => {
      if (f.photoId && photos[f.photoId]) f.crop = clampedCrop(f, photos[f.photoId]);
    });
  }
  const apply = (next) => {
    Object.assign(p, next);
    holdSpreads();
  };
  holdSpreads();

  // ---------- History and saving ----------
  const snapshot = () => {
    const o = {};
    SNAP_KEYS.forEach((k) => (o[k] = p[k]));
    return JSON.stringify(o);
  };
  let hist = [snapshot()];
  let hi = 0;

  const saveSoon = debounce(() => saveProject(p).then((r) => (p.updatedAt = r.updatedAt)).catch(() => toast('Could not save. Is your storage full?')), 400);
  const thumbSoon = debounce(makeThumb, 1500);

  function commit() {
    const s = snapshot();
    if (s === hist[hi]) return;
    hist = hist.slice(0, hi + 1);
    hist.push(s);
    if (hist.length > 150) hist.shift();
    hi = hist.length - 1;
    saveSoon();
    thumbSoon();
    renderTop();
  }
  const commitSoon = debounce(commit, 600);

  function restore(s) {
    const o = JSON.parse(s);
    SNAP_KEYS.forEach((k) => (p[k] = o[k]));
    if (sel && !frameById(sel)) {
      sel = null;
      photoMode = false;
    }
    fitIfNeeded();
    render();
    saveSoon();
    thumbSoon();
  }
  function undo() {
    commitSoon.flush();
    if (hi > 0) restore(hist[--hi]);
  }
  function redo() {
    if (hi < hist.length - 1) restore(hist[++hi]);
  }

  async function makeThumb() {
    try {
      const get = await previewSources();
      const c = previewCanvas(p, get, { height: 200, count: Math.min(3, p.slides) });
      const blob = await canvasToBlob(c, 'image/jpeg', 0.8);
      c.width = c.height = 0;
      p.thumb = blob;
      await saveProjectThumb(p.id, blob);
    } catch {}
  }

  // ---------- DOM ----------
  view.innerHTML = `
    <div class="editor" data-editor>
      <div class="ws" data-ws>
        <div class="ws-inner" data-inner>
          <div class="nb-open" data-nb><span></span><span></span></div>
          <div class="ws-labels" data-labels></div>
          <div class="strip" data-strip>
            <div class="strip-frames" data-frames></div>
            <div class="strip-bands" data-bands></div>
            <div class="strip-seams" data-seams></div>
            <div class="strip-safe" data-safe></div>
            <div class="strip-guides" data-guides></div>
          </div>
          <div class="nb-gutter" data-gutter></div>
          <div class="sel" data-sel hidden>
            ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="handle h-${h}" data-h="${h}"></span>`).join('')}
            <button type="button" class="sel-x" data-act="take-out" aria-label="Take the photo out">${ICONS.x}</button>
          </div>
        </div>
      </div>
      <button type="button" class="ws-add" data-act="add-slide" aria-label="Add a slide">${ICONS.plus}</button>
      <div class="ed-name" data-name><button type="button" data-act="rename" aria-label="Rename this chapter"><span>${esc(p.name)}</span></button></div>
      <div class="ed-adjust" data-adjust hidden>
        <span class="ed-adjust-label">Zoom</span>
        <input type="range" min="1" max="5" step="0.01" value="1" data-zoom aria-label="Photo zoom" />
        <button type="button" class="small-btn primary" data-act="adjust-done">Done</button>
      </div>
      <div class="tray" data-tray></div>
      <nav class="ed-tools" data-tools aria-label="Tools"></nav>
    </div>`;
  document.body.dataset.route = 'edit';

  const $ = (s) => view.querySelector(s);
  const ws = $('[data-ws]');
  const inner = $('[data-inner]');
  const strip = $('[data-strip]');
  const framesEl = $('[data-frames]');
  const bandsEl = $('[data-bands]');
  const seamsEl = $('[data-seams]');
  const safeEl = $('[data-safe]');
  const guidesEl = $('[data-guides]');
  const labelsEl = $('[data-labels]');
  const nbEl = $('[data-nb]');
  const gutterEl = $('[data-gutter]');
  const selEl = $('[data-sel]');
  const adjustEl = $('[data-adjust]');
  const zoomInput = $('[data-zoom]');
  const addBtn = $('.ws-add');
  const nameEl = $('[data-name]');
  const trayEl = $('[data-tray]');
  const toolsEl = $('[data-tools]');
  ws.addEventListener('scroll', () => { if (sel) placeX(); }, { passive: true });

  // ---------- Zoom and layout ----------
  function wsSize() {
    return { w: ws.clientWidth || 360, h: ws.clientHeight || 480 };
  }
  function fitZ(mode) {
    const { w, h } = wsSize();
    const across = mode === 'all' ? 2 : 1;
    return Math.max(0.02, Math.min((w - 2 * EDGE_X - 8) / (across * SLIDE_W), (h - 2 * (EDGE_Y + 36)) / H()));
  }
  const minZ = () => fitZ('all') * 0.85;
  const maxZ = () => fitZ('one') * 4;

  function layout() {
    const { w, h } = wsSize();
    const sw = SLIDE_W * z;
    const total = p.slides * sw;
    const sh = H() * z;
    const both = 2 * sw;
    spread = clamp(spread, 0, spreadCount(p) - 1);
    pageLeft = both + 2 * EDGE_X <= w ? (w - both) / 2 : Math.max(EDGE_X + 6, (w - sw) / 2);
    margX = pageLeft - spread * both;
    margY = Math.max(EDGE_Y + 32, (h - sh) / 2);
    inner.style.width = `${both + 2 * pageLeft}px`;
    inner.style.height = `${Math.max(h, sh + 2 * margY)}px`;
    strip.style.left = `${margX}px`;
    strip.style.top = `${margY}px`;
    strip.style.width = `${total}px`;
    strip.style.height = `${sh}px`;
    strip.style.background = p.background;
    // Only the two pages lying open show.
    const a = spread * both;
    const b = Math.min(total, a + both);
    strip.style.clipPath = `inset(0 ${total - b}px 0 ${a}px)`;
    nbEl.style.left = `${pageLeft - EDGE_X}px`;
    nbEl.style.top = `${margY - EDGE_Y}px`;
    nbEl.style.width = `${both + 2 * EDGE_X}px`;
    nbEl.style.height = `${sh + 2 * EDGE_Y}px`;
    gutterEl.style.left = `${pageLeft + sw}px`;
    gutterEl.style.top = `${margY - EDGE_Y}px`;
    gutterEl.style.height = `${sh + 2 * EDGE_Y}px`;
    placeAdd();
    placeName();
  }

  // The chapter name sits in the middle of the space under the notebook.
  function placeName() {
    const { h } = wsSize();
    const under = Math.min(h, margY + H() * z + EDGE_Y);
    const mid = Math.min((under + h) / 2, h - NAME_H / 2);
    nameEl.style.top = `${ws.offsetTop + mid - NAME_H / 2}px`;
    // Zoomed in, the notebook reaches behind it and it needs a backing.
    nameEl.classList.toggle('is-over', under > h - NAME_H);
  }

  // The add-a-slide button stays in the bottom-right corner of the grey, so
  // it never scrolls out of reach and stays clear of the seams. It lives
  // outside the scroller, so the strip scrolls under it.
  function placeAdd() {
    addBtn.hidden = p.slides >= MAX_SLIDES;
    if (addBtn.hidden) return;
    const { w, h } = wsSize();
    addBtn.style.left = `${ws.offsetLeft + w - 44 - 14}px`;
    addBtn.style.top = `${ws.offsetTop + h - 44 - 14}px`;
  }

  function setZoom(nz, cx, cy) {
    const r = ws.getBoundingClientRect();
    if (cx === undefined) {
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    }
    const u = toUnits(cx, cy);
    z = clamp(nz, minZ(), maxZ());
    zoomFit = null;
    renderStrip();
    ws.scrollLeft = margX + u.x * z - (cx - r.left);
    ws.scrollTop = margY + u.y * z - (cy - r.top);
    renderTools();
  }

  const firstPage = () => spread * 2;
  const lastPage = () => Math.min(p.slides - 1, spread * 2 + 1);

  function visibleSlide() {
    if (zoomFit === 'all' && touched !== null && spreadOf(touched) === spread && touched < p.slides) return touched;
    const { w } = wsSize();
    const k = Math.floor((ws.scrollLeft + w / 2 - margX) / (SLIDE_W * z));
    return clamp(k, firstPage(), lastPage());
  }

  // Where the scroller sits to centre a page of the open spread.
  function pageX(k) {
    const { w } = wsSize();
    return clamp(pageLeft + ((k % 2) + 0.5) * SLIDE_W * z - w / 2, 0, Math.max(0, inner.offsetWidth - w));
  }

  function scrollToX(x, ms = 260) {
    stopInertia();
    const from = ws.scrollLeft;
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / ms, 0, 1);
      ws.scrollLeft = from + (x - from) * (1 - (1 - t) ** 3);
      inertia = t < 1 ? requestAnimationFrame(step) : 0;
    };
    inertia = requestAnimationFrame(step);
  }

  // Goes to a page: turns to its spread if it is on another one.
  function showSlide(k) {
    if (spreadOf(k) !== spread) flipTo(spreadOf(k), k);
    else if (zoomFit !== 'all') scrollToX(pageX(k));
  }

  function fitTo(mode, slide = visibleSlide()) {
    zoomFit = mode;
    z = fitZ(mode);
    spread = spreadOf(slide);
    renderStrip();
    ws.scrollLeft = mode === 'one' ? pageX(slide) : 0;
    ws.scrollTop = Math.max(0, (inner.offsetHeight - wsSize().h) / 2);
    renderTools();
  }

  function fitIfNeeded() {
    if (zoomFit) {
      spread = clamp(spread, 0, spreadCount(p) - 1);
      const k = visibleSlide();
      z = fitZ(zoomFit);
      renderStrip();
      if (zoomFit === 'one') ws.scrollLeft = pageX(k);
    } else {
      z = clamp(z, minZ(), maxZ());
    }
  }

  // ---------- Turning the page ----------
  // The flip is drawn on pictures of the four pages involved; the real pages
  // are swapped underneath at the start and uncovered at the end.
  async function flipTo(s, page = s * 2) {
    if (flipping || destroyed) return;
    s = clamp(s, 0, spreadCount(p) - 1);
    if (s === spread) return;
    flipping = true;
    stopInertia();
    touched = null;
    sel = null;
    photoMode = false;
    placeSel();
    renderTools();
    renderAdjust();
    const dir = s > spread ? 1 : -1;
    const land = (k) => (zoomFit === 'one' ? pageX(k) : zoomFit === 'all' ? 0 : ws.scrollLeft);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spread = s;
      renderStrip();
      ws.scrollLeft = land(page);
      flipping = false;
      return;
    }
    const get = await previewSources();
    if (destroyed) return;
    const sh = H() * z;
    const px = Math.round(Math.min(1200, sh * Math.min(2, window.devicePixelRatio || 1)));
    const face = (k) => {
      const el = document.createElement('div');
      el.className = 'flip-page';
      if (k < p.slides) el.appendChild(previewCanvas(p, get, { height: px, from: k, count: 1, empty: '#ffffff' }));
      else el.classList.add('is-blank');
      return el;
    };
    const oldL = spread * 2;
    const newL = s * 2;
    const under = (el, cls) => {
      el.classList.add('flip-under', cls);
      const shade = document.createElement('i');
      shade.className = 'flip-shade';
      el.appendChild(shade);
      return el;
    };
    const left = under(face(dir > 0 ? oldL : newL), 'is-left');
    const right = under(face(dir > 0 ? newL + 1 : oldL + 1), 'is-right');
    const front = face(dir > 0 ? oldL + 1 : newL + 1);
    const back = face(dir > 0 ? newL : oldL);
    front.classList.add('flip-front');
    back.classList.add('flip-back');
    [front, back].forEach((el) => {
      const shade = document.createElement('i');
      shade.className = 'flip-shade';
      el.appendChild(shade);
    });
    const leaf = document.createElement('div');
    leaf.className = 'flip-leaf';
    // The page has a little thickness: paper edges down the outside, top and bottom.
    const edges = ['out', 'top', 'bottom'].map((side) => {
      const edge = document.createElement('i');
      edge.className = `flip-edge is-${side}`;
      return edge;
    });
    leaf.append(front, back, ...edges);
    leaf.style.setProperty('--t', `${Math.max(4, Math.round(SLIDE_W * z * 0.016))}px`);
    const box = document.createElement('div');
    box.className = 'flip';
    box.style.left = `${pageLeft}px`;
    box.style.top = `${margY}px`;
    box.style.width = `${2 * SLIDE_W * z}px`;
    box.style.height = `${sh}px`;
    box.append(left, right, leaf);
    const angle = (t) => (dir > 0 ? -180 * t : -180 * (1 - t));
    leaf.style.transform = `rotateY(${angle(0)}deg)`;
    inner.appendChild(box);

    spread = s;
    renderStrip();
    const shades = box.querySelectorAll('.flip-shade');
    const x0 = ws.scrollLeft;
    const x1 = land(page);
    const t0 = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (!destroyed) ws.scrollLeft = x1;
      box.querySelectorAll('canvas').forEach((c) => (c.width = c.height = 0));
      box.remove();
      flipping = false;
    };
    const guard = setTimeout(finish, FLIP_MS + 400);
    const step = (now) => {
      if (done || destroyed) return;
      const r = clamp((now - t0) / FLIP_MS, 0, 1);
      const t = r < 0.5 ? 2 * r * r : 1 - (-2 * r + 2) ** 2 / 2;
      leaf.style.transform = `rotateY(${angle(t)}deg)`;
      const dark = String(Math.sin(Math.PI * t) * 0.34);
      shades.forEach((el) => (el.style.opacity = dark));
      ws.scrollLeft = x0 + (x1 - x0) * t;
      if (r < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  }

  // One page on, or back: across the spread, or over to the next one.
  function turnPage(dir) {
    if (flipping) return;
    if (zoomFit === 'one') {
      const k = visibleSlide() + dir;
      if (k >= 0 && k < p.slides) showSlide(k);
    } else if (spread + dir >= 0 && spread + dir < spreadCount(p)) {
      flipTo(spread + dir);
    }
  }

  function toUnits(cx, cy) {
    const r = strip.getBoundingClientRect();
    return { x: (cx - r.left) / z, y: (cy - r.top) / z };
  }

  // ---------- Strip rendering ----------
  const frameEls = new Map();

  function placeFrame(f) {
    const o = frameEls.get(f.id);
    if (!o) return;
    const s = o.el.style;
    s.left = `${f.x * z}px`;
    s.top = `${f.y * z}px`;
    s.width = `${f.w * z}px`;
    s.height = `${f.h * z}px`;
    const ph = f.photoId && photos[f.photoId];
    if (ph) {
      if (o.img.dataset.pid !== f.photoId) {
        o.img.dataset.pid = f.photoId;
        o.img.src = urlOf(f.photoId);
        o.img.style.width = `${ph.previewW}px`;
        o.img.style.height = `${ph.previewH}px`;
      }
      o.img.hidden = false;
      o.img.style.transform = cssTransform(f, ph, ph.previewW, z);
    } else {
      o.img.hidden = true;
      o.img.removeAttribute('src');
      delete o.img.dataset.pid;
    }
    const bw = ph ? p.borderWidth || 0 : 0;
    o.line.hidden = !bw;
    if (bw) o.line.style.boxShadow = `inset 0 0 0 ${Math.max(0.5, bw * z)}px ${p.borderColor}`;
    o.el.classList.toggle('is-empty', !ph);
    o.el.classList.toggle('is-target', dropTarget === f.id);
    o.el.classList.toggle('is-roomy', f.w * z >= 120 && f.h * z >= 90);
  }

  function renderFrames() {
    const seen = new Set();
    p.frames.forEach((f, i) => {
      let o = frameEls.get(f.id);
      if (!o) {
        const el = document.createElement('div');
        el.className = 'fr';
        el.dataset.id = f.id;
        el.innerHTML = `<img alt="" draggable="false" hidden /><div class="fr-line" hidden></div>
          <div class="fr-empty"><span class="fr-plus">${ICONS.plus}</span><span class="fr-hint">Double-tap to add a photo</span></div>`;
        o = { el, img: el.querySelector('img'), line: el.querySelector('.fr-line') };
        frameEls.set(f.id, o);
      }
      if (framesEl.children[i] !== o.el) framesEl.insertBefore(o.el, framesEl.children[i] || null);
      placeFrame(f);
      seen.add(f.id);
    });
    for (const [fid, o] of frameEls) {
      if (!seen.has(fid)) {
        o.el.remove();
        frameEls.delete(fid);
      }
    }
  }

  function box(el, r) {
    el.style.left = `${r.x * z}px`;
    el.style.top = `${r.y * z}px`;
    el.style.width = `${r.w * z}px`;
    el.style.height = `${r.h * z}px`;
  }

  function renderBands() {
    const html = [];
    for (let i = 0; i < p.slides; i++) {
      for (const b of borderBands(p, i)) {
        html.push(`<div class="band" style="left:${b.x * z}px;top:${b.y * z}px;width:${b.w * z}px;height:${b.h * z}px;background:${esc(p.background)}"></div>`);
      }
    }
    bandsEl.innerHTML = html.join('');
  }

  // The spine stands in for the seam between the two open pages.
  function renderSeams() {
    seamsEl.innerHTML = '';
  }

  function renderSafe() {
    const on = isStory(p) && showSafe;
    safeEl.hidden = !on;
    if (!on) return;
    let html = '';
    for (let i = 0; i < p.slides; i++) {
      const x = i * SLIDE_W * z;
      const w = SLIDE_W * z;
      html += `<div class="safe-band top" style="left:${x}px;top:0;width:${w}px;height:${SAFE_TOP * z}px"><span>Instagram covers this</span></div>
        <div class="safe-band bottom" style="left:${x}px;top:${(H() - SAFE_BOTTOM) * z}px;width:${w}px;height:${SAFE_BOTTOM * z}px"><span>Instagram covers this</span></div>`;
    }
    safeEl.innerHTML = html;
  }

  function renderLabels() {
    const sw = SLIDE_W * z;
    const word = pageTitle(p);
    let html = '';
    for (let i = firstPage(); i <= lastPage(); i++) {
      // The trash sits right after the label, away from the frame's corner x.
      const del = p.slides > 1 && sw >= 60
        ? `<button type="button" class="ws-del" data-act="del-slide" data-k="${i}" aria-label="Delete ${word.toLowerCase()} ${i + 1}">${ICONS.trash}</button>`
        : '';
      html += `<div class="ws-label${del ? ' has-del' : ''}" style="left:${margX + i * sw}px;top:${margY - EDGE_Y - 27}px;width:${sw}px"><span>${sw >= 90 ? `${word} ${i + 1}` : i + 1}</span>${del}</div>`;
    }
    labelsEl.innerHTML = html;
  }

  function placeSel() {
    const f = selFrame();
    selEl.hidden = !f;
    if (!f) return;
    selEl.style.left = `${margX + f.x * z}px`;
    selEl.style.top = `${margY + f.y * z}px`;
    selEl.style.width = `${f.w * z}px`;
    selEl.style.height = `${f.h * z}px`;
    selEl.classList.toggle('is-photo', photoMode);
    selEl.classList.toggle('has-photo', !!f.photoId);
    selEl.classList.toggle('is-small', f.w * z < 70 || f.h * z < 70);
    placeX();
  }

  // The x sits on the frame's top-right corner, but slides along the top edge
  // to stay on screen when a wide frame runs past the right side.
  function placeX() {
    const f = selFrame();
    const x = selEl.querySelector('.sel-x');
    if (!f || !x) return;
    const left = margX + f.x * z;
    const right = left + f.w * z;
    const edge = ws.scrollLeft + ws.clientWidth - 20;
    const over = Math.max(0, Math.min(right - edge, f.w * z - 30));
    x.style.right = `${-13 + over}px`;
  }

  function showGuides(gx, gy) {
    let html = '';
    if (gx !== null && gx !== undefined) html += `<div class="guide v" style="left:${gx * z}px"></div>`;
    if (gy !== null && gy !== undefined) html += `<div class="guide h" style="top:${gy * z}px"></div>`;
    guidesEl.innerHTML = html;
  }

  // The middle lines of one frame, for a photo moving inside it.
  function showFrameGuides(f, onX, onY) {
    let html = '';
    if (onX) html += `<div class="guide v in-frame" style="left:${(f.x + f.w / 2) * z}px;top:${f.y * z}px;bottom:auto;height:${f.h * z}px"></div>`;
    if (onY) html += `<div class="guide h in-frame" style="top:${(f.y + f.h / 2) * z}px;left:${f.x * z}px;right:auto;width:${f.w * z}px"></div>`;
    guidesEl.innerHTML = html;
  }

  function renderStrip() {
    layout();
    renderFrames();
    renderBands();
    renderSeams();
    renderSafe();
    renderLabels();
    placeSel();
  }

  function renderTop() {
    const u = toolsEl.querySelector('[data-act="undo"]');
    const r = toolsEl.querySelector('[data-act="redo"]');
    if (u) u.disabled = hi === 0;
    if (r) r.disabled = hi >= hist.length - 1;
    nameEl.querySelector('span').textContent = p.name;
  }

  function render() {
    renderStrip();
    renderTop();
    renderTools();
    renderTray();
    renderAdjust();
  }

  // ---------- Tools ----------
  const tool = (act, icon, label, { disabled = false, on = false } = {}) =>
    `<button type="button" class="tool${on ? ' is-on' : ''}" data-act="${act}"${disabled ? ' disabled' : ''}><span class="tool-icon">${icon}</span><span class="tool-label">${esc(label)}</span></button>`;

  const smallTool = (act, icon, label, disabled) =>
    `<button type="button" class="tool tool-sm" data-act="${act}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}><span class="tool-icon">${icon}</span></button>`;

  function renderTools() {
    const f = selFrame();
    const history = [smallTool('undo', ICONS.undo, 'Undo', hi === 0), smallTool('redo', ICONS.redo, 'Redo', hi >= hist.length - 1)];
    if (f) {
      const has = !!f.photoId;
      toolsEl.innerHTML = [
        ...history,
        tool('adjust', ICONS.adjust, 'Adjust', { disabled: !has, on: photoMode }),
        tool('rotate', ICONS.rotate, 'Rotate', { disabled: !has }),
        tool('swap', has ? ICONS.swap : ICONS.photo, has ? 'Swap' : 'Photo'),
        tool('fit', ICONS.fit, 'Fit', { disabled: !has }),
        tool('frame-more', ICONS.more, 'More'),
        tool('delete', ICONS.trash, 'Delete'),
      ].join('');
      return;
    }
    toolsEl.innerHTML = [
      smallTool('back', ICONS.back, 'Back to the notebook'),
      ...history,
      tool('add-frame', ICONS.addFrame, 'Frame'),
      tool('slides', ICONS.slides, pageTitle(p, true)),
      tool('layout', ICONS.layout, 'Layout'),
      tool('more', ICONS.more, 'More'),
      tool('export', ICONS.export, 'Export'),
    ].join('');
  }

  function renderAdjust() {
    const f = selFrame();
    const on = !!(photoMode && f && f.photoId);
    adjustEl.hidden = !on;
    if (on) zoomInput.value = String(f.crop.zoom || 1);
  }

  // ---------- Tray ----------
  function usedIds() {
    return new Set(p.frames.map((f) => f.photoId).filter(Boolean));
  }

  function renderTray() {
    const used = usedIds();
    const items = p.photoIds
      .filter((pid) => photos[pid])
      .map(
        (pid) => `<button type="button" class="tray-item${used.has(pid) ? ' is-used' : ''}" data-pid="${pid}" aria-label="${used.has(pid) ? 'Photo in use' : 'Photo'}">
          <img src="${thumbOf(pid)}" alt="" draggable="false" />${used.has(pid) ? `<span class="tray-used">${ICONS.check}</span>` : ''}</button>`
      )
      .join('');
    const was = trayEl.querySelector('[data-tray-list]');
    const keep = was ? was.scrollLeft : 0;
    trayEl.innerHTML = `
      <button type="button" class="tray-add" data-act="add-photos">${ICONS.plus}<span>Photos</span></button>
      <div class="tray-list" data-tray-list>${items || '<p class="tray-hint">Add photos from your camera roll. They fill empty frames in order.</p>'}</div>`;
    // A redraw must not throw the row back to its first photos.
    trayEl.querySelector('[data-tray-list]').scrollLeft = keep;
  }

  // ---------- Frame actions ----------
  function select(fid) {
    if (sel !== fid) photoMode = false;
    sel = fid;
    placeSel();
    renderTools();
    renderAdjust();
  }

  function deselect() {
    if (!sel && !photoMode) return;
    sel = null;
    photoMode = false;
    placeSel();
    renderTools();
    renderAdjust();
  }

  function putPhoto(f, pid) {
    f.photoId = pid;
    f.crop = defaultCrop();
    if (!p.photoIds.includes(pid)) p.photoIds.push(pid);
  }

  // Empty frames in reading order: slide by slide, top to bottom.
  function emptyFrames() {
    return p.frames
      .filter((f) => !f.photoId)
      .sort((a, b) => anchorSlide(a, p.slides) - anchorSlide(b, p.slides) || a.y - b.y || a.x - b.x);
  }

  function addFrame() {
    const k = visibleSlide();
    const b = slideBox(p, k);
    const onIt = p.frames.some((f) => anchorSlide(f, p.slides) === k);
    const f = onIt
      ? newFrame(Math.round(b.x + b.w / 4), Math.round(b.y + b.h / 4), Math.round(b.w / 2), Math.round(b.h / 2))
      : newFrame(b.x, b.y, b.w, b.h);
    p.frames.push(f);
    sel = f.id;
    photoMode = false;
    render();
    commit();
  }

  function rotateSel() {
    const f = selFrame();
    if (!f || !f.photoId) return;
    f.crop = rotatedCrop(f.crop);
    f.crop = clampedCrop(f, photos[f.photoId]);
    placeFrame(f);
    commit();
  }

  // The frame takes the photo's shape, so all of the photo shows.
  function fitSel() {
    const f = selFrame();
    if (!f || !f.photoId) return;
    const ph = photos[f.photoId];
    const turned = (f.crop.rot || 0) % 180 !== 0;
    const ar = turned ? ph.height / ph.width : ph.width / ph.height;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    let w = f.w;
    let h = w / ar;
    if (h > H()) {
      h = f.h;
      w = h * ar;
    }
    f.w = Math.round(w);
    f.h = Math.round(h);
    f.x = Math.round(cx - f.w / 2);
    f.y = Math.round(clamp(cy - f.h / 2, Math.min(0, H() - f.h), Math.max(0, H() - f.h)));
    f.crop = { ...defaultCrop(), rot: f.crop.rot || 0 };
    render();
    commit();
  }

  // The x on a selected photo: the frame stays, the photo goes back to the tray.
  function takeOut() {
    const f = selFrame();
    if (!f || !f.photoId) return;
    f.photoId = null;
    f.crop = defaultCrop();
    photoMode = false;
    render();
    commit();
  }

  function deleteSlide(k) {
    if (p.slides <= 1) return;
    apply(removeSlide(p, k));
    if (sel && !frameById(sel)) {
      sel = null;
      photoMode = false;
    }
    fitIfNeeded();
    render();
    commit();
  }

  function deleteSel() {
    if (!sel) return;
    p.frames = p.frames.filter((f) => f.id !== sel);
    sel = null;
    photoMode = false;
    render();
    commit();
  }

  async function frameMore() {
    const f = selFrame();
    if (!f) return;
    const idx = p.frames.indexOf(f);
    const key = await choiceSheet({
      title: 'Frame',
      options: [
        { key: 'fill', label: `Fill the ${pageWord(p)}`, detail: 'Cover the slide, inside its border.' },
        { key: 'front', label: 'Bring to front', detail: 'Over the frames it overlaps.' },
        { key: 'back', label: 'Send to back', detail: 'Under the frames it overlaps.' },
        ...(f.photoId ? [{ key: 'empty', label: 'Empty this frame', detail: 'The photo stays in the tray.' }] : []),
      ].filter((o) => !(o.key === 'front' && idx === p.frames.length - 1) && !(o.key === 'back' && idx === 0)),
    });
    if (!key || !frameById(f.id)) return;
    if (key === 'fill') {
      Object.assign(f, slideBox(p, anchorSlide(f, p.slides)));
      if (f.photoId) f.crop = clampedCrop(f, photos[f.photoId]);
    } else if (key === 'front') {
      p.frames.splice(idx, 1);
      p.frames.push(f);
    } else if (key === 'back') {
      p.frames.splice(idx, 1);
      p.frames.unshift(f);
    } else if (key === 'empty') {
      f.photoId = null;
      f.crop = defaultCrop();
      photoMode = false;
    }
    render();
    commit();
  }

  // ---------- Photos in and out ----------
  // targetIds: the frames to fill first, in order (one id or a list).
  async function importInto(files, targetIds = []) {
    askToPersist();
    // Progress shows on the + Photos button; render() puts its label back.
    const addLabel = trayEl.querySelector('.tray-add span');
    const { photos: added, failed } = await importFiles(p.id, files, (i, n) => {
      if (addLabel) addLabel.textContent = n === 1 ? 'Adding' : `${i + 1} of ${n}`;
    });
    if (destroyed) return;
    added.forEach((r) => {
      photos[r.id] = r;
      if (!p.photoIds.includes(r.id)) p.photoIds.push(r.id);
    });
    if (failed.length) toast(`${failed.length === 1 ? 'One photo' : `${failed.length} photos`} could not be opened. JPEG and PNG work everywhere.`, { ms: 5000 });
    const queue = added.map((r) => r.id);
    const targets = [].concat(targetIds || []).map((id) => frameById(id)).filter(Boolean);
    for (const f of targets) if (queue.length) putPhoto(f, queue.shift());
    const fillEmpty = () => {
      if (!targets.length) for (const f of emptyFrames()) if (queue.length) putPhoto(f, queue.shift());
    };
    const open = targets.length ? 0 : emptyFrames().length;
    const extra = queue.length - open;
    render();
    if (extra > 0 && p.slides < MAX_SLIDES) {
      // Nothing is placed until this is answered, so keeping them in the
      // tray leaves the pages exactly as they were.
      const room = Math.min(extra, MAX_SLIDES - p.slides);
      const word = pageWord(p, room !== 1);
      const photosLine = queue.length === 1 ? 'One photo' : `${queue.length} photos`;
      const key = await choiceSheet({
        title: 'More photos than frames',
        message: open ? `${photosLine}, ${open === 1 ? 'one empty frame' : `${open} empty frames`}.` : `${photosLine} without a frame.`,
        options: [
          { key: 'slides', label: `Add ${room} ${word}`, detail: open ? `Fills the empty frames, then one photo on each new ${pageWord(p)}.` : `One photo on each new ${pageWord(p)}.` },
          { key: 'tray', label: 'Keep them in the tray', detail: 'Nothing goes on the pages yet.' },
        ],
      });
      if (key === 'slides' && !destroyed) {
        fillEmpty();
        for (let n = 0; n < room && queue.length; n++) {
          apply(insertSlide(p, p.slides));
          const b = slideBox(p, p.slides - 1);
          p.frames.push(newFrame(b.x, b.y, b.w, b.h, queue.shift()));
        }
        fitIfNeeded();
        render();
      }
    } else {
      fillEmpty();
      render();
    }
    commit();
  }

  async function addPhotos() {
    const files = await pickFiles({ multiple: true });
    if (files.length) await importInto(files);
  }

  // The frames one pick fills: the tapped frame first, then the other empty
  // frames on its slide, top to bottom. A frame with a photo is a swap: one.
  function slideTargets(f) {
    if (f.photoId) return [f.id];
    const k = anchorSlide(f, p.slides);
    const rest = p.frames
      .filter((o) => o !== f && !o.photoId && anchorSlide(o, p.slides) === k)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    return [f.id, ...rest.map((o) => o.id)];
  }

  // Three columns, each photo at its own shape, filled shortest column first
  // so the order still reads left to right.
  function pickColumns(list, current) {
    const cols = [[], [], []];
    const tall = [0, 0, 0];
    for (const pid of list) {
      const ph = photos[pid];
      const i = tall.indexOf(Math.min(...tall));
      cols[i].push(`<button type="button" class="pick-photo${pid === current ? ' is-current' : ''}" data-pid="${pid}" style="aspect-ratio:${ph.width || 1} / ${ph.height || 1}"><img src="${thumbOf(pid)}" alt="" draggable="false" /><span class="pick-num"></span></button>`);
      tall[i] += (ph.height || 1) / (ph.width || 1);
    }
    return `<div class="pick-grid">${cols.map((c) => `<div class="pick-col">${c.join('')}</div>`).join('')}</div>`;
  }

  function openSwap(fid) {
    const f = frameById(fid);
    if (!f) return;
    const targets = slideTargets(f);
    const max = targets.length;
    const many = max > 1;
    const list = p.photoIds.filter((pid) => photos[pid]);
    // Nothing in the draft to choose from yet: go straight to the camera roll.
    if (!list.length) {
      pickFiles({ multiple: many }).then((files) => files.length && importInto(files, targets));
      return;
    }
    const s = openSheet({
      title: f.photoId ? 'Swap photo' : many ? 'Add photos' : 'Add a photo',
      className: many ? 'has-footer' : '',
      body: `
        ${many ? `<p class="sheet-message">Pick up to ${max}, one for each empty frame on this ${esc(pageWord(p))}.</p>` : ''}
        ${pickColumns(list, f.photoId)}
        ${many
          ? `<div class="sheet-footer"><div class="button-stack">
              <button type="button" class="small-btn primary" data-place disabled>Place photos</button>
              <button type="button" class="small-btn secondary" data-new>+ From camera roll</button>
            </div></div>`
          : `<div class="button-stack">
              <button type="button" class="small-btn primary" data-new>+ From camera roll</button>
              ${f.photoId ? '<button type="button" class="small-btn secondary" data-empty>Empty this frame</button>' : ''}
            </div>`}`,
    });
    const picked = [];
    const placeBtn = s.body.querySelector('[data-place]');
    function mark() {
      s.body.querySelectorAll('[data-pid]').forEach((b) => {
        const n = picked.indexOf(b.dataset.pid);
        b.classList.toggle('is-picked', n >= 0);
        b.querySelector('.pick-num').textContent = n >= 0 ? String(n + 1) : '';
      });
      placeBtn.disabled = !picked.length;
      placeBtn.textContent = picked.length ? `Place ${picked.length} photo${picked.length === 1 ? '' : 's'}` : 'Place photos';
    }
    // Put the picked photos in, in the order they were tapped.
    function place() {
      picked.forEach((pid, i) => {
        const fr = frameById(targets[i]);
        if (fr) putPhoto(fr, pid);
      });
    }
    s.body.querySelectorAll('[data-pid]').forEach((b) =>
      b.addEventListener('click', () => {
        const pid = b.dataset.pid;
        if (!many) {
          const fr = frameById(fid);
          if (fr) putPhoto(fr, pid);
          s.close();
          render();
          commit();
          return;
        }
        const n = picked.indexOf(pid);
        if (n >= 0) picked.splice(n, 1);
        else if (picked.length < max) picked.push(pid);
        mark();
      })
    );
    if (placeBtn) {
      placeBtn.addEventListener('click', () => {
        place();
        s.close();
        render();
        commit();
      });
    }
    s.body.querySelector('[data-new]').addEventListener('click', async () => {
      // Photos already picked here go in first; the camera roll fills the rest.
      place();
      const left = targets.slice(picked.length);
      s.close();
      if (picked.length) {
        render();
        commit();
      }
      if (!left.length) return;
      const files = await pickFiles({ multiple: left.length > 1 });
      if (files.length) await importInto(files, left);
    });
    const emptyBtn = s.body.querySelector('[data-empty]');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        const fr = frameById(fid);
        if (fr) {
          fr.photoId = null;
          fr.crop = defaultCrop();
        }
        photoMode = false;
        s.close();
        render();
        commit();
      });
    }
  }

  function trayTap(pid) {
    const f = selFrame() || emptyFrames()[0];
    if (!f) return;
    putPhoto(f, pid);
    sel = f.id;
    render();
    commit();
  }

  // ---------- Sheets ----------
  async function openSlides() {
    const get = await previewSources();
    const word = pageTitle(p);
    const s = openSheet({ title: pageTitle(p, true), className: 'has-footer' });
    function draw() {
      const n = p.slides;
      s.body.innerHTML = `
        <ol class="slide-list">
          ${Array.from({ length: n }, (_, i) => `
            <li class="slide-row">
              <button type="button" class="slide-thumb r-${p.ratio.replace(':', 'x')}" data-go="${i}" aria-label="Show ${word} ${i + 1}"></button>
              <span class="slide-name">${word} ${i + 1}</span>
              <span class="slide-acts">
                <button type="button" class="mini-btn" data-layout="${i}" aria-label="Change the layout">${ICONS.grid}</button>
                <button type="button" class="mini-btn" data-up="${i}" aria-label="Move earlier"${i === 0 ? ' disabled' : ''}>${ICONS.up}</button>
                <button type="button" class="mini-btn" data-down="${i}" aria-label="Move later"${i === n - 1 ? ' disabled' : ''}>${ICONS.down}</button>
                <button type="button" class="mini-btn" data-copy="${i}" aria-label="Copy the layout"${n >= MAX_SLIDES ? ' disabled' : ''}>${ICONS.copy}</button>
                <button type="button" class="mini-btn" data-del="${i}" aria-label="Remove"${n <= 1 ? ' disabled' : ''}>${ICONS.trash}</button>
              </span>
            </li>`).join('')}
        </ol>
        <p class="field-hint">The grid button picks a new layout for that ${pageWord(p)}. Copy makes a new ${pageWord(p)} with the same empty frames. A photo that crosses a seam moves with the ${pageWord(p)} it starts on.</p>
        <div class="sheet-footer">
          <button type="button" class="modal-cta primary" data-add${n >= MAX_SLIDES ? ' disabled' : ''}>${n >= MAX_SLIDES ? `${MAX_SLIDES} is the most` : `+ Add a ${pageWord(p)}`}</button>
        </div>`;
      s.body.querySelectorAll('.slide-thumb').forEach((b) => {
        const c = previewCanvas(p, get, { height: 96, from: Number(b.dataset.go), count: 1 });
        b.appendChild(c);
      });
    }
    function changed() {
      fitIfNeeded();
      render();
      commit();
      draw();
    }
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.go !== undefined) {
        s.close();
        showSlide(Number(d.go));
        return;
      }
      if (d.layout !== undefined || d.add !== undefined) {
        const k = d.layout !== undefined ? +d.layout : null;
        pickLayout(k).then((l) => {
          if (!l || destroyed || !s.overlay.isConnected) return;
          if (k === null) addSlideWith(l);
          else apply(applySlideLayout(p, k, l));
          if (sel && !frameById(sel)) sel = null;
          changed();
        });
        return;
      }
      if (d.up !== undefined) apply(moveSlide(p, +d.up, +d.up - 1));
      else if (d.down !== undefined) apply(moveSlide(p, +d.down, +d.down + 1));
      else if (d.copy !== undefined) apply(copySlideLayout(p, +d.copy));
      else if (d.del !== undefined) apply(removeSlide(p, +d.del));
      else return;
      if (sel && !frameById(sel)) sel = null;
      changed();
    });
    draw();
  }

  // ---------- Layouts for one slide ----------

  // A drawing of what `layout` would make on slide k of q.
  function layoutSvg(q, k, layout) {
    const Hh = slideH(q);
    const rects = layoutRects(q, k, layout)
      .map((r) => `<rect x="${r.x - k * SLIDE_W}" y="${r.y}" width="${r.w}" height="${r.h}" class="lay-frame"/>`)
      .join('');
    return `<svg class="lay-svg" width="${Math.round((84 * SLIDE_W) / Hh)}" height="84" viewBox="0 0 ${SLIDE_W} ${Hh}" aria-hidden="true"><rect width="${SLIDE_W}" height="${Hh}" fill="${esc(q.background)}" class="lay-slide"/>${rects}<rect width="${SLIDE_W}" height="${Hh}" class="lay-edge"/></svg>`;
  }

  // Resolves with the chosen layout, or null. k is the slide to change, or
  // null for a new slide at the end.
  function pickLayout(k) {
    const isNew = k === null;
    const word = pageWord(p);
    const q = isNew ? insertSlide(p, p.slides) : p;
    const at = isNew ? p.slides : k;
    const options = [];
    if (isNew && framesWithinSlide(p, p.slides - 1).length) options.push(layoutOfSlide(p, p.slides - 1));
    options.push(...SLIDE_LAYOUTS);
    const hasPhotos = !isNew && framesWithinSlide(p, k).some((f) => f.photoId);
    return new Promise((resolve) => {
      let chosen = null;
      const s = openSheet({
        title: isNew ? `New ${word}` : `${word} ${k + 1} layout`,
        className: 'sheet-wide',
        body: `
          ${hasPhotos ? `<p class="sheet-message">Its photos move into the new frames, in order.</p>` : ''}
          <div class="layout-grid">
            ${options.map((o, n) => `<button type="button" class="layout-opt" data-n="${n}">${layoutSvg(q, at, o)}<span>${esc(o.name)}</span></button>`).join('')}
          </div>
          <p class="field-hint">For space around and between the photos: the three dots at the top, then Background and borders.</p>`,
        onClose: () => resolve(chosen),
      });
      s.body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-n]');
        if (!b) return;
        chosen = options[Number(b.dataset.n)];
        s.close();
      });
    });
  }

  function addSlideWith(layout) {
    apply(insertSlide(p, p.slides));
    apply(applySlideLayout(p, p.slides - 1, layout));
  }

  async function addSlide() {
    if (p.slides >= MAX_SLIDES) return;
    const layout = await pickLayout(null);
    if (!layout || destroyed || p.slides >= MAX_SLIDES) return;
    addSlideWith(layout);
    sel = null;
    photoMode = false;
    fitIfNeeded();
    render();
    showSlide(p.slides - 1);
    commit();
  }

  // The Layout button: a new layout for the slide on screen.
  async function layoutThisSlide() {
    const k = visibleSlide();
    const l = await pickLayout(k);
    if (!l || destroyed) return;
    apply(applySlideLayout(p, k, l));
    if (sel && !frameById(sel)) {
      sel = null;
      photoMode = false;
    }
    render();
    commit();
  }

  function openBorders() {
    const colorChips = (name, value, options) => `
      <div class="swatches" role="radiogroup">
        ${options.map(([v, label]) => `<label class="swatch"><input type="radio" name="${name}" value="${v}"${value.toLowerCase() === v ? ' checked' : ''} /><span><i style="background:${v}"></i>${label}</span></label>`).join('')}
        <label class="swatch swatch-custom"><input type="radio" name="${name}" value="custom"${options.some(([v]) => v === value.toLowerCase()) ? '' : ' checked'} /><span><input type="color" value="${esc(value)}" data-color="${name}" aria-label="Custom color" />Custom</span></label>
      </div>`;
    const s = openSheet({
      title: 'Background and borders',
      body: `
        <div class="form">
          <div class="field">
            <span class="field-label">Background</span>
            ${colorChips('bg', p.background, [['#ffffff', 'White'], ['#000000', 'Black']])}
            <span class="field-hint">Shows wherever there's no photo.</span>
          </div>
          <div class="field">
            <span class="field-label">Slide border <b class="range-val" data-val="pad"></b></span>
            <input type="range" min="0" max="200" step="2" value="${p.padding}" data-range="pad" />
            <span class="field-hint">An even border around each ${pageWord(p)}, in the background color. Frames also snap this far apart.</span>
            <label class="check"><input type="checkbox" data-seams${p.seamsOpen ? ' checked' : ''} /> Leave seams open</label>
            <span class="field-hint">No border where ${pageWord(p, true)} meet, so a panorama runs straight across.</span>
          </div>
          <div class="field">
            <span class="field-label">Photo border <b class="range-val" data-val="bw"></b></span>
            <input type="range" min="0" max="80" step="1" value="${p.borderWidth}" data-range="bw" />
            ${colorChips('bc', p.borderColor, [['#ffffff', 'White'], ['#000000', 'Black']])}
            <span class="field-hint">A line around the inside edge of every photo.</span>
          </div>
        </div>`,
      onClose: commit,
    });
    const b = s.body;
    const vals = () => {
      b.querySelector('[data-val="pad"]').textContent = p.padding ? `${p.padding} px` : 'Off';
      b.querySelector('[data-val="bw"]').textContent = p.borderWidth ? `${p.borderWidth} px` : 'Off';
    };
    vals();
    const live = () => {
      vals();
      renderStrip();
    };
    const colorOf = (name) => {
      const r = b.querySelector(`input[name="${name}"]:checked`);
      return r.value === 'custom' ? b.querySelector(`[data-color="${name}"]`).value : r.value;
    };
    b.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.range === 'pad') p.padding = Number(t.value);
      else if (t.dataset.range === 'bw') p.borderWidth = Number(t.value);
      else if (t.dataset.color) {
        t.closest('.swatch').querySelector('input[type="radio"]').checked = true;
        if (t.dataset.color === 'bg') p.background = t.value;
        else p.borderColor = t.value;
      } else return;
      live();
    });
    b.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'bg') p.background = colorOf('bg');
      else if (t.name === 'bc') p.borderColor = colorOf('bc');
      else if (t.dataset.seams !== undefined) p.seamsOpen = t.checked;
      live();
      commit();
    });
  }

  async function openGrid() {
    const get = await previewSources();
    const s = openSheet({
      title: 'Grid preview',
      body: `
        <div class="grid-preview">
          <div class="grid-tile is-post" data-post></div>
          ${Array.from({ length: 8 }, () => '<div class="grid-tile"></div>').join('')}
        </div>
        <p class="field-hint">${p.ratio === '3:4' ? 'Your first slide fills its tile in your profile grid.' : 'Your profile grid shows the middle of the first slide as a 3:4 tile.'}</p>`,
    });
    const c = previewCanvas(p, get, { height: 480, count: 1 });
    s.body.querySelector('[data-post]').appendChild(c);
  }

  async function topMore() {
    const unused = p.photoIds.filter((pid) => !usedIds().has(pid));
    const both = z <= fitZ('all') * 1.05;
    const key = await choiceSheet({
      title: 'Chapter',
      options: [
        { key: 'rename', label: 'Rename', detail: 'Also names the exported files.' },
        { key: 'zoom', label: both ? 'See one page' : 'See both pages', detail: both ? 'Closer in, one page at a time.' : 'The whole open notebook.' },
        ...(isStory(p) ? [{ key: 'safe', label: showSafe ? 'Hide safe zone' : 'Show safe zone', detail: 'The parts Instagram covers.' }] : []),
        { key: 'borders', label: 'Background and borders', detail: 'The background color, and space around the photos.' },
        { key: 'template', label: 'Save as template', detail: 'Keeps the layout, not the photos.' },
        ...(isStory(p) || isPrint(p) ? [] : [{ key: 'grid', label: 'Grid preview', detail: 'How the first slide looks in your profile grid.' }]),
        ...(unused.length ? [{ key: 'clear', label: 'Remove unused photos', detail: `${unused.length} in the tray, not in a frame.` }] : []),
      ],
    });
    if (key === 'rename') rename();
    else if (key === 'zoom') fitTo(both ? 'one' : 'all');
    else if (key === 'safe') toggleSafe();
    else if (key === 'borders') openBorders();
    else if (key === 'template') saveAsTemplate();
    else if (key === 'grid') openGrid();
    else if (key === 'clear') {
      p.photoIds = p.photoIds.filter((pid) => usedIds().has(pid));
      renderTray();
      commit();
    }
  }

  async function rename() {
    const v = await promptSheet({ title: 'Rename', value: p.name });
    if (!v || v === p.name) return;
    p.name = v;
    renderTop();
    commit();
  }

  async function saveAsTemplate() {
    const v = await promptSheet({ title: 'Save as template', label: 'Template name', value: p.name, confirmLabel: 'Save' });
    if (!v) return;
    const all = await listTemplates();
    const order = all.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1;
    await saveTemplate({ ...templateFromProject(p), name: v, sortOrder: order, starter: false });
  }

  function toggleSafe() {
    showSafe = !showSafe;
    try {
      localStorage.setItem(SAFE_KEY, showSafe ? 'on' : 'off');
    } catch {}
    renderSafe();
    renderTools();
  }

  async function leave() {
    commitSoon.flush();
    saveSoon.flush();
    thumbSoon.cancel();
    await makeThumb();
    location.hash = '#/contents';
  }

  // ---------- Buttons ----------
  // view and document outlive this editor, so their listeners come off
  // with it (one signal for all of them).
  const off = new AbortController();
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      const a = b.dataset.act;
      if (a === 'back') leave();
      else if (a === 'undo') undo();
      else if (a === 'redo') redo();
      else if (a === 'more') topMore();
      else if (a === 'rename') rename();
      else if (a === 'export') {
        commitSoon.flush();
        saveSoon.flush();
        openExport(p, photos);
      } else if (a === 'add-frame') addFrame();
      else if (a === 'add-slide') addSlide();
      else if (a === 'slides') openSlides();
      else if (a === 'layout') layoutThisSlide();
      else if (a === 'adjust') {
        photoMode = !photoMode;
        placeSel();
        renderTools();
        renderAdjust();
      } else if (a === 'adjust-done') {
        photoMode = false;
        placeSel();
        renderTools();
        renderAdjust();
      } else if (a === 'rotate') rotateSel();
      else if (a === 'swap') openSwap(sel);
      else if (a === 'fit') fitSel();
      else if (a === 'frame-more') frameMore();
      else if (a === 'delete') deleteSel();
      else if (a === 'add-photos') addPhotos();
      else if (a === 'take-out') takeOut();
      else if (a === 'del-slide') deleteSlide(Number(b.dataset.k));
      return;
    }
    const t = e.target.closest('.tray-item');
    if (t && !trayDrag.suppressClick) trayTap(t.dataset.pid);
  }, { signal: off.signal });

  zoomInput.addEventListener('input', () => {
    const f = selFrame();
    if (!f || !f.photoId) return;
    f.crop = { ...f.crop, zoom: Number(zoomInput.value) };
    f.crop = clampedCrop(f, photos[f.photoId]);
    placeFrame(f);
  });
  zoomInput.addEventListener('change', commit);

  // ---------- Gestures on the strip ----------
  const pts = new Map();
  let g = null;
  let lastTap = { id: null, t: 0 };
  let inertia = 0;
  let holdTimer = 0;
  const HOLD_MS = 420;
  // ---------- Hold a photo, drag it onto another frame: they swap ----------
  function stopHold() {
    clearTimeout(holdTimer);
    holdTimer = 0;
  }

  function startLift() {
    holdTimer = 0;
    if (!g || g.moved || pts.size !== 1 || (g.type !== 'pan' && g.type !== 'photo')) return;
    const id = g.type === 'pan' ? g.frameId : g.id;
    const f = id && frameById(id);
    if (!f || !f.photoId) return;
    stopInertia();
    const ghost = document.createElement('img');
    ghost.className = 'drag-ghost is-lift';
    ghost.src = thumbOf(f.photoId);
    document.body.appendChild(ghost);
    const el = framesEl.querySelector(`.fr[data-id="${f.id}"]`);
    if (el) el.classList.add('is-lifted');
    g = { type: 'lift', pid: g.pid, id: f.id, ghost, el, moved: true };
    const pt = pts.get(g.pid);
    if (pt) moveLift(pt.x, pt.y);
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
  }

  function moveLift(x, y) {
    g.ghost.style.transform = `translate(${x - 44}px, ${y - 44}px)`;
    const d = dropAt(x, y);
    setDropTarget(d && d.frameId && d.frameId !== g.id ? d.frameId : null);
  }

  function endLift(was, e) {
    was.ghost.remove();
    if (was.el) was.el.classList.remove('is-lifted');
    const to = dropTarget;
    setDropTarget(null);
    if (e.type !== 'pointerup' || !to) return;
    const a = frameById(was.id);
    const b = frameById(to);
    if (!a || !b) return;
    // Each photo keeps its turn; zoom and position start fresh in the new shape.
    const [pa, ra, pb, rb] = [a.photoId, a.crop.rot || 0, b.photoId, b.crop.rot || 0];
    a.photoId = pb;
    a.crop = { ...defaultCrop(), rot: pb ? rb : 0 };
    b.photoId = pa;
    b.crop = { ...defaultCrop(), rot: ra };
    sel = b.id;
    photoMode = false;
    render();
    commit();
  }

  function stopInertia() {
    cancelAnimationFrame(inertia);
    inertia = 0;
  }

  function startPinch() {
    const [a, b] = [...pts.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const f = g && g.id && frameById(g.id);
    if (f && f.photoId && sel === f.id && (g.type === 'photo' || g.type === 'resize')) {
      if (g.start) Object.assign(f, g.start);
      placeFrame(f);
      placeSel();
      showGuides(null, null);
      const pl = placement(f, photos[f.photoId]);
      g = { type: 'ppinch', id: f.id, d0, zoom0: f.crop.zoom || 1, crop0: { ...f.crop, cx: pl.cx, cy: pl.cy }, mid0: mid };
    } else {
      showGuides(null, null);
      g = { type: 'zpinch', d0, z0: z, u: toUnits(mid.x, mid.y) };
    }
  }

  function pinchMove() {
    const [a, b] = [...pts.values()];
    if (!a || !b) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    if (g.type === 'zpinch') {
      const r = ws.getBoundingClientRect();
      z = clamp(g.z0 * (d / g.d0), minZ(), maxZ());
      zoomFit = null;
      renderStrip();
      ws.scrollLeft = margX + g.u.x * z - (mid.x - r.left);
      ws.scrollTop = margY + g.u.y * z - (mid.y - r.top);
      return;
    }
    const f = frameById(g.id);
    if (!f) return;
    const ph = photos[f.photoId];
    // Keep the point of the photo under the fingers where it was.
    const r = strip.getBoundingClientRect();
    const fc = { x: r.left + (f.x + f.w / 2) * z, y: r.top + (f.y + f.h / 2) * z };
    const pl0 = placement({ ...f, crop: g.crop0 }, ph);
    const q = { x: pl0.px + (g.mid0.x - fc.x) / z / pl0.s, y: pl0.py + (g.mid0.y - fc.y) / z / pl0.s };
    const zoom = clamp(g.zoom0 * (d / g.d0), 1, 8);
    const pl1 = placement({ ...f, crop: { ...g.crop0, zoom } }, ph);
    const px = q.x - (mid.x - fc.x) / z / pl1.s;
    const py = q.y - (mid.y - fc.y) / z / pl1.s;
    f.crop = { ...g.crop0, zoom, cx: px / pl1.rw + 0.5, cy: py / pl1.rh + 0.5 };
    f.crop = clampedCrop(f, ph);
    placeFrame(f);
    if (photoMode) zoomInput.value = String(zoom);
  }

  function resizeFrame(f, dxu, dyu, noSnap) {
    const s = g.start;
    const h = g.h;
    const tol = SNAP_PX / z;
    let l = s.x;
    let r = s.x + s.w;
    let t = s.y;
    let b = s.y + s.h;
    let gx = null;
    let gy = null;
    const snap = (v, list) => {
      const n = noSnap ? null : nearest([v], list, tol);
      return n ? [v + n.d, n.line] : [v, null];
    };
    if (h.includes('w')) [l, gx] = snap(s.x + dxu, g.targets.xs);
    if (h.includes('e')) [r, gx] = snap(s.x + s.w + dxu, g.targets.xs);
    // The edges of the open spread are as far as a frame can go.
    const lo = spread * 2 * SLIDE_W;
    const hi2 = lo + 2 * SLIDE_W;
    if (l < lo) [l, gx] = [lo, null];
    if (r > hi2) [r, gx] = [hi2, null];
    if (h.includes('n')) [t, gy] = snap(s.y + dyu, g.targets.ys);
    if (h.includes('s')) [b, gy] = snap(s.y + s.h + dyu, g.targets.ys);
    if (r - l < MIN_FRAME) {
      if (h.includes('w')) l = r - MIN_FRAME;
      else r = l + MIN_FRAME;
      gx = null;
    }
    if (b - t < MIN_FRAME) {
      if (h.includes('n')) t = b - MIN_FRAME;
      else b = t + MIN_FRAME;
      gy = null;
    }
    f.x = Math.round(l);
    f.y = Math.round(t);
    f.w = Math.round(r - l);
    f.h = Math.round(b - t);
    showGuides(gx, gy);
  }

  function panPhoto(f, dxu, dyu) {
    const ph = photos[f.photoId];
    const pl = placement({ ...f, crop: g.crop0 }, ph);
    f.crop = { ...g.crop0, cx: pl.cx - dxu / (pl.s * pl.rw), cy: pl.cy - dyu / (pl.s * pl.rh) };
    // Close to the frame's middle, the photo's centre catches on that axis
    // and a line shows it. An axis the photo can't move along has no catch.
    const wide = pl.s * pl.rw;
    const tall = pl.s * pl.rh;
    const onX = wide > f.w + 0.5 && Math.abs(f.crop.cx - 0.5) * wide * z < SNAP_PX;
    const onY = tall > f.h + 0.5 && Math.abs(f.crop.cy - 0.5) * tall * z < SNAP_PX;
    if (onX) f.crop.cx = 0.5;
    if (onY) f.crop.cy = 0.5;
    f.crop = clampedCrop(f, ph);
    showFrameGuides(f, onX, onY);
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Buttons on the canvas (the photo's x, a slide's delete) take their own taps.
    if (e.target.closest('button') || flipping) return;
    try {
      ws.setPointerCapture(e.pointerId);
    } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopInertia();
    inner.style.transition = 'none';
    inner.style.transform = '';
    if (pts.size === 2) {
      stopHold();
      showGuides(null, null);
      if (g && g.type === 'lift') return;
      startPinch();
      return;
    }
    if (pts.size > 2) return;
    const base = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, mouse: e.pointerType === 'mouse' };
    const handle = e.target.closest('[data-h]');
    const frEl = e.target.closest('.fr');
    const f = handle ? selFrame() : frEl && frameById(frEl.dataset.id);
    if (handle && f) {
      g = { ...base, type: 'resize', id: f.id, h: handle.dataset.h, start: { x: f.x, y: f.y, w: f.w, h: f.h }, targets: snapTargets(p, f.id, { safeZone: showSafe }) };
      return;
    }
    // Frames stay where the layout put them. Dragging the selected frame
    // moves its photo inside it; dragging anything else scrolls the strip,
    // so looking around never knocks a photo out of place. A tap selects.
    // Holding still on any photo lifts it, to drop on another frame.
    stopHold();
    if (f && f.photoId) holdTimer = setTimeout(startLift, HOLD_MS);
    if (f && sel === f.id && f.photoId) {
      const pl = placement(f, photos[f.photoId]);
      g = { ...base, type: 'photo', id: f.id, wasSel: true, crop0: { ...f.crop, cx: pl.cx, cy: pl.cy } };
      return;
    }
    g = { ...base, type: 'pan', frameId: f ? f.id : null, wasSel: !!f && sel === f.id, sl: ws.scrollLeft, st: ws.scrollTop, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
  }

  function onMove(e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    if (g.type === 'zpinch' || g.type === 'ppinch') {
      pinchMove();
      return;
    }
    if (e.pointerId !== g.pid) return;
    if (g.type === 'lift') {
      moveLift(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    // A finger has to travel a little further to move a photo than to
    // scroll, so a tap never nudges one.
    if (!g.moved && Math.hypot(dx, dy) < (g.mouse ? 3 : g.type === 'pan' ? 7 : 10)) return;
    g.moved = true;
    stopHold();
    if (g.type === 'pan') {
      const want = g.sl - dx;
      const maxS = Math.max(0, inner.offsetWidth - wsSize().w);
      ws.scrollLeft = want;
      ws.scrollTop = g.st - dy;
      // Past the end of the spread the page gives a little, then turns on release.
      g.over = want < 0 ? want : want > maxS ? want - maxS : 0;
      inner.style.transform = g.over ? `translateX(${-g.over * 0.4}px)` : '';
      g.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (g.samples.length > 6) g.samples.shift();
      return;
    }
    const f = frameById(g.id);
    if (!f) return;
    if (g.type === 'resize') resizeFrame(f, dx / z, dy / z, e.altKey);
    else if (g.type === 'photo') panPhoto(f, dx / z, dy / z);
    placeFrame(f);
    placeSel();
  }

  function glide(vx, vy) {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      ws.scrollLeft -= vx * dt;
      ws.scrollTop -= vy * dt;
      const k = Math.pow(0.994, dt);
      vx *= k;
      vy *= k;
      if (Math.abs(vx) + Math.abs(vy) > 0.02) inertia = requestAnimationFrame(step);
      else inertia = 0;
    };
    inertia = requestAnimationFrame(step);
  }

  // A drag has ended: snap to a page, turn the page, or coast.
  function settlePan(was, e) {
    const s = was.samples;
    const a = s[0];
    const b = s[s.length - 1];
    const dt = b.t - a.t;
    const fresh = e.type === 'pointerup' && dt > 0 && performance.now() - b.t < 60;
    const vx = fresh ? (b.x - a.x) / dt : 0;
    const vy = fresh ? (b.y - a.y) / dt : 0;
    const over = was.over || 0;
    const dragged = b.x - was.x0;
    const flick = Math.abs(vx) > 0.35 && Math.sign(vx) === Math.sign(dragged);
    inner.style.transition = 'transform .22s ease-out';
    inner.style.transform = '';
    if (zoomFit === 'one') {
      const first = firstPage();
      const last = lastPage();
      const from = Math.abs(was.sl - pageX(first)) <= Math.abs(was.sl - pageX(last)) ? first : last;
      const turned = Math.abs(dragged) > SLIDE_W * z * 0.28 || flick;
      const k = from + (turned ? (dragged < 0 ? 1 : -1) : 0);
      if (k < 0 || k >= p.slides) scrollToX(pageX(from));
      else if (spreadOf(k) !== spread) flipTo(spreadOf(k), k);
      else scrollToX(pageX(k));
      return;
    }
    const maxS = Math.max(0, inner.offsetWidth - wsSize().w);
    const next = over > 60 || (flick && vx < 0 && ws.scrollLeft >= maxS - 2);
    const prev = over < -60 || (flick && vx > 0 && ws.scrollLeft <= 2);
    if (next && spread < spreadCount(p) - 1) flipTo(spread + 1);
    else if (prev && spread > 0) flipTo(spread - 1, spread * 2 - 1);
    else if (fresh && !was.mouse) glide(vx, vy);
  }

  function onUp(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    stopHold();
    if (!g) return;
    if (g.type === 'lift') {
      if (e.pointerId !== g.pid) return;
      const was = g;
      g = null;
      endLift(was, e);
      return;
    }
    if (g.type === 'zpinch' || g.type === 'ppinch') {
      if (g.type === 'ppinch') commit();
      else renderTools();
      // The finger left behind starts nothing until it lifts too.
      g = pts.size ? { type: 'idle' } : null;
      return;
    }
    if (g.type === 'idle') {
      if (!pts.size) g = null;
      return;
    }
    if (e.pointerId !== g.pid) return;
    showGuides(null, null);
    const was = g;
    g = null;
    if (was.moved) {
      if (was.type === 'pan') {
        settlePan(was, e);
      } else commit();
      return;
    }
    if (e.type !== 'pointerup') return;
    // A tap: on the grey it deselects, on a frame it selects that frame.
    if (was.type === 'resize') return;
    const hit = toUnits(e.clientX, e.clientY);
    touched = clamp(Math.floor(hit.x / SLIDE_W), firstPage(), lastPage());
    const id = was.type === 'pan' ? was.frameId : was.id;
    if (!id) {
      deselect();
      return;
    }
    const now = performance.now();
    const double = lastTap.id === id && now - lastTap.t < 380;
    lastTap = double ? { id: null, t: 0 } : { id, t: now };
    const f = frameById(id);
    if (!f) return;
    if (!was.wasSel) select(id);
    if (double || (was.wasSel && !f.photoId)) openSwap(f.id);
  }

  ws.addEventListener('contextmenu', (e) => e.preventDefault());
  ws.addEventListener('pointerdown', onDown);
  ws.addEventListener('pointermove', onMove);
  ws.addEventListener('pointerup', onUp);
  ws.addEventListener('pointercancel', onUp);
  ws.addEventListener('lostpointercapture', (e) => {
    if (pts.has(e.pointerId)) onUp(e);
  });

  // Trackpad pinch (and ctrl + wheel) zooms. Over the photo being adjusted
  // it zooms the photo instead.
  ws.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const f = selFrame();
      const over = e.target.closest('.fr');
      if (photoMode && f && f.photoId && over && over.dataset.id === f.id) {
        f.crop = { ...f.crop, zoom: clamp((f.crop.zoom || 1) * Math.exp(-e.deltaY * 0.01), 1, 8) };
        f.crop = clampedCrop(f, photos[f.photoId]);
        placeFrame(f);
        zoomInput.value = String(f.crop.zoom);
        commitSoon();
        return;
      }
      setZoom(z * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    },
    { passive: false }
  );

  // ---------- Dragging photos from the tray ----------
  const trayDrag = { rec: null, ghost: null, suppressClick: false };

  function dropAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const fr = hit && hit.closest('.fr');
    if (fr && view.contains(fr)) return { frameId: fr.dataset.id };
    const sr = strip.getBoundingClientRect();
    if (x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom) {
      return { slide: clamp(Math.floor((x - sr.left) / (SLIDE_W * z)), firstPage(), lastPage()) };
    }
    return null;
  }

  function setDropTarget(fid) {
    if (dropTarget === fid) return;
    const prev = dropTarget && frameById(dropTarget);
    dropTarget = fid;
    if (prev) placeFrame(prev);
    const next = fid && frameById(fid);
    if (next) placeFrame(next);
  }

  // The app moves the tray itself, as it does the canvas: a finger going
  // sideways scrolls the row (with a flick), a finger going up lifts a photo
  // out to drop on a frame, and a tap places it.
  const trayList = () => trayEl.querySelector('[data-tray-list]');
  const trayMax = (list) => {
    const last = list.querySelector('.tray-item:last-child');
    return last ? Math.max(0, last.offsetLeft + last.offsetWidth + 2 - list.clientWidth) : 0;
  };
  let trayInertia = 0;
  function stopTrayGlide() {
    if (trayInertia) cancelAnimationFrame(trayInertia);
    trayInertia = 0;
  }
  function trayGlide(list, v) {
    let last = performance.now();
    const max = trayMax(list);
    const step = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      const to = clamp(list.scrollLeft - v * dt, 0, max);
      list.scrollLeft = to;
      v *= Math.pow(0.994, dt);
      trayInertia = Math.abs(v) > 0.02 && to > 0 && to < max ? requestAnimationFrame(step) : 0;
    };
    trayInertia = requestAnimationFrame(step);
  }

  trayEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tray-add') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const list = trayList();
    if (!list) return;
    stopTrayGlide();
    const item = e.target.closest('.tray-item');
    trayDrag.rec = {
      pid: item ? item.dataset.pid : null, id: e.pointerId, x0: e.clientX, y0: e.clientY, item, list, mode: null,
      sl: list.scrollLeft, samples: [{ t: performance.now(), x: e.clientX }],
    };
    trayDrag.suppressClick = false;
    if (e.pointerType !== 'mouse') traySwell(e.clientX);
  });
  trayEl.addEventListener('pointermove', (e) => {
    const r = trayDrag.rec;
    if (!r || r.id !== e.pointerId) return;
    const dx = e.clientX - r.x0;
    if (!r.mode) {
      const up = r.y0 - e.clientY;
      if (r.item && up >= 12 && up >= Math.abs(dx)) r.mode = 'drag';
      else if (Math.abs(dx) >= 6 && Math.abs(dx) >= Math.abs(e.clientY - r.y0)) r.mode = 'scroll';
      else return;
      try {
        trayEl.setPointerCapture(e.pointerId);
      } catch {}
      if (r.mode === 'drag') {
        traySwell(null);
        const ghost = document.createElement('img');
        ghost.className = 'drag-ghost';
        ghost.src = thumbOf(r.pid);
        document.body.appendChild(ghost);
        trayDrag.ghost = ghost;
      }
    }
    if (r.mode === 'scroll') {
      r.list.scrollLeft = clamp(r.sl - dx, 0, trayMax(r.list));
      r.samples.push({ t: performance.now(), x: e.clientX });
      if (r.samples.length > 6) r.samples.shift();
      if (e.pointerType !== 'mouse') traySwell(e.clientX);
      return;
    }
    trayDrag.ghost.style.transform = `translate(${e.clientX - 32}px, ${e.clientY - 32}px)`;
    const d = dropAt(e.clientX, e.clientY);
    setDropTarget(d && d.frameId ? d.frameId : null);
  });
  const endTrayDrag = (e) => {
    const r = trayDrag.rec;
    if (!r || r.id !== e.pointerId) return;
    trayDrag.rec = null;
    if (e.pointerType !== 'mouse') traySwell(null);
    if (!r.mode) return;
    trayDrag.suppressClick = true;
    setTimeout(() => (trayDrag.suppressClick = false), 400);
    if (r.mode === 'scroll') {
      const a = r.samples[0];
      const b = r.samples[r.samples.length - 1];
      const dt = b.t - a.t;
      if (e.type === 'pointerup' && dt > 0 && performance.now() - b.t < 60) trayGlide(r.list, (b.x - a.x) / dt);
      return;
    }
    if (trayDrag.ghost) trayDrag.ghost.remove();
    trayDrag.ghost = null;
    setDropTarget(null);
    if (e.type !== 'pointerup') return;
    const d = dropAt(e.clientX, e.clientY);
    if (!d) return;
    if (d.frameId) {
      const f = frameById(d.frameId);
      if (f) {
        putPhoto(f, r.pid);
        sel = f.id;
      }
    } else {
      const b = slideBox(p, d.slide);
      const f = newFrame(b.x, b.y, b.w, b.h, r.pid);
      p.frames.push(f);
      sel = f.id;
    }
    photoMode = false;
    render();
    commit();
  };
  trayEl.addEventListener('pointerup', endTrayDrag);
  trayEl.addEventListener('pointercancel', endTrayDrag);

  // ---------- The tray's Dock swell ----------
  // Like the Dock on a Mac: the photo under the finger (or the mouse) grows
  // and pushes its neighbours aside, easing off over about two photos each
  // way. Only transforms change, so the scrolling list never shifts.
  const SWELL = 0.45;
  let swellX = null;
  let swellRaf = 0;
  function traySwell(x) {
    swellX = x;
    if (!swellRaf) swellRaf = requestAnimationFrame(applySwell);
  }
  function applySwell() {
    swellRaf = 0;
    const list = trayEl.querySelector('[data-tray-list]');
    const items = list ? [...list.querySelectorAll('.tray-item')] : [];
    const on = swellX !== null && !(trayDrag.rec && trayDrag.rec.mode === 'drag') && items.length > 0;
    trayEl.classList.toggle('is-swell', on);
    if (!on) {
      items.forEach((el) => (el.style.transform = ''));
      return;
    }
    const left = list.getBoundingClientRect().left - list.scrollLeft;
    const pitch = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : items[0].offsetWidth + 6;
    const R = pitch * 2.2;
    const a = Math.PI / R;
    // Growth 1 + SWELL * cos²(a·d/2) inside R; a photo's push is that growth
    // added up between the finger and its centre.
    const push = (d) => (Math.abs(d) >= R ? Math.sign(d) * SWELL * (R / 2) : SWELL * (d / 2 + Math.sin(a * d) / (2 * a)));
    const w = items[0].offsetWidth;
    const fx = items.map((el) => {
      const d = left + el.offsetLeft + w / 2 - swellX;
      return { el, d, x: push(d), k: Math.abs(d) >= R ? 1 : 1 + SWELL * Math.cos((a * d) / 2) ** 2 };
    });
    // Near either end of the list, the end photo stays inside instead of
    // being pushed out of view; the nudge fades as the row scrolls away.
    const first = fx[0];
    const last = fx[fx.length - 1];
    const firstOut = -(first.x - (w * (first.k - 1)) / 2);
    const lastOut = last.x + (w * (last.k - 1)) / 2;
    const room = trayMax(list) - list.scrollLeft;
    const nudge = Math.max(0, firstOut - list.scrollLeft) - Math.max(0, lastOut - room);
    for (const { el, x, k } of fx) el.style.transform = `translateX(${(x + nudge).toFixed(1)}px) scale(${k.toFixed(3)})`;
  }
  // A mouse swells on hover; a finger is handled with the gestures above.
  trayEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const list = trayList();
    const r = list && list.getBoundingClientRect();
    traySwell(r && e.clientX >= r.left && e.clientX <= r.right ? e.clientX : null);
  });
  trayEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') traySwell(null);
  });
  trayEl.addEventListener('scroll', () => swellX !== null && traySwell(swellX), { capture: true, passive: true });

  // ---------- Keys ----------
  function onKey(e) {
    if (sheetIsOpen() || destroyed) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      redo();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && sel) {
      e.preventDefault();
      deleteSel();
    } else if (e.key === 'Escape') {
      deselect();
    } else if (!sel && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      turnPage(e.key === 'ArrowRight' ? 1 : -1);
    } else if (sel && e.key.startsWith('Arrow')) {
      // Arrows nudge the photo inside its frame; frames stay put.
      e.preventDefault();
      const f = selFrame();
      if (!f.photoId) return;
      const n = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0;
      const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      const ph = photos[f.photoId];
      const pl = placement(f, ph);
      f.crop = { ...f.crop, cx: pl.cx - dx / (pl.s * pl.rw), cy: pl.cy - dy / (pl.s * pl.rh) };
      f.crop = clampedCrop(f, ph);
      placeFrame(f);
      commitSoon();
    }
  }
  document.addEventListener('keydown', onKey, { signal: off.signal });

  // ---------- Start ----------
  const ro = new ResizeObserver(() => {
    if (destroyed) return;
    fitIfNeeded();
    renderStrip();
    renderTools();
  });
  ro.observe(ws);

  render();
  const zOne = fitZ('one');
  const zAll = fitZ('all');
  fitTo(zAll >= zOne * 0.6 ? 'all' : 'one', 0);
  render();
  if (!p.thumb) thumbSoon();

  // Testing aid only: lets a test drive the editor without a camera roll.
  window.__editor = { p, photos, importInto, render, commit, undo, redo, get z() { return z; }, get spread() { return spread; }, get flipping() { return flipping; }, setZoom, fitTo, select, openSwap, flipTo, showSlide };

  return function destroy() {
    destroyed = true;
    commitSoon.flush();
    saveSoon.flush();
    thumbSoon.cancel();
    ro.disconnect();
    stopInertia();
    off.abort();
    if (trayDrag.ghost) trayDrag.ghost.remove();
    delete document.body.dataset.route;
    // Give images a moment to leave the screen before letting their memory go.
    setTimeout(() => {
      Object.values(previewUrl).forEach((u) => URL.revokeObjectURL(u));
      Object.values(thumbUrl).forEach((u) => URL.revokeObjectURL(u));
    }, 1000);
    if (window.__editor && window.__editor.p === p) delete window.__editor;
  };
}
