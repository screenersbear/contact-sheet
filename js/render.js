// Drawing slides. One function draws a slide for every use: the export (at
// full size, from the original photos), and the small previews around the
// app (from the editing copies). Each slide is drawn on its own, showing
// only the parts of frames that fall inside it; the whole carousel is never
// drawn as one canvas, which iOS Safari would refuse past a certain size.
import { SLIDE_W, slideH, drawPhoto, borderBands } from './model.js';

// getSrc(photoId) returns { photo, src } or null. emptyFill, for previews
// only, shows empty frames in that colour; exports leave them as background.
export function drawSlide(ctx, p, i, getSrc, { scale = 1, dx = 0, dy = 0, emptyFill = null, smooth = 'high' } = {}) {
  const W = SLIDE_W;
  const H = slideH(p);
  const a = i * W;
  const b = a + W;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, dx, dy);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = smooth;
  ctx.translate(-a, 0);
  const bw = p.borderWidth || 0;
  for (const f of p.frames) {
    if (f.x >= b || f.x + f.w <= a || f.y >= H || f.y + f.h <= 0) continue;
    const got = f.photoId ? getSrc(f.photoId) : null;
    if (!got) {
      if (emptyFill) {
        ctx.fillStyle = emptyFill;
        ctx.fillRect(f.x, f.y, f.w, f.h);
      }
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    ctx.save();
    drawPhoto(ctx, f, got.photo, got.src);
    ctx.restore();
    if (bw > 0) {
      ctx.fillStyle = p.borderColor;
      const t = Math.min(bw, f.w / 2, f.h / 2);
      ctx.fillRect(f.x, f.y, f.w, t);
      ctx.fillRect(f.x, f.y + f.h - t, f.w, t);
      ctx.fillRect(f.x, f.y, t, f.h);
      ctx.fillRect(f.x + f.w - t, f.y, t, f.h);
    }
    ctx.restore();
  }
  ctx.fillStyle = p.background;
  for (const band of borderBands(p, i)) ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.restore();
}

// The grey the editor shows empty frames in.
const EMPTY = '#cdcdcd';

// Slides side by side, `height` pixels tall, for previews.
export function previewCanvas(p, getSrc, { height = 200, from = 0, count = p.slides, gap = 0, empty = EMPTY } = {}) {
  const H = slideH(p);
  const scale = height / H;
  const sw = Math.round(SLIDE_W * scale);
  const c = document.createElement('canvas');
  const n = Math.max(1, Math.min(count, p.slides - from));
  c.width = sw * n + gap * (n - 1);
  c.height = Math.round(height);
  const ctx = c.getContext('2d', { colorSpace: 'srgb' });
  for (let k = 0; k < n; k++) drawSlide(ctx, p, from + k, getSrc, { scale, dx: k * (sw + gap), emptyFill: empty });
  return c;
}
