import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, '../..');
const fallbackVersion = '0.0.0-dev';
const appVersion = readAppVersion();

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  plugins: [serviceWorkerPlugin(appVersion)],
  build: {
    sourcemap: true,
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.js'],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 100,
        perFile: true,
      },
    },
  },
});

function readAppVersion() {
  try {
    const tag = execSync('git describe --tags --match v[0-9]* --abbrev=0', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (tag) {
      return tag.replace(/^v/, '');
    }
  } catch (error) {
    // Local archives or CI checkouts without tags get a non-release build marker.
    console.warn(
      `Unable to derive app version from git tags; using ${fallbackVersion}.`,
      error instanceof Error ? error.message : error,
    );
  }

  return fallbackVersion;
}

function serviceWorkerPlugin(version) {
  const buildId = (precacheAssets = []) => {
    const source = precacheAssets.join('|') || 'dev';
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36);
  };

  const source = (precacheAssets = []) =>
    readFileSync(resolve(webDir, 'src/sw.js'), 'utf8')
      .replaceAll('__APP_VERSION__', version)
      .replaceAll('__BUILD_ID__', buildId(precacheAssets))
      .replace('__PRECACHE_ASSETS__', JSON.stringify(precacheAssets));

  return {
    name: 'cup-check-service-worker',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== '/sw.js') {
          next();
          return;
        }

        response.setHeader('Content-Type', 'application/javascript');
        response.end(source());
      });
    },
    generateBundle(_options, bundle) {
      const precacheAssets = Object.values(bundle)
        .map((file) => file.fileName)
        .filter((fileName) => fileName !== 'sw.js')
        .filter((fileName) => !fileName.endsWith('.map'))
        .map((fileName) => `./${fileName}`);

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: source(precacheAssets),
      });
    },
  };
}
