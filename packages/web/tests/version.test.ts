import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('version', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uses VITE_APP_VERSION when defined', async () => {
    vi.stubEnv('VITE_APP_VERSION', '1.2.3');
    const { PRODUCT_VERSION } = await import('../src/version.js');
    expect(PRODUCT_VERSION).toBe('1.2.3');
  });

  it('falls back to 0.0.0-dev when VITE_APP_VERSION is undefined', async () => {
    vi.stubEnv('VITE_APP_VERSION', undefined);
    const { PRODUCT_VERSION } = await import('../src/version.js');
    expect(PRODUCT_VERSION).toBe('0.0.0-dev');
  });
});
