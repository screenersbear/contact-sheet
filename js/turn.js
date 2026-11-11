// Turning the shut notebook by hand, the way Callback's head turns: slower than
// the finger, harder the further it goes, and it swings back when let go.
const SPIN_LEFT = 0.9; // radians each way from where it rests
const SPIN_RIGHT = 0.62;
const TILT = 0.42;

const soft = (raw, max) => max * Math.tanh(raw / max);
const spinOf = (raw) => soft(raw, raw < 0 ? SPIN_LEFT : SPIN_RIGHT);

// root gets --spin and --tilt. canStart(e) says if a touch may turn it.
// onMoved runs once a touch has become a turn, so it isn't taken for a tap.
export function makeTurnable(root, { canStart, onMoved, size }) {
  let spin = 0;
  let tilt = 0;
  let spinV = 0;
  let tiltV = 0;
  let spinGoal = 0;
  let tiltGoal = 0;
  let drag = null;
  let raf = 0;
  let last = 0;

  const paint = () => {
    root.style.setProperty('--spin', `${spin.toFixed(4)}rad`);
    root.style.setProperty('--tilt', `${tilt.toFixed(4)}rad`);
  };

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    const held = drag && drag.moved;
    spinV += (-(drag ? 40 : 14) * (spin - (held ? spinGoal : 0)) - (drag ? 12 : 7.5) * spinV) * dt;
    tiltV += (-(drag ? 40 : 30) * (tilt - (held ? tiltGoal : 0)) - (drag ? 12 : 10) * tiltV) * dt;
    spin += spinV * dt;
    tilt += tiltV * dt;
    const still = Math.abs(spin) < 1e-3 && Math.abs(tilt) < 1e-3 && Math.abs(spinV) < 1e-2 && Math.abs(tiltV) < 1e-2;
    if (!drag && still) {
      reset();
      return;
    }
    paint();
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    root.classList.add('is-turning');
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function reset() {
    cancelAnimationFrame(raf);
    raf = 0;
    drag = null;
    spin = tilt = spinV = tiltV = 0;
    root.style.removeProperty('--spin');
    root.style.removeProperty('--tilt');
    root.classList.remove('is-turning');
  }

  const down = (e) => {
    if (drag || e.button || !canStart(e)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, spin, tilt, moved: false };
  };
  const move = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= 6) return;
      drag.moved = true;
      try {
        root.setPointerCapture(e.pointerId);
      } catch {}
      onMoved();
      kick();
    }
    const k = (Math.PI / size()) * 0.5;
    spinGoal = spinOf(drag.spin + dx * k);
    tiltGoal = soft(drag.tilt - dy * k, TILT);
  };
  const up = (e) => {
    if (drag && drag.id === e.pointerId) drag = null;
  };
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);

  return { reset };
}
