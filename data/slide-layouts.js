// Layouts for one slide: the set to pick from, and putting one on a slide.
import { SLIDE_W, slideH, pageWord } from './formats.js';
import { newFrame } from './templates.js';

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
