const LATEST_DATASET_URL = './dataset-latest.json';
const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100';
const PAGES_DATASETS_URL = 'https://ale-saglia.github.io/cup-check/datasets';
const DATASET_TAG_PATTERN = /^dataset-\d{4}-\d{2}$/;
const MIN_SCHEMA_VERSION = 1;
const MAX_CHUNK_RETRIES = 2;

let datasetPromise = null;

export function loadLatestDataset(options = {}) {
  datasetPromise ??= loadDataset(options);
  return datasetPromise;
}

export async function discoverLatestDataset(fetchFn = fetch) {
  const latest = await fetchJson(fetchFn, LATEST_DATASET_URL).catch(() => null);
  if (isLatestPointer(latest)) return latest;
  return discoverLatestFromGitHub(fetchFn);
}

async function discoverLatestFromGitHub(fetchFn) {
  const releases = await fetchJson(fetchFn, GITHUB_RELEASES_URL);
  if (!Array.isArray(releases)) {
    throw new Error('dataset releases response is not an array');
  }

  const release = releases
    .filter((item) => DATASET_TAG_PATTERN.test(item?.tag_name ?? ''))
    .sort((a, b) => b.tag_name.localeCompare(a.tag_name))[0];
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
} = {}) {
  const latest = await discoverLatestDataset(fetchFn);
  const manifest = await fetchJson(fetchFn, latest.manifest_url);
  validateManifest(manifest);
  const sqliteBytes = await downloadCupIndex(fetchFn, manifest.cup_index, (progress) =>
    onProgress({ ...progress, datasetTag: manifest.dataset_tag }),
  );
  const SQL = await initSql();
  const db = new SQL.Database(sqliteBytes);

  return {
    latest,
    manifest,
    hasCup(cup) {
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

async function initDefaultSql(options) {
  const [{ default: initSqlJs }, { default: sqlWasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
  ]);
  return initSqlJs({ locateFile: () => sqlWasmUrl, ...options });
}

async function downloadCupIndex(fetchFn, cupIndex, onProgress) {
  const chunkHashes = cupIndex.files_sha256;
  let loadedBytes = 0;
  onProgress({ loadedBytes: 0, totalBytes: cupIndex.total_size_bytes, percent: 0 });

  const chunks = await Promise.all(
    cupIndex.files.map(async (file, index) => {
      const bytes = await fetchAndVerifyChunk(
        fetchFn,
        `${cupIndex.base_url}/${file}`,
        chunkHashes[index],
        MAX_CHUNK_RETRIES,
      );
      loadedBytes += bytes.byteLength;
      onProgress({
        loadedBytes,
        totalBytes: cupIndex.total_size_bytes,
        percent: Math.min(100, Math.floor((loadedBytes / cupIndex.total_size_bytes) * 100)),
      });
      return bytes;
    }),
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

async function fetchAndVerifyChunk(fetchFn, url, expectedSha256, retries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchFn(url);
      if (!response.ok) throw new Error(`dataset chunk ${url}: HTTP ${response.status}`);
      const bytes = await readResponseBytes(response, () => {});
      await verifySha256(bytes, expectedSha256);
      return bytes;
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
}

async function verifySha256(bytes, expectedHex) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hashHex !== expectedHex) {
    throw new Error('dataset integrity check failed');
  }
}

async function readResponseBytes(response, onBytes) {
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

async function fetchJson(fetchFn, url) {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function validateManifest(manifest) {
  if (manifest?.schema_version !== MIN_SCHEMA_VERSION) {
    throw new Error('unsupported dataset manifest schema');
  }
  if (manifest?.schema?.table !== 'cup_index') {
    throw new Error('unsupported dataset table');
  }
  const cupIndex = manifest?.cup_index;
  if (
    !cupIndex ||
    typeof cupIndex.base_url !== 'string' ||
    !Array.isArray(cupIndex.files) ||
    cupIndex.files.length === 0 ||
    !cupIndex.files.every((file) => typeof file === 'string') ||
    typeof cupIndex.total_size_bytes !== 'number' ||
    !Array.isArray(cupIndex.files_sha256) ||
    cupIndex.files_sha256.length !== cupIndex.files.length ||
    !cupIndex.files_sha256.every((h) => typeof h === 'string' && h.length > 0)
  ) {
    throw new Error('invalid dataset cup_index');
  }
}

function isLatestPointer(value) {
  return (
    DATASET_TAG_PATTERN.test(value?.dataset_tag ?? '') &&
    typeof value?.manifest_url === 'string' &&
    value.manifest_url.length > 0 &&
    typeof value?.sources_snapshot_date === 'string' &&
    typeof value?.released_at === 'string'
  );
}
