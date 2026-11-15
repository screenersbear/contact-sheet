// Options' Back up and Restore: Back up is the sheet every notebook shares
// (components/shared/backup-sheet.js: just Layouts, or all four), and
// Restore puts a backup back.
import { confirmSheet } from '../components/dialogs.js';
import { toast } from '../components/toast.js';
import { isZipBackup, restoreBackup as restoreZip } from '../data/backup.js';

// Just this notebook, or all four notebooks, as one zip (a few on a phone).
export function backUp() {
  window.DFBackupSheet.open({ here: 'contact-sheet' });
}

// A backup of all four asks first (components/shared/restore-sheet.js):
// just Layouts' part, the other notebooks left as they are, or all four.
export async function restoreBackup(close) {
  const D = window.DFData;
  const R = window.DFRestore;
  let files = await D.pickFiles(R.PICK); // straight from the tap, or iOS won't open the picker
  if (!files.length) return;
  const pick = await R.which(files, 'contact-sheet');
  if (!pick) return;
  if (pick.all) { close(); R.confirm(files); return; }
  files = pick.files;
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
