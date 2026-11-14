// The home page (round 2, 01-home): the band, a slip when posts have come
// from The Eye (posts-slip.js), then every layout newest first, each a strip
// of its first slides, its name, "N slides · date" and its ... menu; the tip
// at the end.
import { listProjects } from '../data/db.js';
import { makePostsFromEye } from '../data/from-eye.js';
import { slipsHtml, wireSlips } from './posts-slip.js';
import { openPosts } from './posts.js';
import { bandHtml, PLUS, MORE } from '../components/band.js';
import { esc, shortDate, isIOS, isStandalone } from '../components/util.js';
import { pageWord } from '../data/formats.js';
import { TIP_KEY, TIP } from './book-sizes.js';

export function addContents(ed) {
  Object.assign(ed, { drawPages, releaseThumbs, drawToc });
  ed.slips = '';
  ed.slipUrls = [];
  wireSlips(ed.leftEl, () => drawToc(), openPosts);
  function rowHtml(p) {
    const u = ed.thumbs.get(p.id);
    return `
      <div class="toc-row">
        <a class="toc-open" href="#/edit/${esc(p.id)}" draggable="false">
          <span class="toc-strip" aria-hidden="true">${u ? `<img src="${u}" alt="" draggable="false" />` : '<span class="toc-blank"></span>'}</span>
          <span class="toc-text">
            <span class="toc-name">${esc(p.name)}</span>
            <span class="toc-meta">${p.slides} ${esc(pageWord(p, p.slides !== 1))} · ${esc(shortDate(p.updatedAt))}</span>
          </span>
        </a>
        <button type="button" class="toc-more" data-layout-more="${esc(p.id)}" aria-label="More for ${esc(p.name)}">${MORE}</button>
      </div>`;
  }

  // Every layout on one page that scrolls; the tip at the end.
  function pageHtml() {
    const rows = ed.chapters.map(rowHtml).join('');
    return `
      ${bandHtml({ title: 'Layouts', place: 'All layouts' })}
      ${ed.slips}
      <div class="list-head"><h2>Newest first <span>${ed.chapters.length}</span></h2><button type="button" class="list-act" data-toc="new">${PLUS}New layout</button></div>
      <div class="list-rule"></div>
      <div class="toc-list">${rows || '<p class="toc-empty">No layouts yet.</p>'}</div>
      ${ed.showTip ? TIP : ''}`;
  }

  function drawPages() {
    ed.leftEl.innerHTML = pageHtml();
  }

  function releaseThumbs() {
    ed.thumbs.forEach((u) => URL.revokeObjectURL(u));
    ed.thumbs = new Map();
    ed.slipUrls.forEach((u) => URL.revokeObjectURL(u));
    ed.slipUrls = [];
  }

  // Finals waiting from The Eye are made into posts first (once), then drawn.
  let making = false;
  async function drawToc() {
    const [projects, urls] = [await listProjects(), []];
    const slips = await slipsHtml(urls).catch(() => '');
    if (ed.destroyed) { urls.forEach((u) => URL.revokeObjectURL(u)); return; }
    releaseThumbs();
    ed.slips = slips;
    ed.slipUrls = urls;
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
    if (!making) {
      making = true;
      makePostsFromEye().catch(() => 0).then((n) => { making = false; if (n && !ed.destroyed) drawToc(); });
    }
  }
}
