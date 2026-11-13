// The editor's fixed numbers: snapping distance, room around the photos,
// the paper's line height, and what a saved snapshot of a chapter holds.
import { LAYOUT_KEYS } from '../data/formats.js';

export const SNAP_PX = 9;
export const ROOM = 34;
 // kept above and below the photos, for the labels and the name
// One ruled line of the notebook's paper (styles/notebook.css --lh): the labels and the
// name sit on the lines.
export const lineH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh')) || 32;
export const SAFE_KEY = 'contact-sheet-safe-zone';
export const SNAP_KEYS = ['name', ...LAYOUT_KEYS, 'frames', 'photoIds'];
