// Saving the whole notebook, or one chapter, as a printable PDF.
import { pageWord } from '../data/formats.js';
import { showPdf } from './pdfview.js';
import { openSheet } from '../components/sheet.js';
import { renderSlides } from '../data/slide-images.js';
import { FULL_AREA, printScale, checkPictures } from '../data/print-check.js';
import { sheetsOf, makeNotebook } from '../data/notebook-pdf.js';

export function openNotebookExport() {
  let free = null;
  const s = openSheet({ title: 'Export notebook', className: 'sheet-export', onClose: () => free && free() });
  async function run() {
    s.setTitle('Export notebook');
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let book;
    try {
      book = await makeNotebook((name, part) => {
        msg.textContent = `Making ${name}`;
        bar.style.width = `${Math.round(part * 100)}%`;
      }, () => s.overlay.isConnected);
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the PDF. Try again.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
      s.body.querySelector('[data-again]').addEventListener('click', run);
      return;
    }
    if (!s.overlay.isConnected) return;
    if (!book) {
      s.body.innerHTML = '<p class="sheet-message">There are no chapters to export yet.</p>';
      return;
    }
    free = showPdf(s, { ...book, fileName: 'contact-sheet-notebook.pdf', onSaved: () => s.close() });
  }
  run();
  return s;
}

// One chapter's chosen pages, made at print size, then the preview on top of
// the export screen. Closing it goes back to the picks.
export function openChapterPdf(p, photos, order, base, exportSheet) {
  let free = null;
  const s = openSheet({ title: 'Printable PDF', className: 'sheet-export', onClose: () => free && free() });
  async function run() {
    s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
    const msg = s.body.querySelector('[data-msg]');
    const bar = s.body.querySelector('[data-bar]');
    let files;
    try {
      files = await renderSlides(p, photos, 'jpeg', (i, n) => {
        msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
        bar.style.width = `${Math.round((i / n) * 100)}%`;
      }, { thumbs: false, scale: printScale(p, FULL_AREA), only: order });
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the PDF. Try again.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
      s.body.querySelector('[data-again]').addEventListener('click', run);
      return;
    }
    if (!s.overlay.isConnected) return;
    const sheets = sheetsOf(files.map((f) => f.blob), files[0].width, files[0].height);
    free = showPdf(s, {
      sheets,
      report: checkPictures(p, photos, order, sheets),
      fileName: `${base}-print.pdf`,
      onSaved: () => {
        s.close();
        exportSheet.close();
      },
    });
  }
  run();
}
