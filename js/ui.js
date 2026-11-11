// Interface pieces shared by every screen: bottom sheets, confirmations,
// choices, name prompts and the toast. Same look and behaviour as Callback
// and Documenting Fictions.
import { esc } from './util.js';

export const X_ICON =
  '<svg class="x-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const open = [];

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
if (iPhoneApp) {
  const soon = (ms) => setTimeout(() => {
    if (turned()) return;
    nudgeScreen().then((gap) => {
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
// iOS zooms in on any field with text under 16px and leaves the page
// zoomed. A scale limit stops that.
if (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && !/maximum-scale/.test(meta.content)) meta.content += ', maximum-scale=1';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open.length) {
    e.stopPropagation();
    open[open.length - 1].close();
  }
});

export const sheetIsOpen = () => open.length > 0;

// A bottom sheet on phones, a centered panel on wide screens.
// Returns { el, body, close, setTitle }. `onClose` runs once, however it closes.
export function openSheet({ title, body = '', className = '', onClose } = {}) {
  const opener = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.style.zIndex = String(50 + open.length * 2);
  overlay.innerHTML = `
    <div class="sheet ${esc(className)}" role="dialog" aria-modal="true" aria-labelledby="sheetTitle${open.length}">
      <header class="sheet-header">
        <h2 id="sheetTitle${open.length}">${esc(title)}</h2>
        <button type="button" class="close-btn" data-close aria-label="Close">${X_ICON}</button>
      </header>
      <div class="sheet-body">${body}</div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('sheet-open');

  const el = overlay.querySelector('.sheet');
  const api = {
    el,
    overlay,
    body: el.querySelector('.sheet-body'),
    setTitle(t) {
      el.querySelector('.sheet-header h2').textContent = t;
    },
    close(result) {
      if (!overlay.isConnected) return;
      overlay.remove();
      open.splice(open.indexOf(api), 1);
      if (!open.length) document.body.classList.remove('sheet-open');
      if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
      if (onClose) onClose(result);
    },
  };
  open.push(api);

  // On a phone, the tap that opened this sheet can arrive a moment later as
  // a click on whatever is now under the finger. Ignore that one.
  const openedAt = performance.now();
  overlay.addEventListener('click', (e) => {
    if (performance.now() - openedAt < 450) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) api.close();
  });

  // Focus the sheet itself, not its first field: on phones a focused field
  // pops the keyboard over half the sheet before anyone asked to type.
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  return api;
}

export function closeAllSheets() {
  while (open.length) open[open.length - 1].close();
}

// Resolves true when confirmed, false otherwise.
export function confirmSheet({ title, message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const s = openSheet({
      title,
      className: 'sheet-small',
      body: `
        ${message ? `<p class="sheet-message">${message}</p>` : ''}
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-no>${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmLabel)}</button>
        </div>`,
      onClose: () => resolve(answer),
    });
    s.body.querySelector('[data-no]').addEventListener('click', () => s.close());
    s.body.querySelector('[data-yes]').addEventListener('click', () => {
      answer = true;
      s.close();
    });
  });
}

// A list of choices; resolves with the chosen key, or null.
// options: [{ key, label, detail, current, danger }]
export function choiceSheet({ title, message = '', options, footer = '' }) {
  return new Promise((resolve) => {
    let answer = null;
    const s = openSheet({
      title,
      className: 'sheet-small',
      body: `
        ${message ? `<p class="sheet-message">${message}</p>` : ''}
        <div class="choice-list">
          ${options
            .map(
              (o) => o.heading ? `<span class="field-label choice-heading">${esc(o.heading)}</span>` : `<button type="button" class="choice${o.current ? ' current' : ''}${o.danger ? ' is-danger' : ''}" data-key="${esc(o.key)}">
                ${o.icon || ''}<span class="choice-text"><span class="choice-label">${esc(o.label)}</span>
                ${o.detail ? `<span class="choice-detail">${esc(o.detail)}</span>` : ''}</span></button>`
            )
            .join('')}
        </div>${footer}`,
      onClose: () => resolve(answer),
    });
    s.body.querySelectorAll('.choice').forEach((b) =>
      b.addEventListener('click', () => {
        answer = b.dataset.key;
        s.close();
      })
    );
  });
}

// One text field; resolves with the trimmed text, or null if cancelled.
export function promptSheet({ title, label = 'Name', value = '', confirmLabel = 'Save', placeholder = '', allowEmpty = false }) {
  return new Promise((resolve) => {
    let answer = null;
    const s = openSheet({
      title,
      className: 'sheet-small',
      body: `
        <form class="form" data-form>
          <label class="field">
            <span class="field-label">${esc(label)}</span>
            <input type="text" name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80" autocomplete="off" enterkeyhint="done" />
          </label>
          <div class="sheet-actions">
            <button type="button" class="btn secondary" data-no>Cancel</button>
            <button type="submit" class="btn primary">${esc(confirmLabel)}</button>
          </div>
        </form>`,
      onClose: () => resolve(answer),
    });
    const form = s.body.querySelector('[data-form]');
    const input = form.querySelector('input');
    s.body.querySelector('[data-no]').addEventListener('click', () => s.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v && !allowEmpty) {
        input.focus();
        return;
      }
      answer = v;
      s.close();
    });
    // A name field is the whole point of this sheet, so it takes focus.
    setTimeout(() => {
      input.focus();
      input.select();
    }, 60);
  });
}

let toastTimer;
export function toast(message, { action, ms = 3200 } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  if (action) {
    el.querySelector('.toast-action').addEventListener('click', () => {
      el.hidden = true;
      action.run();
    });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, action ? ms + 2000 : ms);
}

export function hideToast() {
  clearTimeout(toastTimer);
  const el = document.getElementById('toast');
  if (el) el.hidden = true;
}
