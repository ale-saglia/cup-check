import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { findChromePath } from './chrome-path.mjs';

const MIN_SCORE = 90;
const port = await getFreePort();
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const outputDir = await mkdtemp(join(tmpdir(), 'cup-check-lighthouse-'));
const outputPath = join(outputDir, 'report.json');

try {
  const url = `http://127.0.0.1:${port}/`;
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

  console.log(JSON.stringify(scores, null, 2));
} finally {
  stopServer(server);
  await rm(outputDir, { recursive: true, force: true });
}

async function runLighthouse(url, outputPath) {
  const chromePath = await findChromePath();
  if (!chromePath) {
    throw new Error('Chrome/Chromium non trovato. Nel devcontainer ricostruito e atteso /usr/bin/chromium.');
  }
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
