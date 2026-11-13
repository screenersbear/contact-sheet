// A guide's step marks along its top (round 2, as in Ref's new board guide
// and The Eye's): the steps as marks on a hairline, named underneath; done
// ones solid, this one larger with a dot in the notebook's colour, the rest
// open rings. The line is inked up to this step.
import { esc } from './util.js';

export function marksHtml(names, at) {
  const last = names.length - 1;
  const marks = names.map((_, i) => {
    const line = i ? `<span class="guide-line${i <= at ? ' inked' : ''}"></span>` : '';
    return `${line}<span class="guide-mark${i === at ? ' now' : i < at ? ' done' : ''}"></span>`;
  }).join('');
  const words = names.map((n, i) => {
    const where = i === 0 ? 'left:0' : i === last ? 'right:0' : `left:${(i / last) * 100}%`;
    return `<span class="guide-mark-name${i <= at ? ' reached' : ''}${i && i < last ? ' mid' : ''}" style="${where}">${esc(n)}</span>`;
  }).join('');
  return `<div class="guide-marks" role="img" aria-label="Step ${at + 1} of ${names.length}: ${esc(names[at])}"><div class="guide-mark-row">${marks}</div><div class="guide-mark-names" aria-hidden="true">${words}</div></div>`;
}
