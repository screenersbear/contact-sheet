// Contact Sheet's restore of a zip backup: the notebooks' shared zip
// (df-data.js's restoreZip), Contact Sheet's part of it, read from the
// stored photos themselves so the phone never holds the notebook in memory.
// A backup of all four restores here too (Contact Sheet's part of it). Old
// .json backups still restore (df-data.js's importDb, in
// pages/options-backup.js). Back up itself is the sheet every notebook
// shares (components/shared/backup-sheet.js).
const D = window.DFData;

export const isZipBackup = (file) => D.isZipFile(file);
// `files`: the backup's one zip, or all the files it was saved as.
export const restoreBackup = (files, onProgress) => D.restoreZip(files, { databases: ['contact-sheet'], onProgress });
