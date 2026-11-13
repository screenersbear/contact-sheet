// The notebook's fixed numbers and words: its size, its turn, the tabs, the
// tip; when its art is ready, and which mode a route opens it in.

export const TIP_KEY = 'contact-sheet-home-tip';
export const RATIO = 1000 / 1360;
 // the notebook art's width over its height
export const TIP = `<p class="toc-tip"><b>Keep your chapters safe:</b> add Contact Sheet to your Home Screen. Safari can clear the photos of sites that aren't on it. <button type="button" class="text-btn" data-tip-off>Got it</button></p>`;
export const STACK = 16;
 // sheets drawn for the thickness of the shut book
export const TURNED = (20 * Math.PI) / 180;
 // the shut book's turn; matches styles/notebook.css
export const PERSPECTIVE = 1100;
 // matches .nb in styles/notebook.css
export const TAB_OUT = 0.06;
 // how far the tabs stick out, of the book's width
// Zoomed in, the open book's coloured edge is this many screen pixels wide and
// its paper starts PAPER_IN inside it. The page zooms OVER past the screen's
// edges, so its paper, round corners and all, covers the whole screen.
export const RIM = 10;
export const PAPER_IN = 7;
export const OVER = PAPER_IN + 12;
export const OPEN_MS = 860;
 // the cover swinging open and the book zooming in
export const ZOOM_MS = 760;

 // 'first' opens on the Table of contents
export const TABS = [['toc', 'Table of contents'], ['new', 'New chapter']];

// Resolves once the notebook's art can paint, so the shut book appears whole.
// Never waits long: a slow file shouldn't keep the notebook away.
export function artReady() {
  const book = document.documentElement.dataset.book || 'orange';
  const ready = ['cover', 'block'].map((part) => {
    const img = new Image();
    img.src = `art/${book}-${part}.webp`;
    return img.decode().catch(() => {});
  });
  if (document.fonts && document.fonts.load) ready.push(document.fonts.load('16px "Klee One"').catch(() => {}));
  return Promise.race([Promise.all(ready), new Promise((done) => setTimeout(done, 1200))]);
}

export function modeOfHash(h) {
  return h === '/contents' || h === '/book' ? 'toc' : 'closed';
}
export const currentMode = () => modeOfHash((location.hash || '#/').slice(1) || '/');
