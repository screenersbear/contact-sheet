// Writing sits on the ruled lines, like handwriting. Every kind of text on a
// ruled page is marked data-sit="<kind>" and has a line height that is a whole
// number of lines (--lh). The first time a kind shows up (once the fonts are
// in), its baseline is measured and the kind is nudged down so the baseline
// rests --sit-gap above the line at the bottom of its first line box. The
// result is kept as --sit-<kind> on the root, so rows aren't measured one by one.
// Measured, not worked out: the fonts differ, and Safari ignores ascent-override.
const root = document.documentElement;
const done = new Map();
let stale = new Set(); // measured before the fonts or the pitch changed: kept until they can be measured again
const rules = document.createElement('style');
document.head.append(rules);
let ready = false;

const num = (v) => parseFloat(v) || 0;
const varPx = (name, d) => num(getComputedStyle(root).getPropertyValue(name)) || d;

// The baseline's distance from the top of the element's first line box.
function baseline(el) {
  const cs = getComputedStyle(el);
  let host = el, probe = null;
  if (el.matches('input, textarea, select')) {
    // Form fields can't hold the marker: measure a stand-in set the same way.
    probe = host = document.createElement('span');
    probe.textContent = 'Hg';
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;white-space:nowrap;display:block;padding:0;border:0';
    for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight']) probe.style[p] = cs[p];
    el.parentNode.append(probe);
  }
  const m = document.createElement('span');
  m.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';
  host.prepend(m);
  // offsetTop counts from the element's padding edge; data-sit elements are position: relative.
  const b = m.offsetTop + (probe ? num(cs.paddingTop) + num(cs.borderTopWidth) : 0);
  m.remove();
  probe?.remove();
  return b;
}

function measure(el) {
  const lh = num(getComputedStyle(el).lineHeight);
  if (!lh) return null;
  const gap = varPx('--sit-gap', 2);
  return Math.round((lh - 1 - gap - baseline(el)) * 2) / 2;
}

function paint() {
  rules.textContent = [...done.keys()].map((k) => `[data-sit="${k}"]{top:var(--sit-${k})}`).join('\n');
  for (const [k, v] of done) root.style.setProperty(`--sit-${k}`, `${v}px`);
}

// Boxes whose height comes from what's in them (cards, chip lists) are marked
// data-snap: their height is rounded up to whole lines, so what follows them
// still starts on a line.
function snap(scope) {
  const step = varPx('--lh', 32);
  for (const el of scope.querySelectorAll('[data-snap]')) {
    el.style.minHeight = '';
    const h = el.getBoundingClientRect().height;
    if (h) el.style.minHeight = `${Math.ceil(h / step - 0.02) * step}px`;
  }
}

export function sitOnLines(scope = document) {
  snap(scope);
  if (!ready) return;
  let changed = false;
  for (const el of scope.querySelectorAll('[data-sit]')) {
    const k = el.dataset.sit;
    if ((done.has(k) && !stale.has(k)) || !el.getClientRects().length) continue;
    const v = measure(el);
    if (v == null) continue;
    stale.delete(k);
    if (done.get(k) === v) continue;
    done.set(k, v);
    changed = true;
  }
  if (changed) paint();
}

// A font arriving or the line pitch changing with the screen size: measure
// every kind again, each as soon as it shows (a hidden one keeps its old nudge
// until then). Both fonts load up front, so this is rare.
let lh = 0;
function again() { stale = new Set(done.keys()); lh = varPx('--lh', 32); sitOnLines(); }
getComputedStyle(root).fontFamily; // Safari lists the CSS fonts only once the page's style is worked out
document.fonts?.forEach((f) => f.status === 'unloaded' && f.load().catch(() => {}));
document.fonts?.ready.then(() => { ready = true; again(); });
document.fonts?.addEventListener?.('loadingdone', () => { if (ready) again(); });
addEventListener('resize', () => { if (ready && varPx('--lh', 32) !== lh) again(); else snap(document); });
// New screens are drawn all the time: catch each kind the first time it appears,
// before the page is painted (shown by adding it, or by taking away hidden).
new MutationObserver(() => sitOnLines()).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
