// New layout (round 2, 02 and 03): a guide over the whole screen with the
// short band (back, NEW LAYOUT, close), the step marks Name, Size and
// Template, and Back / Next at the foot. Make it saves the layout and opens
// it. The steps themselves are drawn in new-layout-steps.js.
import { saveProject, listTemplates } from '../data/db.js';
import { blankLayout, layoutFromTemplate } from '../data/templates.js';
import { changeRatio } from '../data/slides.js';
import { DEFAULT_RATIO } from '../data/formats.js';
import { openSheet } from '../components/sheet.js';
import { shortBandHtml, CLOSE } from '../components/band.js';
import { marksHtml } from '../components/guide-marks.js';
import { shortDate } from '../components/util.js';
import { seedStarters } from '../data/starters.js';
import { templateMenu } from './template-menu.js';
import { MARKS, nameStep, sizeStep, templateStep } from './new-layout-steps.js';

const dateName = () => `Layout, ${shortDate(new Date().toISOString())}`;

// Any template fits any size: boxes keep their place relative to the slide.
const inRatio = (t, ratio) => (t.ratio === ratio ? t : changeRatio(t, ratio));

// Resolves true once a layout is made, false if the guide was left.
export async function newLayout() {
  await seedStarters();
  return new Promise((resolve) => {
    let made = false;
    const W = { step: 0, name: '', defaultName: dateName(), ratio: DEFAULT_RATIO, template: '' };
    let list = [];
    const s = openSheet({ title: 'New layout', className: 'sheet-page sheet-guide', onClose: () => resolve(made) });
    s.body.innerHTML = `
      ${shortBandHtml({ name: 'New layout', backAttr: 'data-back', end: { label: 'Close', attr: 'data-close', svg: CLOSE } })}
      <div class="page-scroll" data-scroll></div>
      <div class="page-foot guide-foot">
        <button type="button" class="btn secondary" data-back>Back</button>
        <button type="button" class="btn primary" data-next></button>
      </div>`;
    const scroll = s.body.querySelector('[data-scroll]');
    const next = s.body.querySelector('[data-next]');

    async function draw(keepPlace = false) {
      if (W.step === 2) list = (await listTemplates()).filter((t) => t.starterKey !== 'story' && t.starterKey !== 'full-bleed');
      if (!s.overlay.isConnected) return;
      const blank = { ...blankLayout(W.ratio), name: 'Blank' };
      const body = W.step === 0 ? nameStep(W) : W.step === 1 ? sizeStep(W) : templateStep(W, list.map((t) => inRatio(t, W.ratio)), blank);
      const top = scroll.scrollTop;
      scroll.innerHTML = marksHtml(MARKS, W.step) + body;
      scroll.scrollTop = keepPlace ? top : 0;
      next.textContent = W.step < 2 ? `Next: ${MARKS[W.step + 1]}` : 'Make it';
      const name = scroll.querySelector('[data-name]');
      name?.addEventListener('input', () => (W.name = name.value));
      name?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          go(1);
        }
      });
    }

    async function make() {
      const t = list.find((x) => x.id === W.template);
      const layout = t ? layoutFromTemplate(inRatio(t, W.ratio)) : blankLayout(W.ratio);
      made = true;
      const p = await saveProject({ name: W.name.trim() || W.defaultName, photoIds: [], thumb: null, ...layout });
      s.close();
      location.hash = `#/edit/${p.id}`;
    }

    function go(dir) {
      if (dir < 0 && W.step === 0) return s.close();
      if (dir > 0 && W.step === 2) return make();
      W.step += dir;
      draw();
    }

    s.body.addEventListener('click', (e) => {
      if (e.target.closest('[data-back]')) return go(-1);
      if (e.target.closest('[data-next]')) return go(1);
      const size = e.target.closest('[data-ratio]');
      if (size) {
        W.ratio = size.dataset.ratio;
        return draw(true);
      }
      const more = e.target.closest('[data-tmore]');
      if (more) {
        // Renamed, copied, moved or deleted: drawn again, and a deleted pick
        // goes back to Blank.
        return templateMenu(more.dataset.tmore, async () => {
          await draw(true);
          if (W.template && !list.some((t) => t.id === W.template)) {
            W.template = '';
            draw(true);
          }
        });
      }
      const use = e.target.closest('[data-use]');
      if (use) {
        W.template = use.dataset.use;
        draw(true);
      }
    });
    draw();
  });
}
