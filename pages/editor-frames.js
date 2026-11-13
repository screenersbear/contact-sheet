// What a frame can do: take a photo, fit it, swap, lose its photo, go.
import { pageWord } from '../data/formats.js';
import { newFrame, defaultCrop } from '../data/templates.js';
import { clampedCrop, rotatedCrop } from '../components/placement.js';
import { anchorSlide, removeSlide } from '../data/slides.js';
import { slideBox } from '../data/slide-layouts.js';
import { choiceSheet } from '../components/dialogs.js';
import { clamp } from '../components/util.js';

export function addFrameActions(ed) {
  Object.assign(ed, { select, deselect, putPhoto, emptyFrames, addFrame, rotateSel, fitSel, takeOut, deleteSlide, deleteSel, frameMore });
  // ---------- Frame actions ----------
  function select(fid) {
    if (ed.sel !== fid) ed.photoMode = false;
    ed.sel = fid;
    ed.placeSel();
    ed.renderTools();
    ed.renderAdjust();
  }

  function deselect() {
    if (!ed.sel && !ed.photoMode) return;
    ed.sel = null;
    ed.photoMode = false;
    ed.placeSel();
    ed.renderTools();
    ed.renderAdjust();
  }

  function putPhoto(f, pid) {
    f.photoId = pid;
    f.crop = defaultCrop();
    if (!ed.p.photoIds.includes(pid)) ed.p.photoIds.push(pid);
  }

  // Empty frames in reading order: slide by slide, top to bottom.
  function emptyFrames() {
    return ed.p.frames
      .filter((f) => !f.photoId)
      .sort((a, b) => anchorSlide(a, ed.p.slides) - anchorSlide(b, ed.p.slides) || a.y - b.y || a.x - b.x);
  }

  function addFrame() {
    const k = ed.visibleSlide();
    const b = slideBox(ed.p, k);
    const onIt = ed.p.frames.some((f) => anchorSlide(f, ed.p.slides) === k);
    const f = onIt
      ? newFrame(Math.round(b.x + b.w / 4), Math.round(b.y + b.h / 4), Math.round(b.w / 2), Math.round(b.h / 2))
      : newFrame(b.x, b.y, b.w, b.h);
    ed.p.frames.push(f);
    ed.sel = f.id;
    ed.photoMode = false;
    ed.render();
    ed.commit();
  }

  function rotateSel() {
    const f = ed.selFrame();
    if (!f || !f.photoId) return;
    f.crop = rotatedCrop(f.crop);
    f.crop = clampedCrop(f, ed.photos[f.photoId]);
    ed.placeFrame(f);
    ed.commit();
  }

  // The frame takes the photo's shape, so all of the photo shows.
  function fitSel() {
    const f = ed.selFrame();
    if (!f || !f.photoId) return;
    const ph = ed.photos[f.photoId];
    const turned = (f.crop.rot || 0) % 180 !== 0;
    const ar = turned ? ph.height / ph.width : ph.width / ph.height;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    let w = f.w;
    let h = w / ar;
    if (h > ed.H()) {
      h = f.h;
      w = h * ar;
    }
    f.w = Math.round(w);
    f.h = Math.round(h);
    f.x = Math.round(cx - f.w / 2);
    f.y = Math.round(clamp(cy - f.h / 2, Math.min(0, ed.H() - f.h), Math.max(0, ed.H() - f.h)));
    f.crop = { ...defaultCrop(), rot: f.crop.rot || 0 };
    ed.render();
    ed.commit();
  }

  // The x on a selected photo: the frame stays, the photo goes back to the tray.
  function takeOut() {
    const f = ed.selFrame();
    if (!f || !f.photoId) return;
    f.photoId = null;
    f.crop = defaultCrop();
    ed.photoMode = false;
    ed.render();
    ed.commit();
  }

  function deleteSlide(k) {
    if (ed.p.slides <= 1) return;
    ed.apply(removeSlide(ed.p, k));
    if (ed.sel && !ed.frameById(ed.sel)) {
      ed.sel = null;
      ed.photoMode = false;
    }
    ed.fitIfNeeded();
    ed.render();
    ed.commit();
  }

  function deleteSel() {
    if (!ed.sel) return;
    ed.p.frames = ed.p.frames.filter((f) => f.id !== ed.sel);
    ed.sel = null;
    ed.photoMode = false;
    ed.render();
    ed.commit();
  }

  async function frameMore() {
    const f = ed.selFrame();
    if (!f) return;
    const idx = ed.p.frames.indexOf(f);
    const key = await choiceSheet({
      title: 'Box',
      options: [
        { key: 'fill', label: `Fill the ${pageWord(ed.p)}`, detail: 'Cover the slide, inside its border.' },
        { key: 'front', label: 'Bring to front', detail: 'Over the boxes it overlaps.' },
        { key: 'back', label: 'Send to back', detail: 'Under the boxes it overlaps.' },
        ...(f.photoId ? [{ key: 'empty', label: 'Empty this box', detail: 'The photo stays in the tray.' }] : []),
      ].filter((o) => !(o.key === 'front' && idx === ed.p.frames.length - 1) && !(o.key === 'back' && idx === 0)),
    });
    if (!key || !ed.frameById(f.id)) return;
    if (key === 'fill') {
      Object.assign(f, slideBox(ed.p, anchorSlide(f, ed.p.slides)));
      if (f.photoId) f.crop = clampedCrop(f, ed.photos[f.photoId]);
    } else if (key === 'front') {
      ed.p.frames.splice(idx, 1);
      ed.p.frames.push(f);
    } else if (key === 'back') {
      ed.p.frames.splice(idx, 1);
      ed.p.frames.unshift(f);
    } else if (key === 'empty') {
      f.photoId = null;
      f.crop = defaultCrop();
      ed.photoMode = false;
    }
    ed.render();
    ed.commit();
  }
}
