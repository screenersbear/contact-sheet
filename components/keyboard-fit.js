// Keeps sheets above the iPhone keyboard (runs once, when the app starts).

// On an iPhone the keyboard covers the bottom of the screen without
// shrinking the page, so a bottom sheet would slide under it. The visible
// area is tracked here (as --vv-top and --vv-height) and sheets keep inside it.
const vv = window.visualViewport;
const html = document.documentElement;
function fitViewport() {
  if (!vv) return;
  html.style.setProperty('--vv-top', `${vv.offsetTop}px`);
  html.style.setProperty('--vv-height', `${vv.height}px`);
}
if (vv) {
  vv.addEventListener('resize', fitViewport);
  vv.addEventListener('scroll', fitViewport);
  fitViewport();
}
