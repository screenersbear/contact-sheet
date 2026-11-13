// Export (round 2, 06-export): a page of its own with the short EXPORT band.
// Every slide is drawn on its own at full size from the original photos;
// then they show numbered in posting order, to leave out or move, and one
// button saves them to Photos (phones) or downloads them (a ZIP for several).
import { SLIDE_W, slideH, pageWord, isPrint } from '../data/formats.js';
import { makeZip } from '../data/zip.js';
import { MAX_VIDEO_S, canRecordVideo, hasVideo, recordSlide, startSound } from '../data/videoexport.js';
import { ICONS } from '../components/icons.js';
import { openSheet } from '../components/sheet.js';
import { shortBandHtml } from '../components/band.js';
import { toast } from '../components/toast.js';
import { esc, slug, downloadBlob, isPhone } from '../components/util.js';
import { openSource, exportScale, renderSlides } from '../data/slide-images.js';
import { openLayoutPdf } from './notebook-export.js';
import { dragToReorder } from './export-drag.js';

const PDF_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
const GO_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

// Export goes straight to making the images (JPEG, best for Instagram).
export function openExport(p, photos) {
  const H = slideH(p);
  const empty = p.frames.filter((f) => !f.photoId).length;
  let urls = [];
  const slidesWithVideo = Array.from({ length: p.slides }, (_, i) => i).filter((i) => hasVideo(p, photos, i));
  const record = slidesWithVideo.length > 0 && canRecordVideo();
  // Started here, on the tap, or an iPhone keeps the sound off.
  const audio = record ? startSound() : null;
  const s = openSheet({
    title: 'Export',
    className: 'sheet-page sheet-export',
    onClose: () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      if (audio) audio.close().catch(() => {});
    },
  });
  s.body.innerHTML = `
    ${shortBandHtml({ name: 'Export', backAttr: 'data-close' })}
    <div class="page-scroll" data-scroll></div>
    <div class="page-foot exp-foot" data-foot hidden></div>`;
  const scroll = s.body.querySelector('[data-scroll]');
  const foot = s.body.querySelector('[data-foot]');

  async function run() {
    foot.hidden = true;
    scroll.innerHTML = `
      <h1 class="page-title" data-msg>Getting ready</h1>
      <p class="page-ask" data-hint>${p.slides} ${esc(pageWord(p, p.slides !== 1))}, each ${Math.round(SLIDE_W * exportScale(p))} × ${Math.round(H * exportScale(p))}. Keep this screen open while it works.</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>`;
    const msg = scroll.querySelector('[data-msg]');
    const bar = scroll.querySelector('[data-bar]');
    let files;
    try {
      files = await renderSlides(p, photos, 'jpeg', (i, n) => {
        msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
        bar.style.width = `${Math.round((i / n) * 100)}%`;
      });
      if (record) {
        scroll.querySelector('[data-hint]').textContent = `Videos are made as they play, up to ${MAX_VIDEO_S} seconds each. Keep this screen open while it works.`;
        const live = document.createElement('div');
        live.className = 'video-live';
        scroll.appendChild(live);
        for (const i of slidesWithVideo) {
          if (!s.overlay.isConnected) return;
          msg.textContent = `Making the video on ${pageWord(p)} ${i + 1}`;
          bar.style.width = '0%';
          const made = await recordSlide(p, photos, i, {
            audio,
            host: live,
            openSource,
            stillOpen: () => s.overlay.isConnected,
            onTime: (t, length) => (bar.style.width = `${Math.round((t / length) * 100)}%`),
          });
          files[i] = { ...files[i], ...made, name: files[i].name.replace(/\.jpg$/, `.${made.ext}`) };
        }
      }
    } catch (e) {
      console.error(e);
      if (!s.overlay.isConnected) return;
      scroll.innerHTML = `
        <h1 class="page-title">That didn't work</h1>
        <p class="page-ask">Something went wrong making the ${record ? 'videos' : 'images'}. Keep this screen open and try again, or try fewer ${esc(pageWord(p, true))} at a time.</p>`;
      foot.innerHTML = '<button type="button" class="btn primary" data-again>Try again</button>';
      foot.hidden = false;
      foot.querySelector('[data-again]').addEventListener('click', run);
      return;
    }
    if (!s.overlay.isConnected) return;
    finished(files);
  }

  function finished(files) {
    urls = files.map((f) => URL.createObjectURL(f.thumb));
    const base = slug(p.name);
    const n = files.length;
    let order = files.map((_, i) => i);
    const off = new Set();
    let canShare = false;
    try {
      canShare = isPhone() && !!navigator.canShare && navigator.canShare({ files: files.map((f) => new File([f.blob], f.name, { type: f.mime })) });
    } catch {}
    const word = pageWord(p);
    scroll.innerHTML = `
      ${n > 1
        ? `<h1 class="page-title">${isPrint(p) ? 'Keep' : 'Post'} them in this order</h1>
           <p class="page-ask">Tap a ${esc(word)} to leave it out. Hold and drag to change the order.</p>`
        : `<h1 class="page-title">Ready</h1><p class="page-ask">Your ${esc(word)}, made at full size.</p>`}
      <ol class="order-grid${n > 1 ? ' is-pick' : ''}" data-grid>
        ${files.map((f, i) => `<li data-i="${i}"><img style="aspect-ratio:${f.width}/${f.height}" src="${urls[i]}" alt="${esc(word)} ${i + 1}" draggable="false" /><span class="order-num"></span>${f.isVideo ? `<span class="order-vid">${ICONS.play}</span>` : ''}<span class="order-off">Left out</span></li>`).join('')}
      </ol>
      ${n > 1 ? '<p class="order-count" data-count></p>' : ''}
      ${empty ? `<p class="tip">${empty === 1 ? '1 box is' : `${empty} boxes are`} empty and show the background color.</p>` : ''}
      ${slidesWithVideo.length && !record ? `<p class="tip">This browser can't save video, so those ${esc(pageWord(p, true))} are saved as still images. Safari and Chrome can.</p>` : ''}
      <button type="button" class="exp-row" data-pdf>
        <span class="exp-row-icon">${PDF_ICON}</span>
        <span class="exp-row-text"><span class="exp-row-name">Printable PDF</span><span class="exp-row-sub">Preview, sharpness check, then save or print</span></span>
        <span class="exp-row-go">${GO_ICON}</span>
      </button>`;
    foot.innerHTML = `
      <button type="button" class="btn primary" data-save></button>
      ${canShare ? '<p class="exp-hint" data-share-hint></p>' : ''}`;
    foot.hidden = false;
    const grid = scroll.querySelector('[data-grid]');
    const count = scroll.querySelector('[data-count]');
    const save = foot.querySelector('[data-save]');
    const hint = foot.querySelector('[data-share-hint]');
    const items = new Map([...grid.children].map((li) => [Number(li.dataset.i), li]));

    // The chosen images, in the chosen order, named 01, 02... in that order.
    const chosen = () =>
      order.filter((i) => !off.has(i)).map((i, k) => ({ ...files[i], name: `${base}-${String(k + 1).padStart(2, '0')}.${files[i].ext || 'jpg'}` }));

    function draw() {
      let k = 0;
      for (const i of order) {
        const li = items.get(i);
        grid.appendChild(li);
        li.classList.toggle('is-off', off.has(i));
        li.querySelector('.order-num').textContent = off.has(i) ? '' : String(++k);
      }
      const c = k;
      save.disabled = !c;
      if (canShare) save.textContent = c ? `Save ${c} to Photos` : 'Save to Photos';
      else save.textContent = c > 1 ? `Download ${c} as ZIP` : 'Download';
      if (count) count.textContent = c === n ? `${n} ${pageWord(p, true)}` : `${c} of ${n} ${pageWord(p, true)} · ${n - c} left out`;
      if (hint) {
        const v = order.filter((i) => !off.has(i) && files[i].isVideo).length;
        const what = !v ? (c === 1 ? 'Image' : `${c} Images`) : c === 1 ? 'Video' : v === c ? `${c} Videos` : `${c} Items`;
        hint.innerHTML = c ? `In the share sheet, tap <b>Save ${what}</b>.` : `Tap a ${esc(word)} to put it back.`;
      }
    }

    save.addEventListener('click', async () => {
      const list = chosen();
      if (!list.length) return;
      if (canShare) {
        try {
          await navigator.share({ files: list.map((f) => new File([f.blob], f.name, { type: f.mime })) });
          s.close();
        } catch (e) {
          // Cancelling the share sheet stays here, to change the picks or try again.
          if (e && e.name !== 'AbortError') toast('Sharing did not work here. Try again in Safari.');
        }
        return;
      }
      if (list.length === 1) downloadBlob(list[0].blob, list[0].name);
      else downloadBlob(await makeZip(list), `${base}.zip`);
      s.close();
    });

    scroll.querySelector('[data-pdf]').addEventListener('click', () => {
      const picked = order.filter((i) => !off.has(i));
      if (picked.length) openLayoutPdf(p, photos, picked, base, s);
    });

    if (n > 1) {
      let suppress = false;
      grid.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-i]');
        if (!li || suppress) return;
        const i = Number(li.dataset.i);
        if (off.has(i)) off.delete(i);
        else off.add(i);
        draw();
      });
      dragToReorder(grid, (from, to) => {
        const [i] = order.splice(from, 1);
        order.splice(to, 0, i);
        draw();
      }, (v) => (suppress = v));
    }
    draw();
  }

  run();
  return s;
}
