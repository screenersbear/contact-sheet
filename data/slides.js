// Slides: adding, removing, moving and copying the slides of a chapter.
import { clamp } from '../components/util.js';
import { SLIDE_W, MIN_FRAME, RATIOS, slideH } from './formats.js';
import { newFrame } from './templates.js';

// ---------- Slides ----------

// The slide a frame belongs to: the one its left edge is on.
export function anchorSlide(f, slides) {
  return clamp(Math.floor((f.x + 0.5) / SLIDE_W), 0, slides - 1);
}

// The frames that touch slide i.
export function framesOnSlide(p, i) {
  const a = i * SLIDE_W;
  const b = a + SLIDE_W;
  const H = slideH(p);
  return p.frames.filter((f) => f.x < b && f.x + f.w > a && f.y < H && f.y + f.h > 0);
}

// A new slide at index k. Frames on later slides move along with their
// slides; a frame crossing that seam stays put and now runs onto the new one.
export function insertSlide(p, k) {
  const at = k * SLIDE_W;
  return {
    ...p,
    slides: p.slides + 1,
    frames: p.frames.map((f) => (f.x >= at - 0.5 ? { ...f, x: f.x + SLIDE_W } : f)),
  };
}

// Removes slide k. Frames wholly on it go; frames after it move back one
// slide; a frame crossing onto it loses just the part that was on it.
export function removeSlide(p, k) {
  const a = k * SLIDE_W;
  const b = a + SLIDE_W;
  const frames = [];
  for (const f of p.frames) {
    const l = f.x;
    const r = f.x + f.w;
    const overlap = Math.max(0, Math.min(r, b) - Math.max(l, a));
    if (overlap >= f.w - 0.5) continue;
    if (l >= b - 0.5) frames.push({ ...f, x: f.x - SLIDE_W });
    else if (r <= a + 0.5) frames.push(f);
    else if (l < a && r > b) frames.push({ ...f, w: f.w - SLIDE_W });
    else if (l < a) frames.push({ ...f, w: a - l });
    else frames.push({ ...f, x: a, w: r - b });
  }
  return { ...p, slides: p.slides - 1, frames: frames.filter((f) => f.w >= 1) };
}

// Moves slide `from` to index `to`. Each frame travels with the slide its
// left edge is on, so a panorama moves with the slide where it starts.
export function moveSlide(p, from, to) {
  const order = [...Array(p.slides).keys()];
  order.splice(to, 0, order.splice(from, 1)[0]);
  const newIndex = [];
  order.forEach((old, i) => (newIndex[old] = i));
  return {
    ...p,
    frames: p.frames.map((f) => {
      const a = anchorSlide(f, p.slides);
      return { ...f, x: f.x + (newIndex[a] - a) * SLIDE_W };
    }),
  };
}

// A new slide after slide k with the same frames as k, empty.
export function copySlideLayout(p, k) {
  const a = k * SLIDE_W;
  const b = a + SLIDE_W;
  const own = p.frames.filter((f) => f.x >= a - 0.5 && f.x + f.w <= b + 0.5);
  const next = insertSlide(p, k + 1);
  next.frames = [...next.frames, ...own.map((f) => newFrame(f.x + SLIDE_W, f.y, f.w, f.h))];
  return next;
}

// Changing the ratio keeps every frame in the same place relative to the
// slide's height, so a full-bleed frame stays full bleed.
export function changeRatio(p, ratio) {
  const k = RATIOS[ratio].h / slideH(p);
  return {
    ...p,
    ratio,
    padding: Math.round(p.padding * Math.min(1, k)),
    frames: p.frames.map((f) => ({ ...f, y: Math.round(f.y * k), h: Math.max(MIN_FRAME, Math.round(f.h * k)) })),
  };
}
