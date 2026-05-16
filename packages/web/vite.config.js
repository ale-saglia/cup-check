import { defineConfig } from 'vite';
import { codecovVitePlugin } from '@codecov/vite-plugin';
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
  if (!subdir)
    throw new Error(`${lang} traineddata (best_int) not found in @tesseract.js-data/${lang}`);
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
  plugins: [
    serviceWorkerPlugin(appVersion),
    pdfjsWorkerPlugin(),
    tesseractAssetsPlugin(),
    codecovVitePlugin({
      enableBundleAnalysis: !!process.env.CODECOV_TOKEN,
      bundleName: 'cup-check-web',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
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
        branches: 90,
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

// Polyfills for APIs missing in Chrome <124, injected into the pdfjs worker at build time
// so the worker can load as a real Web Worker instead of falling back to fake-worker mode.
const workerPolyfills = `
if(typeof Promise.withResolvers==='undefined'){Promise.withResolvers=function(){var resolve,reject;var promise=new Promise(function(res,rej){resolve=res;reject=rej});return{promise:promise,resolve:resolve,reject:reject}}}
if(typeof Promise.try==='undefined'){Promise.try=function(fn){var args=Array.prototype.slice.call(arguments,1);return new Promise(function(resolve){resolve(fn.apply(undefined,args))})}}
if(typeof Map.prototype.getOrInsertComputed==='undefined'){Map.prototype.getOrInsertComputed=function(key,callbackFn){if(this.has(key)){return this.get(key)}var value=callbackFn(key);this.set(key,value);return value}}
if(typeof ReadableStream!=='undefined'&&!ReadableStream.prototype[Symbol.asyncIterator]){ReadableStream.prototype[Symbol.asyncIterator]=async function*(){const reader=this.getReader();try{while(true){const{done,value}=await reader.read();if(done)break;yield value}}finally{reader.releaseLock()}}}
if(typeof Uint8Array.prototype.toHex==='undefined'){Uint8Array.prototype.toHex=function(){var result='';for(var i=0;i<this.length;i++){result+=this[i].toString(16).padStart(2,'0')}return result}}
if(typeof Uint8Array.prototype.toBase64==='undefined'){Uint8Array.prototype.toBase64=function(options){var omitPadding=options&&options.omitPadding===true;var useUrlAlphabet=options&&options.alphabet==='base64url';var binaryStr='';for(var i=0;i<this.length;i++){binaryStr+=String.fromCharCode(this[i])}var result=btoa(binaryStr);if(useUrlAlphabet){result=result.replace(/\\+/g,'-').replace(/\\//g,'_')}if(omitPadding){result=result.replace(/=+$/,'')}return result}}
if(typeof Uint8Array.fromBase64==='undefined'){Uint8Array.fromBase64=function(string,options){var useUrlAlphabet=options&&options.alphabet==='base64url';var s=useUrlAlphabet?string.replace(/-/g,'+').replace(/_/g,'/'):string;while(s.length%4!==0){s+='='}var binaryStr=atob(s);var bytes=new Uint8Array(binaryStr.length);for(var i=0;i<binaryStr.length;i++){bytes[i]=binaryStr.charCodeAt(i)}return bytes}}
`;

function pdfjsWorkerPlugin() {
  const workerPath = resolve(webDir, pdfjsWorkerSrc);
  const workerWithPolyfills = () => workerPolyfills + readFileSync(workerPath, 'utf8');
  return {
    name: 'pdfjs-worker',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== '/pdfjs/pdf.worker.min.mjs') {
          next();
          return;
        }
        response.setHeader('Content-Type', 'application/javascript');
        response.end(workerWithPolyfills());
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'pdfjs/pdf.worker.min.mjs',
        source: workerWithPolyfills(),
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
