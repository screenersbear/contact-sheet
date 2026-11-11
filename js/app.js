// Screens and routing: Drafts (home) and the editor.
// Routes: #/  #/edit/<project id>
import {
  listProjects, saveProject, deleteProject, duplicateProject,
  listTemplates, saveTemplate, saveTemplates, deleteTemplate, getMeta, setMeta,
} from './db.js';
import { starterTemplates, blankLayout, layoutFromTemplate, changeRatio, RATIOS, RATIO_ORDER, SLIDE_W, pageWord, isStory } from './model.js';
import { mountEditor } from './editor.js';
import { openSheet, choiceSheet, confirmSheet, promptSheet, toast, closeAllSheets } from './ui.js';
import { ICONS } from './icons.js';
import { esc, shortDate, isIOS, isStandalone } from './util.js';

const view = document.getElementById('view');
const TIP_KEY = 'contact-sheet-home-tip';
let destroyCurrent = null;
let routeToken = 0;
let urls = [];

function releaseUrls() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}

// The starter set goes in once. Deleting a starter keeps it deleted.
async function seedStarters() {
  if (await getMeta('startersSeeded')) return;
  await saveTemplates(starterTemplates());
  await setMeta('startersSeeded', true);
}

const formatLine = (p) => `${p.ratio} · ${p.slides} ${pageWord(p, p.slides !== 1)}`;

// ---------- Making drafts ----------

async function createProject(layout) {
  const word = isStory(layout) ? 'Story' : 'Post';
  const p = await saveProject({ name: `${word} ${shortDate(new Date().toISOString())}`, photoIds: [], thumb: null, ...layout });
  location.hash = `#/edit/${p.id}`;
}

// New post: pick the size, then a template drawn in that size.
async function newPost() {
  const ratio = await choiceSheet({
    title: 'New post',
    options: RATIO_ORDER.map((r) => ({ key: r, label: RATIOS[r].label, detail: `${RATIOS[r].size}. ${RATIOS[r].detail}` })),
  });
  if (ratio) await chooseTemplate(ratio);
}

// Any template fits any size: frames keep their place relative to the slide.
const inRatio = (t, ratio) => (t.ratio === ratio ? t : changeRatio(t, ratio));

async function chooseTemplate(ratio) {
  await seedStarters();
  const s = openSheet({ title: 'Templates', className: 'sheet-templates' });
  let list = [];
  async function draw() {
    // "Story full bleed" is one full frame, the same as Blank.
    list = (await listTemplates()).filter((t) => t.starterKey !== 'story');
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
  await draw();
  s.body.addEventListener('click', (e) => {
    const more = e.target.closest('[data-tmore]');
    if (more) {
      templateMenu(more.dataset.tmore, draw);
      return;
    }
    const b = e.target.closest('[data-use]');
    if (!b) return;
    const t = list.find((x) => x.id === b.dataset.use);
    s.close();
    createProject(t ? layoutFromTemplate(inRatio(t, ratio)) : blankLayout(ratio));
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

// ---------- Drafts ----------

async function renderHome(token) {
  const [projects] = await Promise.all([listProjects(), seedStarters()]);
  if (token !== routeToken) return;
  releaseUrls();
  const showTip = (() => {
    if (!isIOS() || isStandalone()) return false;
    try {
      return localStorage.getItem(TIP_KEY) !== 'off';
    } catch {
      return true;
    }
  })();
  const cards = projects
    .map((p) => {
      let thumb = '';
      if (p.thumb) {
        const u = URL.createObjectURL(p.thumb);
        urls.push(u);
        thumb = `<img src="${u}" alt="" />`;
      }
      return `
        <div class="draft-card">
          <a class="draft-open" href="#/edit/${esc(p.id)}">
            <span class="draft-thumb">${thumb || `<span class="draft-thumb-empty">${ICONS.slides}</span>`}</span>
            <span class="row-main">
              <span class="row-name">${esc(p.name)}</span>
              <span class="row-meta">${esc(formatLine(p))}</span>
              <span class="row-meta">Edited ${esc(shortDate(p.updatedAt))}</span>
            </span>
          </a>
          <button type="button" class="mini-btn" data-more="${esc(p.id)}" aria-label="More for ${esc(p.name)}">${ICONS.more}</button>
        </div>`;
    })
    .join('');
  view.innerHTML = `
    <section class="hero-band">
      <div class="brand-row">
        <div class="brand-logo-wrap"><img class="brand-logo" src="icons/icon.svg" alt="" /></div>
        <h1 class="brand-title">Contact Sheet</h1>
      </div>
      <button type="button" class="hero-cta shine-sweep" data-act="new">+ New post</button>
    </section>
    ${showTip ? `
      <div class="tip-card">
        <p><b>Keep your drafts safe.</b> Add Contact Sheet to your Home Screen: tap Share, then Add to Home Screen. Safari can clear the photos of sites that aren't on it.</p>
        <button type="button" class="text-btn" data-act="tip-off">Got it</button>
      </div>` : ''}
    <section class="section-block">
      <h2 class="heading-yellow static">Drafts</h2>
      ${projects.length ? `<div class="card-list">${cards}</div>` : `
        <div class="empty">
          <p class="empty-title">No drafts yet</p>
          <p>Start a post, add your photos, and line them up across the slides.</p>
          <button type="button" class="modal-cta primary" data-act="new">Start a new post</button>
        </div>`}
    </section>`;
  fitBrandTitle();
}

// The logo and title fill the header's width. Measured rather than set in
// CSS, since phones without Arial Black fall back to a narrower Helvetica.
// Everything in the row is in em, so it all scales with one font size.
function fitBrandTitle() {
  const row = view.querySelector('.brand-row');
  const t = row?.querySelector('.brand-title');
  if (!t) return;
  row.style.fontSize = '100px';
  const text = document.createRange();
  text.selectNodeContents(t);
  const natural = text.getBoundingClientRect().right - row.getBoundingClientRect().left;
  const size = (100 * row.clientWidth) / natural;
  row.style.fontSize = `${Math.min(64, Math.floor(size * 0.995 * 10) / 10)}px`;
}

async function draftMenu(id) {
  const projects = await listProjects();
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  const key = await choiceSheet({
    title: p.name,
    options: [
      { key: 'open', label: 'Open' },
      { key: 'rename', label: 'Rename' },
      { key: 'duplicate', label: 'Duplicate', detail: 'A copy with the same photos.' },
      { key: 'delete', label: 'Delete', danger: true },
    ],
  });
  if (key === 'open') location.hash = `#/edit/${p.id}`;
  else if (key === 'rename') {
    const v = await promptSheet({ title: 'Rename', value: p.name });
    if (v && v !== p.name) {
      await saveProject({ ...p, name: v });
      route();
    }
  } else if (key === 'duplicate') {
    await duplicateProject(p.id, `${p.name} copy`);
    toast('Duplicated');
    route();
  } else if (key === 'delete') {
    const ok = await confirmSheet({
      title: 'Delete draft?',
      message: `<b>${esc(p.name)}</b> and its photos will be deleted from this device. Photos in your camera roll stay where they are.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      await deleteProject(p.id);
      toast('Draft deleted');
      route();
    }
  }
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

// Drafts only; the editor handles its own taps.
view.addEventListener('click', (e) => {
  if (view.dataset.route === 'edit') return;
  const b = e.target.closest('[data-act], [data-more]');
  if (!b) return;
  if (b.dataset.act === 'new') newPost();
  else if (b.dataset.act === 'tip-off') {
    try {
      localStorage.setItem(TIP_KEY, 'off');
    } catch {}
    b.closest('.tip-card').remove();
  } else if (b.dataset.more) draftMenu(b.dataset.more);
});

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
      view.dataset.route = 'edit';
      releaseUrls();
      const destroy = await mountEditor(view, decodeURIComponent(m[1]));
      if (token !== routeToken) destroy();
      else destroyCurrent = destroy;
    } else {
      view.dataset.route = 'drafts';
      await renderHome(token);
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><p class="empty-title">Something went wrong</p><p>${esc(e.message || 'Try reloading the page.')}</p></div>`;
  }
  if (!m) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
window.addEventListener('resize', fitBrandTitle);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
