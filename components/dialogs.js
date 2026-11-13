// The sheets that ask something: a confirmation, a choice from a list, and a
// name to type.
import { esc } from './util.js';
import { openSheet } from './sheet.js';

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
