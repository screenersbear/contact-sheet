// Cropping a photo for a sticker: the sheet where fingers move and size it.
import { openSheet } from './sheet.js';
import { CORNER, clamp } from './sticker-sizes.js';

// One finger drags, two pinch; a wheel or trackpad zooms on a computer.
// onMove(dx, dy, k) gets the movement in pixels and the change in size.
export function followFingers(el, onMove) {
  const fingers = new Map();
  let last = null;
  const read = () => {
    const [a, b] = [...fingers.values()];
    return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) } : { x: a.x, y: a.y, d: 0 };
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    el.setPointerCapture(e.pointerId);
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = read();
  });
  el.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = read();
    onMove(now.x - last.x, now.y - last.y, now.d && last.d ? now.d / last.d : 1);
    last = now;
  });
  const lift = (e) => {
    fingers.delete(e.pointerId);
    last = fingers.size ? read() : null;
  };
  el.addEventListener('pointerup', lift);
  el.addEventListener('pointercancel', lift);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    onMove(0, 0, Math.exp(-e.deltaY * 0.002));
  }, { passive: false });
  // Stops an iPhone zooming the whole page instead.
  el.addEventListener('gesturestart', (e) => e.preventDefault());
}

// Choosing which part of the photo goes in the shape. Resolves with the part
// to use, in the photo's own pixels, or null if it was closed.
export function cropSheet(img, shape, ratio) {
  return new Promise((resolve) => {
    let answer = null;
    const s = openSheet({
      title: 'Crop',
      className: 'sheet-small',
      body: `
        <div class="crop-stage"><canvas></canvas><div class="crop-hole is-${shape}"></div></div>
        <p class="field-hint crop-hint">Drag to move. Pinch to zoom.</p>
        <button type="button" class="modal-cta primary" data-crop-ok>Next</button>`,
      onClose: () => resolve(answer),
    });
    const stage = s.body.querySelector('.crop-stage');
    const hole = s.body.querySelector('.crop-hole');
    const view = stage.querySelector('canvas');
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    // A smaller copy to drag around, so a big photo doesn't stutter.
    const fit = Math.min(1, 1600 / Math.max(nw, nh));
    const cw = (view.width = Math.round(nw * fit));
    const ch = (view.height = Math.round(nh * fit));
    const vctx = view.getContext('2d');
    vctx.imageSmoothingQuality = 'high';
    vctx.drawImage(img, 0, 0, cw, ch);

    const base = Math.min(stage.clientWidth - 48, window.innerHeight * 0.42);
    const hw = ratio >= 1 ? base : base * ratio;
    const hh = ratio >= 1 ? base / ratio : base;
    const sw = stage.clientWidth;
    const sh = base + 40;
    stage.style.height = `${sh}px`;
    hole.style.width = `${hw}px`;
    hole.style.height = `${hh}px`;
    if (shape !== 'circle') hole.style.borderRadius = cornersOf(ratio);
    const fill = Math.max(hw / cw, hh / ch);
    let zoom = 1;
    let cx = 0.5;
    let cy = 0.5;
    let halfW = 0;
    let halfH = 0;
    const show = () => {
      const k = fill * zoom;
      halfW = hw / (2 * cw * k);
      halfH = hh / (2 * ch * k);
      cx = clamp(cx, halfW, 1 - halfW);
      cy = clamp(cy, halfH, 1 - halfH);
      view.style.transform = `translate(${sw / 2 - cx * cw * k}px, ${sh / 2 - cy * ch * k}px) scale(${k})`;
    };
    show();
    followFingers(stage, (dx, dy, pinch) => {
      const k = fill * zoom;
      cx -= dx / (cw * k);
      cy -= dy / (ch * k);
      zoom = clamp(zoom * pinch, 1, 8);
      show();
    });
    s.body.querySelector('[data-crop-ok]').addEventListener('click', () => {
      answer = { x: (cx - halfW) * nw, y: (cy - halfH) * nh, w: 2 * halfW * nw, h: 2 * halfH * nh };
      view.width = view.height = 0;
      s.close();
    });
  });
}

export const cornersOf = (ratio) => (ratio >= 1 ? `${(CORNER * 100) / ratio}% / ${CORNER * 100}%` : `${CORNER * 100}% / ${CORNER * 100 * ratio}%`);
