const LATEST_DATASET_URL = './dataset-latest.json';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/ale-saglia/cup-check/releases?per_page=100';
const DATASET_TAG_PATTERN = /^dataset-\d{4}-\d{2}$/;
const MIN_SCHEMA_VERSION = 1;

let datasetPromise = null;

export function loadLatestDataset() {
  datasetPromise ??= loadDataset();
  return datasetPromise;
}

export async function discoverLatestDataset(fetchFn = fetch) {
  try {
    const latest = await fetchJson(fetchFn, LATEST_DATASET_URL);
    if (isLatestPointer(latest)) return latest;
  } catch {
    // Fallback to GitHub API discovery when the static pointer is unavailable.
  }

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
  const manifestAsset = release?.assets?.find((asset) => asset?.name === 'dataset-manifest.json');
  if (!release || !manifestAsset?.browser_download_url) {
    throw new Error('latest dataset release not found');
  }

  return {
    dataset_tag: release.tag_name,
    manifest_url: manifestAsset.browser_download_url,
    sources_snapshot_date: release.tag_name.replace('dataset-', '') + '-01',
    released_at: release.published_at ?? release.created_at ?? '',
  };
}

export async function loadDataset({ fetchFn = fetch, initSql = initDefaultSql } = {}) {
  const latest = await discoverLatestDataset(fetchFn);
  const manifest = await fetchJson(fetchFn, latest.manifest_url);
  validateManifest(manifest);
  const sqliteBytes = await downloadCupIndex(fetchFn, manifest.cup_index);
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

async function downloadCupIndex(fetchFn, cupIndex) {
  const chunks = await Promise.all(
    cupIndex.files.map(async (file) => {
      const response = await fetchFn(`${cupIndex.base_url}/${file}`);
      if (!response.ok) throw new Error(`dataset chunk ${file}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
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
    typeof cupIndex.total_size_bytes !== 'number'
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
