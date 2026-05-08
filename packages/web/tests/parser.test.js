import { describe, expect, it } from 'vitest';
import { detectCupColumn, hasHeader } from '../src/parser.js';

describe('detectCupColumn', () => {
  it('selects the first header containing CUP', () => {
    expect(detectCupColumn(['id', 'Codice CUP', 'note'])).toBe(1);
  });

  it('falls back to the first column', () => {
    expect(detectCupColumn(['codice', 'note'])).toBe(0);
  });
});

describe('hasHeader', () => {
  it('detects textual headers', () => {
    expect(hasHeader(['CUP', 'Descrizione'])).toBe(true);
  });

  it('does not treat a CUP-only first row as header', () => {
    expect(hasHeader(['G17H03000130001'])).toBe(false);
  });
});
