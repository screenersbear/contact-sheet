// The editor's tools row and the photo tray under the pages.
import { pageTitle } from '../data/formats.js';
import { ICONS } from '../components/icons.js';
import { esc } from '../components/util.js';

export function addTools(ed) {
  Object.assign(ed, { renderTools, renderAdjust, usedIds, renderTray });
  // ---------- Tools ----------
  const tool = (act, icon, label, { disabled = false, on = false } = {}) =>
    `<button type="button" class="tool${on ? ' is-on' : ''}" data-act="${act}"${disabled ? ' disabled' : ''}><span class="tool-icon">${icon}</span><span class="tool-label">${esc(label)}</span></button>`;

  const smallTool = (act, icon, label, disabled) =>
    `<button type="button" class="tool tool-sm" data-act="${act}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}><span class="tool-icon">${icon}</span></button>`;

  function renderTools() {
    const f = ed.selFrame();
    const history = [smallTool('undo', ICONS.undo, 'Undo', ed.hi === 0), smallTool('redo', ICONS.redo, 'Redo', ed.hi >= ed.hist.length - 1)];
    if (f) {
      const has = !!f.photoId;
      ed.toolsEl.innerHTML = [
        ...history,
        tool('adjust', ICONS.adjust, 'Adjust', { disabled: !has, on: ed.photoMode }),
        tool('rotate', ICONS.rotate, 'Rotate', { disabled: !has }),
        tool('swap', has ? ICONS.swap : ICONS.photo, has ? 'Swap' : 'Photo'),
        tool('fit', ICONS.fit, 'Fit', { disabled: !has }),
        tool('frame-more', ICONS.more, 'More'),
        tool('delete', ICONS.trash, 'Delete'),
      ].join('');
      return;
    }
    ed.toolsEl.innerHTML = [
      smallTool('back', ICONS.back, 'Back to the notebook'),
      ...history,
      tool('add-frame', ICONS.addFrame, 'Frame'),
      tool('slides', ICONS.slides, pageTitle(ed.p, true)),
      tool('layout', ICONS.layout, 'Layout'),
      tool('more', ICONS.more, 'More'),
      tool('export', ICONS.export, 'Export'),
    ].join('');
  }

  function renderAdjust() {
    const f = ed.selFrame();
    const on = !!(ed.photoMode && f && f.photoId);
    ed.adjustEl.hidden = !on;
    if (on) ed.zoomInput.value = String(f.crop.zoom || 1);
  }

  // ---------- Tray ----------
  function usedIds() {
    return new Set(ed.p.frames.map((f) => f.photoId).filter(Boolean));
  }

  function renderTray() {
    const used = usedIds();
    const items = ed.p.photoIds
      .filter((pid) => ed.photos[pid])
      .map(
        (pid) => `<button type="button" class="tray-item${used.has(pid) ? ' is-used' : ''}" data-pid="${pid}" aria-label="${used.has(pid) ? 'Photo in use' : 'Photo'}">
          <img src="${ed.thumbOf(pid)}" alt="" draggable="false" />${ed.photos[pid].kind === 'video' ? `<span class="tray-vid">${ICONS.play}</span>` : ''}${used.has(pid) ? `<span class="tray-used">${ICONS.check}</span>` : ''}</button>`
      )
      .join('');
    const was = ed.trayEl.querySelector('[data-tray-list]');
    const keep = was ? was.scrollLeft : 0;
    ed.trayEl.innerHTML = `
      <button type="button" class="tray-add" data-act="add-photos">${ICONS.plus}<span>Photos</span></button>
      <div class="tray-list" data-tray-list>${items || '<p class="tray-hint">Add photos and videos from your camera roll. They fill empty frames in order.</p>'}</div>`;
    // A redraw must not throw the row back to its first photos.
    ed.trayEl.querySelector('[data-tray-list]').scrollLeft = keep;
  }
}
