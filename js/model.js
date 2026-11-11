// Formats, starter templates and the geometry every screen shares.
//
// Everything is measured in export pixels. A slide is always 1080 wide, and
// a project is one long strip of slides side by side, so a frame at x 900,
// width 600 runs across the seam between slides 1 and 2. The numbers in a
// project are exactly what lands in the exported files.
import { uuid, clamp } from './util.js';

export const SLIDE_W = 1080;
export const MAX_SLIDES = 20;
export const MIN_FRAME = 60;

export const RATIOS = {
  '3:4': { h: 1440, story: false, label: 'Feed post 3:4', size: '1080 × 1440', detail: 'Tall. Matches the profile grid.' },
  '4:5': { h: 1350, story: false, label: 'Feed post 4:5', size: '1080 × 1350', detail: 'The classic portrait size.' },
  '1:1': { h: 1080, story: false, label: 'Feed post 1:1', size: '1080 × 1080', detail: 'Square.' },
  '9:16': { h: 1920, story: true, label: 'Story 9:16', size: '1080 × 1920', detail: 'Full screen. One or a series.' },
  // Not for posting. `scale` multiplies the exported pixels, for printing.
  '2:3': { h: 1620, story: false, print: true, scale: 1, label: 'Photo 4 × 6', size: '4 × 6 in', detail: 'The usual photo print.' },
  '5:7': { h: 1512, story: false, print: true, scale: 1.5, label: 'Photo 5 × 7', size: '5 × 7 in', detail: 'A framed print.' },
  '8:10': { h: 1350, story: false, print: true, scale: 2, label: 'Print 8 × 10', size: '8 × 10 in', detail: 'A larger print.' },
  letter: { h: 1398, story: false, print: true, scale: 2, label: 'US Letter', size: '8.5 × 11 in', detail: 'A full sheet of paper.' },
  a4: { h: 1527, story: false, print: true, scale: 2, label: 'A4', size: '210 × 297 mm', detail: 'A full sheet of paper.' },
  '3:2': { h: 720, story: false, print: true, scale: 2, label: 'Landscape 3:2', size: '6 × 4 in', detail: 'A photo print on its side.' },
  '4:3': { h: 810, story: false, print: true, scale: 2, label: 'Landscape 4:3', size: '2160 × 1620', detail: 'Wide, for slides and screens.' },
  '16:9': { h: 608, story: false, print: true, scale: 2, label: 'Widescreen 16:9', size: '2160 × 1216', detail: 'Wider, for video and presentations.' },
};
export const RATIO_ORDER = ['3:4', '4:5', '1:1', '9:16'];
export const MORE_RATIOS = ['2:3', '5:7', '8:10', 'letter', 'a4', '3:2', '4:3', '16:9'];
export const DEFAULT_RATIO = '3:4';

export const slideH = (p) => RATIOS[p.ratio].h;
export const isStory = (p) => RATIOS[p.ratio].story;
export const stripW = (p) => p.slides * SLIDE_W;
// What a page is called: "slide" in a feed post, "story" in a Story.
export const isPrint = (p) => !!RATIOS[p.ratio].print;
export const pageWord = (p, plural = false) => {
  if (isStory(p)) return plural ? 'stories' : 'story';
  if (isPrint(p)) return plural ? 'pages' : 'page';
  return plural ? 'slides' : 'slide';
};
export const pageTitle = (p, plural = false) => {
  const word = pageWord(p, plural);
  return word[0].toUpperCase() + word.slice(1);
};

// Instagram's own buttons and captions cover the top and bottom of a Story.
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 340;

export const DEFAULT_BG = '#ffffff';

// The parts of a project a template keeps.
export const LAYOUT_KEYS = ['ratio', 'slides', 'background', 'padding', 'seamsOpen', 'borderWidth', 'borderColor'];

export const defaultCrop = () => ({ zoom: 1, cx: 0.5, cy: 0.5, rot: 0 });

export function newFrame(x, y, w, h, photoId = null) {
  return { id: uuid(), x, y, w, h, photoId, crop: defaultCrop() };
}

export function blankLayout(ratio = DEFAULT_RATIO) {
  const h = RATIOS[ratio].h;
  return {
    ratio,
    slides: 1,
    background: DEFAULT_BG,
    padding: 0,
    seamsOpen: false,
    borderWidth: 0,
    borderColor: '#ffffff',
    frames: [newFrame(0, 0, SLIDE_W, h)],
  };
}

// A template's layout as a fresh project: same frames, all empty.
export function layoutFromTemplate(t) {
  const out = {};
  LAYOUT_KEYS.forEach((k) => (out[k] = t[k]));
  out.frames = (t.frames || []).map((f) => newFrame(f.x, f.y, f.w, f.h));
  return out;
}

// A project's layout as a template: frames keep their place, never their photos.
export function templateFromProject(p) {
  const out = {};
  LAYOUT_KEYS.forEach((k) => (out[k] = p[k]));
  out.frames = p.frames.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
  return out;
}

// The starter set. Clearly labelled, and deletable like any other template.
export function starterTemplates() {
  const W = SLIDE_W;
  const H = 1440;
  const full = (i, h = H) => ({ x: i * W, y: 0, w: W, h });
  const base = { background: DEFAULT_BG, padding: 0, seamsOpen: false, borderWidth: 0, borderColor: '#ffffff', starter: true };
  const B = 60;
  return [
    {
      ...base,
      starterKey: 'white-border',
      name: 'White border',
      ratio: '3:4',
      slides: 3,
      padding: B,
      frames: [0, 1, 2].map((i) => ({ x: i * W + B, y: B, w: W - 2 * B, h: H - 2 * B })),
    },
    { ...base, starterKey: 'panorama', name: 'Two-slide panorama', ratio: '3:4', slides: 2, frames: [{ x: 0, y: 0, w: 2 * W, h: H }] },
    {
      ...base,
      starterKey: 'panorama-singles',
      name: 'Panorama plus singles',
      ratio: '3:4',
      slides: 4,
      frames: [{ x: 0, y: 0, w: 2 * W, h: H }, full(2), full(3)],
    },
    { ...base, starterKey: 'story', name: 'Story full bleed', ratio: '9:16', slides: 1, frames: [full(0, 1920)] },
  ].map((t, i) => ({ ...t, sortOrder: i }));
}

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

// ---------- Spreads ----------

// Slides are the pages of a notebook, two to a spread. A frame may run across
// the spine of a spread, but never across a page flip.
export const spreadOf = (k) => Math.floor(k / 2);
export const spreadCount = (p) => Math.ceil(p.slides / 2);

// Trims any frame crossing a flip back to the spread holding most of it.
export function keepInSpreads(p) {
  const S = 2 * SLIDE_W;
  const end = p.slides * SLIDE_W;
  let changed = false;
  for (const f of p.frames) {
    const first = Math.floor(f.x / S) + 1;
    if (first * S >= f.x + f.w || first * S >= end || first < 1) continue;
    const lo = Math.floor((f.x + f.w / 2) / S) * S;
    const l = Math.max(f.x, lo);
    const r = Math.min(f.x + f.w, lo + S);
    f.x = l;
    f.w = Math.max(MIN_FRAME, r - l);
    changed = true;
  }
  return changed;
}

// ---------- Layouts for one slide ----------

// Each cell is [x, y, w, h] as fractions of the space inside the slide's
// border. The gap between photos is the slide border too, so the spacing
// around and between them matches.
const third = 1 / 3;
export const SLIDE_LAYOUTS = [
  { key: 'full', name: 'Full', cells: [[0, 0, 1, 1]] },
  { key: 'two-stacked', name: 'Two stacked', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { key: 'side-by-side', name: 'Side by side', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { key: 'grid-4', name: 'Grid of 4', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { key: 'three-stacked', name: 'Three stacked', cells: [[0, 0, 1, third], [0, third, 1, third], [0, 2 * third, 1, third]] },
  { key: 'three-across', name: 'Three across', cells: [[0, 0, third, 1], [third, 0, third, 1], [2 * third, 0, third, 1]] },
  { key: 'big-top', name: 'Big top, two below', cells: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]] },
  { key: 'big-left', name: 'Big left, two right', cells: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
  { key: 'grid-6', name: 'Grid of 6', cells: [0, 1, 2].flatMap((r) => [[0, r * third, 0.5, third], [0.5, r * third, 0.5, third]]) },
  { key: 'centred', name: 'Small, centred', cells: [[0.15, 0.2, 0.7, 0.6]] },
  { key: 'blank', name: 'Blank', cells: [] },
];

// A layout's frames on slide i, in strip units.
export function layoutRects(p, i, layout) {
  if (layout.exact) return layout.exact.map((r) => ({ ...r, x: r.x + i * SLIDE_W }));
  const box = slideBox(p, i);
  const gap = p.padding || 0;
  const at = (f, start, size, inner) => start + f * size + (inner ? gap / 2 : 0);
  return layout.cells.map(([cx, cy, cw, ch]) => {
    const l = at(cx, box.x, box.w, cx > 0.001);
    const r = at(cx + cw, box.x, box.w, false) - (cx + cw < 0.999 ? gap / 2 : 0);
    const t = at(cy, box.y, box.h, cy > 0.001);
    const b = at(cy + ch, box.y, box.h, false) - (cy + ch < 0.999 ? gap / 2 : 0);
    return { x: Math.round(l), y: Math.round(t), w: Math.round(r - l), h: Math.round(b - t) };
  });
}

// The frames sitting wholly on slide i (not ones crossing a seam into it).
export function framesWithinSlide(p, i) {
  const a = i * SLIDE_W;
  const b = a + SLIDE_W;
  return p.frames.filter((f) => f.x >= a - 0.5 && f.x + f.w <= b + 0.5);
}

// Gives slide i a new layout. Its photos move into the new frames in
// reading order (top to bottom, left to right); any left over stay in the
// tray. Frames crossing a seam onto the slide are left as they are.
export function applySlideLayout(p, i, layout) {
  const old = framesWithinSlide(p, i);
  const photoIds = old
    .filter((f) => f.photoId)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((f) => f.photoId);
  const fresh = layoutRects(p, i, layout).map((r) => newFrame(r.x, r.y, r.w, r.h, photoIds.shift() || null));
  return { ...p, frames: [...p.frames.filter((f) => !old.includes(f)), ...fresh] };
}

// Slide `from`'s frames, in the same places, as a layout for any slide.
export function layoutOfSlide(p, from) {
  const a = from * SLIDE_W;
  return {
    key: `slide-${from}`,
    name: `Same as ${pageWord(p)} ${from + 1}`,
    exact: framesWithinSlide(p, from).map((f) => ({ x: f.x - a, y: f.y, w: f.w, h: f.h })),
  };
}

// The space on slide i inside its border.
export function slideBox(p, i) {
  const P = p.padding || 0;
  const H = slideH(p);
  const left = p.seamsOpen && i > 0 ? 0 : P;
  const right = p.seamsOpen && i < p.slides - 1 ? 0 : P;
  return { x: i * SLIDE_W + left, y: P, w: SLIDE_W - left - right, h: H - 2 * P };
}

// The bands of border on slide i, in strip units: what covers the photos
// along that slide's edges. Seams stay open when seamsOpen is on.
export function borderBands(p, i) {
  const P = p.padding || 0;
  if (!P) return [];
  const H = slideH(p);
  const x0 = i * SLIDE_W;
  const bands = [
    { x: x0, y: 0, w: SLIDE_W, h: P },
    { x: x0, y: H - P, w: SLIDE_W, h: P },
  ];
  if (!p.seamsOpen || i === 0) bands.push({ x: x0, y: 0, w: P, h: H });
  if (!p.seamsOpen || i === p.slides - 1) bands.push({ x: x0 + SLIDE_W - P, y: 0, w: P, h: H });
  return bands;
}

// ---------- Snapping ----------

// Lines a frame's edges and centre can snap to, in strip units.
export function snapTargets(p, skipId, { safeZone = false } = {}) {
  const W = SLIDE_W;
  const H = slideH(p);
  const P = p.padding || 0;
  const xs = [];
  const ys = [0, H, H / 2];
  for (let k = 0; k <= p.slides; k++) xs.push(k * W);
  for (let k = 0; k < p.slides; k++) {
    xs.push(k * W + W / 2);
    if (P) xs.push(k * W + P, (k + 1) * W - P);
  }
  if (P) ys.push(P, H - P);
  if (safeZone && isStory(p)) ys.push(SAFE_TOP, H - SAFE_BOTTOM);
  for (const f of p.frames) {
    if (f.id === skipId) continue;
    xs.push(f.x, f.x + f.w, f.x + f.w / 2);
    ys.push(f.y, f.y + f.h, f.y + f.h / 2);
    // Frames also line up one border's width apart, so the gaps match.
    if (P) {
      xs.push(f.x - P, f.x + f.w + P);
      ys.push(f.y - P, f.y + f.h + P);
    }
  }
  return { xs, ys };
}

// The nearest target to any of `values`, within `tol`. Returns the shift to
// apply and the line it lands on, or null.
export function nearest(values, targets, tol) {
  let best = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t };
    }
  }
  return best;
}
