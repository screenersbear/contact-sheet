// The editor: one horizontal strip of slides, frames that can sit anywhere
// on it (across seams too), the photo tray and the tools.
//
// The strip is plain HTML: each frame is a box holding an <img> of the
// photo's editing copy, placed with the same maths the export uses
// (model.js), so what you see is what exports. The area around the strip
// and everything drawn over the photos stays grey, white or black, so the
// colours of the photos are never thrown off by the app's own.
import {
  SLIDE_W, MAX_SLIDES, MIN_FRAME, RATIOS, RATIO_ORDER, LAYOUT_KEYS, SAFE_TOP, SAFE_BOTTOM,
  slideH, isStory, pageWord, newFrame, defaultCrop, placement, clampedCrop, cssTransform, rotatedCrop,
  anchorSlide, insertSlide, removeSlide, moveSlide, copySlideLayout, changeRatio, slideBox, borderBands,
  snapTargets, nearest, templateFromProject, SLIDE_LAYOUTS, layoutRects, applySlideLayout, layoutOfSlide,
  framesWithinSlide,
} from './model.js';
import {
  getProject, saveProject, saveProjectThumb, photosForProject, deleteUnlistedPhotos,
  listTemplates, saveTemplate, askToPersist,
} from './db.js';
import { importFiles, pickFiles } from './photos.js';
import { previewCanvas } from './render.js';
import { openExport } from './export.js';
import { openSheet, choiceSheet, promptSheet, toast, hideToast, sheetIsOpen } from './ui.js';
import { ICONS } from './icons.js';
import { esc, clamp, debounce, canvasToBlob, loadImage } from './util.js';

const SNAP_PX = 9;
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
  let dropTarget = null;
  let destroyed = false;

  const H = () => slideH(p);
  const frameById = (fid) => p.frames.find((f) => f.id === fid);
  const selFrame = () => (sel ? frameById(sel) : null);
  const apply = (next) => Object.assign(p, next);

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
      <header class="ed-top">
        <button type="button" class="ed-icon ed-back" data-act="back" aria-label="Back to drafts">${ICONS.back}</button>
        <button type="button" class="ed-title" data-act="rename" aria-label="Rename">
          <span class="ed-name" data-name></span><span class="ed-sub" data-sub></span>
        </button>
        <button type="button" class="ed-icon" data-act="undo" aria-label="Undo">${ICONS.undo}</button>
        <button type="button" class="ed-icon" data-act="redo" aria-label="Redo">${ICONS.redo}</button>
        <button type="button" class="ed-icon" data-act="more" aria-label="More">${ICONS.more}</button>
        <button type="button" class="btn primary ed-export" data-act="export">Export</button>
      </header>
      <div class="ws" data-ws>
        <div class="ws-inner" data-inner>
          <div class="ws-labels" data-labels></div>
          <div class="strip" data-strip>
            <div class="strip-frames" data-frames></div>
            <div class="strip-bands" data-bands></div>
            <div class="strip-seams" data-seams></div>
            <div class="strip-safe" data-safe></div>
            <div class="strip-guides" data-guides></div>
          </div>
          <div class="sel" data-sel hidden>
            ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="handle h-${h}" data-h="${h}"></span>`).join('')}
          </div>
          <button type="button" class="ws-add" data-act="add-slide" aria-label="Add a slide">${ICONS.plus}</button>
        </div>
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
  const ws = $('[data-ws]');
  const inner = $('[data-inner]');
  const strip = $('[data-strip]');
  const framesEl = $('[data-frames]');
  const bandsEl = $('[data-bands]');
  const seamsEl = $('[data-seams]');
  const safeEl = $('[data-safe]');
  const guidesEl = $('[data-guides]');
  const labelsEl = $('[data-labels]');
  const selEl = $('[data-sel]');
  const adjustEl = $('[data-adjust]');
  const zoomInput = $('[data-zoom]');
  const addBtn = $('.ws-add');
  const trayEl = $('[data-tray]');
  const toolsEl = $('[data-tools]');

  // ---------- Zoom and layout ----------
  function wsSize() {
    return { w: ws.clientWidth || 360, h: ws.clientHeight || 480 };
  }
  // Grey kept right of the last slide for the add-a-slide button.
  const addRoom = () => (p.slides < MAX_SLIDES ? 72 : 0);

  function fitZ(mode) {
    const { w, h } = wsSize();
    const across = mode === 'all' ? p.slides : 1;
    const room = mode === 'all' ? addRoom() : 0;
    return Math.max(0.02, Math.min((w - 48 - room) / (across * SLIDE_W), (h - 76) / H()));
  }
  const minZ = () => fitZ('all') * 0.85;
  const maxZ = () => fitZ('one') * 4;

  function layout() {
    const { w, h } = wsSize();
    const sw = SLIDE_W * z;
    const total = p.slides * sw;
    const sh = H() * z;
    const room = addRoom();
    margX = total + room <= w - 48 ? (w - total - room) / 2 : Math.max(24, (w - sw) / 2);
    margY = Math.max(34, (h - sh) / 2);
    inner.style.width = `${total + 2 * margX + room}px`;
    addBtn.hidden = !room;
    addBtn.style.left = `${margX + total + 16}px`;
    addBtn.style.top = `${margY + sh / 2 - 22}px`;
    inner.style.height = `${Math.max(h, sh + 2 * margY)}px`;
    strip.style.left = `${margX}px`;
    strip.style.top = `${margY}px`;
    strip.style.width = `${total}px`;
    strip.style.height = `${sh}px`;
    strip.style.background = p.background;
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

  function visibleSlide() {
    const { w } = wsSize();
    const k = Math.floor((ws.scrollLeft + w / 2 - margX) / (SLIDE_W * z));
    return clamp(k, 0, p.slides - 1);
  }

  function showSlide(k) {
    ws.scrollLeft = margX + (k + 0.5) * SLIDE_W * z - wsSize().w / 2;
  }

  function fitTo(mode, slide = visibleSlide()) {
    zoomFit = mode;
    z = fitZ(mode);
    renderStrip();
    if (mode === 'one') showSlide(slide);
    else ws.scrollLeft = 0;
    ws.scrollTop = Math.max(0, (inner.offsetHeight - wsSize().h) / 2);
    renderTools();
  }

  function fitIfNeeded() {
    if (zoomFit) {
      const k = visibleSlide();
      z = fitZ(zoomFit);
      renderStrip();
      if (zoomFit === 'one') showSlide(Math.min(k, p.slides - 1));
    } else {
      z = clamp(z, minZ(), maxZ());
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

  function renderSeams() {
    let html = '';
    for (let k = 1; k < p.slides; k++) html += `<div class="seam" style="left:${k * SLIDE_W * z}px"></div>`;
    seamsEl.innerHTML = html;
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
    const word = isStory(p) ? 'Story' : 'Slide';
    let html = '';
    for (let i = 0; i < p.slides; i++) {
      html += `<span class="ws-label" style="left:${margX + i * sw}px;top:${margY - 24}px;width:${sw}px">${sw >= 90 ? `${word} ${i + 1}` : i + 1}</span>`;
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
    selEl.classList.toggle('is-small', f.w * z < 70 || f.h * z < 70);
  }

  function showGuides(gx, gy) {
    let html = '';
    if (gx !== null && gx !== undefined) html += `<div class="guide v" style="left:${gx * z}px"></div>`;
    if (gy !== null && gy !== undefined) html += `<div class="guide h" style="top:${gy * z}px"></div>`;
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
    $('[data-name]').textContent = p.name;
    const n = p.slides;
    $('[data-sub]').textContent = `${p.ratio} · ${n} ${pageWord(p, n !== 1)}`;
    $('[data-act="undo"]').disabled = hi === 0;
    $('[data-act="redo"]').disabled = hi >= hist.length - 1;
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

  function renderTools() {
    const f = selFrame();
    if (f) {
      const has = !!f.photoId;
      toolsEl.innerHTML = [
        tool('adjust', ICONS.adjust, 'Adjust', { disabled: !has, on: photoMode }),
        tool('rotate', ICONS.rotate, 'Rotate', { disabled: !has }),
        tool('swap', has ? ICONS.swap : ICONS.photo, has ? 'Swap' : 'Photo'),
        tool('fit', ICONS.fit, 'Fit', { disabled: !has }),
        tool('copy', ICONS.copy, 'Copy'),
        tool('frame-more', ICONS.more, 'More'),
        tool('delete', ICONS.trash, 'Delete'),
      ].join('');
      return;
    }
    const all = p.slides > 1 && z > fitZ('all') * 1.05;
    toolsEl.innerHTML = [
      tool('add-frame', ICONS.addFrame, 'Frame'),
      tool('slides', ICONS.slides, isStory(p) ? 'Stories' : 'Slides'),
      tool('layout', ICONS.layout, 'Layout'),
      tool('format', ICONS.format, 'Format'),
      isStory(p) ? tool('safe', ICONS.safe, 'Safe zone', { on: showSafe }) : tool('grid', ICONS.grid, 'Grid'),
      p.slides > 1 ? tool('zoom', all ? ICONS.zoomOut : ICONS.zoomIn, all ? 'See all' : 'Zoom in') : tool('zoom', ICONS.zoomIn, 'Fit'),
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
    trayEl.innerHTML = `
      <button type="button" class="tray-add" data-act="add-photos">${ICONS.plus}<span>Photos</span></button>
      <div class="tray-list" data-tray-list>${items || '<p class="tray-hint">Add photos from your camera roll. They fill empty frames in order.</p>'}</div>`;
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

  function copySel() {
    const f = selFrame();
    if (!f) return;
    const c = { ...newFrame(f.x + 40, f.y + 40, f.w, f.h, f.photoId), crop: { ...f.crop } };
    p.frames.push(c);
    sel = c.id;
    photoMode = false;
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
  async function importInto(files, targetId = null) {
    askToPersist();
    const { photos: added, failed } = await importFiles(p.id, files, (i, n) =>
      toast(n === 1 ? 'Adding the photo' : `Adding photo ${i + 1} of ${n}`, { ms: 120000 })
    );
    hideToast();
    if (destroyed) return;
    added.forEach((r) => {
      photos[r.id] = r;
      if (!p.photoIds.includes(r.id)) p.photoIds.push(r.id);
    });
    if (failed.length) toast(`${failed.length === 1 ? 'One photo' : `${failed.length} photos`} could not be opened. JPEG and PNG work everywhere.`, { ms: 5000 });
    const queue = added.map((r) => r.id);
    const target = targetId && frameById(targetId);
    if (target && queue.length) putPhoto(target, queue.shift());
    else for (const f of emptyFrames()) if (queue.length) putPhoto(f, queue.shift());
    render();
    if (queue.length && p.slides < MAX_SLIDES) {
      const room = Math.min(queue.length, MAX_SLIDES - p.slides);
      const word = pageWord(p, room !== 1);
      const key = await choiceSheet({
        title: 'More photos than frames',
        message: `${queue.length === 1 ? 'One photo is' : `${queue.length} photos are`} in the tray without a frame.`,
        options: [
          { key: 'slides', label: `Add ${room} ${word}`, detail: `One photo on each new ${pageWord(p)}.` },
          { key: 'tray', label: 'Keep them in the tray', detail: 'Place them yourself later.' },
        ],
      });
      if (key === 'slides' && !destroyed) {
        for (let n = 0; n < room; n++) {
          apply(insertSlide(p, p.slides));
          const b = slideBox(p, p.slides - 1);
          p.frames.push(newFrame(b.x, b.y, b.w, b.h, queue.shift()));
        }
        fitIfNeeded();
        render();
      }
    }
    commit();
  }

  async function addPhotos() {
    const files = await pickFiles({ multiple: true });
    if (files.length) await importInto(files);
  }

  function openSwap(fid) {
    const f = frameById(fid);
    if (!f) return;
    const list = p.photoIds.filter((pid) => photos[pid]);
    const s = openSheet({
      title: f.photoId ? 'Swap photo' : 'Add a photo',
      body: `
        ${list.length ? `<div class="pick-grid">${list
          .map((pid) => `<button type="button" class="pick-photo${pid === f.photoId ? ' is-current' : ''}" data-pid="${pid}"><img src="${thumbOf(pid)}" alt="" /></button>`)
          .join('')}</div>` : '<p class="sheet-message">No photos in this draft yet.</p>'}
        <div class="button-stack">
          <button type="button" class="small-btn primary" data-new>+ From camera roll</button>
          ${f.photoId ? '<button type="button" class="small-btn secondary" data-empty>Empty this frame</button>' : ''}
        </div>`,
    });
    s.body.querySelectorAll('[data-pid]').forEach((b) =>
      b.addEventListener('click', () => {
        const fr = frameById(fid);
        if (fr) putPhoto(fr, b.dataset.pid);
        s.close();
        render();
        commit();
      })
    );
    s.body.querySelector('[data-new]').addEventListener('click', async () => {
      s.close();
      const files = await pickFiles({ multiple: false });
      if (files.length) await importInto(files, fid);
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
    if (!f) {
      toast('Tap a frame first, then tap a photo.');
      return;
    }
    putPhoto(f, pid);
    sel = f.id;
    render();
    commit();
  }

  // ---------- Sheets ----------
  async function openSlides() {
    const get = await previewSources();
    const word = isStory(p) ? 'Story' : 'Slide';
    const s = openSheet({ title: isStory(p) ? 'Stories' : 'Slides', className: 'has-footer' });
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
        if (zoomFit !== 'one' && z < fitZ('one') * 0.7) fitTo('one', Number(d.go));
        else showSlide(Number(d.go));
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
    return `<svg class="lay-svg" viewBox="0 0 ${SLIDE_W} ${Hh}" aria-hidden="true"><rect width="${SLIDE_W}" height="${Hh}" fill="${esc(q.background)}" class="lay-slide"/>${rects}<rect width="${SLIDE_W}" height="${Hh}" class="lay-edge"/></svg>`;
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
          <p class="field-hint">${p.padding ? 'The space around and between photos is your Slide border, set in Layout.' : 'Photos touch edge to edge. For space around and between them, set a Slide border in Layout.'}</p>`,
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
    if (zoomFit === 'all') fitTo('all');
    else fitIfNeeded();
    render();
    if (zoomFit !== 'all') showSlide(p.slides - 1);
    commit();
  }

  function openLayout() {
    const colorChips = (name, value, options) => `
      <div class="swatches" role="radiogroup">
        ${options.map(([v, label]) => `<label class="swatch"><input type="radio" name="${name}" value="${v}"${value.toLowerCase() === v ? ' checked' : ''} /><span><i style="background:${v}"></i>${label}</span></label>`).join('')}
        <label class="swatch swatch-custom"><input type="radio" name="${name}" value="custom"${options.some(([v]) => v === value.toLowerCase()) ? '' : ' checked'} /><span><input type="color" value="${esc(value)}" data-color="${name}" aria-label="Custom color" />Custom</span></label>
      </div>`;
    const s = openSheet({
      title: 'Layout',
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

  async function openFormat() {
    const key = await choiceSheet({
      title: 'Format',
      message: isStory(p) ? '' : 'Instagram uses one shape for every slide in a post, so this changes them all.',
      options: RATIO_ORDER.map((r) => ({ key: r, label: RATIOS[r].label, detail: `${RATIOS[r].size}. ${RATIOS[r].detail}`, current: r === p.ratio })),
    });
    if (!key || key === p.ratio) return;
    apply(changeRatio(p, key));
    p.frames.forEach((f) => f.photoId && photos[f.photoId] && (f.crop = clampedCrop(f, photos[f.photoId])));
    zoomFit = zoomFit || 'one';
    fitIfNeeded();
    render();
    commit();
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
    const key = await choiceSheet({
      title: 'Draft',
      options: [
        { key: 'rename', label: 'Rename', detail: 'Also names the exported files.' },
        { key: 'template', label: 'Save as template', detail: 'Keeps the layout, not the photos.' },
        ...(unused.length ? [{ key: 'clear', label: 'Remove unused photos', detail: `${unused.length} in the tray, not in a frame.` }] : []),
      ],
    });
    if (key === 'rename') rename();
    else if (key === 'template') saveAsTemplate();
    else if (key === 'clear') {
      p.photoIds = p.photoIds.filter((pid) => usedIds().has(pid));
      renderTray();
      commit();
      toast(unused.length === 1 ? 'Removed 1 photo' : `Removed ${unused.length} photos`, { action: { label: 'Undo', run: undo } });
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
    toast('Saved to your templates');
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
    location.hash = '#/';
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
      else if (a === 'rename') rename();
      else if (a === 'undo') undo();
      else if (a === 'redo') redo();
      else if (a === 'more') topMore();
      else if (a === 'export') {
        commitSoon.flush();
        saveSoon.flush();
        openExport(p, photos);
      } else if (a === 'add-frame') addFrame();
      else if (a === 'add-slide') addSlide();
      else if (a === 'slides') openSlides();
      else if (a === 'layout') openLayout();
      else if (a === 'format') openFormat();
      else if (a === 'grid') openGrid();
      else if (a === 'safe') toggleSafe();
      else if (a === 'zoom') fitTo(p.slides > 1 && z > fitZ('all') * 1.05 ? 'all' : 'one');
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
      else if (a === 'copy') copySel();
      else if (a === 'frame-more') frameMore();
      else if (a === 'delete') deleteSel();
      else if (a === 'add-photos') addPhotos();
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

  function stopInertia() {
    cancelAnimationFrame(inertia);
    inertia = 0;
  }

  function startPinch() {
    const [a, b] = [...pts.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const f = g && g.id && frameById(g.id);
    if (f && f.photoId && sel === f.id && (g.type === 'move' || g.type === 'photo' || g.type === 'resize')) {
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

  function moveFrame(f, dxu, dyu, noSnap) {
    let x = g.start.x + dxu;
    let y = g.start.y + dyu;
    const tol = SNAP_PX / z;
    const sx = noSnap ? null : nearest([x, x + f.w / 2, x + f.w], g.targets.xs, tol);
    const sy = noSnap ? null : nearest([y, y + f.h / 2, y + f.h], g.targets.ys, tol);
    if (sx) x += sx.d;
    if (sy) y += sy.d;
    f.x = Math.round(x);
    f.y = Math.round(y);
    showGuides(sx && sx.line, sy && sy.line);
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
    f.crop = clampedCrop(f, ph);
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // The add-a-slide button is an ordinary button: let its click through.
    if (e.target.closest('.ws-add')) return;
    try {
      ws.setPointerCapture(e.pointerId);
    } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopInertia();
    if (pts.size === 2) {
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
    // Only the selected frame moves. Dragging any other frame scrolls the
    // strip like the grey does, so looking around never knocks a photo out
    // of place; a tap selects it.
    if (f && sel === f.id) {
      if (photoMode && f.photoId) {
        const pl = placement(f, photos[f.photoId]);
        g = { ...base, type: 'photo', id: f.id, wasSel: true, crop0: { ...f.crop, cx: pl.cx, cy: pl.cy } };
        return;
      }
      g = { ...base, type: 'move', id: f.id, wasSel: true, start: { x: f.x, y: f.y, w: f.w, h: f.h }, targets: snapTargets(p, f.id, { safeZone: showSafe }) };
      return;
    }
    g = { ...base, type: 'pan', frameId: f ? f.id : null, sl: ws.scrollLeft, st: ws.scrollTop, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
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
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    // A finger has to travel a little further to move a photo than to
    // scroll, so a tap never nudges one.
    if (!g.moved && Math.hypot(dx, dy) < (g.mouse ? 3 : g.type === 'pan' ? 7 : 10)) return;
    g.moved = true;
    if (g.type === 'pan') {
      ws.scrollLeft = g.sl - dx;
      ws.scrollTop = g.st - dy;
      g.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (g.samples.length > 6) g.samples.shift();
      return;
    }
    const f = frameById(g.id);
    if (!f) return;
    if (g.type === 'move') moveFrame(f, dx / z, dy / z, e.altKey);
    else if (g.type === 'resize') resizeFrame(f, dx / z, dy / z, e.altKey);
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

  function onUp(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (!g) return;
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
        const s = was.samples;
        const a = s[0];
        const b = s[s.length - 1];
        const dt = b.t - a.t;
        if (e.type === 'pointerup' && !was.mouse && dt > 0 && performance.now() - b.t < 60) glide((b.x - a.x) / dt, (b.y - a.y) / dt);
      } else commit();
      return;
    }
    if (e.type !== 'pointerup') return;
    // A tap: on the grey it deselects, on a frame it selects that frame.
    if (was.type === 'resize') return;
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
      return { slide: clamp(Math.floor((x - sr.left) / (SLIDE_W * z)), 0, p.slides - 1) };
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

  trayEl.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.tray-item');
    if (!item || (e.pointerType === 'mouse' && e.button !== 0)) return;
    trayDrag.rec = { pid: item.dataset.pid, id: e.pointerId, x0: e.clientX, y0: e.clientY, item, dragging: false };
    trayDrag.suppressClick = false;
  });
  trayEl.addEventListener('pointermove', (e) => {
    const r = trayDrag.rec;
    if (!r || r.id !== e.pointerId) return;
    if (!r.dragging) {
      const up = r.y0 - e.clientY;
      if (up < 12 || up < Math.abs(e.clientX - r.x0)) return;
      r.dragging = true;
      try {
        r.item.setPointerCapture(e.pointerId);
      } catch {}
      const ghost = document.createElement('img');
      ghost.className = 'drag-ghost';
      ghost.src = thumbOf(r.pid);
      document.body.appendChild(ghost);
      trayDrag.ghost = ghost;
    }
    trayDrag.ghost.style.transform = `translate(${e.clientX - 32}px, ${e.clientY - 32}px)`;
    const d = dropAt(e.clientX, e.clientY);
    setDropTarget(d && d.frameId ? d.frameId : null);
  });
  const endTrayDrag = (e) => {
    const r = trayDrag.rec;
    if (!r || r.id !== e.pointerId) return;
    trayDrag.rec = null;
    if (!r.dragging) return;
    trayDrag.suppressClick = true;
    setTimeout(() => (trayDrag.suppressClick = false), 400);
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
    } else if (sel && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const f = selFrame();
      const n = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') f.x -= n;
      if (e.key === 'ArrowRight') f.x += n;
      if (e.key === 'ArrowUp') f.y -= n;
      if (e.key === 'ArrowDown') f.y += n;
      placeFrame(f);
      placeSel();
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
  fitTo(p.slides > 1 && zAll >= zOne * 0.6 ? 'all' : 'one', 0);
  render();
  if (!p.thumb) thumbSoon();

  // Testing aid only: lets a test drive the editor without a camera roll.
  window.__editor = { p, photos, importInto, render, commit, undo, redo, get z() { return z; }, setZoom, fitTo, select, openSwap };

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
