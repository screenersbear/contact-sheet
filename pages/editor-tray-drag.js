// Dragging photos up from the tray onto a frame, and the tray's swell
// under the finger (like the Dock on a Mac).
import { SLIDE_W } from '../data/formats.js';
import { newFrame } from '../data/templates.js';
import { slideBox } from '../data/slide-layouts.js';
import { clamp } from '../components/util.js';

export function addTrayDrag(ed) {
  Object.assign(ed, { dropAt, setDropTarget });
  // ---------- Dragging photos from the tray ----------
  const trayDrag = { rec: null, ghost: null, suppressClick: false }; ed.trayDrag = trayDrag;

  function dropAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const fr = hit && hit.closest('.fr');
    if (fr && ed.view.contains(fr)) return { frameId: fr.dataset.id };
    const sr = ed.strip.getBoundingClientRect();
    if (x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom) {
      return { slide: clamp(Math.floor((x - sr.left) / (SLIDE_W * ed.z)), ed.firstPage(), ed.lastPage()) };
    }
    return null;
  }

  function setDropTarget(fid) {
    if (ed.dropTarget === fid) return;
    const prev = ed.dropTarget && ed.frameById(ed.dropTarget);
    ed.dropTarget = fid;
    if (prev) ed.placeFrame(prev);
    const next = fid && ed.frameById(fid);
    if (next) ed.placeFrame(next);
  }

  // The app moves the tray itself, as it does the canvas: a finger going
  // sideways scrolls the row (with a flick), a finger going up lifts a photo
  // out to drop on a frame, and a tap places it.
  const trayList = () => ed.trayEl.querySelector('[data-tray-list]');
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

  ed.trayEl.addEventListener('pointerdown', (e) => {
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
  ed.trayEl.addEventListener('pointermove', (e) => {
    const r = trayDrag.rec;
    if (!r || r.id !== e.pointerId) return;
    const dx = e.clientX - r.x0;
    if (!r.mode) {
      const up = r.y0 - e.clientY;
      if (r.item && up >= 12 && up >= Math.abs(dx)) r.mode = 'drag';
      else if (Math.abs(dx) >= 6 && Math.abs(dx) >= Math.abs(e.clientY - r.y0)) r.mode = 'scroll';
      else return;
      try {
        ed.trayEl.setPointerCapture(e.pointerId);
      } catch {}
      if (r.mode === 'drag') {
        traySwell(null);
        const ghost = document.createElement('img');
        ghost.className = 'drag-ghost';
        ghost.src = ed.thumbOf(r.pid);
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
      const f = ed.frameById(d.frameId);
      if (f) {
        ed.putPhoto(f, r.pid);
        ed.sel = f.id;
      }
    } else {
      const b = slideBox(ed.p, d.slide);
      const f = newFrame(b.x, b.y, b.w, b.h, r.pid);
      ed.p.frames.push(f);
      ed.sel = f.id;
    }
    ed.photoMode = false;
    ed.render();
    ed.commit();
  };
  ed.trayEl.addEventListener('pointerup', endTrayDrag);
  ed.trayEl.addEventListener('pointercancel', endTrayDrag);

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
    const list = ed.trayEl.querySelector('[data-tray-list]');
    const items = list ? [...list.querySelectorAll('.tray-item')] : [];
    const on = swellX !== null && !(trayDrag.rec && trayDrag.rec.mode === 'drag') && items.length > 0;
    ed.trayEl.classList.toggle('is-swell', on);
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
  ed.trayEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const list = trayList();
    const r = list && list.getBoundingClientRect();
    traySwell(r && e.clientX >= r.left && e.clientX <= r.right ? e.clientX : null);
  });
  ed.trayEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') traySwell(null);
  });
  ed.trayEl.addEventListener('scroll', () => swellX !== null && traySwell(swellX), { capture: true, passive: true });
}
