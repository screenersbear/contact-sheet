// Drawing the strip: every frame and its photo (videos play on the open
// pages), the spine, a frame's x and the lines a moving photo snaps to.
import { SLIDE_W, SAFE_TOP, SAFE_BOTTOM, isStory, pageTitle } from '../data/formats.js';
import { cssTransform } from '../components/placement.js';
import { anchorSlide } from '../data/slides.js';
import { borderBands } from '../data/slide-layouts.js';
import { spreadOf } from '../data/spreads.js';
import { ICONS } from '../components/icons.js';
import { esc } from '../components/util.js';
import { lineH } from './editor-sizes.js';

export function addStrip(ed) {
  Object.assign(ed, { dropVideo, placeFrame, renderSafe, placeSel, placeX, showGuides, showFrameGuides, renderStrip, renderTop, render });
  // ---------- Strip rendering ----------
  const frameEls = new Map(); ed.frameEls = frameEls;

  function dropVideo(o) {
    if (!o.video) return;
    o.video.pause();
    o.video.removeAttribute('src');
    o.video.load();
    o.video.remove();
    o.video = null;
  }

  // Videos play silently over their stills, only on the pages lying open:
  // an iPhone can only decode a few at once.
  function showVideo(f, o, ph) {
    if (ph.kind !== 'video' || !ph.original || spreadOf(anchorSlide(f, ed.p.slides)) !== ed.spread) {
      dropVideo(o);
      return;
    }
    if (!o.video || o.video.dataset.pid !== f.photoId) {
      dropVideo(o);
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.dataset.pid = f.photoId;
      v.style.width = `${ph.previewW}px`;
      v.style.height = `${ph.previewH}px`;
      // The still stays until there's a moving picture to replace it.
      v.style.visibility = 'hidden';
      v.addEventListener('playing', () => (v.style.visibility = ''), { once: true });
      v.addEventListener('error', () => o.video === v && dropVideo(o), { once: true });
      v.src = ed.videoSrc(f.photoId);
      o.img.after(v);
      o.video = v;
      v.play().catch(() => {});
    }
    o.video.style.transform = o.img.style.transform;
  }

  function placeFrame(f) {
    const o = frameEls.get(f.id);
    if (!o) return;
    const s = o.el.style;
    s.left = `${f.x * ed.z}px`;
    s.top = `${f.y * ed.z}px`;
    s.width = `${f.w * ed.z}px`;
    s.height = `${f.h * ed.z}px`;
    const ph = f.photoId && ed.photos[f.photoId];
    if (ph) {
      if (o.img.dataset.pid !== f.photoId) {
        o.img.dataset.pid = f.photoId;
        o.img.src = ed.urlOf(f.photoId);
        o.img.style.width = `${ph.previewW}px`;
        o.img.style.height = `${ph.previewH}px`;
      }
      o.img.hidden = false;
      o.img.style.transform = cssTransform(f, ph, ph.previewW, ed.z);
      showVideo(f, o, ph);
    } else {
      dropVideo(o);
      o.img.hidden = true;
      o.img.removeAttribute('src');
      delete o.img.dataset.pid;
    }
    const bw = ph ? ed.p.borderWidth || 0 : 0;
    o.line.hidden = !bw;
    if (bw) o.line.style.boxShadow = `inset 0 0 0 ${Math.max(0.5, bw * ed.z)}px ${ed.p.borderColor}`;
    o.el.classList.toggle('is-empty', !ph);
    o.el.classList.toggle('is-target', ed.dropTarget === f.id);
    o.el.classList.toggle('is-roomy', f.w * ed.z >= 120 && f.h * ed.z >= 90);
  }

  function renderFrames() {
    const seen = new Set();
    ed.p.frames.forEach((f, i) => {
      let o = frameEls.get(f.id);
      if (!o) {
        const el = document.createElement('div');
        el.className = 'fr';
        el.dataset.id = f.id;
        el.innerHTML = `<img alt="" draggable="false" hidden /><div class="fr-line" hidden></div>
          <div class="fr-empty"><span class="fr-plus">${ICONS.plus}</span><span class="fr-hint">Double-tap to add a photo or video</span></div>`;
        o = { el, img: el.querySelector('img'), line: el.querySelector('.fr-line') };
        frameEls.set(f.id, o);
      }
      if (ed.framesEl.children[i] !== o.el) ed.framesEl.insertBefore(o.el, ed.framesEl.children[i] || null);
      placeFrame(f);
      seen.add(f.id);
    });
    for (const [fid, o] of frameEls) {
      if (!seen.has(fid)) {
        dropVideo(o);
        o.el.remove();
        frameEls.delete(fid);
      }
    }
  }

  function box(el, r) {
    el.style.left = `${r.x * ed.z}px`;
    el.style.top = `${r.y * ed.z}px`;
    el.style.width = `${r.w * ed.z}px`;
    el.style.height = `${r.h * ed.z}px`;
  }

  function renderBands() {
    const html = [];
    for (let i = 0; i < ed.p.slides; i++) {
      for (const b of borderBands(ed.p, i)) {
        html.push(`<div class="border-band" style="left:${b.x * ed.z}px;top:${b.y * ed.z}px;width:${b.w * ed.z}px;height:${b.h * ed.z}px;background:${esc(ed.p.background)}"></div>`);
      }
    }
    ed.bandsEl.innerHTML = html.join('');
  }

  // The spine stands in for the seam between the two open pages.
  function renderSeams() {
    ed.seamsEl.innerHTML = '';
  }

  function renderSafe() {
    const on = isStory(ed.p) && ed.showSafe;
    ed.safeEl.hidden = !on;
    if (!on) return;
    let html = '';
    for (let i = 0; i < ed.p.slides; i++) {
      const x = i * SLIDE_W * ed.z;
      const w = SLIDE_W * ed.z;
      html += `<div class="safe-band top" style="left:${x}px;top:0;width:${w}px;height:${SAFE_TOP * ed.z}px"><span>Instagram covers this</span></div>
        <div class="safe-band bottom" style="left:${x}px;top:${(ed.H() - SAFE_BOTTOM) * ed.z}px;width:${w}px;height:${SAFE_BOTTOM * ed.z}px"><span>Instagram covers this</span></div>`;
    }
    ed.safeEl.innerHTML = html;
  }

  function renderLabels() {
    const sw = SLIDE_W * ed.z;
    const word = pageTitle(ed.p);
    let html = '';
    for (let i = ed.firstPage(); i <= ed.lastPage(); i++) {
      // The trash sits right after the label, away from the frame's corner x.
      const del = ed.p.slides > 1 && sw >= 60
        ? `<button type="button" class="ws-del" data-act="del-slide" data-k="${i}" aria-label="Delete ${word.toLowerCase()} ${i + 1}">${ICONS.trash}</button>`
        : '';
      html += `<div class="ws-label${del ? ' has-del' : ''}" style="left:${ed.margX + i * sw}px;top:${ed.margY - lineH()}px;width:${sw}px"><span>${sw >= 90 ? `${word} ${i + 1}` : i + 1}</span>${del}</div>`;
    }
    ed.labelsEl.innerHTML = html;
  }

  function placeSel() {
    const f = ed.selFrame();
    ed.selEl.hidden = !f;
    if (!f) return;
    ed.selEl.style.left = `${ed.margX + f.x * ed.z}px`;
    ed.selEl.style.top = `${ed.margY + f.y * ed.z}px`;
    ed.selEl.style.width = `${f.w * ed.z}px`;
    ed.selEl.style.height = `${f.h * ed.z}px`;
    ed.selEl.classList.toggle('is-photo', ed.photoMode);
    ed.selEl.classList.toggle('has-photo', !!f.photoId);
    ed.selEl.classList.toggle('is-small', f.w * ed.z < 70 || f.h * ed.z < 70);
    placeX();
  }

  // The x sits on the frame's top-right corner, but slides along the top edge
  // to stay on screen when a wide frame runs past the right side.
  function placeX() {
    const f = ed.selFrame();
    const x = ed.selEl.querySelector('.sel-x');
    if (!f || !x) return;
    const left = ed.margX + f.x * ed.z;
    const right = left + f.w * ed.z;
    const edge = ed.ws.scrollLeft + ed.ws.clientWidth - 20;
    const over = Math.max(0, Math.min(right - edge, f.w * ed.z - 30));
    x.style.right = `${-13 + over}px`;
  }

  function showGuides(gx, gy) {
    let html = '';
    if (gx !== null && gx !== undefined) html += `<div class="guide v" style="left:${gx * ed.z}px"></div>`;
    if (gy !== null && gy !== undefined) html += `<div class="guide h" style="top:${gy * ed.z}px"></div>`;
    ed.guidesEl.innerHTML = html;
  }

  // The middle lines of one frame, for a photo moving inside it.
  function showFrameGuides(f, onX, onY) {
    let html = '';
    if (onX) html += `<div class="guide v in-frame" style="left:${(f.x + f.w / 2) * ed.z}px;top:${f.y * ed.z}px;bottom:auto;height:${f.h * ed.z}px"></div>`;
    if (onY) html += `<div class="guide h in-frame" style="top:${(f.y + f.h / 2) * ed.z}px;left:${f.x * ed.z}px;right:auto;width:${f.w * ed.z}px"></div>`;
    ed.guidesEl.innerHTML = html;
  }

  function renderStrip() {
    ed.layout();
    renderFrames();
    renderBands();
    renderSeams();
    renderSafe();
    renderLabels();
    placeSel();
  }

  function renderTop() {
    const u = ed.toolsEl.querySelector('[data-act="undo"]');
    const r = ed.toolsEl.querySelector('[data-act="redo"]');
    if (u) u.disabled = ed.hi === 0;
    if (r) r.disabled = ed.hi >= ed.hist.length - 1;
    ed.nameEl.querySelector('span').textContent = ed.p.name;
  }

  function render() {
    renderStrip();
    renderTop();
    ed.renderTools();
    ed.renderTray();
    ed.renderAdjust();
  }
}
