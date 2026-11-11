// The notebook's size on screen. The Table of contents and every chapter ask
// here, so they all open to the very same frame.
//
// A page is measured from the spine to the outside of the notebook's rim.
export const OUT = 6; // white left outside the rim
export const RIM = 10; // the notebook's coloured edge; matches --nb-rim
export const GAP = 4; // from the rim to the photo
export const PEEK = OUT + RIM + GAP; // how far the page beyond the spine shows
const PAGE_RATIO = 0.74; // a page never gets wider than a notebook page would
const MIN_TWO = 300; // narrower than this, one page shows at a time

// w: the window's width. h: the frame's height.
// one: a page when you read a page at a time. both: a page with two in view.
export function bookSize(w, h) {
  const cap = (h - 2 * RIM) * PAGE_RATIO + RIM + GAP;
  const half = w / 2 - OUT;
  const two = half >= MIN_TWO;
  const both = Math.min(half, cap);
  return { two, both, one: two ? both : Math.min(w - OUT - PEEK, cap) };
}

// Where the notebook's left edge sits, given a page's width.
export const bookLeft = (w, page) => (2 * page + 2 * OUT <= w + 1 ? (w - 2 * page) / 2 : OUT);
