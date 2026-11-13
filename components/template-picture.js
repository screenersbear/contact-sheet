// What a template will look like, as a small drawing (round 2,
// 03-new-layout-template): its first two slides side by side, a dashed seam
// between them, and its boxes in grey (in the notebook's colour once it's
// the one picked; styles/new-layout-guide.css).
import { RATIOS, SLIDE_W } from '../data/formats.js';

// t: a template already in the size being made. boxes: false draws the
// slides bare (Blank).
export function spreadSvg(t, boxes = true) {
  const W = SLIDE_W;
  const H = RATIOS[t.ratio].h;
  const rects = boxes ? (t.frames || []).filter((f) => f.x < 2 * W).map((f) => `<rect class="spread-box" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/>`).join('') : '';
  return `<svg class="spread-svg" viewBox="0 0 ${2 * W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect class="spread-paper" width="${2 * W}" height="${H}"/>${rects}<line class="spread-seam" x1="${W}" y1="0" x2="${W}" y2="${H}" stroke-width="16" stroke-dasharray="53 53"/></svg>`;
}
