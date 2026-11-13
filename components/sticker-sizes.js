// A sticker's sizes and shapes, and the look of its print.

export const KEY = 'stickers';
const PRINT = 1000; // the long side in pixels, so a big sticker stays sharp
export const EDGE = 0.04; // the white paper edge, of the sticker's short side
export const CORNER = 0.05; // a square or rectangle's corners, of its short side
export const RECT = 1.5; // a rectangle's long side over its short side
export const START_SIZE = 0.42; // of the cover's width
export const MIN_SIZE = 0.12;
export const MAX_SIZE = 1.5;
export const COVER_TALL = 1360 / 1000; // the cover's height, in cover widths
export const BEND = 0.09; // how far in from the edge a sticker starts to curve over
export const INK = '66, 48, 30'; // shadows are warm, like the light on the cover
// How the creases are drawn. Stickers creased an older way are creased again
// from their plain print (those made before 2026-11-11's v29 have none, and
// keep theirs).
export const LOOK = 2;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const printSize = (ratio) => (ratio >= 1 ? [PRINT, Math.round(PRINT / ratio)] : [Math.round(PRINT * ratio), PRINT]);

export function shapePath(ctx, shape, w, h, inset) {
  const short = Math.min(w, h);
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(w / 2, h / 2, short / 2 - inset, 0, Math.PI * 2);
  else ctx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, Math.max(0, short * CORNER - inset));
}
