// The Eye's own data, read from where it keeps it: its shoots in
// localStorage, and how it names a shoot.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const { hasText, store } = parts;

  // ---------- The Eye's own data, read from where it keeps it ----------
  const EYE_STATE = 'dailies_state_v1';
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

  Object.assign(parts, { eyeState, eyeShootName });
})();
