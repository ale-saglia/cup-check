import type { Dataset, DatasetLatestPointer, DatasetManifest, DatasetCupIndex, DownloadProgress } from '../types.js';

const LATEST_DATASET_URL = './dataset-latest.json';
const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100';
const PAGES_DATASETS_URL = 'https://ale-saglia.github.io/cup-check/datasets';
const DATASET_TAG_PATTERN = /^dataset-\d{4}-\d{2}$/;
const MIN_SCHEMA_VERSION = 1;
const MAX_CHUNK_RETRIES = 2;
const CHUNK_INACTIVITY_TIMEOUT_MS = 30_000;
const CACHE_NAME = 'cup-check-dataset-v1';
const CACHE_KEY_SQLITE = 'cup-check://dataset/sqlite';
const CACHE_KEY_META = 'cup-check://dataset/meta';

type FetchFn = typeof fetch;
interface LoadDatasetOptions {
  fetchFn?: FetchFn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initSql?: (options?: Record<string, unknown>) => Promise<any>;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

let datasetPromise: Promise<Dataset> | null = null;
let datasetController: AbortController | null = null;
const datasetConsumers = new Set<DatasetConsumer>();

interface DatasetConsumer {
  onProgress: (progress: DownloadProgress) => void;
}

export function loadLatestDataset(options: LoadDatasetOptions = {}): Promise<Dataset> {
  if (!datasetPromise) {
    datasetController = new AbortController();
    const { fetchFn, initSql } = options;
    const pendingDataset = loadDataset({
      fetchFn,
      initSql,
      signal: datasetController.signal,
      onProgress: (progress) => {
        for (const consumer of datasetConsumers) {
          consumer.onProgress(progress);
        }
      },
    }).catch((error) => {
      datasetPromise = null;
      datasetController = null;
      datasetConsumers.clear();
      throw error;
    });
    datasetPromise = pendingDataset;
  }

  return followDatasetPromise(datasetPromise, options);
}

function followDatasetPromise(promise: Promise<Dataset>, options: LoadDatasetOptions): Promise<Dataset> {
  const consumer: DatasetConsumer = {
    onProgress: options.onProgress ?? (() => {}),
  };
  datasetConsumers.add(consumer);

  const unregister = () => {
    datasetConsumers.delete(consumer);
    if (datasetConsumers.size === 0 && datasetController && !datasetController.signal.aborted) {
      datasetController.abort();
    }
  };

  if (!options.signal) {
    return promise.finally(unregister);
  }

  if (options.signal.aborted) {
    unregister();
    return Promise.reject(makeAbortError(options.signal.reason));
  }

  return new Promise<Dataset>((resolve, reject) => {
    const onAbort = () => {
      unregister();
      reject(makeAbortError(options.signal?.reason));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (dataset) => {
        options.signal?.removeEventListener('abort', onAbort);
        unregister();
        resolve(dataset);
      },
      (error) => {
        options.signal?.removeEventListener('abort', onAbort);
        unregister();
        reject(error);
      },
    );
  });
}

function makeAbortError(reason?: unknown): DOMException {
  if (reason instanceof DOMException && reason.name === 'AbortError') return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

export async function discoverLatestDataset(fetchFn: FetchFn = fetch, signal?: AbortSignal): Promise<DatasetLatestPointer> {
  const latest = await fetchJson(fetchFn, LATEST_DATASET_URL, signal).catch(() => null);
  if (isLatestPointer(latest)) return latest;
  return discoverLatestFromGitHub(fetchFn, signal);
}

async function discoverLatestFromGitHub(fetchFn: FetchFn, signal?: AbortSignal): Promise<DatasetLatestPointer> {
  const releases = await fetchJson(fetchFn, GITHUB_RELEASES_URL, signal);
  if (!Array.isArray(releases)) {
    throw new Error('dataset releases response is not an array');
  }

  const release = releases
    .filter((item: unknown) => DATASET_TAG_PATTERN.test((item as Record<string, string>)?.tag_name ?? ''))
    .sort((a: Record<string, string>, b: Record<string, string>) => b.tag_name.localeCompare(a.tag_name))[0] as Record<string, string> | undefined;
  if (!release) {
    throw new Error('latest dataset release not found');
  }

  return {
    dataset_tag: release.tag_name,
    manifest_url: `${PAGES_DATASETS_URL}/${release.tag_name}/dataset-manifest.json`,
    sources_snapshot_date: release.tag_name.replace('dataset-', '') + '-01',
    released_at: release.published_at ?? release.created_at ?? '',
  };
}

export async function loadDataset({
  fetchFn = fetch,
  initSql = initDefaultSql,
  onProgress = () => {},
  signal,
}: LoadDatasetOptions = {}): Promise<Dataset> {
  let latest: DatasetLatestPointer;
  let manifest: DatasetManifest;
  let sqliteBytes: Uint8Array;

  try {
    latest = await discoverLatestDataset(fetchFn, signal);
    manifest = await fetchJson(fetchFn, latest.manifest_url, signal) as DatasetManifest;
    validateManifest(manifest);

    const cached = await getCachedSqliteBytes(manifest.cup_index.sha256);
    if (cached) {
      sqliteBytes = cached;
      onProgress({
        loadedBytes: manifest.cup_index.total_size_bytes,
        totalBytes: manifest.cup_index.total_size_bytes,
        percent: 100,
        datasetTag: manifest.dataset_tag,
      });
    } else {
      sqliteBytes = await downloadCupIndex(
        fetchFn,
        manifest.cup_index,
        (progress) => onProgress({ ...progress, datasetTag: manifest.dataset_tag }),
        signal,
      );
      await saveSqliteToCache(sqliteBytes, manifest.cup_index.sha256, latest, manifest);
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    const offline = await getCachedDatasetOffline();
    if (!offline) throw err;
    ({ bytes: sqliteBytes, latest, manifest } = offline);
    onProgress({
      loadedBytes: offline.bytes.byteLength,
      totalBytes: offline.bytes.byteLength,
      percent: 100,
      datasetTag: manifest.dataset_tag,
    });
  }

  const SQL = await initSql();
  const db = new SQL.Database(sqliteBytes!);

  return {
    latest: latest!,
    manifest: manifest!,
    hasCup(cup: string): boolean {
      const statement = db.prepare('SELECT 1 FROM cup_index WHERE cup = ? LIMIT 1');
      try {
        statement.bind([cup]);
        return statement.step();
      } finally {
        statement.free();
      }
    },
    close() {
      db.close();
    },
  };
}

async function getCachedSqliteBytes(expectedSha256: string): Promise<Uint8Array | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(CACHE_KEY_SQLITE);
    if (!response) return null;
    if (response.headers.get('X-SHA256') !== expectedSha256) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function saveSqliteToCache(
  bytes: Uint8Array,
  sha256: string,
  latest: DatasetLatestPointer,
  manifest: DatasetManifest,
): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all([
      cache.put(CACHE_KEY_SQLITE, new Response(bytes.buffer as ArrayBuffer, { headers: { 'X-SHA256': sha256 } })),
      cache.put(CACHE_KEY_META, Response.json({ latest, manifest })),
    ]);
  } catch {
    // Quota exceeded or Cache API unavailable — ignore
  }
}

async function getCachedDatasetOffline(): Promise<{
  bytes: Uint8Array;
  latest: DatasetLatestPointer;
  manifest: DatasetManifest;
} | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const [sqliteResponse, metaResponse] = await Promise.all([
      cache.match(CACHE_KEY_SQLITE),
      cache.match(CACHE_KEY_META),
    ]);
    if (!sqliteResponse || !metaResponse) return null;
    const [bytes, meta] = await Promise.all([
      sqliteResponse.arrayBuffer().then((b) => new Uint8Array(b)),
      metaResponse.json() as Promise<{ latest: DatasetLatestPointer; manifest: DatasetManifest }>,
    ]);
    return { bytes, ...meta };
  } catch {
    return null;
  }
}

async function initDefaultSql(options?: Record<string, unknown>) {
  const [{ default: initSqlJs }, { default: sqlWasmUrl }] = await Promise.all([
    import('sql.js'),
    // @ts-expect-error — Vite URL import, no TS declarations
    import('sql.js/dist/sql-wasm.wasm?url'),
  ]);
  return initSqlJs({ locateFile: () => sqlWasmUrl, ...options });
}

async function downloadCupIndex(fetchFn: FetchFn, cupIndex: DatasetCupIndex, onProgress: (p: Omit<DownloadProgress, 'datasetTag'>) => void, signal?: AbortSignal): Promise<Uint8Array> {
  const chunkHashes = cupIndex.files_sha256;
  let loadedBytes = 0;
  onProgress({ loadedBytes: 0, totalBytes: cupIndex.total_size_bytes, percent: 0 });

  const reportProgress = (delta: number) => {
    loadedBytes += delta;
    onProgress({
      loadedBytes,
      totalBytes: cupIndex.total_size_bytes,
      percent: Math.min(100, Math.floor((loadedBytes / cupIndex.total_size_bytes) * 100)),
    });
  };

  const chunks = await Promise.all(
    cupIndex.files.map((file, index) =>
      fetchAndVerifyChunk(
        fetchFn,
        `${cupIndex.base_url}/${file}`,
        chunkHashes[index],
        MAX_CHUNK_RETRIES,
        reportProgress,
        signal,
      ),
    ),
  );

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (totalSize !== cupIndex.total_size_bytes) {
    throw new Error('dataset chunk size mismatch');
  }

  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchAndVerifyChunk(fetchFn: FetchFn, url: string, expectedSha256: string, retries: number, onBytes: (n: number) => void, signal?: AbortSignal): Promise<Uint8Array> {
  let receivedThisAttempt = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    signal?.throwIfAborted();
    if (attempt > 0) {
      onBytes(-receivedThisAttempt);
      receivedThisAttempt = 0;
    }
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onExternalAbort, { once: true });
    let timeoutId = setTimeout(() => controller.abort(), CHUNK_INACTIVITY_TIMEOUT_MS);
    try {
      const response = await fetchFn(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`dataset chunk ${url}: HTTP ${response.status}`);
      const bytes = await readResponseBytes(response, (n) => {
        receivedThisAttempt += n;
        onBytes(n);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => controller.abort(), CHUNK_INACTIVITY_TIMEOUT_MS);
      });
      await verifySha256(bytes, expectedSha256);
      return bytes;
    } catch (err) {
      if (signal?.aborted || attempt === retries) throw err;
    } finally {
      signal?.removeEventListener('abort', onExternalAbort);
      clearTimeout(timeoutId);
    }
  }
  // Unreachable: loop always throws on the last attempt
  throw new Error('all retries exhausted');
}

async function verifySha256(bytes: Uint8Array, expectedHex: string): Promise<void> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hashHex !== expectedHex) {
    throw new Error('dataset integrity check failed');
  }
}

async function readResponseBytes(response: Response, onBytes: (n: number) => void): Promise<Uint8Array> {
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onBytes(bytes.byteLength);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalSize += value.byteLength;
    onBytes(value.byteLength);
  }

  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchJson(fetchFn: FetchFn, url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetchFn(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error(`${url}: unexpected content-type "${ct}"`);
  }
  return response.json();
}

function validateManifest(manifest: unknown): asserts manifest is DatasetManifest {
  const m = manifest as Record<string, unknown>;
  if (m?.schema_version !== MIN_SCHEMA_VERSION) {
    throw new Error('unsupported dataset manifest schema');
  }
  if ((m?.schema as Record<string, unknown>)?.table !== 'cup_index') {
    throw new Error('unsupported dataset table');
  }
  const cupIndex = m?.cup_index as Record<string, unknown> | undefined;
  if (
    !cupIndex ||
    typeof cupIndex.base_url !== 'string' ||
    !Array.isArray(cupIndex.files) ||
    cupIndex.files.length === 0 ||
    !cupIndex.files.every((file: unknown) => typeof file === 'string') ||
    typeof cupIndex.total_size_bytes !== 'number' ||
    !Array.isArray(cupIndex.files_sha256) ||
    cupIndex.files_sha256.length !== cupIndex.files.length ||
    !cupIndex.files_sha256.every((h: unknown) => typeof h === 'string' && h.length > 0)
  ) {
    throw new Error('invalid dataset cup_index');
  }
}

function isLatestPointer(value: unknown): value is DatasetLatestPointer {
  const v = value as Record<string, unknown>;
  return (
    DATASET_TAG_PATTERN.test(String(v?.dataset_tag ?? '')) &&
    typeof v?.manifest_url === 'string' &&
    v.manifest_url.length > 0 &&
    typeof v?.sources_snapshot_date === 'string' &&
    typeof v?.released_at === 'string'
  );
}
