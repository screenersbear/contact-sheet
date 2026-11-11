// Turning a page of the notebook. Drawn on copies of the four pages involved;
// the real pages are swapped underneath at the start and uncovered at the end.
export const FLIP_MS = 620;

// host: holds the flip. rect: the two pages' box inside it. oldL, newL: the
// left page of the spread being left and of the one arrived at. face(k): a
// new element showing page k. onStep(t) runs as it turns, t from 0 to 1.
export function playFlip({ host, rect, oldL, newL, face, thick = 5, onStep, onDone }) {
  const dir = newL > oldL ? 1 : -1;
  const page = (k) => {
    const el = face(k);
    el.classList.add('flip-page');
    const shade = document.createElement('i');
    shade.className = 'flip-shade';
    el.appendChild(shade);
    return el;
  };
  const under = (k, cls) => {
    const el = page(k);
    el.classList.add('flip-under', cls);
    return el;
  };
  const left = under(dir > 0 ? oldL : newL, 'is-left');
  const right = under(dir > 0 ? newL + 1 : oldL + 1, 'is-right');
  const front = page(dir > 0 ? oldL + 1 : newL + 1);
  const back = page(dir > 0 ? newL : oldL);
  front.classList.add('flip-front');
  back.classList.add('flip-back');

  const leaf = document.createElement('div');
  leaf.className = 'flip-leaf';
  // The page has a little thickness: paper edges down the outside, top and bottom.
  const edges = ['out', 'top', 'bottom'].map((side) => {
    const edge = document.createElement('i');
    edge.className = `flip-edge is-${side}`;
    return edge;
  });
  leaf.append(front, back, ...edges);
  leaf.style.setProperty('--t', `${thick}px`);
  const angle = (t) => (dir > 0 ? -180 * t : -180 * (1 - t));
  leaf.style.transform = `rotateY(${angle(0)}deg)`;

  const box = document.createElement('div');
  box.className = 'flip';
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
  box.append(left, right, leaf);
  host.appendChild(box);

  const shades = box.querySelectorAll('.flip-shade');
  const t0 = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(guard);
    if (onStep) onStep(1);
    box.querySelectorAll('canvas').forEach((c) => (c.width = c.height = 0));
    box.remove();
    if (onDone) onDone();
  };
  const guard = setTimeout(finish, FLIP_MS + 400);
  const step = (now) => {
    if (done) return;
    const r = Math.min(1, Math.max(0, (now - t0) / FLIP_MS));
    const t = r < 0.5 ? 2 * r * r : 1 - (-2 * r + 2) ** 2 / 2;
    leaf.style.transform = `rotateY(${angle(t)}deg)`;
    const dark = String(Math.sin(Math.PI * t) * 0.34);
    shades.forEach((el) => (el.style.opacity = dark));
    if (onStep) onStep(t);
    if (r < 1) requestAnimationFrame(step);
    else finish();
  };
  requestAnimationFrame(step);
}
