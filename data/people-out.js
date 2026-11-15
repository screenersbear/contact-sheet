// What Layouts tells the one list of people (round 2, connect/08): each
// layout with people in it (the handles in its caption, and everyone on the
// shoot in The Eye its finals came from), for the person page and search on
// the shelf (the suite's shared files, window.DFData, keep the list:
// shared/data/people-things.js). With them, the layouts made each year, for
// the year page (shared/data/year.js). Read only: nothing here changes a layout.
import { listProjects, onProjectsChange } from './db.js';

const D = () => window.DFData;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayWords = (iso) => { const d = new Date(iso); return iso && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : ''; };
const KINDS = { single: 'Single post', carousel: 'Carousel' };

// A layout as the list keeps it: its name, "Carousel · 9 Nov", who's in it
// (shoot: the shoot in The Eye it came from, if any), and its thumbnail
// (asked for only when it changes). Opens in the editor.
export function layoutThing(p, shoot = null) {
  const handles = window.DFConnect ? window.DFConnect.handlesIn(p.caption) : [];
  return {
    id: p.id,
    kind: p.post || p.caption ? 'post' : 'layout',
    title: String(p.name || '').trim() || 'Untitled layout',
    line: [KINDS[p.post] || 'Layout', dayWords(p.updatedAt)].filter(Boolean).join(' · '),
    day: String(p.updatedAt || '').slice(0, 10),
    people: [...handles.map((h) => ({ instagram: h })), ...(shoot ? D().shootPeople(shoot) : [])],
    params: { layout: p.id },
    more: { made: p.createdAt || '' },
    coverKey: p.thumb ? `${p.thumb.size}:${p.updatedAt || ''}` : '',
    covers: async () => (p.thumb ? [{ type: p.thumb.type || 'image/jpeg', bytes: await p.thumb.arrayBuffer() }] : []),
  };
}

// The shoot each layout's finals came from: the hand-off it came with
// (fromEye, in df-links) names the shoot in The Eye.
async function shootFor(p, byId) {
  if (!p.fromEye) return null;
  const link = await D().getLink(p.fromEye).catch(() => null);
  return (link && byId.get(link.fromId)) || null;
}

// Tells the list, a moment after the last change; from the start, after
// every layout saved or deleted too.
let soon = null;
export function tellPeople(wait = 1500) {
  if (!D() || !D().publishThings) return;
  clearTimeout(soon);
  soon = setTimeout(async () => {
    try {
      const state = D().eyeState();
      const byId = new Map(((state && state.shoots) || []).map((s) => [s.id, s]));
      const projects = await listProjects();
      const Y = window.DFYear;
      if (Y) Y.publishYear('contact-sheet', Y.byYear({ posts: Y.countByYear(projects, (p) => p.createdAt) }));
      const things = [];
      for (const p of projects) things.push(layoutThing(p, await shootFor(p, byId)));
      await D().publishThings('contact-sheet', things);
    } catch (e) { /* the list just doesn't hear this time */ }
  }, wait);
}
export const tellPeopleFromNowOn = () => onProjectsChange(() => tellPeople());
