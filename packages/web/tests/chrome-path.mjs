import { existsSync } from 'node:fs';

// Returns a custom Chrome path when CHROME_PATH is set, otherwise null so
// that Playwright uses its own bundled browser (installed via `npx playwright install chromium`).
export function findChromePath() {
  const custom = process.env.CHROME_PATH;
  return custom && existsSync(custom) ? custom : null;
}
