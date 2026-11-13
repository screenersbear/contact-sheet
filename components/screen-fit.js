// Fits the app to the iPhone's screen when it's installed on the home screen
// (runs once, when the app starts; screenGap and nudgeScreen are for tests).
const html = document.documentElement;

// iOS 26 home-screen app on an iPhone: right after it opens, iOS can leave
// the screen about a status bar short at the bottom. It won't draw anything
// pinned below that edge, so the bars can't simply be moved down. Instead
// iOS is made to measure again: for a moment the page is taller than the
// screen and scrolled a pixel and back (the fix proven in Callback). Never
// while typing.
const iPhoneApp = /iPhone|iPod/.test(navigator.userAgent) && (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches);
// Sideways, the page is drawn turned back upright (upright.js) at a size of
// its own, so there's no screen edge to fix.
const turned = () => html.classList.contains('is-turned');
const typing = () => !!document.activeElement && document.activeElement.matches('input, textarea, [contenteditable]');
let probe = null;
// How far short of the screen's real bottom iOS has its bottom edge, in px
// (0 when it's right). `full` stands in for the screen's height in tests.
export function screenGap(full = 0) {
  if (!document.body) return 0;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position: fixed; left: 0; bottom: 0; width: 1px; height: 0; visibility: hidden; pointer-events: none; padding-top: var(--test-safe-top, var(--sa-t));';
    document.body.appendChild(probe);
  }
  const portrait = Math.abs(window.innerWidth - screen.width) < 2;
  const real = full || (portrait ? screen.height : screen.width);
  html.style.setProperty('--screen-h', `${Math.round(real)}px`);
  const under = parseFloat(getComputedStyle(probe).paddingTop) > 0;
  const gap = Math.round(real - probe.getBoundingClientRect().bottom);
  // Drawn under the status bar, the page's top is the screen's top, so any
  // gap is missing screen. Below the status bar, one bar's height is normal
  // and twice that means a bar's height is missing.
  if (under) return gap > 8 && gap < 120 ? gap : 0;
  return gap > 76 && gap < 150 ? Math.round(gap / 2) : 0;
}
let nudging = false;
// For tests: `full` as in screenGap. Resolves with the gap left after it.
export function nudgeScreen(tries = 5, full = 0) {
  return new Promise((done) => {
    const go = (left) => {
      if (!left || turned() || !screenGap(full) || typing()) {
        nudging = false;
        done(screenGap(full));
        return;
      }
      nudging = true;
      html.classList.add('ios-nudge');
      // Timers, not animation frames: those stop while the app is put away.
      setTimeout(() => {
        const y = window.scrollY;
        window.scrollTo(0, y + 1);
        setTimeout(() => {
          window.scrollTo(0, y);
          setTimeout(() => {
            html.classList.remove('ios-nudge');
            setTimeout(() => go(left - 1), 200);
          }, 120);
        }, 40);
      }, 30);
    };
    if (nudging) done(screenGap(full));
    else go(tries);
  });
}
// Installed, the bars show once iOS has its height right (styles/contents.css), so
// they never show high and then drop.
if (!iPhoneApp) html.classList.add('settled');
else setTimeout(() => html.classList.add('settled'), 3500); // whatever happens, they show
if (iPhoneApp) {
  const soon = (ms) => setTimeout(() => {
    if (turned()) return;
    if (!nudging && screenGap() > 0) html.classList.remove('settled'); // short again (coming back)
    nudgeScreen().then((gap) => {
      html.classList.add('settled');
      if (turned()) return;
      html.classList.toggle('is-short', gap > 0);
      window.dispatchEvent(new Event('resize'));
    });
  }, ms);
  window.addEventListener('load', () => soon(120));
  window.addEventListener('pageshow', () => soon(80));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(80); });
  window.addEventListener('orientationchange', () => soon(300));
}
