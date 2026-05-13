import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('service worker', () => {
  let handlers;
  let cachesMock;
  let fetchMock;

  beforeEach(() => {
    vi.resetModules();
    handlers = {};
    const stores = new Map();
    cachesMock = {
      keys: vi.fn(async () => [...stores.keys()]),
      delete: vi.fn(async (key) => stores.delete(key)),
      open: vi.fn(async (name) => {
        if (!stores.has(name)) stores.set(name, makeCache());
        return stores.get(name);
      }),
      match: vi.fn(async (request) => new Response(`cached:${request.url}`)),
      stores,
    };
    fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('caches', cachesMock);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('__PRECACHE_ASSETS__', ['./assets/app.js', './assets/app.js']);
    vi.stubGlobal('self', {
      addEventListener: vi.fn((type, handler) => {
        handlers[type] = handler;
      }),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    });
  });

  it('precaches app shell on install', async () => {
    await import('../src/sw.js');
    const waitUntil = vi.fn();

    handlers.install({ waitUntil });
    await waitUntil.mock.calls[0][0];

    const appCache = await cachesMock.open('cup-check-v__APP_VERSION__-__BUILD_ID__');
    expect(appCache.addAll).toHaveBeenCalledWith([
      './',
      './index.html',
      './manifest.webmanifest',
      './favicon.svg',
      './assets/app.js',
    ]);
    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('activates current caches and evicts dataset requests from app cache', async () => {
    await import('../src/sw.js');
    cachesMock.stores.set('old-cache', makeCache());
    const appCache = makeCache([
      request('https://example.test/datasets/dataset-2026-04/cup-index.sqlite.000'),
      request('https://example.test/assets/app.js'),
    ]);
    cachesMock.stores.set('cup-check-v__APP_VERSION__-__BUILD_ID__', appCache);
    const waitUntil = vi.fn();

    handlers.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(cachesMock.delete).toHaveBeenCalledWith('old-cache');
    expect(appCache.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.test/datasets/dataset-2026-04/cup-index.sqlite.000',
      }),
    );
    expect(self.clients.claim).toHaveBeenCalledTimes(1);
  });

  it('ignores non-GET fetch requests', async () => {
    await import('../src/sw.js');
    const event = { request: request('https://example.test/api', 'POST'), respondWith: vi.fn() };

    handlers.fetch(event);

    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('uses network-first caching for app and dataset requests', async () => {
    await import('../src/sw.js');
    const event = {
      request: request('https://example.test/datasets/dataset-2026-05/cup-index.sqlite.000'),
      waitUntil: vi.fn((promise) => promise),
      respondWith: vi.fn(),
    };

    handlers.fetch(event);
    const response = await event.respondWith.mock.calls[0][0];

    expect(response.ok).toBe(true);
    expect(cachesMock.open).toHaveBeenCalledWith('cup-check-dataset-v1');
  });

  it('does not cache failed network responses and falls back to cache on errors', async () => {
    await import('../src/sw.js');
    fetchMock.mockResolvedValueOnce(new Response('no', { status: 503 }));
    const failedEvent = {
      request: request('https://example.test/index.html'),
      waitUntil: vi.fn(),
      respondWith: vi.fn(),
    };

    handlers.fetch(failedEvent);
    expect(await failedEvent.respondWith.mock.calls[0][0]).toHaveProperty('status', 503);
    expect(failedEvent.waitUntil).not.toHaveBeenCalled();

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const offlineEvent = {
      request: request('https://example.test/index.html'),
      waitUntil: vi.fn(),
      respondWith: vi.fn(),
    };

    handlers.fetch(offlineEvent);
    expect(await (await offlineEvent.respondWith.mock.calls[0][0]).text()).toBe(
      'cached:https://example.test/index.html',
    );

    cachesMock.match.mockResolvedValueOnce(null);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const missingCacheEvent = {
      request: request('https://example.test/missing.html'),
      waitUntil: vi.fn(),
      respondWith: vi.fn(),
    };

    handlers.fetch(missingCacheEvent);
    expect((await missingCacheEvent.respondWith.mock.calls[0][0]).type).toBe('error');
  });

  it('keeps dataset cache untouched when a dataset URL has no release tag', async () => {
    await import('../src/sw.js');
    const datasetCache = makeCache([request('https://example.test/dataset-latest.json')]);
    cachesMock.stores.set('cup-check-dataset-v1', datasetCache);
    const event = {
      request: request('https://example.test/dataset-latest.json'),
      waitUntil: vi.fn((promise) => promise),
      respondWith: vi.fn(),
    };

    handlers.fetch(event);
    await event.respondWith.mock.calls[0][0];
    await event.waitUntil.mock.calls[0][0];

    expect(datasetCache.delete).not.toHaveBeenCalled();
  });

  it('evicts old dataset releases but keeps untagged dataset responses', async () => {
    await import('../src/sw.js');
    const datasetCache = makeCache([
      request('https://example.test/datasets/dataset-2026-04/cup-index.sqlite.000'),
      request('https://example.test/dataset-latest.json'),
    ]);
    cachesMock.stores.set('cup-check-dataset-v1', datasetCache);
    const event = {
      request: request('https://example.test/datasets/dataset-2026-05/dataset-manifest.json'),
      waitUntil: vi.fn((promise) => promise),
      respondWith: vi.fn(),
    };

    handlers.fetch(event);
    await event.respondWith.mock.calls[0][0];
    await event.waitUntil.mock.calls[0][0];

    expect(datasetCache.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.test/datasets/dataset-2026-04/cup-index.sqlite.000',
      }),
    );
    expect(datasetCache.delete).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.test/dataset-latest.json' }),
    );
  });
});

function makeCache(keys = []) {
  return {
    addAll: vi.fn(async () => {}),
    keys: vi.fn(async () => keys),
    delete: vi.fn(async () => true),
    put: vi.fn(async () => {}),
  };
}

function request(url, method = 'GET') {
  return { url, method };
}
