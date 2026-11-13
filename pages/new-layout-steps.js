// The new layout guide's three steps, drawn (round 2, 02-new-layout-size
// and 03-new-layout-template): Name (a field), Size (cards drawn at their
// true shape, in three groups) and Template (cards with a two-slide spread,
// Blank first). new-layout.js runs them.
import { RATIOS, SLIDE_W } from '../data/formats.js';
import { spreadSvg } from '../components/template-picture.js';
import { esc } from '../components/util.js';

export const MARKS = ['Name', 'Size', 'Template'];

// The sizes as the guide shows them: a short name and what's under it.
export const SIZE_GROUPS = [
  ['Feed and story', [['4:5', 'Feed', '4:5'], ['3:4', 'Feed', '3:4'], ['1:1', 'Square', '1:1'], ['9:16', 'Story', '9:16']]],
  ['Print', [['2:3', 'Photo', '4 × 6'], ['5:7', 'Photo', '5 × 7'], ['8:10', 'Print', '8 × 10'], ['a4', 'A4', '']]],
  ['Screen', [['3:2', 'Landscape', '3:2'], ['4:3', 'Landscape', '4:3'], ['16:9', 'Wide', '16:9'], ['letter', 'Letter', 'US']]],
];

const MORE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>';

const head = (title, ask) => `<h1 class="page-title">${esc(title)}</h1><p class="page-ask">${esc(ask)}</p>`;

export function nameStep(W) {
  return `${head('Name', 'What is this one called?')}
    <input class="guide-input" type="text" data-name value="${esc(W.name)}" placeholder="${esc(W.defaultName)}" aria-label="Name" autocomplete="off" enterkeyhint="next" />`;
}

// A size's shape: about the same area for each, the longer side at most 60.
function shape(ratio) {
  const r = SLIDE_W / RATIOS[ratio].h;
  let w = Math.sqrt(2025 * r), h = Math.sqrt(2025 / r);
  const k = Math.min(1, 60 / Math.max(w, h));
  w *= k; h *= k;
  return `<span class="size-shape-box"><span class="size-shape" style="width:${w.toFixed(1)}px;height:${h.toFixed(1)}px"></span></span>`;
}

export function sizeStep(W) {
  const card = ([key, name, sub]) => `<button type="button" class="size-card" role="radio" aria-checked="${key === W.ratio}" data-ratio="${key}" aria-label="${esc(RATIOS[key].label)}">${shape(key)}<span class="size-name">${esc(name)}</span><span class="size-sub">${esc(sub)}</span></button>`;
  return `${head('Size', 'Where will this one live?')}
    ${SIZE_GROUPS.map(([group, sizes]) => `<p class="guide-group">${esc(group)}</p><div class="size-cards" role="radiogroup" aria-label="${esc(group)}">${sizes.map(card).join('')}</div>`).join('')}`;
}

// list: the saved templates, each already in the size being made.
export function templateStep(W, list, blank) {
  const card = (t, id) => `
    <div class="tpl-pick${W.template === id ? ' on' : ''}">
      <button type="button" class="tpl-pick-btn" role="radio" aria-checked="${W.template === id}" data-use="${esc(id)}">
        <span class="tpl-pick-art">${spreadSvg(t, !!id)}</span>
        <span class="tpl-pick-name">${esc(t.name)}</span>
      </button>
      ${id ? `<button type="button" class="tpl-pick-more" data-tmore="${esc(id)}" aria-label="More for ${esc(t.name)}">${MORE}</button>` : ''}
    </div>`;
  return `${head('Template', 'Start from a layout you\'ve saved, or blank.')}
    <div class="tpl-picks" role="radiogroup" aria-label="Template">${card(blank, '')}${list.map((t) => card(t, t.id)).join('')}</div>
    <p class="guide-small">Save any layout as a template from its More menu.</p>`;
}
