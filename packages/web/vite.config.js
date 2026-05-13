import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pdfjsWorkerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, '../..');

function traineddataPath(lang) {
  const dir = resolve(webDir, `node_modules/@tesseract.js-data/${lang}`);
  const subdir = readdirSync(dir).find((d) => d.includes('best_int') && d.endsWith('best_int'));
  if (!subdir) throw new Error(`${lang} traineddata (best_int) not found in @tesseract.js-data/${lang}`);
  return `node_modules/@tesseract.js-data/${lang}/${subdir}/${lang}.traineddata.gz`;
}

const tesseractAssets = [
  {
    urlPath: '/tesseract/worker.min.js',
    srcPath: 'node_modules/tesseract.js/dist/worker.min.js',
  },
  ...['lstm', 'simd-lstm', 'relaxedsimd-lstm'].flatMap((variant) => [
    {
      urlPath: `/tesseract/tesseract-core-${variant}.wasm.js`,
      srcPath: `node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`,
    },
    {
      urlPath: `/tesseract/tesseract-core-${variant}.wasm`,
      srcPath: `node_modules/tesseract.js-core/tesseract-core-${variant}.wasm`,
    },
  ]),
  {
    urlPath: '/tesseract/ita.traineddata.gz',
    srcPath: traineddataPath('ita'),
  },
  {
    urlPath: '/tesseract/eng.traineddata.gz',
    srcPath: traineddataPath('eng'),
  },
];
const fallbackVersion = '0.0.0-dev';
const appVersion = readAppVersion();

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  plugins: [serviceWorkerPlugin(appVersion), pdfjsWorkerPlugin(), tesseractAssetsPlugin()],
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

function pdfjsWorkerPlugin() {
  const workerPath = resolve(webDir, pdfjsWorkerSrc);
  return {
    name: 'pdfjs-worker',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== '/pdfjs/pdf.worker.min.mjs') {
          next();
          return;
        }
        response.setHeader('Content-Type', 'application/javascript');
        response.end(readFileSync(workerPath));
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'pdfjs/pdf.worker.min.mjs',
        source: readFileSync(workerPath),
      });
    },
  };
}

function tesseractAssetsPlugin() {
  const mimeOf = (url) => (url.endsWith('.wasm') ? 'application/wasm' : 'application/javascript');
  return {
    name: 'tesseract-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const asset = tesseractAssets.find((a) => a.urlPath === request.url);
        if (!asset) {
          next();
          return;
        }
        response.setHeader('Content-Type', mimeOf(asset.urlPath));
        response.end(readFileSync(resolve(webDir, asset.srcPath)));
      });
    },
    generateBundle() {
      for (const asset of tesseractAssets) {
        this.emitFile({
          type: 'asset',
          fileName: asset.urlPath.slice(1),
          source: readFileSync(resolve(webDir, asset.srcPath)),
        });
      }
    },
  };
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
