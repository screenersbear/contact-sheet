// The editor's keys on a keyboard.
import { placement, clampedCrop } from '../components/placement.js';
import { sheetIsOpen } from '../components/sheet.js';

export function addKeys(ed) {
  // ---------- Keys ----------
  function onKey(e) {
    if (sheetIsOpen() || ed.destroyed) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) ed.redo();
      else ed.undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      ed.redo();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && ed.sel) {
      e.preventDefault();
      ed.deleteSel();
    } else if (e.key === 'Escape') {
      ed.deselect();
    } else if (!ed.sel && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      ed.turnPage(e.key === 'ArrowRight' ? 1 : -1);
    } else if (ed.sel && e.key.startsWith('Arrow')) {
      // Arrows nudge the photo inside its frame; frames stay put.
      e.preventDefault();
      const f = ed.selFrame();
      if (!f.photoId) return;
      const n = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0;
      const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      const ph = ed.photos[f.photoId];
      const pl = placement(f, ph);
      f.crop = { ...f.crop, cx: pl.cx - dx / (pl.s * pl.rw), cy: pl.cy - dy / (pl.s * pl.rh) };
      f.crop = clampedCrop(f, ph);
      ed.placeFrame(f);
      ed.commitSoon();
    }
  }
  document.addEventListener('keydown', onKey, { signal: ed.off.signal });
}
