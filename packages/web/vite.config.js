import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, '../..');
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
  } catch {
    // Local archives or CI checkouts without tags fall back to package metadata.
  }

  const packageJson = JSON.parse(readFileSync(resolve(webDir, 'package.json'), 'utf8'));
  return packageJson.version;
}

function serviceWorkerPlugin(version) {
  const source = () => readFileSync(resolve(webDir, 'src/sw.js'), 'utf8').replaceAll('__APP_VERSION__', version);

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
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: source(),
      });
    },
  };
}
