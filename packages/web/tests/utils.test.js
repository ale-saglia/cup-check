import { describe, expect, it } from 'vitest';
import { incrementMapValue } from '../src/lib/utils.js';

describe('incrementMapValue', () => {
  it('inizializza e incrementa un contatore in una Map', () => {
    const counts = new Map();

    incrementMapValue(counts, 'CUP');
    incrementMapValue(counts, 'CUP');
    incrementMapValue(counts, 'ALTRO', 3);

    expect([...counts.entries()]).toEqual([
      ['CUP', 2],
      ['ALTRO', 3],
    ]);
  });
});
