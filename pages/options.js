// Options (the ≡ in the band, and the sun beside the shut notebook), in the
// round 2 look (07-options), as Ref's: the notebook's colour as swatches,
// then rows for exporting everything, backups and help. On its own (not in
// the suite) also where it starts and the stickers.
import { openSheet } from '../components/sheet.js';
import { openNotebookExport } from './notebook-export.js';
import { openStickers } from '../components/sticker-sheets.js';
import { openIntro } from './intro.js';
import { saveBackup, restoreBackup } from './options-backup.js';

export const BOOK_KEY = 'contact-sheet-book'; // also read in index.html, before the first paint
export const START_KEY = 'contact-sheet-start';

export const COLORS = [['mango', 'Mango'], ['orange', 'Orange'], ['berry', 'Berry'], ['fern', 'Fern'], ['ocean', 'Ocean'], ['leaf', 'Leaf'], ['ink', 'Black']];
export function useBook(name) {
  document.documentElement.dataset.book = name;
  try {
    localStorage.setItem(BOOK_KEY, name);
  } catch {}
}

export function startsOnFirstPage() {
  try {
    return localStorage.getItem(START_KEY) === 'first';
  } catch {
    return false;
  }
}

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5 12.5 10 17 19 7"/></svg>';
const CHEVRON = '<svg class="opt-chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg>';

// A swatch for each colour: the band with its partner's line and half
// circle, ticked when it's the one.
function colorsHtml() {
  const now = document.documentElement.dataset.book || 'berry';
  return `<div class="opt-colors" role="radiogroup" aria-label="Notebook color">${COLORS.map(([key, name]) => `
    <button type="button" class="opt-color" role="radio" data-color="${key}" aria-checked="${key === now}">
      <span class="opt-swatch" data-swatch="${key}"><span class="opt-swatch-line"></span><span class="opt-swatch-sun"></span>${key === now ? `<span class="opt-swatch-tick">${TICK}</span>` : ''}</span>
      <span class="opt-color-name">${name}</span>
    </button>`).join('')}</div>`;
}
const row = (attr, name, sub = '') => `<button type="button" class="opt-row" ${attr}><span class="opt-row-words"><span class="opt-row-name">${name}</span>${sub ? `<span class="opt-row-sub">${sub}</span>` : ''}</span>${CHEVRON}</button>`;

export function openOptions(stickers) {
  const alone = !window.DF_SUITE;
  const first = startsOnFirstPage();
  const s = openSheet({
    title: 'Options',
    className: 'opt-sheet',
    body: `
      <span class="opt-label">Notebook color</span>
      <div data-colors>${colorsHtml()}</div>
      ${alone ? `<span class="opt-label opt-gap">Always start</span>
      <div class="opt-seg" role="group" aria-label="Always start">
        <button type="button" data-start="notebook" class="${first ? '' : 'on'}" aria-pressed="${!first}">In the notebook</button>
        <button type="button" data-start="first" class="${first ? 'on' : ''}" aria-pressed="${first}">On the first page</button>
      </div>` : ''}
      <span class="opt-label opt-gap">Export</span>
      <div class="opt-rows">${row('data-pdf', 'Everything as one PDF', 'A cover in the app colour, then each layout')}</div>
      ${alone ? `<span class="opt-label opt-gap">Cover</span><div class="opt-rows">${row('data-stickers', 'Stickers')}</div>` : ''}
      <span class="opt-label opt-gap">Backups</span>
      <div class="opt-rows">${row('data-save-backup', 'Save a backup')}${row('data-restore-backup', 'Restore a backup')}</div>
      <span class="opt-label opt-gap">Help</span>
      <div class="opt-rows">${row('data-intro', 'How it works')}</div>`,
  });
  s.body.addEventListener('click', (e) => {
    const color = e.target.closest('[data-color]');
    if (color) {
      useBook(color.dataset.color);
      s.body.querySelector('[data-colors]').innerHTML = colorsHtml();
      return;
    }
    const start = e.target.closest('[data-start]');
    if (start) {
      try {
        localStorage.setItem(START_KEY, start.dataset.start);
      } catch {}
      s.body.querySelectorAll('[data-start]').forEach((b) => {
        b.classList.toggle('on', b === start);
        b.setAttribute('aria-pressed', String(b === start));
      });
      return;
    }
    // Placing a sticker happens on the cover, so Options goes once a shape is picked.
    if (e.target.closest('[data-stickers]')) openStickers(stickers, () => s.close());
    else if (e.target.closest('[data-pdf]')) {
      s.close();
      openNotebookExport();
    } else if (e.target.closest('[data-intro]')) {
      s.close();
      openIntro();
    } else if (e.target.closest('[data-save-backup]')) saveBackup();
    else if (e.target.closest('[data-restore-backup]')) restoreBackup(() => s.close());
  });
}
