// When a drag on the strip ends: snap to a page, turn the page, or coast;
// and a trackpad pinch zooms.
import { SLIDE_W } from '../data/formats.js';
import { clampedCrop } from '../components/placement.js';
import { spreadOf, spreadCount } from '../data/spreads.js';
import { clamp } from '../components/util.js';

export function addDragEnd(ed) {
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
    ed.inner.style.transition = 'transform .22s ease-out';
    ed.inner.style.transform = '';
    if (over) {
      const given = `translateX(${ed.bookX - ed.ws.scrollLeft - over * 0.4}px)`;
      ed.placeBook();
      ed.nbEl.animate([{ transform: given }, { transform: ed.nbEl.style.transform }], { duration: 220, easing: 'ease-out' });
    }
    if (ed.zoomFit === 'one') {
      const first = ed.firstPage();
      const last = ed.lastPage();
      const from = Math.abs(was.sl - ed.pageX(first)) <= Math.abs(was.sl - ed.pageX(last)) ? first : last;
      const turned = Math.abs(dragged) > SLIDE_W * ed.z * 0.28 || flick;
      const k = from + (turned ? (dragged < 0 ? 1 : -1) : 0);
      if (k < 0 || k >= ed.p.slides) ed.scrollToX(ed.pageX(from));
      else if (spreadOf(k) !== ed.spread) ed.flipTo(spreadOf(k), k);
      else ed.scrollToX(ed.pageX(k));
      return;
    }
    const maxS = Math.max(0, ed.inner.offsetWidth - ed.wsSize().w);
    const next = over > 60 || (flick && vx < 0 && ed.ws.scrollLeft >= maxS - 2);
    const prev = over < -60 || (flick && vx > 0 && ed.ws.scrollLeft <= 2);
    if (next && ed.spread < spreadCount(ed.p) - 1) ed.flipTo(ed.spread + 1);
    else if (prev && ed.spread > 0) ed.flipTo(ed.spread - 1, ed.spread * 2 - 1);
    else if (fresh && !was.mouse) ed.glide(vx, vy);
  }

  function onUp(e) {
    if (!ed.pts.has(e.pointerId)) return;
    ed.pts.delete(e.pointerId);
    ed.stopHold();
    if (!ed.g) return;
    if (ed.g.type === 'lift') {
      if (e.pointerId !== ed.g.pid) return;
      const was = ed.g;
      ed.g = null;
      ed.endLift(was, e);
      return;
    }
    if (ed.g.type === 'zpinch' || ed.g.type === 'ppinch') {
      if (ed.g.type === 'ppinch') ed.commit();
      else ed.renderTools();
      // The finger left behind starts nothing until it lifts too.
      ed.g = ed.pts.size ? { type: 'idle' } : null;
      return;
    }
    if (ed.g.type === 'idle') {
      if (!ed.pts.size) ed.g = null;
      return;
    }
    if (e.pointerId !== ed.g.pid) return;
    ed.showGuides(null, null);
    const was = ed.g;
    ed.g = null;
    if (was.moved) {
      if (was.type === 'pan') {
        settlePan(was, e);
      } else ed.commit();
      return;
    }
    if (e.type !== 'pointerup') return;
    // A tap: on the grey it deselects, on a frame it selects that frame.
    if (was.type === 'resize') return;
    const hit = ed.toUnits(e.clientX, e.clientY);
    ed.touched = clamp(Math.floor(hit.x / SLIDE_W), ed.firstPage(), ed.lastPage());
    const id = was.type === 'pan' ? was.frameId : was.id;
    if (!id) {
      ed.deselect();
      return;
    }
    const now = performance.now();
    const double = ed.lastTap.id === id && now - ed.lastTap.t < 380;
    ed.lastTap = double ? { id: null, t: 0 } : { id, t: now };
    const f = ed.frameById(id);
    if (!f) return;
    if (!was.wasSel) ed.select(id);
    if (double || (was.wasSel && !f.photoId)) ed.openSwap(f.id);
  }

  ed.ws.addEventListener('contextmenu', (e) => e.preventDefault());
  ed.ws.addEventListener('pointerdown', ed.onDown);
  ed.ws.addEventListener('pointermove', ed.onMove);
  ed.ws.addEventListener('pointerup', onUp);
  ed.ws.addEventListener('pointercancel', onUp);
  ed.ws.addEventListener('lostpointercapture', (e) => {
    if (ed.pts.has(e.pointerId)) onUp(e);
  });

  // Trackpad pinch (and ctrl + wheel) zooms. Over the photo being adjusted
  // it zooms the photo instead.
  ed.ws.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const f = ed.selFrame();
      const over = e.target.closest('.fr');
      if (ed.photoMode && f && f.photoId && over && over.dataset.id === f.id) {
        f.crop = { ...f.crop, zoom: clamp((f.crop.zoom || 1) * Math.exp(-e.deltaY * 0.01), 1, 8) };
        f.crop = clampedCrop(f, ed.photos[f.photoId]);
        ed.placeFrame(f);
        ed.zoomInput.value = String(f.crop.zoom);
        ed.commitSoon();
        return;
      }
      ed.setZoom(ed.z * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    },
    { passive: false }
  );
}
