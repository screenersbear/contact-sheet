// How much of the screen a chapter's pages take. A page is measured from
// where its two slides meet out to the edge of the screen: no notebook round
// them any more, just a margin.
export const OUT = 0; // left outside the pages
export const RIM = 0; // no notebook edge
export const GAP = 16; // from the screen's edge to the photos
export const PEEK = OUT + RIM + GAP; // how far the page beyond shows
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
