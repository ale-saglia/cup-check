import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { findChromePath } from './chrome-path.mjs';
import { chromium } from 'playwright';

const MIN_SCORE = 90;
const port = await getFreePort();
const server = spawn(
  'npm',
  ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
const outputDir = await mkdtemp(join(tmpdir(), 'cup-check-lighthouse-'));
const outputPath = join(outputDir, 'report.json');

try {
  const url = `http://127.0.0.1:${port}/`;
  await writeLocalUnavailableDataset();
  await waitForHttp(url);
  await runLighthouse(url, outputPath);
  const report = JSON.parse(await readFile(outputPath, 'utf8'));
  const scores = {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories['best-practices'].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
  };

  for (const [category, score] of Object.entries(scores)) {
    if (score < MIN_SCORE) {
      throw new Error(`Lighthouse ${category} sotto soglia: ${score} < ${MIN_SCORE}`);
    }
  }

  const pwa = await checkPwaSurface(url);

  console.log(JSON.stringify({ ...scores, pwa }, null, 2));
} finally {
  stopServer(server);
  await removeLocalUnavailableDataset();
  await rm(outputDir, { recursive: true, force: true });
}

async function writeLocalUnavailableDataset() {
  await writeFile(
    'dist/dataset-latest.json',
    JSON.stringify({
      dataset_tag: 'dataset-2026-05',
      manifest_url: './dataset-manifest.json',
      sources_snapshot_date: '2026-05-01',
      released_at: '2026-05-01T00:00:00Z',
    }),
  );
  await writeFile('dist/dataset-manifest.json', JSON.stringify({ schema_version: 0 }));
}

async function removeLocalUnavailableDataset() {
  await rm('dist/dataset-latest.json', { force: true });
  await rm('dist/dataset-manifest.json', { force: true });
}

async function runLighthouse(url, outputPath) {
  const chromePath = findChromePath() ?? chromium.executablePath();
  const child = spawn(
    'lighthouse',
    [
      url,
      '--output=json',
      `--output-path=${outputPath}`,
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage',
      '--quiet',
    ],
    {
      env: { ...process.env, CHROME_PATH: chromePath },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const [code] = await once(child, 'exit');
  if (code !== 0) {
    throw new Error(`Lighthouse fallito (${code}): ${Buffer.concat(stderr).toString('utf8')}`);
  }
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite preview is still starting.
    }
    await delay(100);
  }
  throw new Error(`preview non raggiungibile: ${url}`);
}

async function checkPwaSurface(url) {
  const manifestUrl = new URL('./manifest.webmanifest', url);
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`manifest non raggiungibile: ${manifestResponse.status}`);
  }

  const manifest = await manifestResponse.json();
  const requiredManifestFields = [
    'name',
    'short_name',
    'start_url',
    'scope',
    'display',
    'theme_color',
    'background_color',
  ];
  const missingFields = requiredManifestFields.filter((field) => !manifest[field]);
  if (missingFields.length > 0) {
    throw new Error(`manifest incompleto: mancano ${missingFields.join(', ')}`);
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('manifest incompleto: manca almeno una icona');
  }

  await assertOk(new URL('./sw.js', url), 'service worker');
  await assertOk(new URL('./favicon.svg', url), 'favicon');
  await assertOk(new URL('./robots.txt', url), 'robots.txt');

  return 'checked';
}

async function assertOk(resourceUrl, label) {
  const response = await fetch(resourceUrl);
  if (!response.ok) {
    throw new Error(`${label} non raggiungibile: ${response.status}`);
  }
}

async function getFreePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port: freePort } = probe.address();
  probe.close();
  await once(probe, 'close');
  return freePort;
}

function stopServer(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill();
  }
}
