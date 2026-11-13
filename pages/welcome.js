// Inside Documenting Fictions, the first time this notebook is opened: how to
// get back to the shelf, then an offer of the tour; turned down, where the
// tour is kept. The words are the suite's (../suite.js), so all four
// notebooks say the same thing.
import { openSheet } from '../components/sheet.js';

export function welcome(name, openTour) {
  const suite = window.DF_SUITE;
  if (!suite || !suite.firstVisit) return false;
  const w = suite.words(name);
  let step = 'back', toured = false;
  const s = openSheet({
    title: w.back[0],
    className: 'sheet-small intro',
    onClose: () => { suite.welcomed(); if (toured) setTimeout(openTour, 60); },
  });
  const say = (text) => `<p class="sheet-message">${text}</p>`;
  const one = (label, step) => `<div class="sheet-actions one"><button type="button" class="btn primary" data-step="${step}">${label}</button></div>`;
  const draw = () => {
    if (step === 'back') { s.setTitle(w.back[0]); s.body.innerHTML = say(w.back[1]) + one('Next', 'next'); }
    else if (step === 'ask') {
      s.setTitle(w.ask[0]);
      s.body.innerHTML = say(w.ask[1]) + `<div class="sheet-actions">
        <button type="button" class="btn secondary" data-step="no">${w.ask[3]}</button>
        <button type="button" class="btn primary" data-step="yes">${w.ask[2]}</button>
      </div>`;
    } else { s.setTitle(w.later[0]); s.body.innerHTML = say(w.later[1]) + one(w.later[2], 'done'); }
  };
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const k = b.dataset.step;
    if (k === 'next') { step = 'ask'; draw(); }
    else if (k === 'no') { step = 'later'; draw(); }
    else { toured = k === 'yes'; s.close(); }
  });
  draw();
  return true;
}
