// Screens and routing: the notebook (book.js) and the editor.
// Routes: #/  #/book  #/contents  #/edit/<project id>
import { saveProject, listTemplates, saveTemplate, saveTemplates, deleteTemplate, getMeta, setMeta } from './db.js';
import { starterTemplates, blankLayout, layoutFromTemplate, changeRatio, RATIOS, RATIO_ORDER, MORE_RATIOS, SLIDE_W, pageWord } from './model.js';
import { mountEditor } from './editor.js';
import { mountBook, modeOfHash, startsOnFirstPage } from './book.js';
import { openSheet, choiceSheet, confirmSheet, promptSheet, closeAllSheets } from './ui.js';
import { ICONS } from './icons.js';
import { esc, shortDate } from './util.js';
import './lines.js';

const view = document.getElementById('view');
let destroyCurrent = null;
let book = null;
let routeToken = 0;

// The starter set goes in once. Deleting a starter keeps it deleted.
async function seedStarters() {
  if (await getMeta('startersSeeded')) return;
  await saveTemplates(starterTemplates());
  await setMeta('startersSeeded', true);
}

// ---------- Making chapters ----------

const sizeOption = (r) => ({ key: r, label: RATIOS[r].label, detail: `${RATIOS[r].size}. ${RATIOS[r].detail}` });
const dateName = () => `Chapter ${shortDate(new Date().toISOString())}`;

async function createProject(layout, name) {
  const p = await saveProject({ name: name || dateName(), photoIds: [], thumb: null, ...layout });
  location.hash = `#/edit/${p.id}`;
}

// New chapter: name it, pick the size, then a template drawn in that size. Resolves
// true once a chapter is made, false if it was cancelled.
async function newChapter() {
  await seedStarters();
  // Left blank, the chapter is named after today.
  const name = await promptSheet({ title: 'New chapter', label: 'Chapter name', placeholder: dateName(), confirmLabel: 'Next', allowEmpty: true });
  if (name === null) return false;
  const ratio = await choiceSheet({
    title: 'New chapter',
    options: [...RATIO_ORDER.map(sizeOption), { heading: 'Other sizes' }, ...MORE_RATIOS.map(sizeOption)],
  });
  return ratio ? chooseTemplate(ratio, name) : false;
}

// Any template fits any size: frames keep their place relative to the slide.
const inRatio = (t, ratio) => (t.ratio === ratio ? t : changeRatio(t, ratio));

function chooseTemplate(ratio, name) {
  return new Promise((resolve) => {
    let made = false;
    const s = openSheet({ title: 'Templates', className: 'sheet-templates', onClose: () => resolve(made) });
    let list = [];
    async function draw() {
      // "Story full bleed" is one full frame, the same as Blank. "Full bleed"
      // was retired, but devices that already have it still store it.
      list = (await listTemplates()).filter((t) => t.starterKey !== 'story' && t.starterKey !== 'full-bleed');
      const blank = { ...blankLayout(ratio), name: 'Blank' };
      const card = (t, id) => {
        const shaped = inRatio(t, ratio);
        return `
          <div class="tpl-card">
            <button type="button" class="tpl-open" data-use="${esc(id)}" aria-label="Start from ${esc(t.name)}">
              <span class="tpl-art">${layoutSvg(shaped)}</span>
              <span class="row-main">
                <span class="row-name">${esc(t.name)}</span>
                <span class="row-meta">${shaped.slides} ${esc(pageWord(shaped, shaped.slides !== 1))}</span>
              </span>
            </button>
            ${id ? `<button type="button" class="mini-btn" data-tmore="${esc(id)}" aria-label="More for ${esc(t.name)}">${ICONS.more}</button>` : ''}
          </div>`;
      };
      s.body.innerHTML = `<div class="card-list">${card(blank, '')}${list.map((t) => card(t, t.id)).join('')}</div>`;
    }
    draw();
    s.body.addEventListener('click', (e) => {
      const more = e.target.closest('[data-tmore]');
      if (more) {
        templateMenu(more.dataset.tmore, draw);
        return;
      }
      const b = e.target.closest('[data-use]');
      if (!b) return;
      const t = list.find((x) => x.id === b.dataset.use);
      made = true;
      s.close();
      createProject(t ? layoutFromTemplate(inRatio(t, ratio)) : blankLayout(ratio), name);
    });
  });
}

// ---------- Template pictures ----------

// What a template will look like: each frame holds its own little picture
// (a panorama's one range of hills runs across the seam), on the slides'
// background, so borders and seams read at a glance.
const HILLS = ['M0 100V64L24 36L44 58L70 24L100 62V100Z', 'M0 100V56L30 26L54 60L78 40L100 66V100Z'];

function layoutSvg(t) {
  const W = SLIDE_W;
  const H = RATIOS[t.ratio].h;
  const n = t.slides;
  let s = '';
  for (let i = 0; i < n; i++) s += `<rect x="${i * W}" y="0" width="${W}" height="${H}" fill="${esc(t.background)}"/>`;
  t.frames.forEach((f, i) => {
    s += `<svg x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" class="lay-sky"/><path d="${HILLS[i % 2]}" class="lay-land"/></svg>`;
  });
  for (let i = 1; i < n; i++) s += `<line x1="${i * W}" y1="0" x2="${i * W}" y2="${H}" class="lay-seam"/>`;
  s += `<rect x="0" y="0" width="${n * W}" height="${H}" class="lay-edge"/>`;
  return `<svg class="tpl-svg" viewBox="0 0 ${n * W} ${H}" preserveAspectRatio="xMinYMid meet" aria-hidden="true">${s}</svg>`;
}

// ---------- Templates ----------

async function templateMenu(id, redraw) {
  const list = await listTemplates();
  const i = list.findIndex((t) => t.id === id);
  const t = list[i];
  if (!t) return;
  const key = await choiceSheet({
    title: t.name,
    options: [
      { key: 'rename', label: 'Rename' },
      { key: 'duplicate', label: 'Duplicate' },
      ...(i > 0 ? [{ key: 'up', label: 'Move up' }] : []),
      ...(i < list.length - 1 ? [{ key: 'down', label: 'Move down' }] : []),
      { key: 'delete', label: 'Delete', danger: true },
    ],
  });
  if (!key) return;
  if (key === 'rename') {
    const v = await promptSheet({ title: 'Rename template', value: t.name });
    if (v && v !== t.name) await saveTemplate({ ...t, name: v });
  } else if (key === 'duplicate') {
    const copy = { ...t, id: undefined, createdAt: undefined, name: `${t.name} copy`, starter: false };
    delete copy.starterKey;
    list.splice(i + 1, 0, copy);
    await saveTemplates(list.map((x, n) => ({ ...x, sortOrder: n })));
  } else if (key === 'up' || key === 'down') {
    const j = key === 'up' ? i - 1 : i + 1;
    [list[i], list[j]] = [list[j], list[i]];
    await saveTemplates(list.map((x, n) => ({ ...x, sortOrder: n })));
  } else if (key === 'delete') {
    const ok = await confirmSheet({
      title: 'Delete template?',
      message: `<b>${esc(t.name)}</b> will be removed. Drafts made from it stay as they are.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteTemplate(t.id);
  }
  await redraw();
}

// ---------- Routing ----------

async function route() {
  const token = ++routeToken;
  if (destroyCurrent) {
    destroyCurrent();
    destroyCurrent = null;
  }
  closeAllSheets();
  const h = (location.hash || '#/').slice(1) || '/';
  const m = h.match(/^\/edit\/(.+)$/);
  try {
    if (m) {
      if (book) book.destroy();
      book = null;
      view.dataset.route = 'edit';
      const destroy = await mountEditor(view, decodeURIComponent(m[1]));
      if (token !== routeToken) destroy();
      else destroyCurrent = destroy;
    } else {
      view.dataset.route = 'book';
      if (book) book.setMode(modeOfHash(h));
      else book = mountBook(view, modeOfHash(h), newChapter);
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><p class="empty-title">Something went wrong</p><p>${esc(e.message || 'Try reloading the page.')}</p></div>`;
  }
  if (!m) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
// Set in Options: open on the Table of contents instead of the shut notebook.
if (startsOnFirstPage() && (location.hash || '#/') === '#/') history.replaceState(null, '', '#/contents');
route();

// Always upright, quietly. The manifest asks for it once the app is
// installed; where a browser allows a lock, this holds it. iPhone home-screen
// apps honour neither, and nothing is shown about it.
try {
  const o = screen.orientation;
  if (o && o.lock) o.lock('portrait').catch(() => {});
} catch {}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
