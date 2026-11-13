// Contact Sheet's backups: the notebooks' shared zip (df-data.js's
// zipBackup and restoreZip), put together from the stored photos themselves
// so the phone never holds the notebook in memory. A backup of all four from
// the shelf restores here too (Contact Sheet's part of it). Old .json
// backups still restore (df-data.js's importDb, in pages/options-backup.js).
const D = window.DFData;

// Resolves with { parts, size, release, done } (df-data.js's zipBackup).
export const makeBackup = ({ extra = {}, onProgress } = {}) =>
  D.zipBackup({ app: 'contact-sheet', databases: ['contact-sheet'], extra, filename: `contact-sheet-backup-${D.todayStr()}.zip`, onProgress });
export const isZipBackup = (file) => D.isZipFile(file);
// `files`: the backup's one zip, or all the files it was saved as.
export const restoreBackup = (files, onProgress) => D.restoreZip(files, { databases: ['contact-sheet'], onProgress });
