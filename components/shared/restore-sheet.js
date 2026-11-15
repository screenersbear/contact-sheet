// Restore, which takes either kind of backup (backup/NOTES.md, 15 Nov):
// - On the shelf, a backup of all four puts all four back, and one of a
//   single notebook puts back just that one, saying which.
// - Inside a notebook, a backup of all four asks first: "This backup has
//   all four notebooks." Just <this notebook> (the main button) restores
//   only its part and leaves the others as they are; All four, all of it.
// In the sheet of backup-sheet.js, loaded before this. What it does:
// shared/data/backups.js. This is the master copy: tools/sync.py shared
// copies it into each notebook's components/shared/.
(function () {
  'use strict';
  const D = window.DFData;
  const B = window.DFBackups;
  const S = window.DFBackupSheet;
  if (!D || !B || !B.restore || !S) return;
  const { BOOKS } = B;
  const PICK = '.zip,application/zip,.json,application/json';

  // Something went wrong before anything was changed: says so.
  function sorry(message) {
    const s = S.frame('Restore', `<p class="dfb-text"></p><button type="button" class="dfb-btn quiet" data-close>Close</button>`);
    s.el.querySelector('.dfb-text').textContent = message || "That backup couldn't be restored.";
  }

  // "Restore all four?" or "Restore Ref?": the last word before the
  // notebooks are swapped for the file's, then the restore, with how far
  // it's got. Resolves true once it's done (then done(), or the page is
  // read fresh), false if cancelled.
  function confirm(files, { only = null, done = null } = {}) {
    const name = only ? BOOKS[only].name : 'all four';
    const what = only
      ? `Everything in ${name} on this device is swapped for what's in the file. The other notebooks stay as they are.`
      : "Everything in Ref, The Eye, Layouts and Rounds on this device is swapped for what's in the file.";
    return new Promise((resolve) => {
      let busy = false;
      const s = S.frame(`Restore ${name}?`, `<p class="dfb-text">${what} This can't be undone, so back up first if you might want today's back.</p>
        <button type="button" class="dfb-btn danger" data-yes>Restore</button>
        <button type="button" class="dfb-btn quiet" data-close>Cancel</button>
        <p class="dfb-note" hidden></p>`, () => { if (!busy) resolve(false); });
      const yes = s.el.querySelector('[data-yes]');
      const note = s.el.querySelector('.dfb-note');
      const say = (text) => { note.textContent = text; note.hidden = false; };
      yes.addEventListener('click', async () => {
        busy = true;
        yes.disabled = true;
        yes.textContent = 'Restoring';
        try {
          await B.restore(files, { only, onProgress: (f) => { yes.textContent = `Restoring, ${Math.floor(f * 100)}%`; } });
          yes.textContent = 'Restored';
          say(only ? `${name} is back as it was in the file.` : 'All four are back as they were in the file.');
          resolve(true);
          setTimeout(() => { if (done) { s.close(); done(); } else location.reload(); }, 900);
        } catch (err) {
          console.error(err);
          busy = false;
          yes.disabled = false;
          yes.textContent = 'Restore';
          say(err.message || "That backup couldn't be restored.");
        }
      });
    });
  }

  // The shelf's Restore a backup: called straight from the tap (or iOS
  // won't open the picker), it picks the files, says what's in them and
  // puts back all four, or just the one notebook the backup is of.
  async function fromShelf() {
    const files = await D.pickFiles(PICK);
    if (!files.length) return false;
    let got;
    try { got = await B.whatsIn(files); } catch (err) { sorry(err.message); return false; }
    return confirm(files, { only: got.all ? null : got.app });
  }

  // Inside a notebook (here: its app id), once a backup's been picked:
  // which part of it to put back. { files } for the notebook's own Restore
  // to take (one notebook's part of a .json of all four made into a file of
  // its own), { all: true } for all four, or null when the sheet's closed.
  // A file that isn't a backup of all four goes to the notebook's own
  // Restore as it is, which says what's wrong with it.
  async function which(files, here) {
    let got = null;
    try { got = await B.whatsIn(files); } catch (e) { /* the notebook's own Restore says why */ }
    if (!got || !got.all) return { files };
    const json = !(await D.isZipFile(files[0]));
    const just = async () => ({ files: json ? [await B.partFile(files[0], here)] : files });
    if (!D.inSuite()) return just(); // on its own, a notebook has only itself
    return new Promise((resolve) => {
      let picked = false;
      const s = S.frame('Restore', `<p class="dfb-text">This backup has all four notebooks.</p>
        <button type="button" class="dfb-btn" data-just>Just ${BOOKS[here].name}</button>
        <button type="button" class="dfb-btn quiet" data-all>All four</button>`, () => { if (!picked) resolve(null); });
      s.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-just], [data-all]');
        if (!b) return;
        picked = true;
        s.close();
        resolve(b.hasAttribute('data-all') ? { all: true } : await just());
      });
    });
  }

  window.DFRestore = { PICK, fromShelf, which, confirm };
})();
