// The Table of contents: a row for every chapter, on one page that scrolls,
// with the tip at the end.
import { listProjects } from '../data/db.js';
import { ICONS } from '../components/icons.js';
import { esc, shortDate, isIOS, isStandalone } from '../components/util.js';
import { pageWord } from '../data/formats.js';
import { TIP_KEY, TIP } from './book-sizes.js';

export function addContents(ed) {
  Object.assign(ed, { drawPages, releaseThumbs, drawToc });
  function rowHtml(p) {
    const u = ed.thumbs.get(p.id);
    return `
      <div class="toc-row">
        <a class="toc-open" href="#/edit/${esc(p.id)}" draggable="false">
          <span class="toc-thumb">${u ? `<img src="${u}" alt="" draggable="false" />` : ''}</span>
          <span class="toc-text">
            <span class="toc-name">${esc(p.name)}</span>
            <span class="toc-meta">${p.slides} ${esc(pageWord(p, p.slides !== 1))} · ${esc(shortDate(p.updatedAt))}</span>
          </span>
        </a>
      </div>`;
  }

  // Every chapter on one page that scrolls; the tip at the end.
  function pageHtml() {
    const rows = ed.chapters.map(rowHtml).join('');
    return `
      <h2 class="nb-head has-plus${window.DF_SUITE ? ' has-menu' : ''}">${window.DF_SUITE ? `<button type="button" class="toc-menu" data-app-menu aria-label="Menu">${ICONS.menu}</button>` : ''}Table of contents<button type="button" class="toc-plus" data-toc="new" aria-label="New chapter">${ICONS.plus}</button></h2>
      <div class="toc-list">${rows || '<p class="toc-empty">No chapters yet.</p>'}</div>
      ${ed.showTip ? TIP : ''}`;
  }

  function drawPages() {
    ed.leftEl.innerHTML = pageHtml();
  }

  function releaseThumbs() {
    ed.thumbs.forEach((u) => URL.revokeObjectURL(u));
    ed.thumbs = new Map();
  }

  async function drawToc() {
    const projects = await listProjects();
    if (ed.destroyed) return;
    releaseThumbs();
    ed.chapters = projects;
    ed.chapters.forEach((p) => p.thumb && ed.thumbs.set(p.id, URL.createObjectURL(p.thumb)));
    ed.showTip = (() => {
      if (!isIOS() || isStandalone()) return false;
      try {
        return localStorage.getItem(TIP_KEY) !== 'off';
      } catch {
        return true;
      }
    })();
    drawPages();
  }
}
