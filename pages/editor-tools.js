// The editor's tools row and the photo tray under the pages.
import { pageTitle } from '../data/formats.js';
import { ICONS } from '../components/icons.js';
import { esc } from '../components/util.js';

export function addTools(ed) {
  Object.assign(ed, { renderTools, renderAdjust, usedIds, renderTray });
  // ---------- Tools ----------
  // Every tool has its name under it (round 2, 04 and 05); Export is in the
  // notebook's colour, Delete in crimson.
  const tool = (act, icon, label, { disabled = false, on = false, tone = '', name = '' } = {}) =>
    `<button type="button" class="tool${on ? ' is-on' : ''}${tone ? ` is-${tone}` : ''}" data-act="${act}"${name ? ` aria-label="${esc(name)}"` : ''}${disabled ? ' disabled' : ''}><span class="tool-icon">${icon}</span><span class="tool-label">${esc(label)}</span></button>`;

  function renderTools() {
    const f = ed.selFrame();
    const history = [tool('undo', ICONS.undo, 'Undo', { disabled: ed.hi === 0 }), tool('redo', ICONS.redo, 'Redo', { disabled: ed.hi >= ed.hist.length - 1 })];
    if (f) {
      const has = !!f.photoId;
      ed.toolsEl.innerHTML = [
        ...history,
        tool('adjust', ICONS.adjust, 'Adjust', { disabled: !has, on: ed.photoMode }),
        tool('rotate', ICONS.rotate, 'Rotate', { disabled: !has }),
        tool('swap', has ? ICONS.swap : ICONS.photo, has ? 'Swap' : 'Photo'),
        tool('fit', ICONS.fit, 'Fit', { disabled: !has }),
        tool('frame-more', ICONS.more, 'More'),
        tool('delete', ICONS.trash, 'Delete', { tone: 'danger' }),
      ].join('');
      return;
    }
    ed.toolsEl.innerHTML = [
      tool('back', ICONS.back, 'Back', { name: 'Back to all layouts' }),
      ...history,
      tool('add-frame', ICONS.addFrame, 'Box'),
      tool('slides', ICONS.slides, pageTitle(ed.p, true)),
      tool('layout', ICONS.layout, 'Grid'),
      tool('more', ICONS.more, 'More'),
      tool('export', ICONS.export, 'Export', { tone: 'accent' }),
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
          <img src="${ed.thumbOf(pid)}" alt="" draggable="false" />${ed.photos[pid].kind === 'video' ? '<span class="tray-vid"></span>' : ''}${used.has(pid) ? `<span class="tray-used">${ICONS.check}</span>` : ''}</button>`
      )
      .join('');
    const was = ed.trayEl.querySelector('[data-tray-list]');
    const keep = was ? was.scrollLeft : 0;
    ed.trayEl.innerHTML = `
      <button type="button" class="tray-add" data-act="add-photos">${ICONS.plus}<span>Photos</span></button>
      <div class="tray-list" data-tray-list>${items || '<p class="tray-hint">Add photos and videos from your camera roll. They fill empty boxes in order.</p>'}</div>`;
    // A redraw must not throw the row back to its first photos.
    ed.trayEl.querySelector('[data-tray-list]').scrollLeft = keep;
  }
}
