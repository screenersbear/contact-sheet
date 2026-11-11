// Export: every slide drawn on its own at full size from the original
// photos, then shared to Photos (phones) or downloaded as a ZIP.
//
// Memory is what breaks long carousels on an iPhone, so this keeps it low:
// one canvas reused for every slide, and only the photos the current slide
// needs are open (a photo crossing into the next slide stays open for it).
import { SLIDE_W, RATIOS, slideH, framesOnSlide, placement, pageWord, isPrint } from './model.js';
import { drawSlide } from './render.js';
import { downscale } from './photos.js';
import { makeZip } from './zip.js';
import { SHEET_W, SHEET_H } from './pdf.js';
import { showPdf } from './pdfview.js';
import { MAX_VIDEO_S, canRecordVideo, hasVideo, recordSlide, startSound } from './videoexport.js';
import { ICONS } from './icons.js';
import { listProjects, photosForProject } from './db.js';
import { openSheet, toast } from './ui.js';
import { esc, slug, loadImage, canvasToBlob, downloadBlob, nextFrame, isPhone } from './util.js';

// The original, shrunk only if it is more than twice the size the slide
// needs (big downscales in one step look gritty).
async function openSource(photo, scale) {
  // A video is printed and thumbnailed from its still.
  const url = URL.createObjectURL(photo.kind === 'video' ? photo.preview : photo.original || photo.preview);
  try {
    const img = await loadImage(url);
    const tw = Math.ceil(photo.width * scale);
    const th = Math.ceil(photo.height * scale);
    if (img.naturalWidth / 2 >= tw && img.naturalHeight / 2 >= th) {
      const c = downscale(img, img.naturalWidth, img.naturalHeight, tw, th);
      img.src = '';
      return { photo, src: c, release: () => (c.width = c.height = 0) };
    }
    return { photo, src: img, release: () => (img.src = '') };
  } finally {
    // Loaded images keep their data; drawing doesn't need the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

// Sizes meant for printing come out with more pixels than the layout uses.
const exportScale = (p) => RATIOS[p.ratio].scale || 1;

// `scale` overrides the size; `only` is which slides to make, in that order.
export async function renderSlides(p, photos, type, onProgress, { thumbs = true, scale = exportScale(p), only = null } = {}) {
  const k = scale;
  const list = only || Array.from({ length: p.slides }, (_, i) => i);
  const W = Math.round(SLIDE_W * k);
  const H = Math.round(slideH(p) * k);
  const mime = type === 'png' ? 'image/png' : 'image/jpeg';
  const ext = type === 'png' ? 'png' : 'jpg';
  const base = slug(p.name);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  const needs = list.map((i) => new Set(framesOnSlide(p, i).filter((f) => f.photoId && photos[f.photoId]).map((f) => f.photoId)));
  // The biggest size each photo is drawn at, over all its frames.
  const scaleOf = {};
  for (const f of p.frames) {
    if (!f.photoId || !photos[f.photoId]) continue;
    scaleOf[f.photoId] = Math.max(scaleOf[f.photoId] || 0, placement(f, photos[f.photoId]).s);
  }
  const open = new Map();
  const out = [];
  try {
    for (let n = 0; n < list.length; n++) {
      const i = list[n];
      if (onProgress) onProgress(n, list.length);
      await nextFrame();
      for (const id of needs[n]) {
        if (!open.has(id)) open.set(id, await openSource(photos[id], scaleOf[id] * k));
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Filled, not cleared: an edge row a scale only part covers would go black.
      ctx.fillStyle = p.background;
      ctx.fillRect(0, 0, W, H);
      drawSlide(ctx, p, i, (id) => open.get(id) || null, { scale: k });
      const blob = await canvasToBlob(canvas, mime, type === 'png' ? undefined : 0.95);
      // A small copy for the "post in this order" list.
      let thumb = null;
      if (thumbs) {
        const t = document.createElement('canvas');
        t.height = 240;
        t.width = Math.round((240 * W) / H);
        t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
        thumb = await canvasToBlob(t, 'image/jpeg', 0.8);
        t.width = t.height = 0;
      }
      out.push({ name: `${base}-${String(i + 1).padStart(2, '0')}.${ext}`, blob, thumb, mime, width: W, height: H });
      const next = needs[n + 1] || new Set();
      for (const [id, s] of open) {
        if (!next.has(id)) {
          s.release();
          open.delete(id);
        }
      }
    }
  } finally {
    open.forEach((s) => s.release());
    canvas.width = canvas.height = 0;
  }
  return out;
}

// ---------- Printable PDFs ----------

const FULL_AREA = { x: 36, y: 36, w: SHEET_W - 72, h: SHEET_H - 72 };
// The whole notebook leaves room at the foot for the chapter name and number.
const BOOK_AREA = { x: 36, y: 44, w: SHEET_W - 72, h: SHEET_H - 74 };
const TOC_ROWS = 9;
const INK = '#313d45';

// What book printers ask for at the printed size, and where they warn it
// will look blurry.
const PRINT_PPI = 300;
const BLURRY_PPI = 150;

const pagesPerSheet = (pxW, pxH) => (pxW / pxH > 1.1 ? 1 : 2);
// How wide a page comes out on its sheet, in points.
const printedW = (aspect, area) => Math.min(area.w / (aspect > 1.1 ? 1 : 2), area.h * aspect);
// The export scale that gives a page PRINT_PPI on its sheet.
const printScale = (p, area) => Math.round((PRINT_PPI * printedW(SLIDE_W / slideH(p), area)) / 72) / SLIDE_W;

// How sharp each picture comes out on paper. Pictures under PRINT_PPI go in
// the report and get a mark on their sheet, which only the preview draws.
// `order` is the slides on `sheets`; `first` is the first sheet's number.
function checkPictures(p, photos, order, sheets, first = 0, chapter = '') {
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
    ctx.font = '112px Mansalva, "Bradley Hand", cursive';
    ctx.fillText('Table of contents', 1100, 250);
    ctx.fillStyle = '#d6dadd';
    ctx.fillRect(300, 320, 1600, 3);
    rows.slice(i, i + TOC_ROWS).forEach((row, n) => {
      const y = 320 + n * 128;
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.font = '68px Mansalva, "Bradley Hand", cursive';
      ctx.fillText(fitText(ctx, row.name, 1360), 320, y + 90);
      ctx.textAlign = 'right';
      ctx.font = '60px Mansalva, "Bradley Hand", cursive';
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
  ctx.font = '46px Mansalva, "Bradley Hand", cursive';
  ctx.fillText(fitText(ctx, name, 1380), 0, 38);
  return { ...(await finishCanvas(c)), x: 36, y: 12, w: 504, h: 25.92 };
}

// A sheet's number, drawn so the handwriting prints as it looks.
async function numberMark(str) {
  const { c, ctx } = whiteCanvas(160, 72);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '46px Mansalva, "Bradley Hand", cursive';
  ctx.fillText(str, 156, 38);
  return { ...(await finishCanvas(c)), x: SHEET_W - 36 - 57.6, y: 12, w: 57.6, h: 25.92 };
}

// The cover, the contents, then every chapter from its own full-size pages.
// Returns { sheets, report }, or null if there are no chapters or `stillOpen` says stop.
export async function makeNotebook(onProgress, stillOpen = () => true) {
  const chapters = await listProjects();
  if (!chapters.length) return null;
  if (document.fonts && document.fonts.load) await document.fonts.load('60px Mansalva').catch(() => {});
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

export function openNotebookExport() {
  let free = null;
  const s = openSheet({ title: 'Export notebook', className: 'sheet-export', onClose: () => free && free() });
  async function run() {
    s.setTitle('Export notebook');
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let book;
    try {
      book = await makeNotebook((name, part) => {
        msg.textContent = `Making ${name}`;
        bar.style.width = `${Math.round(part * 100)}%`;
      }, () => s.overlay.isConnected);
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the PDF. Try again.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
      s.body.querySelector('[data-again]').addEventListener('click', run);
      return;
    }
    if (!s.overlay.isConnected) return;
    if (!book) {
      s.body.innerHTML = '<p class="sheet-message">There are no chapters to export yet.</p>';
      return;
    }
    free = showPdf(s, { ...book, fileName: 'contact-sheet-notebook.pdf', onSaved: () => s.close() });
  }
  run();
  return s;
}

// One chapter's chosen pages, made at print size, then the preview on top of
// the export screen. Closing it goes back to the picks.
function openChapterPdf(p, photos, order, base, exportSheet) {
  let free = null;
  const s = openSheet({ title: 'Printable PDF', className: 'sheet-export', onClose: () => free && free() });
  async function run() {
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let files;
    try {
      files = await renderSlides(p, photos, 'jpeg', (i, n) => {
        msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
        bar.style.width = `${Math.round((i / n) * 100)}%`;
      }, { thumbs: false, scale: printScale(p, FULL_AREA), only: order });
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the PDF. Try again.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
      s.body.querySelector('[data-again]').addEventListener('click', run);
      return;
    }
    if (!s.overlay.isConnected) return;
    const sheets = sheetsOf(files.map((f) => f.blob), files[0].width, files[0].height);
    free = showPdf(s, {
      sheets,
      report: checkPictures(p, photos, order, sheets),
      fileName: `${base}-print.pdf`,
      onSaved: () => {
        s.close();
        exportSheet.close();
      },
    });
  }
  run();
}

// Export goes straight to making the images (JPEG, best for Instagram).
// Then: tap an image to leave it out, hold and drag to change the order,
// and one button saves them (Save to Photos on phones, a download elsewhere).
export function openExport(p, photos) {
  const H = slideH(p);
  const empty = p.frames.filter((f) => !f.photoId).length;
  let urls = [];
  const slidesWithVideo = Array.from({ length: p.slides }, (_, i) => i).filter((i) => hasVideo(p, photos, i));
  const record = slidesWithVideo.length > 0 && canRecordVideo();
  // Started here, on the tap, or an iPhone keeps the sound off.
  const audio = record ? startSound() : null;
  const s = openSheet({
    title: 'Export',
    className: 'sheet-export',
    onClose: () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      if (audio) audio.close().catch(() => {});
    },
  });

  async function run() {
    s.setTitle('Export');
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">${p.slides} ${esc(pageWord(p, p.slides !== 1))}, each ${Math.round(SLIDE_W * exportScale(p))} × ${Math.round(H * exportScale(p))}. Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let files;
    try {
      files = await renderSlides(p, photos, 'jpeg', (i, n) => {
        msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
        bar.style.width = `${Math.round((i / n) * 100)}%`;
      });
      if (record) {
        s.body.querySelector('.field-hint').textContent = `Videos are made as they play, up to ${MAX_VIDEO_S} seconds each. Keep this screen open while it works.`;
        const live = document.createElement('div');
        live.className = 'video-live';
        s.body.appendChild(live);
        for (const i of slidesWithVideo) {
          if (!s.overlay.isConnected) return;
          msg.textContent = `Making the video on ${pageWord(p)} ${i + 1}`;
          bar.style.width = '0%';
          const made = await recordSlide(p, photos, i, {
            audio,
            host: live,
            openSource,
            stillOpen: () => s.overlay.isConnected,
            onTime: (t, length) => (bar.style.width = `${Math.round((t / length) * 100)}%`),
          });
          files[i] = { ...files[i], ...made, name: files[i].name.replace(/\.jpg$/, `.${made.ext}`) };
        }
      }
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the ${record ? 'videos' : 'images'}. Keep this screen open and try again, or try fewer ${esc(pageWord(p, true))} at a time.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
      s.body.querySelector('[data-again]').addEventListener('click', run);
      return;
    }
    if (!s.overlay.isConnected) return;
    finished(files);
  }

  function finished(files) {
    urls = files.map((f) => URL.createObjectURL(f.thumb));
    const base = slug(p.name);
    const n = files.length;
    let order = files.map((_, i) => i);
    const off = new Set();
    let canShare = false;
    try {
      canShare = isPhone() && !!navigator.canShare && navigator.canShare({ files: files.map((f) => new File([f.blob], f.name, { type: f.mime })) });
    } catch {}
    const perSheet = pagesPerSheet(files[0].width, files[0].height);
    s.setTitle('Ready');
    s.body.innerHTML = `
      ${n > 1 ? `<p class="order-note"><b>${isPrint(p) ? 'Keep' : 'Post'} them in this order.</b> Tap one to leave it out. Hold and drag to move it.</p>` : ''}
      <ol class="order-grid${n > 1 ? ' is-pick' : ''}" data-grid>
        ${files.map((f, i) => `<li data-i="${i}"><img style="aspect-ratio:${f.width}/${f.height}" src="${urls[i]}" alt="${esc(pageWord(p))} ${i + 1}" draggable="false" /><span class="order-num"></span>${f.isVideo ? `<span class="order-vid">${ICONS.play}</span>` : ''}<span class="order-off">Left out</span></li>`).join('')}
      </ol>
      ${empty ? `<p class="tip">${empty === 1 ? '1 frame is' : `${empty} frames are`} empty and show the background color.</p>` : ''}
      ${slidesWithVideo.length && !record ? '<p class="tip">This browser can\'t save video, so those slides are saved as still images. Safari and Chrome can.</p>' : ''}
      <div class="button-stack wide">
        <button type="button" class="modal-cta primary" data-save></button>
      </div>
      ${canShare ? '<p class="field-hint" data-hint></p>' : ''}
      <div class="button-stack wide">
        <button type="button" class="modal-cta secondary" data-pdf>Printable PDF</button>
      </div>
      <p class="field-hint">Landscape, ${perSheet === 1 ? 'one page' : 'two pages'} to a sheet.</p>`;
    const grid = s.body.querySelector('[data-grid]');
    const save = s.body.querySelector('[data-save]');
    const hint = s.body.querySelector('[data-hint]');
    const items = new Map([...grid.children].map((li) => [Number(li.dataset.i), li]));

    // The chosen images, in the chosen order, named 01, 02... in that order.
    const chosen = () =>
      order.filter((i) => !off.has(i)).map((i, k) => ({ ...files[i], name: `${base}-${String(k + 1).padStart(2, '0')}.${files[i].ext || 'jpg'}` }));

    function draw() {
      let k = 0;
      for (const i of order) {
        const li = items.get(i);
        grid.appendChild(li);
        li.classList.toggle('is-off', off.has(i));
        li.querySelector('.order-num').textContent = off.has(i) ? '' : String(++k);
      }
      const c = k;
      const all = c === n;
      save.disabled = !c;
      if (canShare) save.textContent = all || !c ? 'Save to Photos' : `Save ${c} to Photos`;
      else save.textContent = c === 1 ? 'Download' : all ? 'Download ZIP' : `Download ${c} as ZIP`;
      if (hint) {
        const v = order.filter((i) => !off.has(i) && files[i].isVideo).length;
        const what = !v ? (c === 1 ? 'Image' : `${c} Images`) : c === 1 ? 'Video' : v === c ? `${c} Videos` : `${c} Items`;
        hint.innerHTML = c ? `In the share sheet, tap <b>Save ${what}</b>.` : 'Tap an image to put it back.';
      }
    }

    save.addEventListener('click', async () => {
      const list = chosen();
      if (!list.length) return;
      if (canShare) {
        try {
          await navigator.share({ files: list.map((f) => new File([f.blob], f.name, { type: f.mime })) });
          s.close();
        } catch (e) {
          // Cancelling the share sheet stays here, to change the picks or try again.
          if (e && e.name !== 'AbortError') toast('Sharing did not work here. Try again in Safari.');
        }
        return;
      }
      if (list.length === 1) downloadBlob(list[0].blob, list[0].name);
      else downloadBlob(await makeZip(list), `${base}.zip`);
      s.close();
    });

    s.body.querySelector('[data-pdf]').addEventListener('click', () => {
      const picked = order.filter((i) => !off.has(i));
      if (picked.length) openChapterPdf(p, photos, picked, base, s);
    });

    if (n > 1) {
      let suppress = false;
      grid.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-i]');
        if (!li || suppress) return;
        const i = Number(li.dataset.i);
        if (off.has(i)) off.delete(i);
        else off.add(i);
        draw();
      });
      dragToReorder(grid, (from, to) => {
        const [i] = order.splice(from, 1);
        order.splice(to, 0, i);
        draw();
      }, (v) => (suppress = v));
    }
    draw();
  }

  run();
  return s;
}

// Hold an item (or drag it with the mouse) and move it: the list reflows
// under the finger. onMove(from, to) changes the order; setSuppress keeps the
// tap that ends a drag from also toggling the item.
function dragToReorder(list, onMove, setSuppress) {
  let d = null;
  const HOLD = 300;
  const index = (li) => [...list.children].indexOf(li);
  function lift(x, y) {
    d.on = true;
    setSuppress(true);
    const r = d.li.getBoundingClientRect();
    d.ghost = d.li.cloneNode(true);
    d.ghost.className = `order-ghost${d.li.classList.contains('is-off') ? ' is-off' : ''}`;
    d.ghost.style.width = `${r.width}px`;
    d.dx = x - r.left;
    d.dy = y - r.top;
    document.body.appendChild(d.ghost);
    d.li.classList.add('is-placeholder');
    place(x, y);
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
  }
  function place(x, y) {
    d.ghost.style.transform = `translate(${x - d.dx}px, ${y - d.dy}px)`;
    const hit = document.elementFromPoint(x, y);
    const over = hit && hit.closest('li[data-i]');
    if (!over || over === d.li || over.parentNode !== list) return;
    const from = index(d.li);
    const to = index(over);
    onMove(from, to);
  }
  function end() {
    if (!d) return;
    clearTimeout(d.timer);
    if (d.on) {
      d.ghost.remove();
      d.li.classList.remove('is-placeholder');
      setTimeout(() => setSuppress(false), 0);
    }
    d = null;
  }
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li || (e.pointerType === 'mouse' && e.button !== 0)) return;
    d = { li, id: e.pointerId, x0: e.clientX, y0: e.clientY, mouse: e.pointerType === 'mouse', on: false };
    if (!d.mouse) d.timer = setTimeout(() => d && !d.on && lift(d.x0, d.y0), HOLD);
  });
  list.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      const far = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
      // A finger that moves before the hold is scrolling; a mouse drags at once.
      if (!d.mouse) {
        if (far > 8) end();
        return;
      }
      if (far < 4) return;
      try {
        list.setPointerCapture(e.pointerId);
      } catch {}
      lift(e.clientX, e.clientY);
    }
    d.x0 = e.clientX;
    d.y0 = e.clientY;
    place(e.clientX, e.clientY);
  });
  // Once an item is held, the page must not scroll under it.
  list.addEventListener('touchmove', (e) => d && d.on && e.preventDefault(), { passive: false });
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
  list.addEventListener('contextmenu', (e) => e.preventDefault());
}
