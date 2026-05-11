const CACHE_NAME = 'cup-check-v__APP_VERSION__-__BUILD_ID__';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg'];
// eslint-disable-next-line no-undef -- injected by the Vite service worker plugin.
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const PRECACHE_URLS = [...new Set([...APP_SHELL, ...PRECACHE_ASSETS])];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
