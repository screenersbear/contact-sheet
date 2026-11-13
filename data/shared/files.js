// Handing a file over: saving one to the phone or computer, and picking files
// to bring in.
(function () {
  'use strict';
  const parts = window.DFDataParts;

  // ---------- Handing a file over ----------
  // The share sheet where there is one (Save to Files on a phone), else a download.
  async function saveFile(file, { share = true } = {}) {
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  }
  // Asks for files (as many as wanted); resolves with them, [] if none.
  function pickFiles(accept = 'application/json,.json') {
    return new Promise((ok) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.multiple = true; input.style.display = 'none';
      input.addEventListener('change', () => { ok(input.files ? [...input.files] : []); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }
  // Asks for a file; resolves with it, or null if none was picked.
  function pickFile(accept = 'application/json,.json') {
    return new Promise((ok) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.style.display = 'none';
      input.addEventListener('change', () => { ok(input.files && input.files[0] ? input.files[0] : null); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }

  Object.assign(parts, { saveFile, pickFiles, pickFile });
})();
