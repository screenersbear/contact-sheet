// Export: every slide drawn on its own at full size from the original
// photos, then shared to Photos (phones) or downloaded as a ZIP.
//
// Memory is what breaks long carousels on an iPhone, so this keeps it low:
// one canvas reused for every slide, and only the photos the current slide
// needs are open (a photo crossing into the next slide stays open for it).
import { SLIDE_W, slideH, framesOnSlide, placement, pageWord } from './model.js';
import { drawSlide } from './render.js';
import { downscale } from './photos.js';
import { makeZip } from './zip.js';
import { openSheet, toast } from './ui.js';
import { esc, slug, loadImage, canvasToBlob, downloadBlob, nextFrame } from './util.js';

const TYPE_KEY = 'contact-sheet-export-type';
const isPhone = () => window.matchMedia('(pointer: coarse)').matches;

function savedType() {
  try {
    return localStorage.getItem(TYPE_KEY) === 'png' ? 'png' : 'jpeg';
  } catch {
    return 'jpeg';
  }
}

// The original, shrunk only if it is more than twice the size the slide
// needs (big downscales in one step look gritty).
async function openSource(photo, scale) {
  const url = URL.createObjectURL(photo.original || photo.preview);
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

export async function renderSlides(p, photos, type, onProgress) {
  const W = SLIDE_W;
  const H = slideH(p);
  const mime = type === 'png' ? 'image/png' : 'image/jpeg';
  const ext = type === 'png' ? 'png' : 'jpg';
  const base = slug(p.name);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  const needs = [];
  for (let i = 0; i < p.slides; i++) needs.push(new Set(framesOnSlide(p, i).filter((f) => f.photoId && photos[f.photoId]).map((f) => f.photoId)));
  // The biggest size each photo is drawn at, over all its frames.
  const scaleOf = {};
  for (const f of p.frames) {
    if (!f.photoId || !photos[f.photoId]) continue;
    scaleOf[f.photoId] = Math.max(scaleOf[f.photoId] || 0, placement(f, photos[f.photoId]).s);
  }
  const open = new Map();
  const out = [];
  try {
    for (let i = 0; i < p.slides; i++) {
      if (onProgress) onProgress(i, p.slides);
      await nextFrame();
      for (const id of needs[i]) {
        if (!open.has(id)) open.set(id, await openSource(photos[id], scaleOf[id]));
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawSlide(ctx, p, i, (id) => open.get(id) || null);
      const blob = await canvasToBlob(canvas, mime, type === 'png' ? undefined : 0.95);
      // A small copy for the "post in this order" list.
      const t = document.createElement('canvas');
      t.height = 240;
      t.width = Math.round((240 * W) / H);
      t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
      const thumb = await canvasToBlob(t, 'image/jpeg', 0.8);
      t.width = t.height = 0;
      out.push({ name: `${base}-${String(i + 1).padStart(2, '0')}.${ext}`, blob, thumb, mime });
      const next = needs[i + 1] || new Set();
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

export function openExport(p, photos) {
  const word = pageWord(p, p.slides !== 1);
  const H = slideH(p);
  const empty = p.frames.filter((f) => !f.photoId).length;
  let type = savedType();
  let urls = [];
  const s = openSheet({
    title: 'Export',
    className: 'sheet-export',
    onClose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  });

  function setup() {
    s.body.innerHTML = `
      <p class="sheet-message"><b>${p.slides} ${esc(word)}</b>, each ${SLIDE_W} × ${H}.</p>
      <span class="field-label">File type</span>
      <div class="seg" role="radiogroup" aria-label="File type">
        <label class="seg-option"><input type="radio" name="t" value="jpeg"${type === 'jpeg' ? ' checked' : ''} /><span>JPEG</span></label>
        <label class="seg-option"><input type="radio" name="t" value="png"${type === 'png' ? ' checked' : ''} /><span>PNG</span></label>
      </div>
      <p class="field-hint">JPEG is best for Instagram. PNG files are bigger.</p>
      ${empty ? `<p class="tip">${empty === 1 ? '1 frame is' : `${empty} frames are`} still empty and will show the background color.</p>` : ''}
      <button type="button" class="modal-cta primary" data-go>Make ${p.slides === 1 ? 'the image' : `${p.slides} images`}</button>`;
    s.body.querySelectorAll('input[name="t"]').forEach((r) =>
      r.addEventListener('change', () => {
        type = r.value;
        try {
          localStorage.setItem(TYPE_KEY, type);
        } catch {}
      })
    );
    s.body.querySelector('[data-go]').addEventListener('click', run);
  }

  async function run() {
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let files;
    try {
      files = await renderSlides(p, photos, type, (i, n) => {
        msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
        bar.style.width = `${Math.round((i / n) * 100)}%`;
      });
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the images. Try again, or try fewer ${esc(pageWord(p, true))} at a time.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
      s.body.querySelector('[data-again]').addEventListener('click', setup);
      return;
    }
    if (!s.overlay.isConnected) return;
    finished(files);
  }

  function finished(files) {
    urls = files.map((f) => URL.createObjectURL(f.thumb));
    const shareFiles = files.map((f) => new File([f.blob], f.name, { type: f.mime }));
    let canShare = false;
    try {
      canShare = isPhone() && !!navigator.canShare && navigator.canShare({ files: shareFiles });
    } catch {}
    const ratioClass = `r-${p.ratio.replace(':', 'x')}`;
    s.setTitle('Ready');
    s.body.innerHTML = `
      <p class="order-note"><b>Post the ${esc(pageWord(p, true))} in this order.</b></p>
      <ol class="order-grid">
        ${files.map((f, i) => `<li><img class="${ratioClass}" src="${urls[i]}" alt="${esc(pageWord(p))} ${i + 1}" /><span class="order-num">${i + 1}</span></li>`).join('')}
      </ol>
      <div class="button-stack wide">
        ${canShare ? `<button type="button" class="modal-cta primary" data-share>Save to Photos</button>` : ''}
        <button type="button" class="modal-cta ${canShare ? 'secondary' : 'primary'}" data-zip>${files.length === 1 ? 'Download' : 'Download ZIP'}</button>
      </div>
      ${canShare ? `<p class="field-hint">In the share sheet, tap <b>Save ${files.length === 1 ? 'Image' : `${files.length} Images`}</b>.</p>` : ''}`;
    const shareBtn = s.body.querySelector('[data-share]');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        try {
          await navigator.share({ files: shareFiles });
        } catch (e) {
          if (e && e.name !== 'AbortError') toast('Sharing did not work here. Try Download ZIP.');
        }
      });
    }
    s.body.querySelector('[data-zip]').addEventListener('click', async () => {
      if (files.length === 1) {
        downloadBlob(files[0].blob, files[0].name);
        return;
      }
      const zip = await makeZip(files);
      downloadBlob(zip, `${slug(p.name)}.zip`);
    });
  }

  setup();
  return s;
}
