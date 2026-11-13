// Everything as one PDF: a cover in the notebook's colour, then every
// layout's slides laid out on sheets (round 2: no contents pages).
import { SHEET_W, SHEET_H } from './pdf.js';
import { listProjects, photosForProject } from './db.js';
import { loadImage, canvasToBlob } from '../components/util.js';
import { renderSlides } from './slide-images.js';
import { FULL_AREA, BOOK_AREA, INK, pagesPerSheet, printedW, printScale, checkPictures } from './print-check.js';

// Facing pages side by side on landscape sheets, touching at the middle so a
// photo running across two pages stays whole. Wide pages get a sheet each.
export function sheetsOf(jpegs, pxW, pxH, area = FULL_AREA) {
  const aspect = pxW / pxH;
  const per = pagesPerSheet(pxW, pxH);
  const w = printedW(aspect, area);
  const h = w / aspect;
  const y = area.y + (area.h - h) / 2;
  const sheets = [];
  for (let i = 0; i < jpegs.length; i += per) {
    const group = jpegs.slice(i, i + per);
    const x0 = area.x + (area.w - group.length * w) / 2;
    sheets.push({ images: group.map((jpeg, n) => ({ jpeg, pxW, pxH, x: x0 + n * w, y, w, h, outline: true })), text: [] });
  }
  return sheets;
}

function whiteCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { colorSpace: 'srgb' });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

async function finishCanvas(c) {
  const jpeg = await canvasToBlob(c, 'image/jpeg', 0.92);
  const size = { pxW: c.width, pxH: c.height };
  c.width = c.height = 0;
  return { jpeg, ...size };
}

function fitText(ctx, str, max) {
  if (ctx.measureText(str).width <= max) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(`${s}...`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}

// The cover: the notebook's own cover art, in the colour picked in Options.
async function coverSheet() {
  try {
    const img = await loadImage(`art/${document.documentElement.dataset.book || 'berry'}-cover.webp`);
    const { c, ctx } = whiteCanvas(1000, 1360);
    ctx.drawImage(img, 0, 0, 1000, 1360);
    const h = FULL_AREA.h;
    const w = (h * 1000) / 1360;
    return { images: [{ ...(await finishCanvas(c)), x: (SHEET_W - w) / 2, y: FULL_AREA.y, w, h }], text: [] };
  } catch {
    return null;
  }
}

const FONT = '"Figtree", system-ui, sans-serif';

// The layout's name at the foot of each of its sheets.
async function nameStrip(name) {
  const { c, ctx } = whiteCanvas(1400, 72);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText(fitText(ctx, name, 1380), 0, 38);
  return { ...(await finishCanvas(c)), x: 36, y: 12, w: 504, h: 25.92 };
}

// A sheet's number, at the foot on the right.
async function numberMark(str) {
  const { c, ctx } = whiteCanvas(160, 72);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText(str, 156, 38);
  return { ...(await finishCanvas(c)), x: SHEET_W - 36 - 57.6, y: 12, w: 57.6, h: 25.92 };
}

// The cover, then every layout from its own full-size slides. Returns
// { sheets, report }, or null if there are no layouts or `stillOpen` says stop.
export async function makeNotebook(onProgress, stillOpen = () => true) {
  const layouts = await listProjects();
  if (!layouts.length) return null;
  if (document.fonts && document.fonts.load) await document.fonts.load(`500 44px ${FONT}`).catch(() => {});
  const total = layouts.reduce((sum, p) => sum + p.slides, 0);
  const cover = await coverSheet();
  const sheets = cover ? [cover] : [];
  const report = { checked: 0, low: [] };
  let made = 0;
  let number = 1;
  for (const p of layouts) {
    if (!stillOpen()) return null;
    const photos = Object.fromEntries((await photosForProject(p.id)).map((ph) => [ph.id, ph]));
    const files = await renderSlides(p, photos, 'jpeg', (i) => onProgress && onProgress(p.name, (made + i) / total), { thumbs: false, scale: printScale(p, BOOK_AREA) });
    made += p.slides;
    const strip = await nameStrip(p.name);
    const own = sheetsOf(files.map((f) => f.blob), files[0].width, files[0].height, BOOK_AREA);
    const found = checkPictures(p, photos, files.map((_, i) => i), own, sheets.length, p.name);
    report.checked += found.checked;
    report.low.push(...found.low);
    for (const sheet of own) {
      sheet.images.push(strip);
      sheet.images.push(await numberMark(String(number++)));
      sheets.push(sheet);
    }
  }
  return { sheets, report };
}
