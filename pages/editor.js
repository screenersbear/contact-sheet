// The editor: slides are the pages of a notebook, two to a spread, with one
// strip behind them and frames that can sit across the spine of a spread.
// Moving past a spread turns the page. Below are the photo tray and the tools.
//
// The strip is plain HTML: each frame is a box holding an <img> of the
// photo's editing copy, placed with the same maths the export uses
// (components/placement.js), so what you see is what exports. The area around the strip
// and everything drawn over the photos stays grey, white or black, so the
// colours of the photos are never thrown off by the app's own.
// Its parts are in the editor-*.js files beside this one.
import { slideH, pageWord } from '../data/formats.js';
import { defaultCrop } from '../data/templates.js';
import { clampedCrop } from '../components/placement.js';
import { keepInSpreads } from '../data/spreads.js';
import { getProject, saveProject, saveProjectThumb, photosForProject, deleteUnlistedPhotos } from '../data/db.js';
import { previewCanvas } from '../components/render.js';
import { toast } from '../components/toast.js';
import { ICONS } from '../components/icons.js';
import { esc, debounce, canvasToBlob, loadImage } from '../components/util.js';
import { OUT } from '../components/frame.js';
import { SAFE_KEY, SNAP_KEYS } from './editor-sizes.js';
import { addLayout } from './editor-layout.js';
import { addStrip } from './editor-strip.js';
import { addTools } from './editor-tools.js';
import { addFrameActions } from './editor-frames.js';
import { addPhotosInOut } from './editor-photos.js';
import { addSheets } from './editor-sheets.js';
import { addSlideLayouts } from './editor-slide-layouts.js';
import { addButtons } from './editor-buttons.js';
import { addGestures } from './editor-gestures.js';
import { addDragEnd } from './editor-drag-end.js';
import { addTrayDrag } from './editor-tray-drag.js';
import { addKeys } from './editor-keys.js';


export async function mountEditor(view, id) {
  const ed = { view }; // what this screen's parts share (see the files it adds)
  Object.assign(ed, { previewSources, commit, undo, redo, makeThumb });
  const loaded = await getProject(id);
  if (!loaded) {
    location.hash = '#/';
    return () => {};
  }
  const p = loaded; ed.p = p;
  const recs = await photosForProject(id);

  // ---------- Photos ----------
  const photos = {}; ed.photos = photos;
  const previewUrl = {};
  const thumbUrl = {};
  const previewImg = {};
  const videoUrl = {};
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

  const urlOf = (pid) => previewUrl[pid] || (previewUrl[pid] = URL.createObjectURL(photos[pid].preview)); ed.urlOf = urlOf;
  const thumbOf = (pid) => thumbUrl[pid] || (thumbUrl[pid] = URL.createObjectURL(photos[pid].thumb || photos[pid].preview)); ed.thumbOf = thumbOf;
  const videoSrc = (pid) => videoUrl[pid] || (videoUrl[pid] = URL.createObjectURL(photos[pid].original)); ed.videoSrc = videoSrc;
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
  ed.sel = null;
  ed.photoMode = false;
  ed.z = 0.3;
  ed.zoomFit = 'one';
  ed.showSafe = true;
  try {
    ed.showSafe = localStorage.getItem(SAFE_KEY) !== 'off';
  } catch {}
  ed.margX = 24;
  ed.margY = 32;
  ed.pageLeft = 24; // where the spread's left page starts
  ed.bookX = OUT; // where the notebook's left edge starts
  ed.spread = 0; // the two pages lying open
  ed.flipping = false;
  ed.touched = null; // the page last tapped, when both are in view
  ed.dropTarget = null;
  ed.destroyed = false;
  ed.gone = false; // deleted: nothing may save it again

  const H = () => slideH(p); ed.H = H;
  const frameById = (fid) => p.frames.find((f) => f.id === fid); ed.frameById = frameById;
  const selFrame = () => (ed.sel ? frameById(ed.sel) : null); ed.selFrame = selFrame;
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
  }; ed.apply = apply;
  holdSpreads();

  // ---------- History and saving ----------
  const snapshot = () => {
    const o = {};
    SNAP_KEYS.forEach((k) => (o[k] = p[k]));
    return JSON.stringify(o);
  };
  ed.hist = [snapshot()];
  ed.hi = 0;

  const saveSoon = debounce(() => ed.gone || saveProject(p).then((r) => (p.updatedAt = r.updatedAt)).catch(() => toast('Could not save. Is your storage full?')), 400); ed.saveSoon = saveSoon;
  const thumbSoon = debounce(makeThumb, 1500); ed.thumbSoon = thumbSoon;

  function commit() {
    const s = snapshot();
    if (s === ed.hist[ed.hi]) return;
    ed.hist = ed.hist.slice(0, ed.hi + 1);
    ed.hist.push(s);
    if (ed.hist.length > 150) ed.hist.shift();
    ed.hi = ed.hist.length - 1;
    saveSoon();
    thumbSoon();
    ed.renderTop();
  }
  const commitSoon = debounce(commit, 600); ed.commitSoon = commitSoon;

  function restore(s) {
    const o = JSON.parse(s);
    SNAP_KEYS.forEach((k) => (p[k] = o[k]));
    if (ed.sel && !frameById(ed.sel)) {
      ed.sel = null;
      ed.photoMode = false;
    }
    ed.fitIfNeeded();
    ed.render();
    saveSoon();
    thumbSoon();
  }
  function undo() {
    commitSoon.flush();
    if (ed.hi > 0) restore(ed.hist[--ed.hi]);
  }
  function redo() {
    if (ed.hi < ed.hist.length - 1) restore(ed.hist[++ed.hi]);
  }

  async function makeThumb() {
    try {
      const get = await previewSources();
      // The home page's strip: 2px of white between the slides, at its size.
      const c = previewCanvas(p, get, { height: 200, count: Math.min(3, p.slides), gap: 11 });
      const ctx = c.getContext('2d');
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      const blob = await canvasToBlob(c, 'image/jpeg', 0.8);
      c.width = c.height = 0;
      p.thumb = blob;
      await saveProjectThumb(p.id, blob);
    } catch {}
  }

  // ---------- DOM ----------
  view.innerHTML = `
    <div class="editor" data-editor>
      <p class="ed-line"><b>Layouts</b><span data-where></span></p>
      <div class="nb-open" data-nb></div>
      <div class="ws" data-ws>
        <div class="ws-inner" data-inner>
          <div class="ws-labels" data-labels></div>
          <div class="strip-shadow" data-shadow></div>
          <div class="strip" data-strip>
            <div class="strip-frames" data-frames></div>
            <div class="strip-bands" data-bands></div>
            <div class="strip-seams" data-seams></div>
            <div class="strip-safe" data-safe></div>
            <div class="strip-guides" data-guides></div>
          </div>
          <div class="sel" data-sel hidden>
            ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="handle h-${h}" data-h="${h}"></span>`).join('')}
            <button type="button" class="sel-x" data-act="take-out" aria-label="Take the photo out">${ICONS.x}</button>
          </div>
        </div>
      </div>
      <div class="ed-under" data-name>
        <button type="button" class="ed-name-btn" data-act="rename" aria-label="Rename this layout"><span>${esc(p.name)}</span></button>
        <span class="ed-dots" data-dots aria-hidden="true"></span>
        <button type="button" class="ed-add" data-act="add-slide">${ICONS.plus}Add a ${esc(pageWord(p))}</button>
      </div>
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
  const ws = $('[data-ws]'); ed.ws = ws;
  const inner = $('[data-inner]'); ed.inner = inner;
  const strip = $('[data-strip]'); ed.strip = strip;
  const framesEl = $('[data-frames]'); ed.framesEl = framesEl;
  const bandsEl = $('[data-bands]'); ed.bandsEl = bandsEl;
  const seamsEl = $('[data-seams]'); ed.seamsEl = seamsEl;
  const safeEl = $('[data-safe]'); ed.safeEl = safeEl;
  const guidesEl = $('[data-guides]'); ed.guidesEl = guidesEl;
  const labelsEl = $('[data-labels]'); ed.labelsEl = labelsEl;
  const editorEl = $('[data-editor]'); ed.editorEl = editorEl;
  const nbEl = $('[data-nb]'); ed.nbEl = nbEl;
  const selEl = $('[data-sel]'); ed.selEl = selEl;
  const adjustEl = $('[data-adjust]'); ed.adjustEl = adjustEl;
  const zoomInput = $('[data-zoom]'); ed.zoomInput = zoomInput;
  const addBtn = $('.ed-add'); ed.addBtn = addBtn;
  ed.whereEl = $('[data-where]');
  ed.dotsEl = $('[data-dots]');
  ed.shadowEl = $('[data-shadow]');
  const nameEl = $('[data-name]'); ed.nameEl = nameEl;
  const trayEl = $('[data-tray]'); ed.trayEl = trayEl;
  const toolsEl = $('[data-tools]'); ed.toolsEl = toolsEl;
  ws.addEventListener('scroll', () => {
    ed.placeBook();
    ed.placeWhere();
    if (ed.sel) ed.placeX();
  }, { passive: true });
  addLayout(ed);
  addStrip(ed);
  addTools(ed);
  addFrameActions(ed);
  addPhotosInOut(ed);
  addSheets(ed);
  addSlideLayouts(ed);
  addButtons(ed);
  addGestures(ed);
  addDragEnd(ed);
  addTrayDrag(ed);
  addKeys(ed);

  // ---------- Start ----------
  const ro = new ResizeObserver(() => {
    if (ed.destroyed) return;
    ed.fitIfNeeded();
    ed.renderStrip();
    ed.renderTools();
  });
  ro.observe(ws);

  ed.render();
  // Round 2 (04-editor): it opens on the first two slides side by side.
  ed.fitTo('all', 0);
  ed.render();
  if (!p.thumb) thumbSoon();

  // Testing aid only: lets a test drive the editor without a camera roll.
  window.__editor = { p, photos, importInto: ed.importInto, render: ed.render, commit, undo, redo, get z() { return ed.z; }, get spread() { return ed.spread; }, get flipping() { return ed.flipping; }, setZoom: ed.setZoom, fitTo: ed.fitTo, select: ed.select, openSwap: ed.openSwap, flipTo: ed.flipTo, showSlide: ed.showSlide };

  return function destroy() {
    ed.destroyed = true;
    if (!ed.gone) {
      commitSoon.flush();
      saveSoon.flush();
    }
    thumbSoon.cancel();
    ro.disconnect();
    ed.stopInertia();
    ed.off.abort();
    if (ed.trayDrag.ghost) ed.trayDrag.ghost.remove();
    ed.frameEls.forEach(ed.dropVideo);
    delete document.body.dataset.route;
    // Give images a moment to leave the screen before letting their memory go.
    setTimeout(() => {
      Object.values(previewUrl).forEach((u) => URL.revokeObjectURL(u));
      Object.values(thumbUrl).forEach((u) => URL.revokeObjectURL(u));
      Object.values(videoUrl).forEach((u) => URL.revokeObjectURL(u));
    }, 1000);
    if (window.__editor && window.__editor.p === p) delete window.__editor;
  };
}
