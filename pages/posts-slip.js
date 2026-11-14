// The slip at the top of the home list once a shoot's finals have come
// from The Eye and been made into posts (round 2, connect/03): the shoot,
// how many finals, the posts (the carousel as a little stack), then LOOK
// THEM OVER (pages/posts.js) or NOT NOW, which tucks it away: the posts
// stay in the list as drafts. It shows once.
import { getProject, getPhoto } from '../data/db.js';
import { esc } from '../components/util.js';

const C = () => window.DFConnect;

// The first photo of a post, small (its tray thumb), as an address in `urls`.
async function coverOf(id, urls) {
  const p = await getProject(id);
  const first = p && p.frames.find((f) => f.photoId);
  const ph = first && (await getPhoto(first.photoId));
  if (!ph || !ph.thumb) return { p, url: '' };
  const url = URL.createObjectURL(ph.thumb);
  urls.push(url);
  return { p, url };
}

function postThumb({ p, url }) {
  if (!p) return '';
  const many = p.post !== 'single';
  const face = `<span class="cs-slip-face">${url ? `<img src="${url}" alt="" draggable="false" />` : ''}</span>`;
  return `<span class="cs-slip-post"><span class="cs-slip-stack${many ? ' is-many' : ''}" aria-hidden="true">${face}</span>
    <span class="cs-slip-what">${many ? `Carousel · ${p.slides}` : 'Single'}</span></span>`;
}

// Every slip waiting here, as markup (their pictures' addresses go in `urls`).
export async function slipsHtml(urls) {
  if (!C() || !window.DFData) return '';
  const waiting = (await C().slipsFor('contact-sheet')).filter((l) => l.type === 'finals' && l.madeAt && (l.postIds || []).length);
  const out = [];
  for (const link of waiting) {
    const posts = await Promise.all(link.postIds.map((id) => coverOf(id, urls)));
    const made = posts.filter((x) => x.p);
    if (!made.length) continue;
    out.push(C().slipHtml({
      link,
      title: link.title || 'From a shoot',
      line: C().postsLine(link.count || 0, made.length),
      body: `<div class="cs-slip-posts">${made.map(postThumb).join('')}</div>`,
      main: 'Look them over',
    }));
  }
  return out.join('');
}

// LOOK THEM OVER opens the posts; NOT NOW tucks the slip away. Either way it's gone.
export function wireSlips(root, redraw, open) {
  root.addEventListener('click', async (e) => {
    const slip = e.target.closest('[data-slip]');
    if (!slip || !C()) return;
    const go = e.target.closest('[data-slip-open]');
    if (!go && !e.target.closest('[data-slip-later]')) return;
    const link = await window.DFData.getLink(slip.dataset.slip);
    if (!link) return;
    await (go ? C().openSlip(link) : C().tuckSlip(link));
    slip.remove();
    redraw();
    if (go) open(link.id);
  });
}
