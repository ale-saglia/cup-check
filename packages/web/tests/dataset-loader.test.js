import initSqlJs from 'sql.js';
import { describe, expect, it, vi } from 'vitest';
import { discoverLatestDataset, loadDataset } from '../src/lib/data/dataset-loader.js';

const wasmPath = new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).pathname;
const MANIFEST_URL = 'https://example.test/dataset-manifest.json';
const CHUNK_URL_0 = 'https://example.test/release/cup-index.sqlite.000';
const CHUNK_URL_1 = 'https://example.test/release/cup-index.sqlite.001';

describe('discoverLatestDataset', () => {
  it('uses dataset-latest.json before remote discovery', async () => {
    const latest = {
      dataset_tag: 'dataset-2026-05',
      manifest_url: 'https://example.test/dataset-manifest.json',
      sources_snapshot_date: '2026-05-01',
      released_at: '2026-05-05T03:14:00Z',
    };

    const result = await discoverLatestDataset(
      mockFetch({
        './dataset-latest.json': latest,
        'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': notFound(),
      }),
    );

    expect(result).toEqual(latest);
  });

  it('falls back to the newest GitHub dataset release', async () => {
    const result = await discoverLatestDataset(
      mockFetch({
        './dataset-latest.json': notFound(),
        'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': [
          {
            tag_name: 'dataset-2026-04',
            published_at: '2026-04-05T00:00:00Z',
            assets: [
              {
                name: 'dataset-manifest.json',
                browser_download_url: 'https://example.test/apr.json',
              },
            ],
          },
          {
            tag_name: 'dataset-2026-05',
            published_at: '2026-05-05T00:00:00Z',
            assets: [
              {
                name: 'dataset-manifest.json',
                browser_download_url: 'https://example.test/may.json',
              },
            ],
          },
        ],
      }),
    );

    expect(result.dataset_tag).toBe('dataset-2026-05');
    expect(result.manifest_url).toBe(
      'https://ale-saglia.github.io/cup-check/datasets/dataset-2026-05/dataset-manifest.json',
    );
  });

  it('ignores software tags during GitHub dataset discovery', async () => {
    const result = await discoverLatestDataset(
      mockFetch({
        './dataset-latest.json': notFound(),
        'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': [
          {
            tag_name: 'v0.4.0',
            published_at: '2026-06-01T00:00:00Z',
            assets: [
              { name: 'web-dist.tar.gz', browser_download_url: 'https://example.test/web.tar.gz' },
            ],
          },
          {
            tag_name: 'dataset-2026-04',
            published_at: '2026-04-05T00:00:00Z',
            assets: [
              {
                name: 'dataset-manifest.json',
                browser_download_url: 'https://example.test/apr.json',
              },
            ],
          },
          {
            tag_name: 'v0.3.1',
            published_at: '2026-05-20T00:00:00Z',
            assets: [
              {
                name: 'web-dist.tar.gz',
                browser_download_url: 'https://example.test/web-patch.tar.gz',
              },
            ],
          },
          {
            tag_name: 'dataset-2026-05',
            published_at: '2026-05-05T00:00:00Z',
            assets: [
              {
                name: 'dataset-manifest.json',
                browser_download_url: 'https://example.test/may.json',
              },
            ],
          },
        ],
      }),
    );

    expect(result.dataset_tag).toBe('dataset-2026-05');
    expect(result.manifest_url).toBe(
      'https://ale-saglia.github.io/cup-check/datasets/dataset-2026-05/dataset-manifest.json',
    );
  });

  it('rejects invalid GitHub releases responses', async () => {
    await expect(
      discoverLatestDataset(
        mockFetch({
          './dataset-latest.json': { invalid: true },
          'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': {
            tag_name: 'dataset-2026-05',
          },
        }),
      ),
    ).rejects.toThrow('dataset releases response is not an array');
  });

  it('rejects when no dataset release is available', async () => {
    await expect(
      discoverLatestDataset(
        mockFetch({
          './dataset-latest.json': { invalid: true },
          'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': [
            { tag_name: 'v0.3.0' },
          ],
        }),
      ),
    ).rejects.toThrow('latest dataset release not found');
  });

  it('rejects with url and content-type when a JSON endpoint returns HTML', async () => {
    const htmlResponse = () =>
      new Response('<html>Error</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    const fetchFn = async (url) => {
      if (String(url) === './dataset-latest.json') return notFound();
      return htmlResponse();
    };
    await expect(discoverLatestDataset(fetchFn)).rejects.toThrow(
      'unexpected content-type "text/html; charset=utf-8"',
    );
  });
});

describe('loadDataset', () => {
  it('returns the same in-flight promise through loadLatestDataset', async () => {
    vi.resetModules();
    const { loadLatestDataset } = await import('../src/lib/data/dataset-loader.js');
    const pendingFetch = vi.fn(() => new Promise(() => {}));

    const first = loadLatestDataset({ fetchFn: pendingFetch });
    const second = loadLatestDataset({ fetchFn: vi.fn() });

    expect(second).toBe(first);
    expect(pendingFetch).toHaveBeenCalledTimes(1);
  });

  it('clears the cached promise after a failed loadLatestDataset call', async () => {
    vi.resetModules();
    const { loadLatestDataset } = await import('../src/lib/data/dataset-loader.js');
    const firstFetch = vi.fn(async () => {
      throw new Error('first dataset discovery failed');
    });
    const retryFetch = vi.fn(async () => {
      throw new Error('retry dataset discovery failed');
    });

    const first = loadLatestDataset({ fetchFn: firstFetch });
    const sameFailure = loadLatestDataset({ fetchFn: vi.fn() });

    expect(sameFailure).toBe(first);
    await expect(first).rejects.toThrow('first dataset discovery failed');

    const retry = loadLatestDataset({ fetchFn: retryFetch });

    expect(retry).not.toBe(first);
    await expect(retry).rejects.toThrow('retry dataset discovery failed');
    expect(firstFetch).toHaveBeenCalledTimes(2);
    expect(retryFetch).toHaveBeenCalledTimes(2);
  });

  it('loads only once through loadLatestDataset', async () => {
    vi.resetModules();
    const { loadLatestDataset } = await import('../src/lib/data/dataset-loader.js');
    const sqliteBytes = await buildSqliteFixture();
    const sha256s = [await computeSha256Hex(sqliteBytes)];
    const fetchFn = vi.fn(
      mockFetch({
        './dataset-latest.json': latestPointer(),
        [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s, {
          files: ['cup-index.sqlite.000'],
        }),
        [CHUNK_URL_0]: sqliteBytes,
      }),
    );
    const initSql = () => initSqlJs({ locateFile: () => wasmPath });

    const first = await loadLatestDataset({ fetchFn, initSql });
    const second = await loadLatestDataset({ fetchFn, initSql });

    expect(second).toBe(first);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    first.close();
  });

  it('loads chunked SQLite and performs local lookup', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const firstChunk = sqliteBytes.slice(0, 128);
    const secondChunk = sqliteBytes.slice(128);
    const sha256s = await Promise.all([firstChunk, secondChunk].map(computeSha256Hex));
    const fetchFn = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s),
      [CHUNK_URL_0]: firstChunk,
      [CHUNK_URL_1]: secondChunk,
    });
    const progressEvents = [];

    const dataset = await loadDataset({
      fetchFn,
      initSql: () => initSqlJs({ locateFile: () => wasmPath }),
      onProgress: (progress) => progressEvents.push(progress.percent),
    });

    expect(dataset.manifest.dataset_tag).toBe('dataset-2026-05');
    expect(dataset.hasCup('G17H03000130001')).toBe(true);
    expect(dataset.hasCup('H11B22001230001')).toBe(false);
    expect(progressEvents.at(0)).toBe(0);
    expect(progressEvents.at(-1)).toBe(100);
    expect(progressEvents).toEqual([...progressEvents].sort((a, b) => a - b));
    dataset.close();
  });

  it('rejects with url and content-type when the manifest returns HTML', async () => {
    const fetchFn = async (url) => {
      if (String(url) === './dataset-latest.json') return Response.json(latestPointer());
      return new Response('<html>404 Not Found</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    };
    await expect(loadDataset({ fetchFn })).rejects.toThrow(
      `${MANIFEST_URL}: unexpected content-type "text/html; charset=utf-8"`,
    );
  });

  it('rejects when files_sha256 is absent from the manifest', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const fetchFn = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, null),
      [CHUNK_URL_0]: sqliteBytes.slice(0, 128),
      [CHUNK_URL_1]: sqliteBytes.slice(128),
    });

    await expect(loadDataset({ fetchFn })).rejects.toThrow('invalid dataset cup_index');
  });

  it('loads with the default sql.js initializer', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const sha256s = [await computeSha256Hex(sqliteBytes)];
    const dataset = await loadDataset({
      fetchFn: mockFetch({
        './dataset-latest.json': latestPointer(),
        [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s, {
          files: ['cup-index.sqlite.000'],
        }),
        [CHUNK_URL_0]: sqliteBytes,
      }),
    });

    expect(dataset.hasCup('G17H03000130001')).toBe(true);
    dataset.close();
  });

  it('rejects unsupported manifest shapes', async () => {
    const valid = makeManifest(1, ['hash']);
    await expect(
      loadDataset({
        fetchFn: mockFetch({
          './dataset-latest.json': latestPointer(),
          [MANIFEST_URL]: { ...valid, schema_version: 2 },
        }),
      }),
    ).rejects.toThrow('unsupported dataset manifest schema');
    await expect(
      loadDataset({
        fetchFn: mockFetch({
          './dataset-latest.json': latestPointer(),
          [MANIFEST_URL]: { ...valid, schema: { table: 'details' } },
        }),
      }),
    ).rejects.toThrow('unsupported dataset table');
    await expect(
      loadDataset({
        fetchFn: mockFetch({
          './dataset-latest.json': latestPointer(),
          [MANIFEST_URL]: { ...valid, cup_index: { ...valid.cup_index, files: [] } },
        }),
      }),
    ).rejects.toThrow('invalid dataset cup_index');
  });

  it('rejects when chunk sizes do not match the manifest', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const firstChunk = sqliteBytes.slice(0, 128);
    const secondChunk = sqliteBytes.slice(128);
    const sha256s = await Promise.all([firstChunk, secondChunk].map(computeSha256Hex));
    const fetchFn = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength + 1, sha256s),
      [CHUNK_URL_0]: firstChunk,
      [CHUNK_URL_1]: secondChunk,
    });

    await expect(loadDataset({ fetchFn })).rejects.toThrow('dataset chunk size mismatch');
  });

  it('reads chunk responses without a streaming body', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const sha256s = [await computeSha256Hex(sqliteBytes)];
    const fetchFn = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s, {
        files: ['cup-index.sqlite.000'],
      }),
      [CHUNK_URL_0]: {
        ok: true,
        body: null,
        arrayBuffer: async () => sqliteBytes.buffer.slice(0),
      },
    });

    const dataset = await loadDataset({
      fetchFn,
      initSql: () => initSqlJs({ locateFile: () => wasmPath }),
    });

    expect(dataset.hasCup('G17H03000130001')).toBe(true);
    dataset.close();
  });

  it('retries a chunk on HTTP failure and succeeds', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const firstChunk = sqliteBytes.slice(0, 128);
    const secondChunk = sqliteBytes.slice(128);
    const sha256s = await Promise.all([firstChunk, secondChunk].map(computeSha256Hex));
    const base = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s),
      [CHUNK_URL_0]: firstChunk,
      [CHUNK_URL_1]: secondChunk,
    });
    const fetchFn = withFailures(base, {
      [CHUNK_URL_0]: { times: 1, response: () => serverError() },
    });

    const dataset = await loadDataset({
      fetchFn,
      initSql: () => initSqlJs({ locateFile: () => wasmPath }),
    });

    expect(dataset.hasCup('G17H03000130001')).toBe(true);
    expect(fetchFn.counts[CHUNK_URL_0]).toBe(2);
    dataset.close();
  });

  it('retries a chunk on sha256 mismatch and succeeds', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const firstChunk = sqliteBytes.slice(0, 128);
    const secondChunk = sqliteBytes.slice(128);
    const sha256s = await Promise.all([firstChunk, secondChunk].map(computeSha256Hex));
    const base = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s),
      [CHUNK_URL_0]: firstChunk,
      [CHUNK_URL_1]: secondChunk,
    });
    const fetchFn = withFailures(base, {
      [CHUNK_URL_0]: { times: 1, response: () => new Response(new Uint8Array([0xde, 0xad])) },
    });

    const dataset = await loadDataset({
      fetchFn,
      initSql: () => initSqlJs({ locateFile: () => wasmPath }),
    });

    expect(dataset.hasCup('G17H03000130001')).toBe(true);
    expect(fetchFn.counts[CHUNK_URL_0]).toBe(2);
    dataset.close();
  });

  it('retries a stalled chunk after inactivity timeout', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const sha256s = [await computeSha256Hex(sqliteBytes)];
    const base = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s, {
        files: ['cup-index.sqlite.000'],
      }),
    });

    let chunkAttempt = 0;
    const fetchFn = async (url, { signal } = {}) => {
      if (url !== CHUNK_URL_0) return base(url);
      chunkAttempt++;
      if (chunkAttempt === 1) {
        let streamCtrl;
        const stream = new ReadableStream({
          start(c) {
            streamCtrl = c;
          },
        });
        signal?.addEventListener('abort', () =>
          streamCtrl?.error(new DOMException('aborted', 'AbortError')),
        );
        return new Response(stream);
      }
      return new Response(sqliteBytes);
    };

    vi.useFakeTimers();
    try {
      const loadPromise = loadDataset({
        fetchFn,
        initSql: () => initSqlJs({ locateFile: () => wasmPath }),
      });
      await vi.advanceTimersByTimeAsync(30_001);
      const dataset = await loadPromise;
      expect(chunkAttempt).toBe(2);
      expect(dataset.hasCup('G17H03000130001')).toBe(true);
      dataset.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects after exhausting chunk retries', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const firstChunk = sqliteBytes.slice(0, 128);
    const secondChunk = sqliteBytes.slice(128);
    const sha256s = await Promise.all([firstChunk, secondChunk].map(computeSha256Hex));
    const base = mockFetch({
      './dataset-latest.json': latestPointer(),
      [MANIFEST_URL]: makeManifest(sqliteBytes.byteLength, sha256s),
      [CHUNK_URL_0]: firstChunk,
      [CHUNK_URL_1]: secondChunk,
    });
    const fetchFn = withFailures(base, {
      [CHUNK_URL_0]: { times: 3, response: () => new Response(new Uint8Array([0xde, 0xad])) },
    });

    await expect(loadDataset({ fetchFn })).rejects.toThrow('dataset integrity check failed');
    expect(fetchFn.counts[CHUNK_URL_0]).toBe(3);
  });
});

async function buildSqliteFixture() {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  db.run('CREATE TABLE cup_index (cup TEXT PRIMARY KEY, detail_chunk INTEGER) WITHOUT ROWID');
  db.run('INSERT INTO cup_index (cup, detail_chunk) VALUES (?, NULL)', ['G17H03000130001']);
  const bytes = db.export();
  db.close();
  return bytes;
}

async function computeSha256Hex(bytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function latestPointer() {
  return {
    dataset_tag: 'dataset-2026-05',
    manifest_url: MANIFEST_URL,
    sources_snapshot_date: '2026-05-01',
    released_at: '2026-05-05T03:14:00Z',
  };
}

function makeManifest(totalSizeBytes, filessha256, overrides = {}) {
  const cupIndex = {
    base_url: 'https://example.test/release',
    files: ['cup-index.sqlite.000', 'cup-index.sqlite.001'],
    chunk_size_bytes: 128,
    total_size_bytes: totalSizeBytes,
    sha256: 'ignored',
    ...overrides,
  };
  if (filessha256 !== null) {
    cupIndex.files_sha256 = filessha256;
  }
  return {
    schema_version: 1,
    dataset_tag: 'dataset-2026-05',
    released_at: '2026-05-05T03:14:00Z',
    sources_snapshot_date: '2026-05-01',
    schema: { table: 'cup_index', version: 1 },
    cup_index: cupIndex,
    n_records: 1,
    min_software_version: '0.3.0',
    natura_categories: [],
  };
}

function mockFetch(routes) {
  return async (url) => {
    const key = String(url);
    const value = routes[key];
    if (value === undefined || value?.notFound) return notFound();
    if (value?.ok === true && 'arrayBuffer' in value) return value;
    if (value instanceof Uint8Array) return new Response(value);
    return Response.json(value);
  };
}

function withFailures(baseFetch, failures) {
  const counts = {};
  const fn = async (url) => {
    const failure = failures[url];
    if (failure) {
      counts[url] = (counts[url] ?? 0) + 1;
      if (counts[url] <= failure.times) return failure.response();
    }
    return baseFetch(url);
  };
  fn.counts = counts;
  return fn;
}

function notFound() {
  return new Response('not found', { status: 404 });
}

function serverError() {
  return new Response('server error', { status: 503 });
}
