import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { discoverLatestDataset, loadDataset } from '../src/dataset-loader.js';

const wasmPath = new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).pathname;

describe('discoverLatestDataset', () => {
  it('uses the newest GitHub dataset release', async () => {
    const result = await discoverLatestDataset(
      mockFetch({
        'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': [
          {
            tag_name: 'dataset-2026-04',
            published_at: '2026-04-05T00:00:00Z',
            assets: [{ name: 'dataset-manifest.json', browser_download_url: 'https://example.test/apr.json' }],
          },
          {
            tag_name: 'dataset-2026-05',
            published_at: '2026-05-05T00:00:00Z',
            assets: [{ name: 'dataset-manifest.json', browser_download_url: 'https://example.test/may.json' }],
          },
        ],
      }),
    );

    expect(result.dataset_tag).toBe('dataset-2026-05');
    expect(result.manifest_url).toBe('https://example.test/may.json');
  });

  it('falls back to dataset-latest.json when GitHub discovery fails', async () => {
    const latest = {
      dataset_tag: 'dataset-2026-05',
      manifest_url: 'https://example.test/dataset-manifest.json',
      sources_snapshot_date: '2026-05-01',
      released_at: '2026-05-05T03:14:00Z',
    };

    const result = await discoverLatestDataset(
      mockFetch({
        'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': notFound(),
        './dataset-latest.json': latest,
      }),
    );

    expect(result).toEqual(latest);
  });
});

describe('loadDataset', () => {
  it('loads chunked SQLite and performs local lookup', async () => {
    const sqliteBytes = await buildSqliteFixture();
    const firstChunk = sqliteBytes.slice(0, 128);
    const secondChunk = sqliteBytes.slice(128);
    const fetchFn = mockFetch({
      'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100': [
        {
          tag_name: 'dataset-2026-05',
          published_at: '2026-05-05T03:14:00Z',
          assets: [
            {
              name: 'dataset-manifest.json',
              browser_download_url: 'https://example.test/dataset-manifest.json',
            },
          ],
        },
      ],
      'https://example.test/dataset-manifest.json': {
        schema_version: 1,
        dataset_tag: 'dataset-2026-05',
        released_at: '2026-05-05T03:14:00Z',
        sources_snapshot_date: '2026-05-01',
        schema: { table: 'cup_index', version: 1 },
        cup_index: {
          base_url: 'https://example.test/release',
          files: ['cup-index.sqlite.000', 'cup-index.sqlite.001'],
          chunk_size_bytes: 128,
          total_size_bytes: sqliteBytes.byteLength,
          sha256: 'test',
        },
        n_records: 1,
        min_software_version: '0.3.0',
        natura_categories: [],
      },
      'https://example.test/release/cup-index.sqlite.000': firstChunk,
      'https://example.test/release/cup-index.sqlite.001': secondChunk,
    });

    const dataset = await loadDataset({
      fetchFn,
      initSql: () => initSqlJs({ locateFile: () => wasmPath }),
    });

    expect(dataset.manifest.dataset_tag).toBe('dataset-2026-05');
    expect(dataset.hasCup('G17H03000130001')).toBe(true);
    expect(dataset.hasCup('H11B22001230001')).toBe(false);
    dataset.close();
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

function mockFetch(routes) {
  return async (url) => {
    const key = String(url);
    const value = routes[key];
    if (value === undefined || value?.notFound) return notFound();
    if (value instanceof Uint8Array) return new Response(value);
    return Response.json(value);
  };
}

function notFound() {
  return new Response('not found', { status: 404 });
}
