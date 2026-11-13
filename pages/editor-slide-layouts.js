// Layouts for one slide: the sheet of drawings to pick from, and putting
// the chosen one on the slide.
import { SLIDE_W, MAX_SLIDES, slideH, isStory, isPrint, pageWord } from '../data/formats.js';
import { insertSlide } from '../data/slides.js';
import { templateFromProject } from '../data/templates.js';
import { SLIDE_LAYOUTS, layoutRects, applySlideLayout, layoutOfSlide, framesWithinSlide } from '../data/slide-layouts.js';
import { deleteProject, listTemplates, saveTemplate } from '../data/db.js';
import { previewCanvas } from '../components/render.js';
import { openSheet } from '../components/sheet.js';
import { choiceSheet, promptSheet, confirmSheet } from '../components/dialogs.js';
import { esc } from '../components/util.js';
import { SAFE_KEY } from './editor-sizes.js';

export function addSlideLayouts(ed) {
  Object.assign(ed, { pickLayout, addSlideWith, addSlide, layoutThisSlide, topMore, rename, leave });
  // ---------- Layouts for one slide ----------

  // A drawing of what `layout` would make on slide k of q.
  function layoutSvg(q, k, layout) {
    const Hh = slideH(q);
    const rects = layoutRects(q, k, layout)
      .map((r) => `<rect x="${r.x - k * SLIDE_W}" y="${r.y}" width="${r.w}" height="${r.h}" class="lay-frame"/>`)
      .join('');
    return `<svg class="lay-svg" width="${Math.round((84 * SLIDE_W) / Hh)}" height="84" viewBox="0 0 ${SLIDE_W} ${Hh}" aria-hidden="true"><rect width="${SLIDE_W}" height="${Hh}" fill="${esc(q.background)}" class="lay-slide"/>${rects}<rect width="${SLIDE_W}" height="${Hh}" class="lay-edge"/></svg>`;
  }

  // Resolves with the chosen layout, or null. k is the slide to change, or
  // null for a new slide at the end.
  function pickLayout(k) {
    const isNew = k === null;
    const word = pageWord(ed.p);
    const q = isNew ? insertSlide(ed.p, ed.p.slides) : ed.p;
    const at = isNew ? ed.p.slides : k;
    const options = [];
    if (isNew && framesWithinSlide(ed.p, ed.p.slides - 1).length) options.push(layoutOfSlide(ed.p, ed.p.slides - 1));
    options.push(...SLIDE_LAYOUTS);
    const hasPhotos = !isNew && framesWithinSlide(ed.p, k).some((f) => f.photoId);
    return new Promise((resolve) => {
      let chosen = null;
      const s = openSheet({
        title: isNew ? `New ${word}` : `${word} ${k + 1} grid`,
        className: 'sheet-wide',
        body: `
          ${hasPhotos ? `<p class="sheet-message">Its photos move into the new boxes, in order.</p>` : ''}
          <div class="layout-grid">
            ${options.map((o, n) => `<button type="button" class="layout-opt" data-n="${n}">${layoutSvg(q, at, o)}<span>${esc(o.name)}</span></button>`).join('')}
          </div>
          <p class="field-hint">For space around and between the photos: the three dots at the top, then Background and borders.</p>`,
        onClose: () => resolve(chosen),
      });
      s.body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-n]');
        if (!b) return;
        chosen = options[Number(b.dataset.n)];
        s.close();
      });
    });
  }

  function addSlideWith(layout) {
    ed.apply(insertSlide(ed.p, ed.p.slides));
    ed.apply(applySlideLayout(ed.p, ed.p.slides - 1, layout));
  }

  async function addSlide() {
    if (ed.p.slides >= MAX_SLIDES) return;
    const layout = await pickLayout(null);
    if (!layout || ed.destroyed || ed.p.slides >= MAX_SLIDES) return;
    addSlideWith(layout);
    ed.sel = null;
    ed.photoMode = false;
    ed.fitIfNeeded();
    ed.render();
    ed.showSlide(ed.p.slides - 1);
    ed.commit();
  }

  // The Grid button: a new grid of boxes for the slide on screen.
  async function layoutThisSlide() {
    const k = ed.visibleSlide();
    const l = await pickLayout(k);
    if (!l || ed.destroyed) return;
    ed.apply(applySlideLayout(ed.p, k, l));
    if (ed.sel && !ed.frameById(ed.sel)) {
      ed.sel = null;
      ed.photoMode = false;
    }
    ed.render();
    ed.commit();
  }

  function openBorders() {
    const colorChips = (name, value, options) => `
      <div class="swatches" role="radiogroup">
        ${options.map(([v, label]) => `<label class="swatch"><input type="radio" name="${name}" value="${v}"${value.toLowerCase() === v ? ' checked' : ''} /><span><i style="background:${v}"></i>${label}</span></label>`).join('')}
        <label class="swatch swatch-custom"><input type="radio" name="${name}" value="custom"${options.some(([v]) => v === value.toLowerCase()) ? '' : ' checked'} /><span><input type="color" value="${esc(value)}" data-color="${name}" aria-label="Custom color" />Custom</span></label>
      </div>`;
    const s = openSheet({
      title: 'Background and borders',
      body: `
        <div class="form">
          <div class="field">
            <span class="field-label">Background</span>
            ${colorChips('bg', ed.p.background, [['#ffffff', 'White'], ['#000000', 'Black']])}
            <span class="field-hint">Shows wherever there's no photo.</span>
          </div>
          <div class="field">
            <span class="field-label">Slide border <b class="range-val" data-val="pad"></b></span>
            <input type="range" min="0" max="200" step="2" value="${ed.p.padding}" data-range="pad" />
            <span class="field-hint">An even border around each ${pageWord(ed.p)}, in the background color. Boxes also snap this far apart.</span>
            <label class="check"><input type="checkbox" data-seams${ed.p.seamsOpen ? ' checked' : ''} /> Leave seams open</label>
            <span class="field-hint">No border where ${pageWord(ed.p, true)} meet, so a panorama runs straight across.</span>
          </div>
          <div class="field">
            <span class="field-label">Photo border <b class="range-val" data-val="bw"></b></span>
            <input type="range" min="0" max="80" step="1" value="${ed.p.borderWidth}" data-range="bw" />
            ${colorChips('bc', ed.p.borderColor, [['#ffffff', 'White'], ['#000000', 'Black']])}
            <span class="field-hint">A line around the inside edge of every photo.</span>
          </div>
        </div>`,
      onClose: ed.commit,
    });
    const b = s.body;
    const vals = () => {
      b.querySelector('[data-val="pad"]').textContent = ed.p.padding ? `${ed.p.padding} px` : 'Off';
      b.querySelector('[data-val="bw"]').textContent = ed.p.borderWidth ? `${ed.p.borderWidth} px` : 'Off';
    };
    vals();
    const live = () => {
      vals();
      ed.renderStrip();
    };
    const colorOf = (name) => {
      const r = b.querySelector(`input[name="${name}"]:checked`);
      return r.value === 'custom' ? b.querySelector(`[data-color="${name}"]`).value : r.value;
    };
    b.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.range === 'pad') ed.p.padding = Number(t.value);
      else if (t.dataset.range === 'bw') ed.p.borderWidth = Number(t.value);
      else if (t.dataset.color) {
        t.closest('.swatch').querySelector('input[type="radio"]').checked = true;
        if (t.dataset.color === 'bg') ed.p.background = t.value;
        else ed.p.borderColor = t.value;
      } else return;
      live();
    });
    b.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'bg') ed.p.background = colorOf('bg');
      else if (t.name === 'bc') ed.p.borderColor = colorOf('bc');
      else if (t.dataset.seams !== undefined) ed.p.seamsOpen = t.checked;
      live();
      ed.commit();
    });
  }

  async function openGrid() {
    const get = await ed.previewSources();
    const s = openSheet({
      title: 'Profile preview',
      body: `
        <div class="grid-preview">
          <div class="grid-tile is-post" data-post></div>
          ${Array.from({ length: 8 }, () => '<div class="grid-tile"></div>').join('')}
        </div>
        <p class="field-hint">${ed.p.ratio === '3:4' ? 'Your first slide fills its tile in your profile grid.' : 'Your profile grid shows the middle of the first slide as a 3:4 tile.'}</p>`,
    });
    const c = previewCanvas(ed.p, get, { height: 480, count: 1 });
    s.body.querySelector('[data-post]').appendChild(c);
  }

  async function topMore() {
    const unused = ed.p.photoIds.filter((pid) => !ed.usedIds().has(pid));
    const both = ed.z <= ed.fitZ('all') * 1.05;
    const key = await choiceSheet({
      title: 'Layout',
      options: [
        { key: 'rename', label: 'Rename', detail: 'Also names the exported files.' },
        { key: 'zoom', label: both ? `See one ${pageWord(ed.p)}` : `See two ${pageWord(ed.p, true)}`, detail: both ? 'Closer in, one at a time.' : 'Side by side, two at a time.' },
        ...(isStory(ed.p) ? [{ key: 'safe', label: ed.showSafe ? 'Hide safe zone' : 'Show safe zone', detail: 'The parts Instagram covers.' }] : []),
        { key: 'borders', label: 'Background and borders', detail: 'The background color, and space around the photos.' },
        { key: 'template', label: 'Save as template', detail: 'Keeps the boxes, not the photos.' },
        ...(isStory(ed.p) || isPrint(ed.p) ? [] : [{ key: 'grid', label: 'Profile preview', detail: 'How the first slide looks in your profile grid.' }]),
        ...(unused.length ? [{ key: 'clear', label: 'Remove unused photos', detail: `${unused.length} in the tray, not in a box.` }] : []),
        { key: 'delete', label: 'Delete layout', detail: 'It and its photos go from this device.', danger: true },
      ],
    });
    if (key === 'rename') rename();
    else if (key === 'zoom') ed.fitTo(both ? 'one' : 'all');
    else if (key === 'safe') toggleSafe();
    else if (key === 'borders') openBorders();
    else if (key === 'template') saveAsTemplate();
    else if (key === 'grid') openGrid();
    else if (key === 'clear') {
      ed.p.photoIds = ed.p.photoIds.filter((pid) => ed.usedIds().has(pid));
      ed.renderTray();
      ed.commit();
    } else if (key === 'delete') deleteChapter();
  }

  async function deleteChapter() {
    const ok = await confirmSheet({
      title: 'Delete layout?',
      message: `<b>${esc(ed.p.name)}</b> and its photos will be deleted from this device. Photos in your camera roll stay where they are.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok || ed.destroyed) return;
    ed.gone = true;
    ed.commitSoon.cancel();
    ed.saveSoon.cancel();
    ed.thumbSoon.cancel();
    await deleteProject(ed.p.id);
    location.hash = '#/contents';
  }

  async function rename() {
    const v = await promptSheet({ title: 'Rename', value: ed.p.name });
    if (!v || v === ed.p.name) return;
    ed.p.name = v;
    ed.renderTop();
    ed.commit();
  }

  async function saveAsTemplate() {
    const v = await promptSheet({ title: 'Save as template', label: 'Template name', value: ed.p.name, confirmLabel: 'Save' });
    if (!v) return;
    const all = await listTemplates();
    const order = all.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1;
    await saveTemplate({ ...templateFromProject(ed.p), name: v, sortOrder: order, starter: false });
  }

  function toggleSafe() {
    ed.showSafe = !ed.showSafe;
    try {
      localStorage.setItem(SAFE_KEY, ed.showSafe ? 'on' : 'off');
    } catch {}
    ed.renderSafe();
    ed.renderTools();
  }

  async function leave() {
    ed.commitSoon.flush();
    ed.saveSoon.flush();
    ed.thumbSoon.cancel();
    await ed.makeThumb();
    location.hash = '#/contents';
  }
}
