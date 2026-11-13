// Every slide drawn on its own at full size, from the original photos, for
// the export and the PDFs.
import { SLIDE_W, RATIOS, slideH } from './formats.js';
import { framesOnSlide } from './slides.js';
import { placement } from '../components/placement.js';
import { drawSlide } from '../components/render.js';
import { downscale } from './photos.js';
import { slug, loadImage, canvasToBlob, nextFrame } from '../components/util.js';

// The original, shrunk only if it is more than twice the size the slide
// needs (big downscales in one step look gritty).
export async function openSource(photo, scale) {
  // A video is printed and thumbnailed from its still.
  const url = URL.createObjectURL(photo.kind === 'video' ? photo.preview : photo.original || photo.preview);
  try {
    const img = await loadImage(url);
    const tw = Math.ceil(photo.width * scale);
    const th = Math.ceil(photo.height * scale);
    if (img.naturalWidth / 2 >= tw && img.naturalHeight / 2 >= th) {
      const c = downscale(img, img.naturalWidth, img.naturalHeight, tw, th);
      img.src = '';
      return { photo, src: c, release: () => (c.width = c.height = 0) };
    }
    return { photo, src: img, release: () => (img.src = '') };
  } finally {
    // Loaded images keep their data; drawing doesn't need the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

// Sizes meant for printing come out with more pixels than the layout uses.
export const exportScale = (p) => RATIOS[p.ratio].scale || 1;

// `scale` overrides the size; `only` is which slides to make, in that order.
export async function renderSlides(p, photos, type, onProgress, { thumbs = true, scale = exportScale(p), only = null } = {}) {
  const k = scale;
  const list = only || Array.from({ length: p.slides }, (_, i) => i);
  const W = Math.round(SLIDE_W * k);
  const H = Math.round(slideH(p) * k);
  const mime = type === 'png' ? 'image/png' : 'image/jpeg';
  const ext = type === 'png' ? 'png' : 'jpg';
  const base = slug(p.name);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  const needs = list.map((i) => new Set(framesOnSlide(p, i).filter((f) => f.photoId && photos[f.photoId]).map((f) => f.photoId)));
  // The biggest size each photo is drawn at, over all its frames.
  const scaleOf = {};
  for (const f of p.frames) {
    if (!f.photoId || !photos[f.photoId]) continue;
    scaleOf[f.photoId] = Math.max(scaleOf[f.photoId] || 0, placement(f, photos[f.photoId]).s);
  }
  const open = new Map();
  const out = [];
  try {
    for (let n = 0; n < list.length; n++) {
      const i = list[n];
      if (onProgress) onProgress(n, list.length);
      await nextFrame();
      for (const id of needs[n]) {
        if (!open.has(id)) open.set(id, await openSource(photos[id], scaleOf[id] * k));
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Filled, not cleared: an edge row a scale only part covers would go black.
      ctx.fillStyle = p.background;
      ctx.fillRect(0, 0, W, H);
      drawSlide(ctx, p, i, (id) => open.get(id) || null, { scale: k });
      const blob = await canvasToBlob(canvas, mime, type === 'png' ? undefined : 0.95);
      // A small copy for the "post in this order" list.
      let thumb = null;
      if (thumbs) {
        const t = document.createElement('canvas');
        t.height = 240;
        t.width = Math.round((240 * W) / H);
        t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
        thumb = await canvasToBlob(t, 'image/jpeg', 0.8);
        t.width = t.height = 0;
      }
      out.push({ name: `${base}-${String(i + 1).padStart(2, '0')}.${ext}`, blob, thumb, mime, width: W, height: H });
      const next = needs[n + 1] || new Set();
      for (const [id, s] of open) {
        if (!next.has(id)) {
          s.release();
          open.delete(id);
        }
      }
    }
  } finally {
    open.forEach((s) => s.release());
    canvas.width = canvas.height = 0;
  }
  return out;
}
