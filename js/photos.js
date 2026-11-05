// Bringing photos in. The original file is stored untouched for export; a
// downscaled preview keeps editing fast, and a small thumb fills the tray.
//
// Orientation: browsers apply a photo's EXIF orientation when they draw it
// (to an <img> and to a canvas), so naturalWidth/Height are the upright size
// and the preview is drawn upright with no EXIF left in it. Colour: canvases
// are sRGB, so a Display P3 iPhone photo is converted on the way in.
import { addPhoto } from './db.js';
import { loadImage, canvasToBlob } from './util.js';

const PREVIEW_MAX = 1600;
const THUMB_MAX = 480; // sharp in the bigger tray and picker

// Draws `src` at w x h, halving first while it's more than twice as big, so
// a 24 megapixel photo shrinks smoothly instead of turning to grain.
export function downscale(src, srcW, srcH, w, h) {
  let cur = src;
  let cw = srcW;
  let ch = srcH;
  const temps = [];
  while (cw / 2 >= w && ch / 2 >= h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cw / 2));
    c.height = Math.max(1, Math.round(ch / 2));
    const x = c.getContext('2d', { colorSpace: 'srgb' });
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    temps.push(c);
    cur = c;
    cw = c.width;
    ch = c.height;
  }
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  const ctx = out.getContext('2d', { colorSpace: 'srgb' });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, out.width, out.height);
  // Hand the memory back now: iOS Safari has a small budget for canvases.
  temps.forEach((c) => {
    c.width = 0;
    c.height = 0;
  });
  return out;
}

const fit = (w, h, max) => {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
};

async function importFile(projectId, file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('empty');
    const [pw, ph] = fit(width, height, PREVIEW_MAX);
    const pc = downscale(img, width, height, pw, ph);
    const preview = await canvasToBlob(pc, 'image/jpeg', 0.86);
    const [tw, th] = fit(width, height, THUMB_MAX);
    const tc = downscale(pc, pw, ph, tw, th);
    const thumb = await canvasToBlob(tc, 'image/jpeg', 0.8);
    pc.width = pc.height = tc.width = tc.height = 0;
    img.src = '';
    return addPhoto({
      projectId,
      name: file.name || 'photo',
      type: file.type || '',
      original: file,
      width,
      height,
      preview,
      previewW: pw,
      previewH: ph,
      thumb,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// One at a time, so a phone never holds more than one full-size photo.
export async function importFiles(projectId, files, onProgress) {
  const photos = [];
  const failed = [];
  const list = [...files].filter((f) => !f.type || f.type.startsWith('image/'));
  for (let i = 0; i < list.length; i++) {
    if (onProgress) onProgress(i, list.length);
    try {
      photos.push(await importFile(projectId, list[i]));
    } catch {
      failed.push(list[i].name || 'photo');
    }
  }
  return { photos, failed, skipped: files.length - list.length };
}

// Opens the camera roll (or the file picker on a computer).
export function pickFiles({ multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = [...(input.files || [])];
      input.remove();
      resolve(files);
    });
    // Closing the picker without choosing fires no change event on some
    // browsers; "cancel" covers the rest.
    input.addEventListener('cancel', () => {
      input.remove();
      resolve([]);
    });
    document.body.appendChild(input);
    input.click();
  });
}
