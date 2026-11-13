// What a template will look like, as a small drawing.
import { RATIOS, SLIDE_W } from '../data/formats.js';
import { esc } from './util.js';

// ---------- Template pictures ----------

// What a template will look like: each frame holds its own little picture
// (a panorama's one range of hills runs across the seam), on the slides'
// background, so borders and seams read at a glance.
const HILLS = ['M0 100V64L24 36L44 58L70 24L100 62V100Z', 'M0 100V56L30 26L54 60L78 40L100 66V100Z'];

export function layoutSvg(t) {
  const W = SLIDE_W;
  const H = RATIOS[t.ratio].h;
  const n = t.slides;
  let s = '';
  for (let i = 0; i < n; i++) s += `<rect x="${i * W}" y="0" width="${W}" height="${H}" fill="${esc(t.background)}"/>`;
  t.frames.forEach((f, i) => {
    s += `<svg x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" class="lay-sky"/><path d="${HILLS[i % 2]}" class="lay-land"/></svg>`;
  });
  for (let i = 1; i < n; i++) s += `<line x1="${i * W}" y1="0" x2="${i * W}" y2="${H}" class="lay-seam"/>`;
  s += `<rect x="0" y="0" width="${n * W}" height="${H}" class="lay-edge"/>`;
  return `<svg class="tpl-svg" viewBox="0 0 ${n * W} ${H}" preserveAspectRatio="xMinYMid meet" aria-hidden="true">${s}</svg>`;
}
