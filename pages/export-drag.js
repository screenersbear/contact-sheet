// Hold an item (or drag it with the mouse) and move it: the list reflows
// under the finger. onMove(from, to) changes the order; setSuppress keeps the
// tap that ends a drag from also toggling the item.
export function dragToReorder(list, onMove, setSuppress) {
  let d = null;
  const HOLD = 300;
  const index = (li) => [...list.children].indexOf(li);
  function lift(x, y) {
    d.on = true;
    setSuppress(true);
    const r = d.li.getBoundingClientRect();
    d.ghost = d.li.cloneNode(true);
    d.ghost.className = `order-ghost${d.li.classList.contains('is-off') ? ' is-off' : ''}`;
    d.ghost.style.width = `${r.width}px`;
    d.dx = x - r.left;
    d.dy = y - r.top;
    document.body.appendChild(d.ghost);
    d.li.classList.add('is-placeholder');
    place(x, y);
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
  }
  function place(x, y) {
    d.ghost.style.transform = `translate(${x - d.dx}px, ${y - d.dy}px)`;
    const hit = document.elementFromPoint(x, y);
    const over = hit && hit.closest('li[data-i]');
    if (!over || over === d.li || over.parentNode !== list) return;
    const from = index(d.li);
    const to = index(over);
    onMove(from, to);
  }
  function end() {
    if (!d) return;
    clearTimeout(d.timer);
    if (d.on) {
      d.ghost.remove();
      d.li.classList.remove('is-placeholder');
      setTimeout(() => setSuppress(false), 0);
    }
    d = null;
  }
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li || (e.pointerType === 'mouse' && e.button !== 0)) return;
    d = { li, id: e.pointerId, x0: e.clientX, y0: e.clientY, mouse: e.pointerType === 'mouse', on: false };
    if (!d.mouse) d.timer = setTimeout(() => d && !d.on && lift(d.x0, d.y0), HOLD);
  });
  list.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      const far = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
      // A finger that moves before the hold is scrolling; a mouse drags at once.
      if (!d.mouse) {
        if (far > 8) end();
        return;
      }
      if (far < 4) return;
      try {
        list.setPointerCapture(e.pointerId);
      } catch {}
      lift(e.clientX, e.clientY);
    }
    d.x0 = e.clientX;
    d.y0 = e.clientY;
    place(e.clientX, e.clientY);
  });
  // Once an item is held, the page must not scroll under it.
  list.addEventListener('touchmove', (e) => d && d.on && e.preventDefault(), { passive: false });
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
  list.addEventListener('contextmenu', (e) => e.preventDefault());
}
