// The editor's sheets: the chapter's menu and its settings.
import { MAX_SLIDES, pageWord, pageTitle } from '../data/formats.js';
import { removeSlide, moveSlide, copySlideLayout } from '../data/slides.js';
import { applySlideLayout } from '../data/slide-layouts.js';
import { previewCanvas } from '../components/render.js';
import { openSheet } from '../components/sheet.js';
import { ICONS } from '../components/icons.js';

export function addSheets(ed) {
  Object.assign(ed, { openSlides });
  // ---------- Sheets ----------
  async function openSlides() {
    const get = await ed.previewSources();
    const word = pageTitle(ed.p);
    const s = openSheet({ title: pageTitle(ed.p, true), className: 'has-footer' });
    function draw() {
      const n = ed.p.slides;
      s.body.innerHTML = `
        <ol class="slide-list">
          ${Array.from({ length: n }, (_, i) => `
            <li class="slide-row">
              <button type="button" class="slide-thumb r-${ed.p.ratio.replace(':', 'x')}" data-go="${i}" aria-label="Show ${word} ${i + 1}"></button>
              <span class="slide-name">${word} ${i + 1}</span>
              <span class="slide-acts">
                <button type="button" class="mini-btn" data-layout="${i}" aria-label="Change the layout">${ICONS.grid}</button>
                <button type="button" class="mini-btn" data-up="${i}" aria-label="Move earlier"${i === 0 ? ' disabled' : ''}>${ICONS.up}</button>
                <button type="button" class="mini-btn" data-down="${i}" aria-label="Move later"${i === n - 1 ? ' disabled' : ''}>${ICONS.down}</button>
                <button type="button" class="mini-btn" data-copy="${i}" aria-label="Copy the layout"${n >= MAX_SLIDES ? ' disabled' : ''}>${ICONS.copy}</button>
                <button type="button" class="mini-btn" data-del="${i}" aria-label="Remove"${n <= 1 ? ' disabled' : ''}>${ICONS.trash}</button>
              </span>
            </li>`).join('')}
        </ol>
        <p class="field-hint">The grid button picks a new layout for that ${pageWord(ed.p)}. Copy makes a new ${pageWord(ed.p)} with the same empty frames. A photo that crosses a seam moves with the ${pageWord(ed.p)} it starts on.</p>
        <div class="sheet-footer">
          <button type="button" class="modal-cta primary" data-add${n >= MAX_SLIDES ? ' disabled' : ''}>${n >= MAX_SLIDES ? `${MAX_SLIDES} is the most` : `+ Add a ${pageWord(ed.p)}`}</button>
        </div>`;
      s.body.querySelectorAll('.slide-thumb').forEach((b) => {
        const c = previewCanvas(ed.p, get, { height: 96, from: Number(b.dataset.go), count: 1 });
        b.appendChild(c);
      });
    }
    function changed() {
      ed.fitIfNeeded();
      ed.render();
      ed.commit();
      draw();
    }
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.go !== undefined) {
        s.close();
        ed.showSlide(Number(d.go));
        return;
      }
      if (d.layout !== undefined || d.add !== undefined) {
        const k = d.layout !== undefined ? +d.layout : null;
        ed.pickLayout(k).then((l) => {
          if (!l || ed.destroyed || !s.overlay.isConnected) return;
          if (k === null) ed.addSlideWith(l);
          else ed.apply(applySlideLayout(ed.p, k, l));
          if (ed.sel && !ed.frameById(ed.sel)) ed.sel = null;
          changed();
        });
        return;
      }
      if (d.up !== undefined) ed.apply(moveSlide(ed.p, +d.up, +d.up - 1));
      else if (d.down !== undefined) ed.apply(moveSlide(ed.p, +d.down, +d.down + 1));
      else if (d.copy !== undefined) ed.apply(copySlideLayout(ed.p, +d.copy));
      else if (d.del !== undefined) ed.apply(removeSlide(ed.p, +d.del));
      else return;
      if (ed.sel && !ed.frameById(ed.sel)) ed.sel = null;
      changed();
    });
    draw();
  }
}
