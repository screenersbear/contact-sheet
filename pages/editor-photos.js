// Photos in and out of a chapter: bringing them in from the phone, filling
// the empty frames, and taking them out of the tray.
import { MAX_SLIDES, pageWord } from '../data/formats.js';
import { newFrame, defaultCrop } from '../data/templates.js';
import { anchorSlide, insertSlide } from '../data/slides.js';
import { slideBox } from '../data/slide-layouts.js';
import { askToPersist } from '../data/db.js';
import { importFiles, pickFiles } from '../data/photos.js';
import { openSheet } from '../components/sheet.js';
import { choiceSheet } from '../components/dialogs.js';
import { toast } from '../components/toast.js';
import { ICONS } from '../components/icons.js';
import { esc } from '../components/util.js';

export function addPhotosInOut(ed) {
  Object.assign(ed, { importInto, addPhotos, openSwap, trayTap });
  // ---------- Photos in and out ----------
  // targetIds: the frames to fill first, in order (one id or a list).
  async function importInto(files, targetIds = []) {
    askToPersist();
    // Progress shows on the + Photos button; render() puts its label back.
    const addLabel = ed.trayEl.querySelector('.tray-add span');
    const { photos: added, failed } = await importFiles(ed.p.id, files, (i, n) => {
      if (addLabel) addLabel.textContent = n === 1 ? 'Adding' : `${i + 1} of ${n}`;
    });
    if (ed.destroyed) return;
    added.forEach((r) => {
      ed.photos[r.id] = r;
      if (!ed.p.photoIds.includes(r.id)) ed.p.photoIds.push(r.id);
    });
    if (failed.length) toast(`${failed.length === 1 ? 'One file' : `${failed.length} files`} could not be opened. JPEG, PNG and MP4 work everywhere.`, { ms: 5000 });
    const queue = added.map((r) => r.id);
    const targets = [].concat(targetIds || []).map((id) => ed.frameById(id)).filter(Boolean);
    for (const f of targets) if (queue.length) ed.putPhoto(f, queue.shift());
    const fillEmpty = () => {
      if (!targets.length) for (const f of ed.emptyFrames()) if (queue.length) ed.putPhoto(f, queue.shift());
    };
    const open = targets.length ? 0 : ed.emptyFrames().length;
    const extra = queue.length - open;
    ed.render();
    if (extra > 0 && ed.p.slides < MAX_SLIDES) {
      // Nothing is placed until this is answered, so keeping them in the
      // tray leaves the pages exactly as they were.
      const room = Math.min(extra, MAX_SLIDES - ed.p.slides);
      const word = pageWord(ed.p, room !== 1);
      const photosLine = queue.length === 1 ? 'One photo' : `${queue.length} photos`;
      const key = await choiceSheet({
        title: 'More photos than boxes',
        message: open ? `${photosLine}, ${open === 1 ? 'one empty box' : `${open} empty boxes`}.` : `${photosLine} without a box.`,
        options: [
          { key: 'slides', label: `Add ${room} ${word}`, detail: open ? `Fills the empty boxes, then one photo on each new ${pageWord(ed.p)}.` : `One photo on each new ${pageWord(ed.p)}.` },
          { key: 'tray', label: 'Keep them in the tray', detail: 'Nothing goes on the pages yet.' },
        ],
      });
      if (key === 'slides' && !ed.destroyed) {
        fillEmpty();
        for (let n = 0; n < room && queue.length; n++) {
          ed.apply(insertSlide(ed.p, ed.p.slides));
          const b = slideBox(ed.p, ed.p.slides - 1);
          ed.p.frames.push(newFrame(b.x, b.y, b.w, b.h, queue.shift()));
        }
        ed.fitIfNeeded();
        ed.render();
      }
    } else {
      fillEmpty();
      ed.render();
    }
    ed.commit();
  }

  async function addPhotos() {
    const files = await pickFiles({ multiple: true });
    if (files.length) await importInto(files);
  }

  // The frames one pick fills: the tapped frame first, then the other empty
  // frames on its slide, top to bottom. A frame with a photo is a swap: one.
  function slideTargets(f) {
    if (f.photoId) return [f.id];
    const k = anchorSlide(f, ed.p.slides);
    const rest = ed.p.frames
      .filter((o) => o !== f && !o.photoId && anchorSlide(o, ed.p.slides) === k)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    return [f.id, ...rest.map((o) => o.id)];
  }

  // Three columns, each photo at its own shape, filled shortest column first
  // so the order still reads left to right.
  function pickColumns(list, current) {
    const cols = [[], [], []];
    const tall = [0, 0, 0];
    for (const pid of list) {
      const ph = ed.photos[pid];
      const i = tall.indexOf(Math.min(...tall));
      cols[i].push(`<button type="button" class="pick-photo${pid === current ? ' is-current' : ''}" data-pid="${pid}" style="aspect-ratio:${ph.width || 1} / ${ph.height || 1}"><img src="${ed.thumbOf(pid)}" alt="" draggable="false" />${ph.kind === 'video' ? `<span class="tray-vid">${ICONS.play}</span>` : ''}<span class="pick-num"></span></button>`);
      tall[i] += (ph.height || 1) / (ph.width || 1);
    }
    return `<div class="pick-grid">${cols.map((c) => `<div class="pick-col">${c.join('')}</div>`).join('')}</div>`;
  }

  function openSwap(fid) {
    const f = ed.frameById(fid);
    if (!f) return;
    const targets = slideTargets(f);
    const max = targets.length;
    const many = max > 1;
    const list = ed.p.photoIds.filter((pid) => ed.photos[pid]);
    // Nothing in the draft to choose from yet: go straight to the camera roll.
    if (!list.length) {
      pickFiles({ multiple: many }).then((files) => files.length && importInto(files, targets));
      return;
    }
    const s = openSheet({
      title: f.photoId ? 'Swap photo' : many ? 'Add photos' : 'Add a photo',
      className: many ? 'has-footer' : '',
      body: `
        ${many ? `<p class="sheet-message">Pick up to ${max}, one for each empty box on this ${esc(pageWord(ed.p))}.</p>` : ''}
        ${pickColumns(list, f.photoId)}
        ${many
          ? `<div class="sheet-footer"><div class="button-stack">
              <button type="button" class="small-btn primary" data-place disabled>Place photos</button>
              <button type="button" class="small-btn secondary" data-new>+ From camera roll</button>
            </div></div>`
          : `<div class="button-stack">
              <button type="button" class="small-btn primary" data-new>+ From camera roll</button>
              ${f.photoId ? '<button type="button" class="small-btn secondary" data-empty>Empty this box</button>' : ''}
            </div>`}`,
    });
    const picked = [];
    const placeBtn = s.body.querySelector('[data-place]');
    function mark() {
      s.body.querySelectorAll('[data-pid]').forEach((b) => {
        const n = picked.indexOf(b.dataset.pid);
        b.classList.toggle('is-picked', n >= 0);
        b.querySelector('.pick-num').textContent = n >= 0 ? String(n + 1) : '';
      });
      placeBtn.disabled = !picked.length;
      placeBtn.textContent = picked.length ? `Place ${picked.length} photo${picked.length === 1 ? '' : 's'}` : 'Place photos';
    }
    // Put the picked photos in, in the order they were tapped.
    function place() {
      picked.forEach((pid, i) => {
        const fr = ed.frameById(targets[i]);
        if (fr) ed.putPhoto(fr, pid);
      });
    }
    s.body.querySelectorAll('[data-pid]').forEach((b) =>
      b.addEventListener('click', () => {
        const pid = b.dataset.pid;
        if (!many) {
          const fr = ed.frameById(fid);
          if (fr) ed.putPhoto(fr, pid);
          s.close();
          ed.render();
          ed.commit();
          return;
        }
        const n = picked.indexOf(pid);
        if (n >= 0) picked.splice(n, 1);
        else if (picked.length < max) picked.push(pid);
        mark();
      })
    );
    if (placeBtn) {
      placeBtn.addEventListener('click', () => {
        place();
        s.close();
        ed.render();
        ed.commit();
      });
    }
    s.body.querySelector('[data-new]').addEventListener('click', async () => {
      // Photos already picked here go in first; the camera roll fills the rest.
      place();
      const left = targets.slice(picked.length);
      s.close();
      if (picked.length) {
        ed.render();
        ed.commit();
      }
      if (!left.length) return;
      const files = await pickFiles({ multiple: left.length > 1 });
      if (files.length) await importInto(files, left);
    });
    const emptyBtn = s.body.querySelector('[data-empty]');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        const fr = ed.frameById(fid);
        if (fr) {
          fr.photoId = null;
          fr.crop = defaultCrop();
        }
        ed.photoMode = false;
        s.close();
        ed.render();
        ed.commit();
      });
    }
  }

  function trayTap(pid) {
    const f = ed.selFrame() || ed.emptyFrames()[0];
    if (!f) return;
    ed.putPhoto(f, pid);
    ed.sel = f.id;
    ed.render();
    ed.commit();
  }
}
