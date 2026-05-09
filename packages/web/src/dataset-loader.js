import initSqlJs from 'sql.js';
import sqlWasm from 'sql.js/dist/sql-wasm.wasm?url';

const MANIFEST_URL = 'https://ale-saglia.github.io/cup-check/dataset/dataset-manifest.json';

export async function fetchManifest(url = MANIFEST_URL) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`manifest: HTTP ${response.status}`);
  }
  return response.json();
}

export async function downloadChunks(manifest, onProgress = () => {}) {
  const buffer = new Uint8Array(manifest.chunks.total_size_bytes);
  let offset = 0;
  let loadedBytes = 0;

  for (const fileName of manifest.chunks.files) {
    const url = `${manifest.chunks.base_url}/${fileName}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`chunk ${fileName}: HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer.set(value, offset);
      offset += value.length;
      loadedBytes += value.length;
      onProgress(loadedBytes, manifest.chunks.total_size_bytes);
    }
  }

  return buffer;
}

export async function createLookup(onProgress = () => {}) {
  const manifest = await fetchManifest();
  const data = await downloadChunks(manifest, onProgress);
  const SQL = await initSqlJs({ locateFile: () => sqlWasm });
  const db = new SQL.Database(data);
  const stmt = db.prepare('SELECT 1 FROM cups WHERE cup = ?');

  return {
    nRecords: manifest.n_records,
    lookup(cup) {
      stmt.bind([cup]);
      const found = stmt.step();
      stmt.reset();
      return found;
    },
    close() {
      stmt.free();
      db.close();
    },
  };
}
