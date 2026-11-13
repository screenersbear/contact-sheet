// Snapping: the lines a moving frame or photo snaps to.
import { SLIDE_W, slideH, isStory, SAFE_TOP, SAFE_BOTTOM } from '../data/formats.js';

// ---------- Snapping ----------

// Lines a frame's edges and centre can snap to, in strip units.
export function snapTargets(p, skipId, { safeZone = false } = {}) {
  const W = SLIDE_W;
  const H = slideH(p);
  const P = p.padding || 0;
  const xs = [];
  const ys = [0, H, H / 2];
  for (let k = 0; k <= p.slides; k++) xs.push(k * W);
  for (let k = 0; k < p.slides; k++) {
    xs.push(k * W + W / 2);
    if (P) xs.push(k * W + P, (k + 1) * W - P);
  }
  if (P) ys.push(P, H - P);
  if (safeZone && isStory(p)) ys.push(SAFE_TOP, H - SAFE_BOTTOM);
  for (const f of p.frames) {
    if (f.id === skipId) continue;
    xs.push(f.x, f.x + f.w, f.x + f.w / 2);
    ys.push(f.y, f.y + f.h, f.y + f.h / 2);
    // Frames also line up one border's width apart, so the gaps match.
    if (P) {
      xs.push(f.x - P, f.x + f.w + P);
      ys.push(f.y - P, f.y + f.h + P);
    }
  }
  return { xs, ys };
}

// The nearest target to any of `values`, within `tol`. Returns the shift to
// apply and the line it lands on, or null.
export function nearest(values, targets, tol) {
  let best = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t };
    }
  }
  return best;
}
