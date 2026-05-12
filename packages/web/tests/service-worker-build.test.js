import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const webDir = resolve(fileURLToPath(import.meta.url), '../..');
const DATASET_CACHE_NAME = 'cup-check-dataset-v1';

describe('service worker build', () => {
  it('pre-cachea gli asset Vite generati', async () => {
    await withBuiltServiceWorker((serviceWorker) => {
      expect(serviceWorker).toMatch(/\.\/assets\/index-[\w-]+\.js/);
      expect(serviceWorker).toMatch(/\.\/assets\/index-[\w-]+\.css/);
      expect(serviceWorker).not.toContain('__PRECACHE_ASSETS__');
    });
  });

  it("usa una cache dedicata per il dataset e mantiene solo l'ultima release", async () => {
    await withBuiltServiceWorker(async (serviceWorker) => {
      const runtime = createServiceWorkerRuntime(serviceWorker, {
        'https://example.test/index.html': new Response('app shell'),
        'https://example.test/dataset-latest.json': Response.json({ dataset_tag: 'dataset-2026-06' }),
        'https://example.test/datasets/dataset-2026-05/cup-index.sqlite.000': new Response('may chunk'),
        'https://example.test/datasets/dataset-2026-06/cup-index.sqlite.000': new Response('june chunk'),
      });

      await runtime.fetch('https://example.test/index.html');
      const appCacheName = runtime.cacheNames().find((name) => name !== DATASET_CACHE_NAME);
      expect(appCacheName).toBeTruthy();
      await runtime.putCached(
        appCacheName,
        'https://example.test/datasets/dataset-2026-05/cup-index.sqlite.000',
        new Response('old app-cache chunk'),
      );
      await runtime.fetch('https://example.test/datasets/dataset-2026-05/cup-index.sqlite.000');
      await runtime.fetch('https://example.test/dataset-latest.json');
      await runtime.fetch('https://example.test/datasets/dataset-2026-06/cup-index.sqlite.000');
      await runtime.activate();

      expect(runtime.cachedUrls(appCacheName)).toContain('https://example.test/index.html');
      expect(runtime.cachedUrls(appCacheName)).not.toContain('https://example.test/dataset-latest.json');
      expect(runtime.cachedUrls(appCacheName)).not.toContain(
        'https://example.test/datasets/dataset-2026-05/cup-index.sqlite.000',
      );
      expect(runtime.cachedUrls(appCacheName)).not.toContain(
        'https://example.test/datasets/dataset-2026-06/cup-index.sqlite.000',
      );

      expect(runtime.cachedUrls(DATASET_CACHE_NAME)).toEqual([
        'https://example.test/dataset-latest.json',
        'https://example.test/datasets/dataset-2026-06/cup-index.sqlite.000',
      ]);
    });
  });
});

async function withBuiltServiceWorker(assertions) {
  const outDir = await mkdtemp(join(tmpdir(), 'cup-check-web-'));

  try {
    await build({
      configFile: resolve(webDir, 'vite.config.js'),
      logLevel: 'silent',
      build: {
        outDir,
        emptyOutDir: true,
      },
    });

    const serviceWorker = await readFile(join(outDir, 'sw.js'), 'utf8');
    await assertions(serviceWorker);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

function createServiceWorkerRuntime(serviceWorker, routes) {
  const listeners = {};
  const cacheStorage = createCacheStorage(routes);
  const context = {
    caches: cacheStorage.api,
    fetch: cacheStorage.fetch,
    Request,
    Response,
    URL,
    self: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
      clients: {
        claim: () => Promise.resolve(),
      },
      skipWaiting: () => {},
    },
  };

  runInNewContext(serviceWorker, context);

  return {
    async activate() {
      const waitUntilPromises = [];

      listeners.activate({
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      });

      await Promise.all(waitUntilPromises);
    },
    async fetch(url) {
      const waitUntilPromises = [];
      let responsePromise;

      listeners.fetch({
        request: new Request(url),
        respondWith(promise) {
          responsePromise = Promise.resolve(promise);
        },
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      });

      const response = await responsePromise;
      await Promise.all(waitUntilPromises);
      return response;
    },
    cachedUrls(cacheName) {
      return cacheStorage.cachedUrls(cacheName);
    },
    cacheNames() {
      return cacheStorage.cacheNames();
    },
    putCached(cacheName, url, response) {
      return cacheStorage.put(cacheName, url, response);
    },
  };
}

function createCacheStorage(routes) {
  const cachesByName = new Map();

  const api = {
    async delete(cacheName) {
      return cachesByName.delete(cacheName);
    },
    async keys() {
      return [...cachesByName.keys()];
    },
    async match(request) {
      for (const cache of cachesByName.values()) {
        const response = await cache.match(request);
        if (response) return response;
      }
      return undefined;
    },
    async open(cacheName) {
      if (!cachesByName.has(cacheName)) {
        cachesByName.set(cacheName, createCache());
      }
      return cachesByName.get(cacheName);
    },
  };

  return {
    api,
    cacheNames() {
      return [...cachesByName.keys()];
    },
    cachedUrls(cacheName) {
      return [...(cachesByName.get(cacheName)?.entries.keys() ?? [])];
    },
    async fetch(request) {
      const response = routes[request.url];
      return response?.clone() ?? new Response('not found', { status: 404 });
    },
    async put(cacheName, url, response) {
      const cache = await api.open(cacheName);
      await cache.put(new Request(url), response);
    },
  };
}

function createCache() {
  const entries = new Map();
  return {
    entries,
    async addAll(urls) {
      for (const url of urls) {
        entries.set(new URL(url, 'https://example.test/').href, new Response('precache'));
      }
    },
    async delete(request) {
      return entries.delete(request.url);
    },
    async keys() {
      return [...entries.keys()].map((url) => new Request(url));
    },
    async match(request) {
      return entries.get(request.url)?.clone();
    },
    async put(request, response) {
      entries.set(request.url, response.clone());
    },
  };
}
