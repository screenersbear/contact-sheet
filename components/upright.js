// Always upright on an iPhone. A home-screen app on an iPhone turns sideways
// with the phone whatever the manifest asks, so when it does, the whole page
// is drawn turned back upright: the app stays the way up it is in your hand.
// Nothing is shown about it.
//
// The page is laid out at its upright size (styles/notebook.css, html.is-turned), and
// everything that reads the screen here is told the upright story: finger
// positions, element boxes, the window's size and the visible area. Loaded
// first, before the app, as a plain script.
(() => {
  const html = document.documentElement;
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 500;
  if (!standalone || !phone) return;

  // The real window, before any of it is told otherwise.
  const own = (k) => Object.getOwnPropertyDescriptor(window, k) || Object.getOwnPropertyDescriptor(Window.prototype, k);
  const iw = own('innerWidth');
  const ih = own('innerHeight');
  const realW = () => (iw && iw.get ? iw.get.call(window) : html.clientWidth);
  const realH = () => (ih && ih.get ? ih.get.call(window) : html.clientHeight);

  // 0 upright; -90 when the phone's top is to the left (the page is turned a
  // quarter anticlockwise to match), 90 when it's to the right.
  let turn = 0;
  let W = 0; // the real window while turned: W wide, H tall
  let H = 0;

  // Which way the phone's top points. window.orientation is the iPhone's own
  // answer (90: top to the left); screen.orientation is the fallback.
  function phoneTop() {
    const o = typeof window.orientation === 'number' ? window.orientation : null;
    if (o === 90) return -90;
    if (o === -90 || o === 270) return 90;
    if (o === 0 || o === 180) return 0;
    const a = screen.orientation && screen.orientation.angle;
    if (a === 90) return -90;
    if (a === 270 || a === -90) return 90;
    return null;
  }

  function update() {
    const w = realW();
    const h = realH();
    let next = 0;
    if (w > h) {
      const t = phoneTop();
      // Mid-turn the window and the phone's answer can disagree for a
      // moment: the turn there is kept until they agree.
      next = t === 0 ? turn : t === null ? turn || -90 : t;
    }
    W = w;
    H = h;
    if (next === turn && (!next || (html.style.getPropertyValue('--turn-h') === `${w}px` && html.style.getPropertyValue('--turn-w') === `${h}px`))) return;
    turn = next;
    html.classList.toggle('is-turned', !!turn);
    html.classList.toggle('is-turned-l', turn < 0);
    html.classList.toggle('is-turned-r', turn > 0);
    if (turn) {
      html.style.setProperty('--turn-w', `${h}px`);
      html.style.setProperty('--turn-h', `${w}px`);
    } else {
      html.style.removeProperty('--turn-w');
      html.style.removeProperty('--turn-h');
    }
  }

  // Screen point -> upright point, and back.
  const upX = (X, Y) => (turn < 0 ? H - Y : Y);
  const upY = (X, Y) => (turn < 0 ? X : W - X);
  const downX = (x, y) => (turn < 0 ? y : W - y);
  const downY = (x, y) => (turn < 0 ? H - x : x);

  function point(proto, kx, ky) {
    if (!proto) return;
    const dx = Object.getOwnPropertyDescriptor(proto, kx);
    const dy = Object.getOwnPropertyDescriptor(proto, ky);
    if (!dx || !dy || !dx.get || !dy.get) return;
    Object.defineProperty(proto, kx, {
      configurable: true,
      enumerable: dx.enumerable,
      get() {
        const X = dx.get.call(this);
        return turn ? upX(X, dy.get.call(this)) : X;
      },
    });
    Object.defineProperty(proto, ky, {
      configurable: true,
      enumerable: dy.enumerable,
      get() {
        const Y = dy.get.call(this);
        return turn ? upY(dx.get.call(this), Y) : Y;
      },
    });
  }

  try {
    for (const proto of [window.MouseEvent && MouseEvent.prototype, window.Touch && Touch.prototype]) {
      point(proto, 'clientX', 'clientY');
      point(proto, 'pageX', 'pageY');
    }
    point(window.MouseEvent && MouseEvent.prototype, 'x', 'y');

    // Boxes: the screen's box of a quarter-turned box is the turned box.
    const box = (r) =>
      turn < 0 ? new DOMRect(H - r.bottom, r.left, r.height, r.width) : new DOMRect(r.top, W - r.right, r.height, r.width);
    const gbcr = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const r = gbcr.call(this);
      return turn ? box(r) : r;
    };
    if (window.Range && Range.prototype.getBoundingClientRect) {
      const rbcr = Range.prototype.getBoundingClientRect;
      Range.prototype.getBoundingClientRect = function () {
        const r = rbcr.call(this);
        return turn ? box(r) : r;
      };
    }

    // Finding what's under a finger takes an upright point.
    for (const k of ['elementFromPoint', 'elementsFromPoint']) {
      const f = Document.prototype[k];
      if (!f) continue;
      Document.prototype[k] = function (x, y) {
        return turn ? f.call(this, downX(x, y), downY(x, y)) : f.call(this, x, y);
      };
    }

    // The window's size is the upright size.
    if (iw && iw.get) Object.defineProperty(window, 'innerWidth', { configurable: true, enumerable: true, get: () => (turn ? realH() : realW()) });
    if (ih && ih.get) Object.defineProperty(window, 'innerHeight', { configurable: true, enumerable: true, get: () => (turn ? realW() : realH()) });

    // The visible area (smaller while the keyboard is up), turned upright.
    // The keyboard comes up along the page's side, so the upright height
    // stays the whole page.
    if (window.VisualViewport) {
      const vp = VisualViewport.prototype;
      const real = {};
      for (const k of ['width', 'height', 'offsetLeft', 'offsetTop']) real[k] = Object.getOwnPropertyDescriptor(vp, k);
      if (Object.values(real).every((d) => d && d.get)) {
        const r = (v, k) => real[k].get.call(v);
        const turned = {
          width: (v) => r(v, 'height'),
          height: (v) => r(v, 'width'),
          offsetLeft: (v) => (turn < 0 ? H - r(v, 'offsetTop') - r(v, 'height') : r(v, 'offsetTop')),
          offsetTop: (v) => (turn < 0 ? r(v, 'offsetLeft') : W - r(v, 'offsetLeft') - r(v, 'width')),
        };
        for (const k of Object.keys(turned)) {
          Object.defineProperty(vp, k, {
            configurable: true,
            enumerable: real[k].enumerable,
            get() {
              return turn ? turned[k](this) : r(this, k);
            },
          });
        }
      }
    }
  } catch (e) {
    // Without the corrections a turned page would take taps in the wrong
    // places, so it isn't turned at all.
    return;
  }

  // Before anything else hears about a turn, so the app measures the upright
  // page. These are the first listeners, as this script runs first.
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => {
    update();
    setTimeout(update, 120);
    setTimeout(update, 400);
  });
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', update);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();
