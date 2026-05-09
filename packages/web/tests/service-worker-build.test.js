import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const webDir = resolve(fileURLToPath(import.meta.url), '../..');

describe('service worker build', () => {
  it('pre-cachea gli asset Vite generati', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'cup-check-web-'));

    try {
      await build({
        configFile: resolve(webDir, 'vite.config.js'),
        logLevel: 'silent',
        build: {
          outDir,
          emptyOutDir: true,
        },
      });

      const serviceWorker = await readFile(join(outDir, 'sw.js'), 'utf8');

      expect(serviceWorker).toMatch(/\.\/assets\/index-[\w-]+\.js/);
      expect(serviceWorker).toMatch(/\.\/assets\/index-[\w-]+\.css/);
      expect(serviceWorker).not.toContain('__PRECACHE_ASSETS__');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
