// The stickers sheet from Options: adding one, and taking one off.
import { pickFiles } from '../data/photos.js';
import { openSheet } from './sheet.js';
import { cornersOf } from './sticker-crop.js';

function openRemove(stickers) {
  const s = openSheet({ title: 'Remove sticker', className: 'sheet-small' });
  const drawList = () => {
    s.body.innerHTML = `
      <p class="sheet-message">Tap the one to remove.</p>
      <div class="opt-stickers">
        ${[...stickers.list()].reverse().map((k) => `
          <button type="button" class="opt-sticker is-${k.shape}" data-id="${k.id}" aria-label="Remove this ${k.shape === 'rect' ? 'rectangle' : k.shape} sticker">
            <img src="${stickers.urlOf(k.id)}" alt="" draggable="false" style="aspect-ratio:${k.ratio || 1}${k.shape === 'circle' ? '' : `;border-radius:${cornersOf(k.ratio || 1)}`}" />
          </button>`).join('')}
      </div>`;
  };
  drawList();
  s.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    await stickers.remove(b.dataset.id);
    if (stickers.list().length) drawList();
    else s.close();
  });
}

// `leave` closes whatever opened this, when a sticker is to be placed.
export function openStickers(stickers, leave) {
  const s = openSheet({
    title: 'Stickers',
    className: 'sheet-small',
    body: `
      <div class="opt-shapes">
        <button type="button" class="opt-shape" data-shape="circle"><i class="is-circle"></i><span>Circle</span></button>
        <button type="button" class="opt-shape" data-shape="square"><i class="is-square"></i><span>Square</span></button>
        <button type="button" class="opt-shape" data-shape="rect"><i class="is-rect"></i><span>Rectangle</span></button>
      </div>
      ${stickers.list().length ? `
        <div class="choice-list">
          <button type="button" class="choice" data-remove><span class="choice-text"><span class="choice-label">Remove sticker</span></span></button>
        </div>` : ''}`,
  });
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shape]');
    if (b) {
      // Asked for straight from the tap: an iPhone refuses the picker otherwise.
      const picking = pickFiles({ multiple: false, accept: 'image/*' });
      s.close();
      if (leave) leave();
      picking.then(([file]) => file && stickers.add(b.dataset.shape, file));
      return;
    }
    if (e.target.closest('[data-remove]')) {
      s.close();
      openRemove(stickers);
    }
  });
}
