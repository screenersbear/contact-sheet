// Fingers on the strip: tap, pan, pinch, and holding a photo to drag it
// onto another frame (they swap).
import { SLIDE_W, MIN_FRAME } from '../data/formats.js';
import { defaultCrop } from '../data/templates.js';
import { placement, clampedCrop } from '../components/placement.js';
import { snapTargets, nearest } from '../components/snapping.js';
import { clamp } from '../components/util.js';
import { SNAP_PX } from './editor-sizes.js';

export function addGestures(ed) {
  Object.assign(ed, { stopHold, endLift, stopInertia, onDown, onMove, glide });
  // ---------- Gestures on the strip ----------
  const pts = new Map(); ed.pts = pts;
  ed.g = null;
  ed.lastTap = { id: null, t: 0 };
  ed.inertia = 0;
  let holdTimer = 0;
  const HOLD_MS = 420;
  // ---------- Hold a photo, drag it onto another frame: they swap ----------
  function stopHold() {
    clearTimeout(holdTimer);
    holdTimer = 0;
  }

  function startLift() {
    holdTimer = 0;
    if (!ed.g || ed.g.moved || pts.size !== 1 || (ed.g.type !== 'pan' && ed.g.type !== 'photo')) return;
    const id = ed.g.type === 'pan' ? ed.g.frameId : ed.g.id;
    const f = id && ed.frameById(id);
    if (!f || !f.photoId) return;
    stopInertia();
    const ghost = document.createElement('img');
    ghost.className = 'drag-ghost is-lift';
    ghost.src = ed.thumbOf(f.photoId);
    document.body.appendChild(ghost);
    const el = ed.framesEl.querySelector(`.fr[data-id="${f.id}"]`);
    if (el) el.classList.add('is-lifted');
    ed.g = { type: 'lift', pid: ed.g.pid, id: f.id, ghost, el, moved: true };
    const pt = pts.get(ed.g.pid);
    if (pt) moveLift(pt.x, pt.y);
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
  }

  function moveLift(x, y) {
    ed.g.ghost.style.transform = `translate(${x - 44}px, ${y - 44}px)`;
    const d = ed.dropAt(x, y);
    ed.setDropTarget(d && d.frameId && d.frameId !== ed.g.id ? d.frameId : null);
  }

  function endLift(was, e) {
    was.ghost.remove();
    if (was.el) was.el.classList.remove('is-lifted');
    const to = ed.dropTarget;
    ed.setDropTarget(null);
    if (e.type !== 'pointerup' || !to) return;
    const a = ed.frameById(was.id);
    const b = ed.frameById(to);
    if (!a || !b) return;
    // Each photo keeps its turn; zoom and position start fresh in the new shape.
    const [pa, ra, pb, rb] = [a.photoId, a.crop.rot || 0, b.photoId, b.crop.rot || 0];
    a.photoId = pb;
    a.crop = { ...defaultCrop(), rot: pb ? rb : 0 };
    b.photoId = pa;
    b.crop = { ...defaultCrop(), rot: ra };
    ed.sel = b.id;
    ed.photoMode = false;
    ed.render();
    ed.commit();
  }

  function stopInertia() {
    cancelAnimationFrame(ed.inertia);
    ed.inertia = 0;
  }

  function startPinch() {
    const [a, b] = [...pts.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const f = ed.g && ed.g.id && ed.frameById(ed.g.id);
    if (f && f.photoId && ed.sel === f.id && (ed.g.type === 'photo' || ed.g.type === 'resize')) {
      if (ed.g.start) Object.assign(f, ed.g.start);
      ed.placeFrame(f);
      ed.placeSel();
      ed.showGuides(null, null);
      const pl = placement(f, ed.photos[f.photoId]);
      ed.g = { type: 'ppinch', id: f.id, d0, zoom0: f.crop.zoom || 1, crop0: { ...f.crop, cx: pl.cx, cy: pl.cy }, mid0: mid };
    } else {
      ed.showGuides(null, null);
      ed.g = { type: 'zpinch', d0, z0: ed.z, u: ed.toUnits(mid.x, mid.y) };
    }
  }

  function pinchMove() {
    const [a, b] = [...pts.values()];
    if (!a || !b) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    if (ed.g.type === 'zpinch') {
      const r = ed.ws.getBoundingClientRect();
      ed.z = clamp(ed.g.z0 * (d / ed.g.d0), ed.minZ(), ed.maxZ());
      ed.zoomFit = null;
      ed.renderStrip();
      ed.ws.scrollLeft = ed.margX + ed.g.u.x * ed.z - (mid.x - r.left);
      ed.ws.scrollTop = ed.margY + ed.g.u.y * ed.z - (mid.y - r.top);
      return;
    }
    const f = ed.frameById(ed.g.id);
    if (!f) return;
    const ph = ed.photos[f.photoId];
    // Keep the point of the photo under the fingers where it was.
    const r = ed.strip.getBoundingClientRect();
    const fc = { x: r.left + (f.x + f.w / 2) * ed.z, y: r.top + (f.y + f.h / 2) * ed.z };
    const pl0 = placement({ ...f, crop: ed.g.crop0 }, ph);
    const q = { x: pl0.px + (ed.g.mid0.x - fc.x) / ed.z / pl0.s, y: pl0.py + (ed.g.mid0.y - fc.y) / ed.z / pl0.s };
    const zoom = clamp(ed.g.zoom0 * (d / ed.g.d0), 1, 8);
    const pl1 = placement({ ...f, crop: { ...ed.g.crop0, zoom } }, ph);
    const px = q.x - (mid.x - fc.x) / ed.z / pl1.s;
    const py = q.y - (mid.y - fc.y) / ed.z / pl1.s;
    f.crop = { ...ed.g.crop0, zoom, cx: px / pl1.rw + 0.5, cy: py / pl1.rh + 0.5 };
    f.crop = clampedCrop(f, ph);
    ed.placeFrame(f);
    if (ed.photoMode) ed.zoomInput.value = String(zoom);
  }

  function resizeFrame(f, dxu, dyu, noSnap) {
    const s = ed.g.start;
    const h = ed.g.h;
    const tol = SNAP_PX / ed.z;
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
    if (h.includes('w')) [l, gx] = snap(s.x + dxu, ed.g.targets.xs);
    if (h.includes('e')) [r, gx] = snap(s.x + s.w + dxu, ed.g.targets.xs);
    // The edges of the open spread are as far as a frame can go.
    const lo = ed.spread * 2 * SLIDE_W;
    const hi2 = lo + 2 * SLIDE_W;
    if (l < lo) [l, gx] = [lo, null];
    if (r > hi2) [r, gx] = [hi2, null];
    if (h.includes('n')) [t, gy] = snap(s.y + dyu, ed.g.targets.ys);
    if (h.includes('s')) [b, gy] = snap(s.y + s.h + dyu, ed.g.targets.ys);
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
    ed.showGuides(gx, gy);
  }

  function panPhoto(f, dxu, dyu) {
    const ph = ed.photos[f.photoId];
    const pl = placement({ ...f, crop: ed.g.crop0 }, ph);
    f.crop = { ...ed.g.crop0, cx: pl.cx - dxu / (pl.s * pl.rw), cy: pl.cy - dyu / (pl.s * pl.rh) };
    // Close to the frame's middle, the photo's centre catches on that axis
    // and a line shows it. An axis the photo can't move along has no catch.
    const wide = pl.s * pl.rw;
    const tall = pl.s * pl.rh;
    const onX = wide > f.w + 0.5 && Math.abs(f.crop.cx - 0.5) * wide * ed.z < SNAP_PX;
    const onY = tall > f.h + 0.5 && Math.abs(f.crop.cy - 0.5) * tall * ed.z < SNAP_PX;
    if (onX) f.crop.cx = 0.5;
    if (onY) f.crop.cy = 0.5;
    f.crop = clampedCrop(f, ph);
    ed.showFrameGuides(f, onX, onY);
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Buttons on the canvas (the photo's x, a slide's delete) take their own taps.
    if (e.target.closest('button') || ed.flipping) return;
    try {
      ed.ws.setPointerCapture(e.pointerId);
    } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopInertia();
    ed.inner.style.transition = 'none';
    ed.inner.style.transform = '';
    if (pts.size === 2) {
      stopHold();
      ed.showGuides(null, null);
      if (ed.g && ed.g.type === 'lift') return;
      startPinch();
      return;
    }
    if (pts.size > 2) return;
    const base = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, mouse: e.pointerType === 'mouse' };
    const handle = e.target.closest('[data-h]');
    const frEl = e.target.closest('.fr');
    const f = handle ? ed.selFrame() : frEl && ed.frameById(frEl.dataset.id);
    if (handle && f) {
      ed.g = { ...base, type: 'resize', id: f.id, h: handle.dataset.h, start: { x: f.x, y: f.y, w: f.w, h: f.h }, targets: snapTargets(ed.p, f.id, { safeZone: ed.showSafe }) };
      return;
    }
    // Frames stay where the layout put them. Dragging the selected frame
    // moves its photo inside it; dragging anything else scrolls the strip,
    // so looking around never knocks a photo out of place. A tap selects.
    // Holding still on any photo lifts it, to drop on another frame.
    stopHold();
    if (f && f.photoId) holdTimer = setTimeout(startLift, HOLD_MS);
    if (f && ed.sel === f.id && f.photoId) {
      const pl = placement(f, ed.photos[f.photoId]);
      ed.g = { ...base, type: 'photo', id: f.id, wasSel: true, crop0: { ...f.crop, cx: pl.cx, cy: pl.cy } };
      return;
    }
    ed.g = { ...base, type: 'pan', frameId: f ? f.id : null, wasSel: !!f && ed.sel === f.id, sl: ed.ws.scrollLeft, st: ed.ws.scrollTop, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
  }

  function onMove(e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!ed.g) return;
    if (ed.g.type === 'zpinch' || ed.g.type === 'ppinch') {
      pinchMove();
      return;
    }
    if (e.pointerId !== ed.g.pid) return;
    if (ed.g.type === 'lift') {
      moveLift(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - ed.g.x0;
    const dy = e.clientY - ed.g.y0;
    // A finger has to travel a little further to move a photo than to
    // scroll, so a tap never nudges one.
    if (!ed.g.moved && Math.hypot(dx, dy) < (ed.g.mouse ? 3 : ed.g.type === 'pan' ? 7 : 10)) return;
    ed.g.moved = true;
    stopHold();
    if (ed.g.type === 'pan') {
      const want = ed.g.sl - dx;
      const maxS = Math.max(0, ed.inner.offsetWidth - ed.wsSize().w);
      ed.ws.scrollLeft = want;
      ed.ws.scrollTop = ed.g.st - dy;
      // Past the end of the spread the page gives a little, then turns on release.
      ed.g.over = want < 0 ? want : want > maxS ? want - maxS : 0;
      ed.inner.style.transform = ed.g.over ? `translateX(${-ed.g.over * 0.4}px)` : '';
      ed.placeBook(ed.g.over * 0.4);
      ed.g.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (ed.g.samples.length > 6) ed.g.samples.shift();
      return;
    }
    const f = ed.frameById(ed.g.id);
    if (!f) return;
    if (ed.g.type === 'resize') resizeFrame(f, dx / ed.z, dy / ed.z, e.altKey);
    else if (ed.g.type === 'photo') panPhoto(f, dx / ed.z, dy / ed.z);
    ed.placeFrame(f);
    ed.placeSel();
  }

  function glide(vx, vy) {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      ed.ws.scrollLeft -= vx * dt;
      ed.ws.scrollTop -= vy * dt;
      const k = Math.pow(0.994, dt);
      vx *= k;
      vy *= k;
      if (Math.abs(vx) + Math.abs(vy) > 0.02) ed.inertia = requestAnimationFrame(step);
      else ed.inertia = 0;
    };
    ed.inertia = requestAnimationFrame(step);
  }
}
