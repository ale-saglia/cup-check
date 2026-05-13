// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { navigate } from '../src/router.js';

describe('router', () => {
  it('navigate imposta location.hash sul percorso richiesto', () => {
    navigate('#/pdf-extract');
    expect(window.location.hash).toBe('#/pdf-extract');
  });
});
