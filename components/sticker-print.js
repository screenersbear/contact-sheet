// Printing a sticker: the photo faded and matte, with soft creases.
import { canvasToBlob, loadImage } from './util.js';
import { EDGE, INK, LOOK, printSize, shapePath } from './sticker-sizes.js';

// The look: printed on matte paper and a little sun-faded, with the same fine
// grain as the cover and the light falling from the top left.
function fade(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const TILE = 256;
  const grain = new Float32Array(TILE * TILE);
  for (let i = 0; i < grain.length; i++) grain[i] = (Math.random() - 0.5) * 13;
  const LOW = 30;
  const HIGH = 240;
  const span = (HIGH - LOW) / 255;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const light = 1.035 - (0.09 * (x + y)) / (w + h);
      const noise = grain[((y >> 1) & 255) * TILE + ((x >> 1) & 255)];
      const grey = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      d[i] = (LOW + (grey + (d[i] - grey) * 0.78) * span) * light + noise;
      d[i + 1] = (LOW + (grey + (d[i + 1] - grey) * 0.78) * span) * light * 0.985 + noise;
      d[i + 2] = (LOW + (grey + (d[i + 2] - grey) * 0.78) * span) * light * 0.95 + noise;
    }
  }
  ctx.putImageData(image, 0, 0);
}

// A point on the sticker's rim, in the direction `a` from its middle.
function rimPoint(shape, w, h, a) {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const r = shape === 'circle' ? Math.min(w, h) / 2 : Math.min(w / 2 / Math.abs(cos || 1e-6), h / 2 / Math.abs(sin || 1e-6));
  return [w / 2 + cos * r, h / 2 + sin * r];
}

// The same sticker always gets the same creases, so it can be printed again.
function seeded(seed) {
  let t = seed >>> 0;
  return (a = 0, b = 1) => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return a + (((r ^ (r >>> 14)) >>> 0) / 4294967296) * (b - a);
  };
}

// A blurred stroke along `path`, faded out from (x0, y0) to (x1, y1). Drawn
// far off the canvas with only its shadow brought back, since Safari has no
// ctx.filter, then laid on with `mode`.
function softStroke(ctx, scratch, path, { width, blur, colour, mode, from, to }) {
  const s = scratch.getContext('2d');
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, scratch.width, scratch.height);
  const OFF = scratch.width + 4 * blur;
  s.save();
  s.lineCap = 'round';
  s.lineJoin = 'round';
  s.lineWidth = width;
  s.strokeStyle = '#000';
  s.shadowColor = `rgba(${colour})`;
  s.shadowBlur = blur;
  s.shadowOffsetX = OFF;
  s.translate(-OFF, 0);
  s.stroke(path);
  s.restore();
  const g = s.createLinearGradient(from[0], from[1], to[0], to[1]);
  g.addColorStop(0, 'rgba(0, 0, 0, 1)');
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  s.globalCompositeOperation = 'destination-in';
  s.fillStyle = g;
  s.fillRect(0, 0, scratch.width, scratch.height);
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

// One crease: starts at the rim, drifts inward in a gentle curve and dies
// away. No line of its own: a wide soft shade down one side and a soft catch
// of light on the other, so it reads as the paper bending, not a cut.
function oneCrease(ctx, scratch, shape, w, h, reach, r) {
  const short = Math.min(w, h);
  const k = short / 1000;
  const a = r(0, Math.PI * 2);
  const [x0, y0] = rimPoint(shape, w, h, a);
  let heading = a + Math.PI + r(0.25, 0.95) * (r() < 0.5 ? -1 : 1);
  const STEPS = 6;
  const len = (short * reach) / STEPS;
  const pts = [[x0, y0]];
  for (let i = 0; i < STEPS; i++) {
    heading += r(-0.09, 0.09);
    const [x, y] = pts[i];
    pts.push([x + Math.cos(heading) * len, y + Math.sin(heading) * len]);
  }
  const side = r() < 0.5 ? -1 : 1;
  const along = (off) => {
    const p = new Path2D();
    const at = (i) => {
      const [ax, ay] = pts[Math.max(0, i - 1)];
      const [bx, by] = pts[Math.min(STEPS, i + 1)];
      const d = Math.hypot(bx - ax, by - ay) || 1;
      return [pts[i][0] - ((by - ay) / d) * off * side, pts[i][1] + ((bx - ax) / d) * off * side];
    };
    const q = pts.map((_, i) => at(i));
    p.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < STEPS; i++) p.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    p.lineTo(q[STEPS][0], q[STEPS][1]);
    return p;
  };
  const from = pts[0];
  const to = pts[STEPS];
  const deep = r(0.75, 1.15);
  softStroke(ctx, scratch, along(9 * k), { width: 18 * k, blur: 30 * k, colour: `${INK}, ${0.34 * deep}`, mode: 'multiply', from, to });
  softStroke(ctx, scratch, along(-11 * k), { width: 14 * k, blur: 26 * k, colour: `255, 255, 255, ${0.3 * deep}`, mode: 'screen', from, to });
}

// Never quite flat: the paper rises and dips a little all over, a couple of
// wide bends cross it, soft creases come in from the rim, and the white edge
// is shadowed where it has lifted.
function crease(ctx, shape, w, h, seed) {
  const r = seeded(seed);
  const short = Math.min(w, h);
  ctx.save();
  for (let i = 0, n = 6 + Math.floor(r(0, 4)); i < n; i++) {
    const x = r(0, w);
    const y = r(0, h);
    const rad = short * r(0.22, 0.5);
    const dark = i % 2 === 0;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, dark ? `rgba(${INK}, ${r(0.035, 0.06)})` : `rgba(255, 255, 255, ${r(0.04, 0.07)})`);
    g.addColorStop(1, dark ? `rgba(${INK}, 0)` : 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = dark ? 'multiply' : 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  for (let i = 0; i < 2; i++) {
    const a = r(0, Math.PI);
    const c = r(-0.25, 0.25) * short;
    const dx = Math.cos(a) * short * 0.7;
    const dy = Math.sin(a) * short * 0.7;
    const g = ctx.createLinearGradient(w / 2 + c - dx, h / 2 + c - dy, w / 2 + c + dx, h / 2 + c + dy);
    g.addColorStop(0.2, `rgba(${INK}, 0)`);
    g.addColorStop(0.46, `rgba(${INK}, 0.1)`);
    g.addColorStop(0.56, 'rgba(255, 255, 255, 0.09)');
    g.addColorStop(0.8, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0, n = 3 + Math.floor(r(0, 3)); i < n; i++) {
    const [x, y] = rimPoint(shape, w, h, r(0, Math.PI * 2));
    const rad = short * r(0.12, 0.26);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${INK}, ${r(0.12, 0.24)})`);
    g.addColorStop(1, `rgba(${INK}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  ctx.restore();
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  for (let i = 0, n = 3 + Math.floor(r(0, 3)); i < n; i++) oneCrease(ctx, scratch, shape, w, h, r(0.28, 0.6), r);
  for (let i = 0, n = 2 + Math.floor(r(0, 3)); i < n; i++) oneCrease(ctx, scratch, shape, w, h, r(0.1, 0.2), r);
  scratch.width = scratch.height = 0;
}

export const newSeed = () => Math.floor(Math.random() * 4294967296);

// The plain print (photo, fade and paper edge) and the creased one shown on
// the notebook. The plain one is kept, so the creases can change later.
export async function print(img, cut, shape, ratio, seed) {
  const [w, h] = printSize(ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(0, 0, w, h);
  const edge = Math.min(w, h) * EDGE;
  ctx.save();
  shapePath(ctx, shape, w, h, edge);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cut.x, cut.y, cut.w, cut.h, edge, edge, w - 2 * edge, h - 2 * edge);
  ctx.restore();
  fade(ctx, w, h);
  const plain = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  crease(ctx, shape, w, h, seed);
  const image = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  canvas.width = canvas.height = 0;
  return { plain, image };
}

// Creased again from its plain print, the way creases are drawn now.
export async function recrease(s) {
  const url = URL.createObjectURL(s.plain);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    crease(ctx, s.shape, canvas.width, canvas.height, s.seed);
    s.image = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    canvas.width = canvas.height = 0;
  } finally {
    URL.revokeObjectURL(url);
  }
  s.creased = true;
  s.look = LOOK;
}
