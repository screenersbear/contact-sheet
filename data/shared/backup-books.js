// What Back up puts in a backup (backups.js makes and restores them): each
// notebook's part on its own, and what a backup of all four holds.
// window.DFBackups is built up by this file, backup-json.js and backups.js,
// loaded in that order after df-data.js.
(function () {
  'use strict';
  const B = (window.DFBackups = window.DFBackups || {});

  // One notebook on its own: the same backup its own Options made before
  // 15 Nov (same app name, databases and file name), so a new backup goes
  // back into an older copy of the app, and an old one into this.
  // dbs: its databases; local: what it keeps in localStorage that comes
  // along; book: its cover colour's localStorage key; line: what's in it,
  // under its name on the Back up sheet.
  const BOOKS = {
    ref: { name: 'Ref', dbs: ['ref-notebook'], local: [], book: 'ref-notebook-book', line: 'Mood boards, tags and their photos.' },
    'the-eye': { name: 'The Eye', dbs: ['starky-moodboards', 'df-links'], local: ['dailies_state_v1'], book: null, line: 'Shoots, guides, reflections and their photos.' },
    'contact-sheet': { name: 'Layouts', dbs: ['contact-sheet'], local: [], book: 'contact-sheet-book', line: 'Carousels, Stories and their photos.' },
    rounds: { name: 'Rounds', dbs: ['rounds'], local: [], book: 'rounds-book', line: 'People, moves and messages.' },
  };
  // In the shelf's order.
  const ORDER = ['ref', 'the-eye', 'contact-sheet', 'rounds'];

  // All four: every notebook's database but The Eye's (its photos,
  // starky-moodboards, go in with its shoots, below), the boards sent from
  // Ref to The Eye's shoots, the stickers on the covers and the one list of
  // people. Rounds' rounds-device (which device this is, for its sync) is
  // never in a backup. Overthoughts, taken out on 15 Nov, isn't either.
  const DBS = [
    { id: 'ref', db: 'ref-notebook', book: 'ref-notebook-book' },
    { id: 'contact-sheet', db: 'contact-sheet', book: 'contact-sheet-book' },
    { id: 'rounds', db: 'rounds', book: 'rounds-book' },
    { id: 'links', db: 'df-links', book: null }, // boards sent from Ref to The Eye's shoots
    { id: 'stickers', db: 'df-stickers', book: null }, // the stickers on the four covers (stickers.js)
    { id: 'people', db: 'df-people', book: null }, // the one list of people (people.js): names changed and "Same person?" answers
  ];
  const EYE_DB = 'starky-moodboards'; // The Eye's photos
  const EYE_STATE = 'dailies_state_v1'; // The Eye's shoots and journal
  const EYE_LAST_BACKUP = 'dailies_last_backup_v1'; // The Eye's "Last backup", so its monthly reminder counts this one

  Object.assign(B, { BOOKS, ORDER, DBS, EYE_DB, EYE_STATE, EYE_LAST_BACKUP });
})();
