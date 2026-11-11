// Stickers on the notebook's cover. A photo is printed once as a faded, matte
// sticker and kept in the app; where it sits is stored as a share of the cover,
// so it stays put at any screen size. The last one added is always on top.
import { getMeta, setMeta } from './db.js';
import { pickFiles } from './photos.js';
import { canvasToBlob, loadImage } from './util.js';
import { openSheet, toast } from './ui.js';

const KEY = 'stickers';
const PRINT = 1000; // the long side in pixels, so a big sticker stays sharp
const EDGE = 0.04; // the white paper edge, of the sticker's short side
const CORNER = 0.05; // a square or rectangle's corners, of its short side
const RECT = 1.5; // a rectangle's long side over its short side
const START_SIZE = 0.42; // of the cover's width
const MIN_SIZE = 0.12;
const MAX_SIZE = 1.5;
const COVER_TALL = 1360 / 1000; // the cover's height, in cover widths
const BEND = 0.09; // how far in from the edge a sticker starts to curve over
const INK = '66, 48, 30'; // shadows are warm, like the light on the cover

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const printSize = (ratio) => (ratio >= 1 ? [PRINT, Math.round(PRINT / ratio)] : [Math.round(PRINT * ratio), PRINT]);

function shapePath(ctx, shape, w, h, inset) {
  const short = Math.min(w, h);
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(w / 2, h / 2, short / 2 - inset, 0, Math.PI * 2);
  else ctx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, Math.max(0, short * CORNER - inset));
}

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

// One crease: starts at the rim, wanders inward and dies away. A soft shade
// down one side, a fine dark line, and a catch of light on the other side.
function oneCrease(ctx, shape, w, h, reach) {
  const short = Math.min(w, h);
  const a = rand(0, Math.PI * 2);
  const [x0, y0] = rimPoint(shape, w, h, a);
  let heading = a + Math.PI + rand(0.25, 1.05) * (Math.random() < 0.5 ? -1 : 1);
  const STEPS = 16;
  const len = short * reach / STEPS;
  const pts = [[x0, y0]];
  for (let i = 0; i < STEPS; i++) {
    heading += rand(-0.13, 0.13);
    const [x, y] = pts[i];
    pts.push([x + Math.cos(heading) * len, y + Math.sin(heading) * len]);
  }
  const side = Math.random() < 0.5 ? -1 : 1;
  const k = short / 1000;
  const layers = [
    ['multiply', 9, 26, `${INK}`, 0.07],
    ['multiply', 4, 10, `${INK}`, 0.13],
    ['multiply', 0.8, 3, `${INK}`, 0.3],
    ['screen', -3.2, 3, '255, 255, 255', 0.2],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  for (const [mode, off, width, colour, alpha] of layers) {
    ctx.globalCompositeOperation = mode;
    ctx.lineWidth = width * k;
    for (let i = 0; i < STEPS; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const d = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (-(by - ay) / d) * off * k * side;
      const ny = ((bx - ax) / d) * off * k * side;
      ctx.strokeStyle = `rgba(${colour}, ${alpha * (1 - (i / STEPS) ** 1.6)})`;
      ctx.beginPath();
      ctx.moveTo(ax + nx, ay + ny);
      ctx.lineTo(bx + nx, by + ny);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Never quite flat: a couple of gentle bends across it, little creases from
// the rim, and soft shadows where the white edge has lifted.
function crease(ctx, shape, w, h) {
  const short = Math.min(w, h);
  ctx.save();
  for (let i = 0, n = 2; i < n; i++) {
    const a = rand(0, Math.PI);
    const c = rand(-0.25, 0.25) * short;
    const dx = Math.cos(a) * short * 0.7;
    const dy = Math.sin(a) * short * 0.7;
    const g = ctx.createLinearGradient(w / 2 + c - dx, h / 2 + c - dy, w / 2 + c + dx, h / 2 + c + dy);
    g.addColorStop(0.36, `rgba(${INK}, 0)`);
    g.addColorStop(0.5, `rgba(${INK}, 0.1)`);
    g.addColorStop(0.53, 'rgba(255, 255, 255, 0.1)');
    g.addColorStop(0.68, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) {
    const [x, y] = rimPoint(shape, w, h, rand(0, Math.PI * 2));
    const r = short * rand(0.1, 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${INK}, ${rand(0.16, 0.3)})`);
    g.addColorStop(1, `rgba(${INK}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.restore();
  for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) oneCrease(ctx, shape, w, h, rand(0.14, 0.38));
  for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) oneCrease(ctx, shape, w, h, rand(0.05, 0.12));
}

async function print(img, cut, shape, ratio) {
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
  crease(ctx, shape, w, h);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  canvas.width = canvas.height = 0;
  return blob;
}

// Stickers printed before creases existed get theirs once.
async function addCreases(s) {
  const url = URL.createObjectURL(s.image);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    crease(ctx, s.shape, canvas.width, canvas.height);
    s.image = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    canvas.width = canvas.height = 0;
  } finally {
    URL.revokeObjectURL(url);
  }
  s.creased = true;
}

// One finger drags, two pinch; a wheel or trackpad zooms on a computer.
// onMove(dx, dy, k) gets the movement in pixels and the change in size.
function followFingers(el, onMove) {
  const fingers = new Map();
  let last = null;
  const read = () => {
    const [a, b] = [...fingers.values()];
    return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) } : { x: a.x, y: a.y, d: 0 };
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    el.setPointerCapture(e.pointerId);
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = read();
  });
  el.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = read();
    onMove(now.x - last.x, now.y - last.y, now.d && last.d ? now.d / last.d : 1);
    last = now;
  });
  const lift = (e) => {
    fingers.delete(e.pointerId);
    last = fingers.size ? read() : null;
  };
  el.addEventListener('pointerup', lift);
  el.addEventListener('pointercancel', lift);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    onMove(0, 0, Math.exp(-e.deltaY * 0.002));
  }, { passive: false });
  // Stops an iPhone zooming the whole page instead.
  el.addEventListener('gesturestart', (e) => e.preventDefault());
}

// Choosing which part of the photo goes in the shape. Resolves with the part
// to use, in the photo's own pixels, or null if it was closed.
function cropSheet(img, shape, ratio) {
  return new Promise((resolve) => {
    let answer = null;
    const s = openSheet({
      title: 'Crop',
      className: 'sheet-small',
      body: `
        <div class="crop-stage"><canvas></canvas><div class="crop-hole is-${shape}"></div></div>
        <p class="field-hint crop-hint">Drag to move. Pinch to zoom.</p>
        <button type="button" class="modal-cta primary" data-crop-ok>Next</button>`,
      onClose: () => resolve(answer),
    });
    const stage = s.body.querySelector('.crop-stage');
    const hole = s.body.querySelector('.crop-hole');
    const view = stage.querySelector('canvas');
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    // A smaller copy to drag around, so a big photo doesn't stutter.
    const fit = Math.min(1, 1600 / Math.max(nw, nh));
    const cw = (view.width = Math.round(nw * fit));
    const ch = (view.height = Math.round(nh * fit));
    const vctx = view.getContext('2d');
    vctx.imageSmoothingQuality = 'high';
    vctx.drawImage(img, 0, 0, cw, ch);

    const base = Math.min(stage.clientWidth - 48, window.innerHeight * 0.42);
    const hw = ratio >= 1 ? base : base * ratio;
    const hh = ratio >= 1 ? base / ratio : base;
    const sw = stage.clientWidth;
    const sh = base + 40;
    stage.style.height = `${sh}px`;
    hole.style.width = `${hw}px`;
    hole.style.height = `${hh}px`;
    if (shape !== 'circle') hole.style.borderRadius = cornersOf(ratio);
    const fill = Math.max(hw / cw, hh / ch);
    let zoom = 1;
    let cx = 0.5;
    let cy = 0.5;
    let halfW = 0;
    let halfH = 0;
    const show = () => {
      const k = fill * zoom;
      halfW = hw / (2 * cw * k);
      halfH = hh / (2 * ch * k);
      cx = clamp(cx, halfW, 1 - halfW);
      cy = clamp(cy, halfH, 1 - halfH);
      view.style.transform = `translate(${sw / 2 - cx * cw * k}px, ${sh / 2 - cy * ch * k}px) scale(${k})`;
    };
    show();
    followFingers(stage, (dx, dy, pinch) => {
      const k = fill * zoom;
      cx -= dx / (cw * k);
      cy -= dy / (ch * k);
      zoom = clamp(zoom * pinch, 1, 8);
      show();
    });
    s.body.querySelector('[data-crop-ok]').addEventListener('click', () => {
      answer = { x: (cx - halfW) * nw, y: (cy - halfH) * nh, w: 2 * halfW * nw, h: 2 * halfH * nh };
      view.width = view.height = 0;
      s.close();
    });
  });
}

const cornersOf = (ratio) => (ratio >= 1 ? `${(CORNER * 100) / ratio}% / ${CORNER * 100}%` : `${CORNER * 100}% / ${CORNER * 100 * ratio}%`);

// root: the notebook. front: the cover the stickers sit on.
export function mountStickers(root, front) {
  const layer = document.createElement('div');
  layer.className = 'nb-stickers';
  // What wraps around the cover's edges stands at right angles to it.
  const edges = document.createElement('div');
  edges.className = 'nb-sticker-edges';
  front.append(layer, edges);

  let list = [];
  let editing = null;
  let gone = false;
  const shown = new Map(); // id -> { el, url }

  const SIDES = ['right', 'left', 'top', 'bottom'];

  // Where the sticker runs past the cover it curves over the edge: the last
  // of it on the front rounds away, and the next bit wraps around the cover's
  // thickness, which shows when the notebook is turned.
  function place(o, s) {
    const ratio = s.ratio || 1;
    const fw = s.size;
    const fh = s.size / ratio;
    const left = s.x - fw / 2;
    const top = s.y * COVER_TALL - fh / 2;
    const over = { right: left + fw - 1, left: -left, top: -top, bottom: top + fh - COVER_TALL };
    o.faces.forEach((el) => {
      el.style.left = `${s.x * 100}%`;
      el.style.top = `${s.y * 100}%`;
      el.style.width = `${s.size * 100}%`;
    });
    const at = { right: (1 - left) / fw, left: (left + fw) / fw, top: (top + fh) / fh, bottom: (COVER_TALL - top) / fh };
    const bends = [];
    for (const side of SIDES) {
      const show = over[side] > 0;
      o.folds[side].hidden = !show;
      if (!show) continue;
      const strength = clamp(over[side] / 0.035, 0, 1);
      const e = at[side] * 100;
      const band = (BEND / (side === 'top' || side === 'bottom' ? fh : fw)) * 100;
      const way = { right: 'to right', left: 'to left', top: 'to top', bottom: 'to bottom' }[side];
      bends.push(`linear-gradient(${way}, rgba(255, 255, 255, 0) ${e - band}%, rgba(255, 255, 255, ${0.36 * strength}) ${e - band * 0.55}%, rgba(${INK}, ${0.1 * strength}) ${e - band * 0.26}%, rgba(${INK}, ${0.68 * strength}) ${e}%)`);
    }
    o.bend.style.backgroundImage = bends.join(', ');
  }

  function face(s, url) {
    const el = document.createElement('i');
    el.className = `nb-sticker is-${s.shape}`;
    const ratio = s.ratio || 1;
    el.style.aspectRatio = String(ratio);
    if (s.shape !== 'circle') el.style.borderRadius = cornersOf(ratio);
    const img = new Image();
    img.alt = '';
    img.draggable = false;
    img.src = url;
    el.appendChild(img);
    return el;
  }

  function draw(s) {
    const url = URL.createObjectURL(s.image);
    const clip = document.createElement('div');
    clip.className = 'nb-stick-clip';
    const main = face(s, url);
    const bend = document.createElement('b');
    bend.className = 'nb-bend';
    main.appendChild(bend);
    clip.appendChild(main);
    layer.appendChild(clip);
    const faces = [main];
    const folds = {};
    for (const side of SIDES) {
      const fold = document.createElement('div');
      fold.className = `nb-fold is-${side}`;
      fold.hidden = true;
      const copy = face(s, url);
      fold.appendChild(copy);
      edges.appendChild(fold);
      faces.push(copy);
      folds[side] = fold;
    }
    const o = { clip, url, faces, folds, bend };
    shown.set(s.id, o);
    place(o, s);
    return main.querySelector('img');
  }

  function undraw(id) {
    const o = shown.get(id);
    if (!o) return;
    o.clip.remove();
    Object.values(o.folds).forEach((f) => f.remove());
    URL.revokeObjectURL(o.url);
    shown.delete(id);
  }

  const ready = getMeta(KEY, [])
    .then(async (saved) => {
      if (gone) return null;
      list = saved || [];
      const flat = list.filter((s) => !s.creased);
      if (flat.length) {
        await Promise.all(flat.map((s) => addCreases(s).catch((e) => console.error(e))));
        setMeta(KEY, list).catch((e) => console.error(e));
      }
      if (gone) return null;
      return Promise.all(list.map((s) => draw(s).decode().catch(() => {})));
    })
    .catch((e) => console.error(e));

  // Moving and sizing the new sticker. One finger drags it, two pinch it.
  function edit(s) {
    const o = shown.get(s.id);
    root.classList.add('is-sticking');
    const pad = document.createElement('div');
    pad.className = 'nb-stickpad';
    pad.innerHTML = `
      <div class="nb-stick-bar">
        <p class="nb-stick-hint">Drag to move. Pinch to resize.</p>
        <button type="button" class="modal-cta primary nb-stick-ok">OK</button>
      </div>`;
    root.appendChild(pad);
    followFingers(pad, (dx, dy, pinch) => {
      const box = front.getBoundingClientRect();
      // Its middle stays on the cover, so it can always be reached again.
      s.x = clamp(s.x + dx / box.width, 0, 1);
      s.y = clamp(s.y + dy / box.height, 0, 1);
      s.size = clamp(s.size * pinch, MIN_SIZE, MAX_SIZE);
      place(o, s);
    });

    const finish = () => {
      pad.remove();
      root.classList.remove('is-sticking');
      editing = null;
    };
    editing = { s, finish };
    pad.querySelector('.nb-stick-ok').addEventListener('click', async () => {
      list.push(s);
      finish();
      try {
        await setMeta(KEY, list);
      } catch (e) {
        console.error(e);
        toast('The sticker could not be saved.');
      }
    });
  }

  // A sticker never finished isn't kept.
  function drop() {
    if (!editing) return;
    const { s, finish } = editing;
    finish();
    undraw(s.id);
  }

  return {
    ready,
    list: () => list,
    urlOf: (id) => shown.get(id)?.url,
    drop,
    async add(shape, file) {
      const url = URL.createObjectURL(file);
      try {
        let img;
        try {
          img = await loadImage(url);
          if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty');
        } catch (e) {
          console.error(e);
          toast('That photo could not be opened. JPEG and PNG work everywhere.', { ms: 5000 });
          return;
        }
        // A rectangle lies the same way as the photo.
        const ratio = shape === 'rect' ? (img.naturalWidth >= img.naturalHeight ? RECT : 1 / RECT) : 1;
        const cut = await cropSheet(img, shape, ratio);
        if (!cut || gone || editing || root.dataset.mode !== 'closed') return;
        const image = await print(img, cut, shape, ratio);
        img.src = '';
        const s = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, shape, ratio, creased: true, x: 0.5, y: 0.5, size: START_SIZE, image };
        draw(s);
        edit(s);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    async remove(id) {
      list = list.filter((s) => s.id !== id);
      undraw(id);
      await setMeta(KEY, list);
    },
    destroy() {
      gone = true;
      drop();
      [...shown.keys()].forEach(undraw);
    },
  };
}

function openRemove(stickers) {
  const s = openSheet({ title: 'Remove sticker', className: 'sheet-small' });
  const drawList = () => {
    s.body.innerHTML = `
      <p class="sheet-message">Tap the one to remove.</p>
      <div class="opt-stickers">
        ${[...stickers.list()].reverse().map((k) => `
          <button type="button" class="opt-sticker is-${k.shape}" data-id="${k.id}" aria-label="Remove this ${k.shape === 'rect' ? 'rectangle' : k.shape} sticker">
            <img src="${stickers.urlOf(k.id)}" alt="" draggable="false" style="aspect-ratio:${k.ratio || 1}${k.shape === 'circle' ? '' : `;border-radius:${cornersOf(k.ratio || 1)}`}" />
          </button>`).join('')}
      </div>`;
  };
  drawList();
  s.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    await stickers.remove(b.dataset.id);
    if (stickers.list().length) drawList();
    else s.close();
  });
}

export function openStickers(stickers) {
  const s = openSheet({
    title: 'Stickers',
    className: 'sheet-small',
    body: `
      <div class="opt-shapes">
        <button type="button" class="opt-shape" data-shape="circle"><i class="is-circle"></i><span>Circle</span></button>
        <button type="button" class="opt-shape" data-shape="square"><i class="is-square"></i><span>Square</span></button>
        <button type="button" class="opt-shape" data-shape="rect"><i class="is-rect"></i><span>Rectangle</span></button>
      </div>
      ${stickers.list().length ? `
        <div class="choice-list">
          <button type="button" class="choice" data-remove><span class="choice-text"><span class="choice-label">Remove sticker</span></span></button>
        </div>` : ''}`,
  });
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shape]');
    if (b) {
      // Asked for straight from the tap: an iPhone refuses the picker otherwise.
      const picking = pickFiles({ multiple: false, accept: 'image/*' });
      s.close();
      picking.then(([file]) => file && stickers.add(b.dataset.shape, file));
      return;
    }
    if (e.target.closest('[data-remove]')) {
      s.close();
      openRemove(stickers);
    }
  });
}
