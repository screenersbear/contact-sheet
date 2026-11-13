// Photo placement: where a photo sits in its frame, zoomed, moved and turned,
// the same maths for the screen and the export.
import { clamp } from './util.js';

// ---------- Photo placement ----------

// How a photo sits in its frame. The photo always covers the frame (zoom 1
// is the smallest that does); cx, cy is the point of the turned photo that
// sits at the frame's centre, as fractions of its width and height.
// Returns s (frame units per photo pixel) and px, py (that point, in photo
// pixels from the photo's centre).
export function placement(frame, photo) {
  const rot = frame.crop.rot || 0;
  const turned = rot % 180 !== 0;
  const rw = turned ? photo.height : photo.width;
  const rh = turned ? photo.width : photo.height;
  const s = Math.max(frame.w / rw, frame.h / rh) * Math.max(1, frame.crop.zoom || 1);
  const hx = frame.w / (2 * s) / rw;
  const hy = frame.h / (2 * s) / rh;
  const cx = clamp(frame.crop.cx, hx, 1 - hx);
  const cy = clamp(frame.crop.cy, hy, 1 - hy);
  return { s, rw, rh, cx, cy, rot, px: (cx - 0.5) * rw, py: (cy - 0.5) * rh };
}

// The crop with its centre pulled back inside the photo.
export function clampedCrop(frame, photo) {
  const pl = placement(frame, photo);
  return { ...frame.crop, cx: pl.cx, cy: pl.cy };
}

// Draws a frame's photo on a 2D canvas whose units are export pixels.
// `src` is any image of the same shape as the photo (the original, or a
// smaller copy of it).
export function drawPhoto(ctx, frame, photo, src) {
  const pl = placement(frame, photo);
  ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
  ctx.scale(pl.s, pl.s);
  ctx.translate(-pl.px, -pl.py);
  ctx.rotate((pl.rot * Math.PI) / 180);
  ctx.drawImage(src, -photo.width / 2, -photo.height / 2, photo.width, photo.height);
}

// The same placement as a CSS transform, for an <img> of size sw x sh
// inside a frame drawn at z screen pixels per export pixel.
export function cssTransform(frame, photo, sw, z) {
  const pl = placement(frame, photo);
  const k = photo.width / sw;
  return (
    `translate(${(frame.w * z) / 2}px,${(frame.h * z) / 2}px) scale(${pl.s * z}) ` +
    `translate(${-pl.px}px,${-pl.py}px) rotate(${pl.rot}deg) ` +
    `translate(${-photo.width / 2}px,${-photo.height / 2}px) scale(${k})`
  );
}

// Turning the photo a quarter clockwise keeps the same part of it centred.
export function rotatedCrop(crop) {
  return { ...crop, rot: ((crop.rot || 0) + 90) % 360, cx: 1 - crop.cy, cy: crop.cx };
}
