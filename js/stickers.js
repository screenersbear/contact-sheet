// Stickers on the notebook's cover. A photo is printed once as a faded, matte
// sticker and kept in the app; where it sits is stored as a share of the cover,
// so it stays put at any screen size. The last one added is always on top.
import { getMeta, setMeta } from './db.js';
import { pickFiles } from './photos.js';
import { canvasToBlob, loadImage } from './util.js';
import { openSheet, toast } from './ui.js';

const KEY = 'stickers';
const PRINT = 1000; // pixels across, so a big sticker stays sharp
const EDGE = 0.04; // the white paper edge, of the sticker's width
const CORNER = 0.05; // a square sticker's corners
const START_SIZE = 0.42; // of the cover's width
const MIN_SIZE = 0.12;
const MAX_SIZE = 1.5;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function shapePath(ctx, shape, inset) {
  const a = inset;
  const w = PRINT - 2 * inset;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(PRINT / 2, PRINT / 2, w / 2, 0, Math.PI * 2);
  else ctx.roundRect(a, a, w, w, Math.max(0, PRINT * CORNER - inset));
}

// The look: printed on matte paper and a little sun-faded, with the same fine
// grain as the cover and the light falling from the top left.
function fade(ctx) {
  const image = ctx.getImageData(0, 0, PRINT, PRINT);
  const d = image.data;
  const TILE = 256;
  const grain = new Float32Array(TILE * TILE);
  for (let i = 0; i < grain.length; i++) grain[i] = (Math.random() - 0.5) * 13;
  const LOW = 30;
  const HIGH = 240;
  const span = (HIGH - LOW) / 255;
  for (let y = 0, i = 0; y < PRINT; y++) {
    for (let x = 0; x < PRINT; x++, i += 4) {
      const light = 1.035 - (0.09 * (x + y)) / (2 * PRINT);
      const noise = grain[((y >> 1) & 255) * TILE + ((x >> 1) & 255)];
      const grey = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      d[i] = (LOW + (grey + (d[i] - grey) * 0.78) * span) * light + noise;
      d[i + 1] = (LOW + (grey + (d[i + 1] - grey) * 0.78) * span) * light * 0.985 + noise;
      d[i + 2] = (LOW + (grey + (d[i + 2] - grey) * 0.78) * span) * light * 0.95 + noise;
    }
  }
  ctx.putImageData(image, 0, 0);
}

async function print(file, shape) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('empty');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PRINT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(0, 0, PRINT, PRINT);
    ctx.save();
    shapePath(ctx, shape, PRINT * EDGE);
    ctx.clip();
    ctx.imageSmoothingQuality = 'high';
    const inner = PRINT * (1 - 2 * EDGE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, PRINT * EDGE, PRINT * EDGE, inner, inner);
    ctx.restore();
    fade(ctx);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    canvas.width = canvas.height = 0;
    img.src = '';
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// root: the notebook. front: the cover the stickers sit on.
export function mountStickers(root, front) {
  const layer = document.createElement('div');
  layer.className = 'nb-stickers';
  front.appendChild(layer);

  let list = [];
  let editing = null;
  let gone = false;
  const shown = new Map(); // id -> { el, url }

  const place = (el, s) => {
    el.style.left = `${s.x * 100}%`;
    el.style.top = `${s.y * 100}%`;
    el.style.width = `${s.size * 100}%`;
  };

  function draw(s) {
    const el = document.createElement('i');
    el.className = `nb-sticker is-${s.shape}`;
    const url = URL.createObjectURL(s.image);
    const img = new Image();
    img.alt = '';
    img.draggable = false;
    img.src = url;
    el.appendChild(img);
    place(el, s);
    layer.appendChild(el);
    shown.set(s.id, { el, url });
    return img;
  }

  function undraw(id) {
    const o = shown.get(id);
    if (!o) return;
    o.el.remove();
    URL.revokeObjectURL(o.url);
    shown.delete(id);
  }

  const ready = getMeta(KEY, [])
    .then((saved) => {
      if (gone) return null;
      list = saved || [];
      return Promise.all(list.map((s) => draw(s).decode().catch(() => {})));
    })
    .catch((e) => console.error(e));

  // Moving and sizing the new sticker. One finger drags it, two pinch it.
  function edit(s) {
    const { el } = shown.get(s.id);
    root.classList.add('is-sticking');
    const pad = document.createElement('div');
    pad.className = 'nb-stickpad';
    pad.innerHTML = `
      <div class="nb-stick-bar">
        <p class="nb-stick-hint">Drag to move. Pinch to resize.</p>
        <button type="button" class="modal-cta primary nb-stick-ok">OK</button>
      </div>`;
    root.appendChild(pad);

    const fingers = new Map();
    let last = null;
    const read = () => {
      const [a, b] = [...fingers.values()];
      return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) } : { x: a.x, y: a.y, d: 0 };
    };
    const size = (k) => {
      s.size = clamp(s.size * k, MIN_SIZE, MAX_SIZE);
      place(el, s);
    };
    pad.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      pad.setPointerCapture(e.pointerId);
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = read();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = read();
      const box = front.getBoundingClientRect();
      // Its middle stays on the cover, so it can always be reached again.
      s.x = clamp(s.x + (now.x - last.x) / box.width, 0, 1);
      s.y = clamp(s.y + (now.y - last.y) / box.height, 0, 1);
      place(el, s);
      if (now.d && last.d) size(now.d / last.d);
      last = now;
    });
    const lift = (e) => {
      fingers.delete(e.pointerId);
      last = fingers.size ? read() : null;
    };
    pad.addEventListener('pointerup', lift);
    pad.addEventListener('pointercancel', lift);
    // A trackpad or mouse wheel sizes it on a computer.
    pad.addEventListener('wheel', (e) => {
      e.preventDefault();
      size(Math.exp(-e.deltaY * 0.002));
    }, { passive: false });
    // Stops an iPhone zooming the whole page instead.
    pad.addEventListener('gesturestart', (e) => e.preventDefault());

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
      let image;
      try {
        image = await print(file, shape);
      } catch (e) {
        console.error(e);
        toast('That photo could not be opened. JPEG and PNG work everywhere.', { ms: 5000 });
        return;
      }
      if (gone || editing || root.dataset.mode !== 'closed') return;
      const s = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, shape, x: 0.5, y: 0.5, size: START_SIZE, image };
      draw(s);
      edit(s);
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
          <button type="button" class="opt-sticker is-${k.shape}" data-id="${k.id}" aria-label="Remove this ${k.shape} sticker">
            <img src="${stickers.urlOf(k.id)}" alt="" draggable="false" />
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
