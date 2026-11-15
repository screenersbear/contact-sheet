// The Back up sheet (round 2, backup/01-back-up.html), on the shelf and in
// every notebook's Options: Just <the notebook> (the one in front on the
// shelf, "Just this notebook" inside one), or All four notebooks. The backup
// is made in the sheet, then saved from a tap of its own, as an iPhone only
// shares a file straight from a tap (on a phone it can be a few files, a tap
// each). What goes in: shared/data/backups.js. Its look:
// styles/shared/backup.css. This is the master copy: tools/sync.py shared
// copies it into each notebook's components/shared/.
(function () {
  'use strict';
  const D = window.DFData;
  const B = window.DFBackups;
  const C = window.DFConnect;
  if (!D || !B || !B.makeBackup || !C) return;
  const { BOOKS, ORDER, EYE_LAST_BACKUP } = B;
  const icon = (size, d) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const CLOSE = icon(18, '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>');
  const CHEV = `<span class="dfb-chev">${icon(16, '<polyline points="9 5 16 12 9 19"/>')}</span>`;
  const bg = (app) => C.NOTEBOOKS[app].bg;
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  // A sheet from the foot of the screen: { el (its body), close() }.
  // Closed by its X, a tap on the dim around it, or close().
  function frame(title, html, onClose) {
    const dim = document.createElement('div');
    dim.className = 'dfb-dim';
    dim.innerHTML = `<section class="dfb-sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <span class="dfb-grab" aria-hidden="true"></span>
      <div class="dfb-head"><h2>${title}</h2><button type="button" class="dfb-close" data-close aria-label="Close"><span>${CLOSE}</span></button></div>
      <div class="dfb-body">${html}</div></section>`;
    document.body.appendChild(dim);
    requestAnimationFrame(() => dim.classList.add('in'));
    let open = true;
    const close = () => {
      if (!open) return;
      open = false;
      dim.classList.remove('in');
      setTimeout(() => dim.remove(), 220);
      if (onClose) onClose();
    };
    dim.addEventListener('click', (e) => { if (e.target === dim || e.target.closest('[data-close]')) close(); });
    return { el: dim.querySelector('.dfb-body'), close, isOpen: () => open };
  }

  const justRow = (app, inside) => `<button type="button" class="dfb-row" data-just="${app}">
      <span class="dfb-tile" style="background:${bg(app)}" aria-hidden="true">${C.markSvg(app, 30)}</span>
      <span class="dfb-words"><span class="dfb-title">${inside ? 'Just this notebook' : `Just ${BOOKS[app].name}`}</span>
      <span class="dfb-line">${inside ? '' : 'The notebook in front. '}${BOOKS[app].line}</span></span>${CHEV}</button>`;
  const allRow = () => `<button type="button" class="dfb-row" data-all>
      <span class="dfb-four" aria-hidden="true">${ORDER.map((a) => `<span style="background:${bg(a)}">${C.markSvg(a, 14)}</span>`).join('')}</span>
      <span class="dfb-words"><span class="dfb-title">All four notebooks</span>
      <span class="dfb-line">Ref, The Eye, Layouts and Rounds in one backup, with the shelf.</span></span>${CHEV}</button>`;

  // Opens Back up. here: the notebook it's opened in (an app id), or none
  // on the shelf, with front: the notebook in front. All four is there only
  // in the suite (a notebook on its own has only itself to back up).
  // before(): just before a backup's made (The Eye saves what's on screen);
  // hold(on): true while the sheet's open, false once it's closed (The Eye
  // holds off an update meanwhile, which would lose files still to save).
  function open({ here = null, front = null, before = () => {}, hold = () => {} } = {}) {
    const app = here || front || ORDER[0];
    const s = frame('Back up', `<div class="dfb-rows">${justRow(app, !!here)}${!here || D.inSuite() ? allRow() : ''}</div>
      <p class="dfb-note" hidden></p><button type="button" class="dfb-btn" data-save hidden></button>`, () => { gone = true; drop(); hold(false); });
    hold(true);
    let gone = false;
    let made = null;
    let steps = null;
    let which = null;
    let turn = 0; // the latest backup asked for: an older one finishing late is let go
    const note = s.el.querySelector('.dfb-note');
    const save = s.el.querySelector('[data-save]');
    const rowsEl = s.el.querySelector('.dfb-rows');
    const rows = [...rowsEl.querySelectorAll('.dfb-row')];
    const say = (text) => { note.textContent = text; note.hidden = !text; };
    function drop() { if (made) made.done(); made = null; steps = null; }

    async function make(row) {
      const mine = ++turn;
      drop();
      which = row.dataset.just || null;
      save.hidden = true;
      rows.forEach((r) => { r.disabled = true; r.setAttribute('aria-busy', String(r === row)); r.classList.toggle('chosen', r === row); });
      rowsEl.classList.remove('made');
      say('Putting it together');
      try {
        before();
        const m = await B.makeBackup((f) => { if (mine === turn && !gone) say(`Putting it together, ${Math.floor(f * 100)}%`); }, which);
        if (gone || mine !== turn) { if (m) m.done(); return; }
        if (!m) { say('There is nothing to back up yet.'); return; }
        made = m;
        steps = D.backupSteps(m); // one file, or a few on a phone: a tap each
        say(steps.note);
        save.textContent = steps.label;
        save.hidden = false;
        rowsEl.classList.add('made'); // the one it's made from stands out
      } catch (err) {
        console.error(err);
        if (!gone && mine === turn) say(err.message || "The backup couldn't be made.");
      } finally {
        if (!gone && mine === turn) rows.forEach((r) => { r.disabled = false; r.removeAttribute('aria-busy'); });
      }
    }

    s.el.addEventListener('click', async (e) => {
      const row = e.target.closest('.dfb-row');
      if (row && !row.disabled) { make(row); return; }
      if (!e.target.closest('[data-save]') || !steps) return;
      try {
        if (!(await steps.tap())) { save.textContent = steps.label; return; }
        // The Eye's "Last backup" counts one that has it in.
        if (!which || which === 'the-eye') remember(EYE_LAST_BACKUP, String(Date.now()));
        save.hidden = true;
        say('Backup saved.');
      } catch (err) {
        console.error(err);
        say(err.message || "The backup wasn't saved.");
      }
    });
    return s;
  }

  window.DFBackupSheet = { open, frame };
})();
