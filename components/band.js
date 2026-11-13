// The band on top of the home page (round 2, DESIGN.md 9.1), as Ref's: the
// title in the partner colour, its ring buttons (the notebooks button, only
// in the suite; a +; Options), the rising mark (three bars), and the label
// line: where you are, a hairline, today's date. Also the short band for a
// page inside (the new layout guide, export).
import { esc } from './util.js';

const ring = (label, attr, svg) => `<button type="button" class="ring-btn" ${attr} aria-label="${esc(label)}"><span>${svg}</span></button>`;
const line = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BOOKS = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="4.5" height="14" rx="1"/><rect x="9.5" y="3" width="4.5" height="16" rx="1"/><path d="M16 6.2l3.6-1 3 12.6-3.6 1z"/></svg>';
export const PLUS = line('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
const MENU = line('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>');
const MARK = '<svg class="band-mark" viewBox="0 0 80 40" aria-hidden="true"><rect x="6" width="20" height="40" class="mk-p"/><rect x="32" y="8" width="20" height="32" class="mk-w"/><rect x="58" y="14.4" width="20" height="25.6" class="mk-p"/></svg>';
export const BACK = line('<polyline points="15 5 8 12 15 19"/>');
export const CLOSE = line('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>');
export const MORE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>';

// FRI 13 NOV (the capitals are the band's).
export const bandDate = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

// title: the band's big word; place: the label line's; add: the + button's name.
export function bandHtml({ title, place, add }) {
  return `
    <header class="band">
      <h1 class="band-title">${esc(title)}</h1>
      <div class="band-btns">${ring('Back to your notebooks', 'data-books', BOOKS)}${ring(add, 'data-band-add', PLUS)}${ring('Options', 'data-app-menu', MENU)}</div>
      ${MARK}
      <p class="band-line"><b>${esc(place)}</b><span class="band-rule"></span><span class="band-date">${bandDate()}</span></p>
    </header>`;
}

// The short band: back (a button with backAttr), the name on the hairline,
// and another ring at the right if there is one ({ label, attr, svg }).
export function shortBandHtml({ name, backAttr, backLabel = 'Back', end = null }) {
  const right = end ? ring(end.label, end.attr, end.svg) : '<span class="ring-btn" aria-hidden="true"></span>';
  return `
    <header class="band band-short">
      ${ring(backLabel, backAttr, BACK)}
      <p class="band-line"><b>${esc(name)}</b><span class="band-rule"></span></p>
      ${right}
    </header>`;
}
