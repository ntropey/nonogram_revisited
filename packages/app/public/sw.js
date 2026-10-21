/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Service worker: network-first for pages, cache-first for hashed assets.
 * Offline-first so the app keeps working without a connection.
 */
const ASSET_CACHE = 'nonogram-assets-v1';
const PAGE_CACHE = 'nonogram-pages-v1';
const PRECACHE_URLS = ['/play/', '/play/index.html', '/play/manifest.json'];

// Install: precache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

// Activate: clear old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== ASSET_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isAsset(url: string) {
  return /\.(js|css|png|svg|woff2?)$/.test(url);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Pages: network-first, fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/play/index.html'))),
    );
    return;
  }

  // Hashed assets: cache-first.
  if (isAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
        return resp;
      })),
    );
    return;
  }

  // Everything else: network-first.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
