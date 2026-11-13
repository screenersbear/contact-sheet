// Options: the notebook's colour, where it opens, stickers, the tour and backups.
import { openSheet } from '../components/sheet.js';
import { openNotebookExport } from './notebook-export.js';
import { openStickers } from '../components/sticker-sheets.js';
import { openIntro } from './intro.js';
import { saveBackup, restoreBackup } from './options-backup.js';

export const BOOK_KEY = 'contact-sheet-book';
 // also read in index.html, before the first paint
export const START_KEY = 'contact-sheet-start';

export const COLORS = [
  ['orange', 'Orange'],
  ['mango', 'Mango'],
  ['berry', 'Berry'],
  ['fern', 'Fern'],
  ['ocean', 'Ocean'],
  ['ink', 'Black'],
];
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
// The sun beside the shut notebook: one sheet, laid out like Ref Notebook's,
// with this app's own settings.
export function openOptions(stickers) {
  const now = document.documentElement.dataset.book;
  const first = startsOnFirstPage();
  const s = openSheet({
    title: 'Options',
    className: 'sheet-small sheet-options',
    body: `
      <span class="field-label">App color</span>
      <div class="opt-colors">
        ${COLORS.map(([key, name]) => `
          <button type="button" class="opt-color" data-color="${key}" aria-pressed="${key === now}">
            <span class="opt-book" style="background-image:url(art/${key}-cover.webp)"></span>
            <span>${name}</span>
          </button>`).join('')}
      </div>
      ${window.DF_SUITE ? '' : `<span class="field-label opt-gap">Stickers</span>
      <button type="button" class="btn secondary opt-wide" data-stickers>Stickers</button>`}
      ${window.DF_SUITE ? '' : `<span class="field-label opt-gap">Always start</span>
      <div class="opt-seg" role="group" aria-label="Always start">
        <button type="button" data-start="notebook" aria-pressed="${!first}">In the notebook</button>
        <button type="button" data-start="first" aria-pressed="${first}">On the first page</button>
      </div>`}
      <span class="field-label opt-gap">Export</span>
      <button type="button" class="btn secondary opt-wide" data-pdf>Whole notebook as PDF</button>
      <span class="field-label opt-gap">Backup</span>
      <button type="button" class="btn secondary opt-wide" data-save-backup>Save a backup</button>
      <button type="button" class="btn secondary opt-wide" data-restore-backup>Restore a backup</button>
      <button type="button" class="btn secondary opt-wide opt-gap" data-intro>How it works</button>`,
  });
  s.body.addEventListener('click', (e) => {
    const color = e.target.closest('[data-color]');
    if (color) {
      useBook(color.dataset.color);
      s.body.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b === color)));
      return;
    }
    const start = e.target.closest('[data-start]');
    if (start) {
      try {
        localStorage.setItem(START_KEY, start.dataset.start);
      } catch {}
      s.body.querySelectorAll('[data-start]').forEach((b) => b.setAttribute('aria-pressed', String(b === start)));
      return;
    }
    // Placing a sticker happens on the cover, so Options goes once a shape is picked.
    if (e.target.closest('[data-stickers]')) openStickers(stickers, () => s.close());
    else if (e.target.closest('[data-pdf]')) {
      s.close();
      openNotebookExport();
    }
    else if (e.target.closest('[data-intro]')) {
      s.close();
      openIntro();
    }
    else if (e.target.closest('[data-save-backup]')) saveBackup();
    else if (e.target.closest('[data-restore-backup]')) restoreBackup(() => s.close());
  });
}
