// Small shared helpers: ids, times, escaping, files.

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clone = (v) => JSON.parse(JSON.stringify(v));

// "Oct 30" this year, "Oct 30, 2025" otherwise.
export function shortDate(iso) {
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

// A file name made from a project name: "Beach day!" becomes "beach-day".
export function slug(name) {
  const s = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || 'post';
}

export function debounce(fn, ms) {
  let t;
  const run = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  run.flush = (...args) => {
    clearTimeout(t);
    return fn(...args);
  };
  run.cancel = () => clearTimeout(t);
  return run;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Encodes straight away. toBlob waits for the browser to be idle, which
// can add a second or more per image while the page is busy, so a 20 slide
// export crawled; toDataURL does the same encoding in a few milliseconds.
export function canvasToBlob(canvas, type, quality) {
  try {
    const url = canvas.toDataURL(type, quality);
    const comma = url.indexOf(',');
    if (comma < 0 || url.length < 30) throw new Error('Could not make the image');
    const mime = url.slice(5, url.indexOf(';')) || type;
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return Promise.resolve(new Blob([bytes], { type: mime }));
  } catch (e) {
    return Promise.reject(e);
  }
}

// Lets the screen repaint (a progress bar) between long steps.
export const nextFrame = () => new Promise((r) => setTimeout(r, 0));

// Ready to draw once it loads. (img.decode() is left out on purpose: it
// never finishes while the page is hidden, which stalled exports.)
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open the image'));
    img.src = src;
  });
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isPhone = () => window.matchMedia('(pointer: coarse)').matches;
