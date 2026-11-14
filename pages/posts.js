// The posts made from a shoot's finals (round 2, connect/04): each post's
// slides to look through, its caption (started with the shoot's title and
// its talent and team handles, yours to change), EDIT to open it in the
// editor, and SAVE AND SHARE: the caption copied, then Export, which saves
// the slides and opens the share sheet. Nothing is posted for you. Sharing
// a post tells Rounds who's tagged in it (a 'post-people' link), so the
// people it knows get "Your photos are up".
import { getProject, saveProject } from '../data/db.js';
import { postsOf } from '../data/from-eye.js';
import { openSheet } from '../components/sheet.js';
import { shortBandHtml } from '../components/band.js';
import { toast } from '../components/toast.js';
import { esc, debounce, loadImage } from '../components/util.js';
import { previewCanvas } from '../components/render.js';
import { openExport } from './export.js';

const D = () => window.DFData;
const C = () => window.DFConnect;
const NOTE = {
  carousel: 'Picked through the set, so it isn\'t five of one look. The cover is the first final.',
  single: 'A shot left over, for a second day.',
};

function postHtml({ p }, i) {
  const what = p.post === 'single' ? 'Single' : `Carousel, ${p.slides} ${p.slides === 1 ? 'shot' : 'shots'}`;
  const dots = p.slides > 1 ? `<div class="posts-dots" aria-hidden="true">${'<span></span>'.repeat(p.slides)}</div>` : '';
  return `<section class="posts-post" data-post="${esc(p.id)}">
    <p class="posts-label">Post ${i + 1} · ${esc(what)}</p>
    <div class="posts-strip" data-strip aria-label="${esc(p.name)}" role="img"></div>${dots}
    <label class="posts-label posts-cap-label" for="cap-${esc(p.id)}">Caption</label>
    <textarea class="posts-caption" id="cap-${esc(p.id)}" rows="4" data-caption>${esc(p.caption || '')}</textarea>
    <p class="posts-note">${esc(NOTE[p.post] || '')}</p>
    <div class="posts-actions"><button type="button" class="posts-edit" data-edit>Edit</button><button type="button" class="posts-share" data-share>Save and share</button></div>
  </section>`;
}

// Each slide of a post, drawn as it will be exported, into its strip.
async function drawStrip(strip, { p, photos }) {
  const urls = [];
  const map = {};
  for (const ph of photos) {
    if (!ph.preview) continue;
    const u = URL.createObjectURL(ph.preview);
    urls.push(u);
    map[ph.id] = { photo: ph, src: await loadImage(u).catch(() => null) };
  }
  for (let i = 0; i < p.slides; i++) {
    const c = previewCanvas(p, (pid) => (map[pid] && map[pid].src ? map[pid] : null), { height: 640, from: i, count: 1 });
    c.className = 'posts-slide';
    strip.append(c);
  }
  urls.forEach((u) => URL.revokeObjectURL(u));
}

// The dots follow the strip.
function followDots(post) {
  const strip = post.querySelector('[data-strip]');
  const dots = [...post.querySelectorAll('.posts-dots span')];
  if (!dots.length) return;
  const mark = () => {
    const w = strip.firstElementChild ? strip.firstElementChild.getBoundingClientRect().width + 8 : 1;
    const at = Math.min(dots.length - 1, Math.round(strip.scrollLeft / w));
    dots.forEach((d, k) => d.classList.toggle('on', k === at));
  };
  strip.addEventListener('scroll', mark, { passive: true });
  mark();
}

// Rounds hears who's tagged in a shared post: once, until Rounds takes it.
async function tellRounds(p, shoot) {
  if (!D() || !C() || !C().connectOn('posts')) return;
  const handles = C().handlesIn(p.caption);
  if (!handles.length) return;
  const [had] = await D().linksWhere({ fromApp: 'contact-sheet', fromId: p.id, type: 'post-people' });
  if (had && had.takenAt) return;
  await D().saveLink({ ...(had || {}), fromApp: 'contact-sheet', fromId: p.id, toApp: 'rounds', toId: '', type: 'post-people', title: shoot, handles, sharedAt: new Date().toISOString() });
}

async function copyCaption(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function openPosts(linkId) {
  const got = await postsOf(linkId, getProject);
  if (!got || !got.posts.length) {
    toast('Those posts are gone.');
    return null;
  }
  const { link, posts } = got;
  // Looked over: its slip doesn't show again.
  if (!link.openedAt && !link.tuckedAt) C().openSlip(link).catch(() => {});
  document.querySelectorAll(`[data-slip="${CSS.escape(link.id)}"]`).forEach((el) => el.remove());
  const s = openSheet({ title: C().postsTitle(posts.length, link.title), className: 'sheet-page sheet-posts' });
  s.body.innerHTML = `
    ${shortBandHtml({ name: posts.length === 1 ? 'A post' : 'Two posts', backAttr: 'data-close' })}
    <div class="page-scroll">
      <div class="posts-tag">${C().tagHtml(link.fromApp)}</div>
      <h1 class="page-title posts-title">${esc(C().postsTitle(posts.length, link.title))}</h1>
      <p class="page-ask posts-ask">Picked from the finals, in the order you added them. Credits come from the shoot's team.</p>
      ${posts.map(postHtml).join('')}
    </div>`;
  posts.forEach((post) => {
    const el = s.body.querySelector(`[data-post="${CSS.escape(post.p.id)}"]`);
    drawStrip(el.querySelector('[data-strip]'), post).then(() => followDots(el));
    const save = debounce(() => saveProject(post.p).catch(() => {}), 500);
    el.querySelector('[data-caption]').addEventListener('input', (e) => {
      post.p.caption = e.target.value;
      save();
    });
    el.querySelector('[data-edit]').addEventListener('click', async () => {
      await saveProject(post.p).catch(() => {});
      s.close();
      location.hash = `#/edit/${encodeURIComponent(post.p.id)}`;
    });
    el.querySelector('[data-share]').addEventListener('click', () => {
      // Copied straight away, while the tap still counts (Safari only copies
      // then); Export opens whether or not it could.
      if (post.p.caption) copyCaption(post.p.caption).then((ok) => ok && toast('Caption copied, to paste in with the post.'));
      saveProject(post.p).catch(() => {});
      tellRounds(post.p, link.title).catch(() => {});
      openExport(post.p, Object.fromEntries(post.photos.map((ph) => [ph.id, ph])));
    });
  });
  return s;
}
