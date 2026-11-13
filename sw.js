// Bump CACHE_NAME with every deploy so installed copies pick up new files.
const CACHE_NAME = 'contact-sheet-v59';
// The same notebook can live twice on one website (inside the Documenting
// Fictions suite and as its own app), and both workers see every cache there:
// each name carries the folder this copy lives in, and each copy only ever
// clears its own (and its own old ones from before names carried a folder).
const HERE = new URL(self.registration.scope).pathname;
const CACHE = `${CACHE_NAME} ${HERE}`;
const PREFIX = 'contact-sheet-v';
const mine = (k) => k !== CACHE && (k.endsWith(` ${HERE}`) || (k.startsWith(PREFIX) && !k.includes(' ')));
const ASSETS = [
  './',
  './index.html',
  './built/shared-data.js', './built/app.css',
  './manifest.json',
  './built/app.js', './components/upright.js',
  './art/orange-cover.webp',
  './art/orange-block.webp',
  './art/mango-cover.webp',
  './art/mango-block.webp',
  './art/berry-cover.webp',
  './art/berry-block.webp',
  './art/fern-cover.webp',
  './art/fern-block.webp',
  './art/ocean-cover.webp',
  './art/ocean-block.webp',
  './art/ink-cover.webp',
  './art/ink-block.webp',
  './fonts/klee-one-latin.woff',
  './fonts/kaisei-decol-500-latin.woff2',
  './fonts/figtree-latin.woff2',
  './fonts/archivo-black-latin.woff2',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(mine).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network first, so a fresh deploy shows up right away; the cache answers
// when there's no connection. no-store skips the browser's own HTTP cache,
// which could otherwise hand back a stale file after a deploy.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
