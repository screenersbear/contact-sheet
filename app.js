// Contact Sheet starts here. Routes: #/  #/book  #/contents  #/edit/<project id>
// Set up once, before anything else: sheets above the keyboard, the iPhone's
// screen, no page zoom.
import './components/keyboard-fit.js';
import './components/screen-fit.js';
import './components/no-zoom.js';
import { mountEditor } from './pages/editor.js';
import { mountBook } from './pages/book.js';
import { modeOfHash } from './pages/book-sizes.js';
import { startsOnFirstPage } from './pages/options.js';
import { closeAllSheets } from './components/sheet.js';
import { esc } from './components/util.js';
import { openIntro } from './pages/intro.js';
import { welcome } from './pages/welcome.js';
import { newLayout } from './pages/new-layout.js';

const view = document.getElementById('view');
let destroyCurrent = null;
let book = null;
let routeToken = 0;

// ---------- Routing ----------

// Inside Documenting Fictions (../suite.js) the shelf is the shut notebook,
// and Options are in the band at the top of the home page.
const suite = window.DF_SUITE;

async function route() {
  const h0 = (location.hash || '#/').slice(1) || '/';
  if (suite && h0 === '/') { suite.home(); return; }
  const token = ++routeToken;
  if (destroyCurrent) {
    destroyCurrent();
    destroyCurrent = null;
  }
  closeAllSheets();
  const h = (location.hash || '#/').slice(1) || '/';
  const m = h.match(/^\/edit\/(.+)$/);
  try {
    if (m) {
      if (book) book.destroy();
      book = null;
      view.dataset.route = 'edit';
      const destroy = await mountEditor(view, decodeURIComponent(m[1]));
      if (token !== routeToken) destroy();
      else destroyCurrent = destroy;
    } else {
      view.dataset.route = 'book';
      if (book) book.setMode(modeOfHash(h));
      else book = mountBook(view, modeOfHash(h), newLayout);
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><p class="empty-title">Something went wrong</p><p>${esc(e.message || 'Try reloading the page.')}</p></div>`;
  }
  if (!m) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
// Set in Options: open on the home page instead of the shut notebook.
if (suite || startsOnFirstPage()) { if ((location.hash || '#/') === '#/') history.replaceState(null, '', '#/contents'); }
route();
if (suite && suite.at === 'new') setTimeout(newLayout, 400);
// Inside Documenting Fictions, the first time: how to get back to the shelf,
// and the tour if it's wanted.
else if (suite && suite.firstVisit) setTimeout(() => { if (!document.querySelector('.sheet-overlay')) welcome('Layouts', openIntro); }, 900);

// Always upright, quietly. The manifest asks for it once the app is
// installed; where a browser allows a lock, this holds it. iPhone home-screen
// apps honour neither, and nothing is shown about it.
try {
  const o = screen.orientation;
  if (o && o.lock) o.lock('portrait').catch(() => {});
} catch {}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
