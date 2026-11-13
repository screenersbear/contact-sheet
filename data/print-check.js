// Printed sizes: how big a page prints, and whether each picture is sharp
// enough at that size.
import { SLIDE_W, slideH, pageWord } from './formats.js';
import { framesOnSlide } from './slides.js';
import { placement } from '../components/placement.js';
import { SHEET_W, SHEET_H } from './pdf.js';

// ---------- Printable PDFs ----------

export const FULL_AREA = { x: 36, y: 36, w: SHEET_W - 72, h: SHEET_H - 72 };
// The whole notebook leaves room at the foot for the chapter name and number.
export const BOOK_AREA = { x: 36, y: 44, w: SHEET_W - 72, h: SHEET_H - 74 };
export const TOC_ROWS = 9;
export const INK = '#313d45';

// What book printers ask for at the printed size, and where they warn it
// will look blurry.
const PRINT_PPI = 300;
const BLURRY_PPI = 150;

export const pagesPerSheet = (pxW, pxH) => (pxW / pxH > 1.1 ? 1 : 2);
// How wide a page comes out on its sheet, in points.
export const printedW = (aspect, area) => Math.min(area.w / (aspect > 1.1 ? 1 : 2), area.h * aspect);
// The export scale that gives a page PRINT_PPI on its sheet.
export const printScale = (p, area) => Math.round((PRINT_PPI * printedW(SLIDE_W / slideH(p), area)) / 72) / SLIDE_W;

// How sharp each picture comes out on paper. Pictures under PRINT_PPI go in
// the report and get a mark on their sheet, which only the preview draws.
// `order` is the slides on `sheets`; `first` is the first sheet's number.
export function checkPictures(p, photos, order, sheets, first = 0, chapter = '') {
  const per = pagesPerSheet(SLIDE_W, slideH(p));
  const H = slideH(p);
  const report = { checked: 0, low: [] };
  for (const f of p.frames) {
    const photo = f.photoId && photos[f.photoId];
    if (!photo) continue;
    const seen = order.map((i, pos) => ({ i, pos })).filter(({ i }) => framesOnSlide(p, i).includes(f));
    if (!seen.length) continue;
    report.checked++;
    const sheetAt = (pos) => sheets[Math.floor(pos / per)];
    const pageAt = (pos) => sheetAt(pos).images[pos % per];
    // Without the original, only the smaller editing copy can be printed.
    const real = photo.original && photo.kind !== 'video' ? 1 : (photo.previewW || photo.width) / photo.width;
    const ppi = Math.round((real * 72 * SLIDE_W) / (placement(f, photo).s * pageAt(seen[0].pos).w));
    if (ppi >= PRINT_PPI) continue;
    const blurry = ppi < BLURRY_PPI;
    for (const { i, pos } of seen) {
      const im = pageAt(pos);
      const x0 = Math.max(0, f.x - i * SLIDE_W);
      const x1 = Math.min(SLIDE_W, f.x + f.w - i * SLIDE_W);
      const y0 = Math.max(0, f.y);
      const y1 = Math.min(H, f.y + f.h);
      const sheet = sheetAt(pos);
      sheet.marks = sheet.marks || [];
      sheet.marks.push({
        x: im.x + (x0 / SLIDE_W) * im.w,
        y: im.y + im.h - (y1 / H) * im.h,
        w: ((x1 - x0) / SLIDE_W) * im.w,
        h: ((y1 - y0) / H) * im.h,
        blurry,
      });
    }
    const where = `${pageWord(p)} ${seen[0].i + 1}`;
    report.low.push({
      ppi,
      blurry,
      thumb: photo.thumb,
      sheet: first + Math.floor(seen[0].pos / per),
      label: chapter ? `${chapter}, ${where}` : where[0].toUpperCase() + where.slice(1),
    });
  }
  return report;
}
