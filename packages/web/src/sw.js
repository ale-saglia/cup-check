const CACHE_NAME = 'cup-check-v__APP_VERSION__-__BUILD_ID__';
const DATASET_CACHE_NAME = 'cup-check-dataset-v1';
const DATASET_TAG_PATTERN = /dataset-\d{4}-\d{2}/;
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg'];
// eslint-disable-next-line no-undef -- injected by the Vite service worker plugin.
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const PRECACHE_URLS = [...new Set([...APP_SHELL, ...PRECACHE_ASSETS])];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activateCaches());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    networkFirst(event, event.request, isDatasetRequest(event.request) ? DATASET_CACHE_NAME : CACHE_NAME),
  );
});

function isDatasetRequest(request) {
  const url = new URL(request.url);
  return (
    url.pathname.includes('/datasets/') ||
    url.pathname.endsWith('/dataset-latest.json') ||
    url.pathname.endsWith('/dataset-manifest.json') ||
    url.pathname.includes('cup-index.sqlite')
  );
}

async function activateCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key !== CACHE_NAME && key !== DATASET_CACHE_NAME)
      .map((key) => caches.delete(key)),
  );

  const appCache = await caches.open(CACHE_NAME);
  await evictDatasetRequests(appCache);
}

async function evictDatasetRequests(cache) {
  const requests = await cache.keys();
  await Promise.all(requests.filter(isDatasetRequest).map((request) => cache.delete(request)));
}

function networkFirst(event, request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return response;
      const copy = response.clone();
      event.waitUntil(
        caches.open(cacheName).then((cache) =>
          cache.put(request, copy).then(() => {
            if (cacheName === DATASET_CACHE_NAME) {
              return evictOldDatasetReleases(cache, datasetTagFromUrl(request.url));
            }
          }),
        ),
      );
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached ?? Response.error()));
}

function datasetTagFromUrl(url) {
  return new URL(url).pathname.match(DATASET_TAG_PATTERN)?.[0] ?? null;
}

async function evictOldDatasetReleases(cache, activeDatasetTag) {
  if (!activeDatasetTag) return;

  const requests = await cache.keys();
  await Promise.all(
    requests
      .filter((request) => {
        const datasetTag = datasetTagFromUrl(request.url);
        return datasetTag && datasetTag !== activeDatasetTag;
      })
      .map((request) => cache.delete(request)),
  );
}
