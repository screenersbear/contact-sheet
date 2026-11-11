// The PDF preview: shows the sheets exactly where the PDF will put them, says
// which pictures are too small to print sharply, and only then saves.
//
// It draws the sheets itself instead of embedding the PDF, because iPhones
// show just the first page of a PDF inside a page.
import { SHEET_W, SHEET_H, makePdf } from './pdf.js';
import { ICONS } from './icons.js';
import { choiceSheet, toast } from './ui.js';
import { clamp, downloadBlob, isPhone } from './util.js';

const MAX_ZOOM = 4;
const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
const box = (r) => `left:${pct(r.x, SHEET_W)};top:${pct(SHEET_H - r.y - r.h, SHEET_H)};width:${pct(r.w, SHEET_W)};height:${pct(r.h, SHEET_H)}`;

// Phones get the share sheet (Print, Save to Files); computers a download.
async function sendPdf(blob, name) {
  const file = new File([blob], name, { type: 'application/pdf' });
  let canShare = false;
  try {
    canShare = isPhone() && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {}
  if (!canShare) {
    downloadBlob(blob, name);
    return true;
  }
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (e) {
    if (e && e.name !== 'AbortError') toast('Sharing did not work here. Try again in Safari.');
    return false;
  }
}

function noticeHtml({ checked, low }) {
  if (low.length) {
    const one = low.length === 1;
    return `<button type="button" class="pdfv-notice is-low" data-low><span><b>${low.length} ${one ? 'picture' : 'pictures'} may not print sharply.</b> Tap to see ${one ? 'it' : 'which'}.</span></button>`;
  }
  return checked ? '<p class="pdfv-notice">Every picture is sharp enough to print.</p>' : '';
}

// Fills open sheet `s` with the preview. report: { checked, low: [{ ppi,
// blurry, thumb, sheet, label }] }. Returns a function that frees the images.
export function showPdf(s, { sheets, report, fileName, onSaved }) {
  const urls = new Map();
  const urlOf = (blob) => {
    if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
    return urls.get(blob);
  };
  const sheetHtml = (sheet) => `
    <div class="pdfv-sheet">
      ${sheet.images.map((im) => `<img class="${im.outline ? 'has-edge' : ''}" style="${box(im)}" data-src="${urlOf(im.jpeg)}" alt="" draggable="false" />`).join('')}
      ${(sheet.text || []).map((t) => `<span class="pdfv-text" style="left:${pct(t.x, SHEET_W)};bottom:${pct(t.y, SHEET_H)};font-size:${((t.size / SHEET_W) * 100).toFixed(3)}cqw">${t.str}</span>`).join('')}
      ${(sheet.marks || []).map((m) => `<span class="pdfv-mark${m.blurry ? ' is-blurry' : ''}" style="${box(m)}"></span>`).join('')}
    </div>`;

  s.el.classList.add('sheet-pdf');
  s.setTitle('Preview');
  s.body.innerHTML = `
    ${noticeHtml(report)}
    <div class="pdfv-scroll" data-scroll>
      <div class="pdfv-pages" data-pages>${sheets.map(sheetHtml).join('')}</div>
    </div>
    <div class="pdfv-foot">
      <div class="pdfv-row">
        <span class="pdfv-count" data-count></span>
        <button type="button" class="mini-btn" data-out aria-label="Zoom out">${ICONS.zoomOut}</button>
        <button type="button" class="mini-btn" data-in aria-label="Zoom in">${ICONS.zoomIn}</button>
      </div>
      <button type="button" class="modal-cta primary" data-save>${isPhone() ? 'Save or print' : 'Download PDF'}</button>
    </div>`;

  const scroll = s.body.querySelector('[data-scroll]');
  const pages = s.body.querySelector('[data-pages]');
  const count = s.body.querySelector('[data-count]');
  const zoomOut = s.body.querySelector('[data-out]');
  const zoomIn = s.body.querySelector('[data-in]');
  const sheetEls = [...pages.children];

  // Only the sheets near the screen hold their images: a long notebook's
  // full-size pages would not all fit in an iPhone's memory.
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      for (const img of e.target.querySelectorAll('img')) {
        if (e.isIntersecting) img.src = img.dataset.src;
        else img.removeAttribute('src');
      }
    }
  }, { root: scroll, rootMargin: '400px' });
  sheetEls.forEach((el) => near.observe(el));

  function showCount() {
    const atEnd = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2;
    const line = scroll.scrollTop + sheetEls[0].offsetHeight / 2;
    const n = atEnd ? sheetEls.length - 1 : Math.max(0, sheetEls.findIndex((el) => el.offsetTop + el.offsetHeight > line));
    count.textContent = `Sheet ${n + 1} of ${sheetEls.length}`;
  }
  scroll.addEventListener('scroll', showCount, { passive: true });

  // Zooming keeps the point (cx, cy) on the screen where it is.
  let z = 1;
  function setZoom(next, cx = scroll.clientWidth / 2, cy = scroll.clientHeight / 2) {
    const to = clamp(next, 1, MAX_ZOOM);
    const k = to / z;
    const x = scroll.scrollLeft + cx;
    const y = scroll.scrollTop + cy;
    z = to;
    pages.style.setProperty('--z', String(z));
    scroll.scrollLeft = x * k - cx;
    scroll.scrollTop = y * k - cy;
    zoomOut.disabled = z <= 1;
    zoomIn.disabled = z >= MAX_ZOOM;
    showCount();
  }
  zoomOut.addEventListener('click', () => setZoom(z / 1.5));
  zoomIn.addEventListener('click', () => setZoom(z * 1.5));

  const inScroll = (x, y) => {
    const r = scroll.getBoundingClientRect();
    return [x - r.left, y - r.top];
  };
  let pinch = null;
  const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  scroll.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = { d: spread(e.touches), z };
  }, { passive: true });
  scroll.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const t = e.touches;
    setZoom((pinch.z * spread(t)) / pinch.d, ...inScroll((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2));
  }, { passive: false });
  scroll.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinch = null;
  });
  scroll.addEventListener('gesturestart', (e) => e.preventDefault());
  // A trackpad pinch arrives as a wheel with ctrl held.
  scroll.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(z * Math.exp(-e.deltaY / 100), ...inScroll(e.clientX, e.clientY));
  }, { passive: false });
  let lastUp = 0;
  scroll.addEventListener('pointerup', (e) => {
    if (e.timeStamp - lastUp < 300) {
      setZoom(z > 1 ? 1 : 2.5, ...inScroll(e.clientX, e.clientY));
      lastUp = 0;
    } else lastUp = e.timeStamp;
  });

  function goTo(n) {
    setZoom(1);
    scroll.scrollTop = sheetEls[n].offsetTop - 12;
    for (const m of sheetEls[n].querySelectorAll('.pdfv-mark')) {
      m.classList.remove('is-flash');
      void m.offsetWidth;
      m.classList.add('is-flash');
    }
  }

  const lowBtn = s.body.querySelector('[data-low]');
  if (lowBtn) {
    lowBtn.addEventListener('click', async () => {
      const key = await choiceSheet({
        title: 'Low resolution',
        message: 'Book printers ask for 300 pixels per inch at the printed size. Below 150 usually looks blurry.',
        options: report.low.map((l, i) => ({
          key: String(i),
          icon: l.thumb ? `<img class="pdfv-thumb" src="${urlOf(l.thumb)}" alt="" />` : '',
          label: l.label,
          detail: `${l.ppi} pixels per inch. ${l.blurry ? 'Will look blurry.' : 'May look a little soft.'}`,
        })),
        footer: '<p class="field-hint">To fix one, use a larger copy of the picture, zoom out of it, or make its frame smaller.</p>',
      });
      if (key !== null) goTo(report.low[Number(key)].sheet);
    });
  }

  // Built on the tap with nothing to wait for, so the share sheet may open.
  s.body.querySelector('[data-save]').addEventListener('click', async () => {
    if (await sendPdf(makePdf(sheets), fileName)) onSaved();
  });

  setZoom(1);
  return () => {
    near.disconnect();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}
