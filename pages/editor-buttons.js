// The editor's buttons: what each one does when it's tapped.
import { clampedCrop } from '../components/placement.js';
import { openExport } from './export.js';

export function addButtons(ed) {
  // ---------- Buttons ----------
  // view and document outlive this editor, so their listeners come off
  // with it (one signal for all of them).
  const off = new AbortController(); ed.off = off;
  ed.view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      const a = b.dataset.act;
      if (a === 'back') ed.leave();
      else if (a === 'undo') ed.undo();
      else if (a === 'redo') ed.redo();
      else if (a === 'more') ed.topMore();
      else if (a === 'rename') ed.rename();
      else if (a === 'export') {
        ed.commitSoon.flush();
        ed.saveSoon.flush();
        openExport(ed.p, ed.photos);
      } else if (a === 'add-frame') ed.addFrame();
      else if (a === 'add-slide') ed.addSlide();
      else if (a === 'slides') ed.openSlides();
      else if (a === 'layout') ed.layoutThisSlide();
      else if (a === 'adjust') {
        ed.photoMode = !ed.photoMode;
        ed.placeSel();
        ed.renderTools();
        ed.renderAdjust();
      } else if (a === 'adjust-done') {
        ed.photoMode = false;
        ed.placeSel();
        ed.renderTools();
        ed.renderAdjust();
      } else if (a === 'rotate') ed.rotateSel();
      else if (a === 'swap') ed.openSwap(ed.sel);
      else if (a === 'fit') ed.fitSel();
      else if (a === 'frame-more') ed.frameMore();
      else if (a === 'delete') ed.deleteSel();
      else if (a === 'add-photos') ed.addPhotos();
      else if (a === 'take-out') ed.takeOut();
      else if (a === 'del-slide') ed.deleteSlide(Number(b.dataset.k));
      return;
    }
    const t = e.target.closest('.tray-item');
    if (t && !ed.trayDrag.suppressClick) ed.trayTap(t.dataset.pid);
  }, { signal: off.signal });

  ed.zoomInput.addEventListener('input', () => {
    const f = ed.selFrame();
    if (!f || !f.photoId) return;
    f.crop = { ...f.crop, zoom: Number(ed.zoomInput.value) };
    f.crop = clampedCrop(f, ed.photos[f.photoId]);
    ed.placeFrame(f);
  });
  ed.zoomInput.addEventListener('change', ed.commit);
}
