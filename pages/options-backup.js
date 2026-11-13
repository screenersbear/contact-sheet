// Options' Backup and Restore: every chapter saved in one zip, and a backup
// put back.
import { openSheet } from '../components/sheet.js';
import { confirmSheet } from '../components/dialogs.js';
import { toast } from '../components/toast.js';
import { makeBackup, isZipBackup, restoreBackup as restoreZip } from '../data/backup.js';

// Everything in the notebook as one file, and back (backup.js: the
// notebooks' zip, which the phone never has to hold in memory). Made first, then saved from a tap of
// its own, as an iPhone only shares a file straight from a tap.
export function saveBackup() {
  const D = window.DFData;
  let open = true;
  let made = null;
  const s = openSheet({
    title: 'Save a backup',
    className: 'sheet-small sheet-options',
    body: '<p class="sheet-message" data-msg>Putting it together</p>',
    onClose: () => { open = false; if (made) made.done(); },
  });
  const msg = s.body.querySelector('[data-msg]');
  makeBackup({
    extra: { book: document.documentElement.dataset.book || '' },
    onProgress: (f) => { if (open) msg.textContent = `Putting it together, ${Math.floor(f * 100)}%`; },
  }).then((m) => {
    made = m;
    if (!open) { if (m) m.done(); return; }
    if (!m) { msg.textContent = 'There is nothing to back up yet.'; return; }
    const steps = D.backupSteps(m); // one file, or a few on a phone: a tap each
    msg.textContent = steps.note;
    msg.insertAdjacentHTML('afterend', `<button type="button" class="btn secondary opt-wide" data-save>${steps.label}</button>`);
    const btn = s.body.querySelector('[data-save]');
    btn.addEventListener('click', async () => {
      try {
        if (!(await steps.tap())) { btn.textContent = steps.label; return; }
        s.close();
        toast('Backup saved');
      } catch (err) {
        console.error(err);
        toast(err.message || 'The backup wasn\'t saved.');
      }
    });
  }).catch((err) => {
    console.error(err);
    if (open) msg.textContent = err.message || 'The backup couldn\'t be made.';
  });
}
export async function restoreBackup(close) {
  const D = window.DFData;
  const files = await D.pickFiles('.zip,application/zip,.json,application/json'); // straight from the tap, or iOS won't open the picker
  if (!files.length) return;
  if (!(await confirmSheet({ title: 'Restore backup', message: 'Everything in Layouts now is swapped for what\'s in the file.', confirmLabel: 'Restore', danger: true }))) return;
  toast('Restoring the backup', { ms: 600000 });
  try {
    const r = (await isZipBackup(files[0]))
      ? await restoreZip(files) // a backup saved as a few files comes back as all of them
      : await D.importDb(files[0], 'contact-sheet', { app: 'contact-sheet', replace: true });
    // A backup of all four from the shelf keeps the colour with the others'.
    const book = (r.extra && r.extra.book) || (r.local ? await r.local('contact-sheet-book') : null);
    if (book) { try { localStorage.setItem('contact-sheet-book', book); } catch {} }
    close();
    toast('Backup restored');
    setTimeout(() => location.reload(), 700); // everything on screen read fresh
  } catch (err) {
    console.error(err);
    toast(err.message || 'That backup couldn\'t be restored.');
  }
}
