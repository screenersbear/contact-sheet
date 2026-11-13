// A new frame, a blank layout, and the starter templates.
import { uuid } from '../components/util.js';
import { SLIDE_W, RATIOS, DEFAULT_RATIO, DEFAULT_BG, LAYOUT_KEYS } from './formats.js';

export const defaultCrop = () => ({ zoom: 1, cx: 0.5, cy: 0.5, rot: 0 });

export function newFrame(x, y, w, h, photoId = null) {
  return { id: uuid(), x, y, w, h, photoId, crop: defaultCrop() };
}

export function blankLayout(ratio = DEFAULT_RATIO) {
  const h = RATIOS[ratio].h;
  return {
    ratio,
    slides: 1,
    background: DEFAULT_BG,
    padding: 0,
    seamsOpen: false,
    borderWidth: 0,
    borderColor: '#ffffff',
    frames: [newFrame(0, 0, SLIDE_W, h)],
  };
}

// A template's layout as a fresh project: same frames, all empty.
export function layoutFromTemplate(t) {
  const out = {};
  LAYOUT_KEYS.forEach((k) => (out[k] = t[k]));
  out.frames = (t.frames || []).map((f) => newFrame(f.x, f.y, f.w, f.h));
  return out;
}

// A project's layout as a template: frames keep their place, never their photos.
export function templateFromProject(p) {
  const out = {};
  LAYOUT_KEYS.forEach((k) => (out[k] = p[k]));
  out.frames = p.frames.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
  return out;
}

// The starter set. Clearly labelled, and deletable like any other template.
export function starterTemplates() {
  const W = SLIDE_W;
  const H = 1440;
  const full = (i, h = H) => ({ x: i * W, y: 0, w: W, h });
  const base = { background: DEFAULT_BG, padding: 0, seamsOpen: false, borderWidth: 0, borderColor: '#ffffff', starter: true };
  const B = 60;
  return [
    {
      ...base,
      starterKey: 'white-border',
      name: 'White border',
      ratio: '3:4',
      slides: 3,
      padding: B,
      frames: [0, 1, 2].map((i) => ({ x: i * W + B, y: B, w: W - 2 * B, h: H - 2 * B })),
    },
    { ...base, starterKey: 'panorama', name: 'Two-slide panorama', ratio: '3:4', slides: 2, frames: [{ x: 0, y: 0, w: 2 * W, h: H }] },
    {
      ...base,
      starterKey: 'panorama-singles',
      name: 'Panorama plus singles',
      ratio: '3:4',
      slides: 4,
      frames: [{ x: 0, y: 0, w: 2 * W, h: H }, full(2), full(3)],
    },
    { ...base, starterKey: 'story', name: 'Story full bleed', ratio: '9:16', slides: 1, frames: [full(0, 1920)] },
  ].map((t, i) => ({ ...t, sortOrder: i }));
}
