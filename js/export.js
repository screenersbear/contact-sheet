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

const isPhone = () => window.matchMedia('(pointer: coarse)').matches;

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

// Export goes straight to making the images (JPEG, best for Instagram).
// Then: tap an image to leave it out, hold and drag to change the order,
// and one button saves them (Save to Photos on phones, a download elsewhere).
export function openExport(p, photos) {
  const H = slideH(p);
  const empty = p.frames.filter((f) => !f.photoId).length;
  let urls = [];
  const s = openSheet({
    title: 'Export',
    className: 'sheet-export',
    onClose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  });

  async function run() {
    s.setTitle('Export');
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">${p.slides} ${esc(pageWord(p, p.slides !== 1))}, each ${SLIDE_W} × ${H}. Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let files;
    try {
      files = await renderSlides(p, photos, 'jpeg', (i, n) => {
        msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
        bar.style.width = `${Math.round((i / n) * 100)}%`;
      });
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the images. Try again, or try fewer ${esc(pageWord(p, true))} at a time.</p>
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
    const ratioClass = `r-${p.ratio.replace(':', 'x')}`;
    s.setTitle('Ready');
    s.body.innerHTML = `
      ${n > 1 ? `<p class="order-note"><b>Post them in this order.</b> Tap one to leave it out. Hold and drag to move it.</p>` : ''}
      <ol class="order-grid${n > 1 ? ' is-pick' : ''}" data-grid>
        ${files.map((f, i) => `<li data-i="${i}"><img class="${ratioClass}" src="${urls[i]}" alt="${esc(pageWord(p))} ${i + 1}" draggable="false" /><span class="order-num"></span><span class="order-off">Left out</span></li>`).join('')}
      </ol>
      ${empty ? `<p class="tip">${empty === 1 ? '1 frame is' : `${empty} frames are`} empty and show the background color.</p>` : ''}
      <div class="button-stack wide">
        <button type="button" class="modal-cta primary" data-save></button>
      </div>
      ${canShare ? '<p class="field-hint" data-hint></p>' : ''}`;
    const grid = s.body.querySelector('[data-grid]');
    const save = s.body.querySelector('[data-save]');
    const hint = s.body.querySelector('[data-hint]');
    const items = new Map([...grid.children].map((li) => [Number(li.dataset.i), li]));

    // The chosen images, in the chosen order, named 01, 02... in that order.
    const chosen = () =>
      order.filter((i) => !off.has(i)).map((i, k) => ({ ...files[i], name: `${base}-${String(k + 1).padStart(2, '0')}.jpg` }));

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
      if (hint) hint.innerHTML = c ? `In the share sheet, tap <b>Save ${c === 1 ? 'Image' : `${c} Images`}</b>.` : 'Tap an image to put it back.';
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
