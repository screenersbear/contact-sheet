// New chapter: name it, pick the size, then a template drawn in that size.
import { saveProject, listTemplates } from '../data/db.js';
import { blankLayout, layoutFromTemplate } from '../data/templates.js';
import { changeRatio } from '../data/slides.js';
import { RATIOS, RATIO_ORDER, MORE_RATIOS, pageWord } from '../data/formats.js';
import { openSheet } from '../components/sheet.js';
import { choiceSheet, promptSheet } from '../components/dialogs.js';
import { ICONS } from '../components/icons.js';
import { esc, shortDate } from '../components/util.js';
import { seedStarters } from '../data/starters.js';
import { layoutSvg } from '../components/template-picture.js';
import { templateMenu } from './template-menu.js';

// ---------- Making chapters ----------

const sizeOption = (r) => ({ key: r, label: RATIOS[r].label, detail: `${RATIOS[r].size}. ${RATIOS[r].detail}` });
const dateName = () => `Chapter ${shortDate(new Date().toISOString())}`;

async function createProject(layout, name) {
  const p = await saveProject({ name: name || dateName(), photoIds: [], thumb: null, ...layout });
  location.hash = `#/edit/${p.id}`;
}

// New chapter: name it, pick the size, then a template drawn in that size. Resolves
// true once a chapter is made, false if it was cancelled.
export async function newChapter() {
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
