import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function findChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/local/bin/google-chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const cacheDir = join(process.env.HOME ?? '/home/vscode', '.cache', 'ms-playwright');
  try {
    const entries = await readdir(cacheDir);
    const chromiumDirs = entries.filter((entry) => entry.startsWith('chromium-')).sort().reverse();
    for (const entry of chromiumDirs) {
      const candidate = join(cacheDir, entry, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Playwright browser cache not present.
  }

  return null;
}
