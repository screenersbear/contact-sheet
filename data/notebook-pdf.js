// The printable notebook: its cover, its contents pages and every chapter's
// pages laid out on sheets for the PDF.
import { SLIDE_W, slideH } from './formats.js';
import { SHEET_W, SHEET_H } from './pdf.js';
import { listProjects, photosForProject } from './db.js';
import { loadImage, canvasToBlob } from '../components/util.js';
import { renderSlides } from './slide-images.js';
import { FULL_AREA, BOOK_AREA, TOC_ROWS, INK, pagesPerSheet, printedW, printScale, checkPictures } from './print-check.js';

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

async function coverSheet() {
  try {
    const img = await loadImage(`art/${document.documentElement.dataset.book || 'orange'}-cover.webp`);
    const { c, ctx } = whiteCanvas(1000, 1360);
    ctx.drawImage(img, 0, 0, 1000, 1360);
    const h = FULL_AREA.h;
    const w = (h * 1000) / 1360;
    return { images: [{ ...(await finishCanvas(c)), x: (SHEET_W - w) / 2, y: FULL_AREA.y, w, h }], text: [] };
  } catch {
    return null;
  }
}

// Each contents sheet is drawn whole, so the handwriting prints as it looks.
async function contentsSheets(rows) {
  const sheets = [];
  for (let i = 0; i < rows.length; i += TOC_ROWS) {
    const { c, ctx } = whiteCanvas(2200, 1700);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = '112px "Klee One", "Bradley Hand", cursive';
    ctx.fillText('Table of contents', 1100, 250);
    ctx.fillStyle = '#d6dadd';
    ctx.fillRect(300, 320, 1600, 3);
    rows.slice(i, i + TOC_ROWS).forEach((row, n) => {
      const y = 320 + n * 128;
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.font = '68px "Klee One", "Bradley Hand", cursive';
      ctx.fillText(fitText(ctx, row.name, 1360), 320, y + 90);
      ctx.textAlign = 'right';
      ctx.font = '60px "Klee One", "Bradley Hand", cursive';
      ctx.fillText(String(row.page), 1880, y + 88);
      ctx.fillStyle = '#d6dadd';
      ctx.fillRect(300, y + 128, 1600, 3);
    });
    sheets.push({ images: [{ ...(await finishCanvas(c)), x: 0, y: 0, w: SHEET_W, h: SHEET_H }], text: [] });
  }
  return sheets;
}

async function nameStrip(name) {
  const { c, ctx } = whiteCanvas(1400, 72);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.font = '46px "Klee One", "Bradley Hand", cursive';
  ctx.fillText(fitText(ctx, name, 1380), 0, 38);
  return { ...(await finishCanvas(c)), x: 36, y: 12, w: 504, h: 25.92 };
}

// A sheet's number, drawn so the handwriting prints as it looks.
async function numberMark(str) {
  const { c, ctx } = whiteCanvas(160, 72);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '46px "Klee One", "Bradley Hand", cursive';
  ctx.fillText(str, 156, 38);
  return { ...(await finishCanvas(c)), x: SHEET_W - 36 - 57.6, y: 12, w: 57.6, h: 25.92 };
}

// The cover, the contents, then every chapter from its own full-size pages.
// Returns { sheets, report }, or null if there are no chapters or `stillOpen` says stop.
export async function makeNotebook(onProgress, stillOpen = () => true) {
  const chapters = await listProjects();
  if (!chapters.length) return null;
  if (document.fonts && document.fonts.load) await document.fonts.load('60px "Klee One"').catch(() => {});
  const total = chapters.reduce((sum, p) => sum + p.slides, 0);
  let page = 1;
  const rows = chapters.map((p) => {
    const row = { name: p.name, page };
    page += Math.ceil(p.slides / pagesPerSheet(SLIDE_W, slideH(p)));
    return row;
  });
  const cover = await coverSheet();
  const sheets = [...(cover ? [cover] : []), ...(await contentsSheets(rows))];
  const report = { checked: 0, low: [] };
  let made = 0;
  let number = 1;
  for (const p of chapters) {
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
      const str = String(number++);
      sheet.images.push(strip);
      sheet.images.push(await numberMark(str));
      sheets.push(sheet);
    }
  }
  return { sheets, report };
}
