#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const sourceDir = resolve(repoRoot, process.argv[2] ?? 'dist/dataset');
const webDistDir = resolve(repoRoot, process.argv[3] ?? 'packages/web/dist');

const latestPath = join(sourceDir, 'dataset-latest.json');
const manifestPath = join(sourceDir, 'dataset-manifest.json');

const latest = JSON.parse(await readFile(latestPath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const datasetTag = latest.dataset_tag;
const targetDatasetDir = join(webDistDir, 'datasets', datasetTag);

await mkdir(targetDatasetDir, { recursive: true });

const files = await readdir(sourceDir);
const chunkFiles = files.filter((file) => /^cup-index\.sqlite\.\d+$/.test(file)).sort();
if (chunkFiles.length === 0) {
  throw new Error(`No cup-index.sqlite.* chunks found in ${sourceDir}`);
}

for (const file of chunkFiles) {
  await copyFile(join(sourceDir, file), join(targetDatasetDir, file));
}

manifest.cup_index.base_url = `./datasets/${datasetTag}`;
latest.manifest_url = `./datasets/${datasetTag}/dataset-manifest.json`;

await writeFile(join(targetDatasetDir, 'dataset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(webDistDir, 'dataset-latest.json'), `${JSON.stringify(latest, null, 2)}\n`);

console.log(`Prepared ${datasetTag} for local web preview with ${chunkFiles.length} chunks.`);
