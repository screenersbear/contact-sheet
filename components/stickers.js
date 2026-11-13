// Stickers on the notebook's cover. A photo is printed once as a faded, matte
// sticker and kept in the app; where it sits is stored as a share of the cover,
// so it stays put at any screen size. The last one added is always on top.
import { getMeta, setMeta } from '../data/db.js';
import { loadImage } from './util.js';
import { toast } from './toast.js';
import { KEY, RECT, START_SIZE, MIN_SIZE, MAX_SIZE, COVER_TALL, BEND, INK, LOOK, clamp } from './sticker-sizes.js';
import { newSeed, print, recrease } from './sticker-print.js';
import { followFingers, cropSheet, cornersOf } from './sticker-crop.js';

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
      list.forEach((s) => {
        // Never creased: its picture is still the plain print.
        if (!s.creased && !s.plain) s.plain = s.image;
        if (s.plain && s.seed == null) s.seed = newSeed();
      });
      const stale = list.filter((s) => s.plain && s.look !== LOOK);
      if (stale.length) {
        await Promise.all(stale.map((s) => recrease(s).catch((e) => console.error(e))));
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
        const seed = newSeed();
        const { plain, image } = await print(img, cut, shape, ratio, seed);
        img.src = '';
        const s = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, shape, ratio, creased: true, look: LOOK, seed, x: 0.5, y: 0.5, size: START_SIZE, plain, image };
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
