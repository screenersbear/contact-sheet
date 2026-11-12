// The tour: a few cards on how Contact Sheet works. Options > How it works
// shows them, and inside Documenting Fictions they're offered the first time
// the notebook is opened (welcome.js).
import { openSheet } from './ui.js';

const CARDS = [
  ['A chapter is a post', 'Tap New chapter, pick a size and start from a template or a blank page. Each chapter is one post: slides for a carousel, or stories.'],
  ['Fill the frames', 'Double-tap a frame to add a photo or video. A frame can run across the edge of a slide, so one photo carries on into the next.'],
  ['Save it out', 'In a chapter, Export saves its slides to Photos, ready to post. Options can save the whole notebook as a PDF.'],
  ['Keep a copy', 'Your chapters are saved inside the app, on this phone. Now and then, save a backup in Options.'],
];

export function openIntro() {
  let at = 0;
  const s = openSheet({ title: CARDS[0][0], className: 'sheet-small intro' });
  const draw = () => {
    const last = at === CARDS.length - 1;
    s.setTitle(CARDS[at][0]);
    s.body.innerHTML = `
      <p class="sheet-message">${CARDS[at][1]}</p>
      <span class="wz-dots intro-dots" aria-hidden="true">${CARDS.map((_, i) => `<i class="${i === at ? 'on' : ''}"></i>`).join('')}</span>
      <div class="sheet-actions${at ? '' : ' one'}">
        ${at ? '<button type="button" class="btn secondary" data-back>Back</button>' : ''}
        <button type="button" class="btn primary" data-next>${last ? 'Got it' : 'Next'}</button>
      </div>`;
  };
  s.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { at--; draw(); }
    else if (e.target.closest('[data-next]')) { if (at === CARDS.length - 1) s.close(); else { at++; draw(); } }
  });
  draw();
  return s;
}
