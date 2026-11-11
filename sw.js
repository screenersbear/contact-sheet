// Bump CACHE_NAME with every deploy so installed copies pick up new files.
const CACHE_NAME = 'contact-sheet-v26';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/book.js',
  './js/db.js',
  './js/editor.js',
  './js/export.js',
  './js/flip.js',
  './js/frame.js',
  './js/icons.js',
  './js/model.js',
  './js/pdf.js',
  './js/pdfview.js',
  './js/photos.js',
  './js/render.js',
  './js/ui.js',
  './js/stickers.js',
  './js/util.js',
  './js/videoexport.js',
  './js/zip.js',
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
  './fonts/mansalva-latin.woff2',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
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
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
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
