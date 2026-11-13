// The Eye's own data, read from where it keeps it: its shoots in
// localStorage, its photos in its database.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { open, rows, hasText, nowIso, todayStr, store } = parts;

  // ---------- The Eye's own data, read from where it keeps it ----------
  const EYE_STATE = 'dailies_state_v1';
  const EYE_IDB = 'starky-moodboards';
  // Version 1: the upgrade only runs when the database is first made, so the store is always new.
  const openEyePhotos = () => open(EYE_IDB, 1, (db) => db.createObjectStore('images'));
  function eyeState() {
    const raw = store.get(EYE_STATE);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  const eyeShootName = (s, mode) => {
    const t = (s.talents || []).find((x) => hasText(x.name));
    const talent = t ? t.name : '';
    return mode === 'title' ? (s.title || talent || 'Untitled shoot') : (talent || s.title || 'Untitled shoot');
  };
  // The same file The Eye's own "Back up all data" makes, so its Restore reads it.
  async function eyeBackupFile() {
    const state = eyeState();
    if (!state) return null;
    const db = await openEyePhotos();
    const images = Object.fromEntries(await rows(db, 'images'));
    db.close();
    const payload = { version: 1, exportedAt: nowIso(), state, images };
    return new File([JSON.stringify(payload)], `starky-backup-${todayStr()}.json`, { type: 'application/json' });
  }
  // The Eye's backup file (or the reflections file it saves for Overthoughts), read.
  async function readEyeFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't from The Eye."); }
    if (!data || !data.state || !Array.isArray(data.state.shoots)) throw new Error("That file isn't from The Eye.");
    return { state: data.state, images: data.images || {} };
  }

  Object.assign(parts, { openEyePhotos, eyeState, eyeShootName, eyeBackupFile, readEyeFile });
})();
