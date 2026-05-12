import { describe, expect, it } from 'vitest';
import { textInputLines } from '../src/text-input.js';

describe('textInputLines', () => {
  it('ignores the first line when it is a CUP header', () => {
    expect(textInputLines('CUP\nA58C15000390001\nB11B15001360001')).toEqual([
      'A58C15000390001',
      'B11B15001360001',
    ]);

    expect(textInputLines('cup\nA58C15000390001\nB11B15001360001')).toEqual([
      'A58C15000390001',
      'B11B15001360001',
    ]);
  });

  it('keeps lines containing cup outside the header position', () => {
    expect(textInputLines('A58C15000390001\ncup\nB11B15001360001')).toEqual([
      'A58C15000390001',
      'cup',
      'B11B15001360001',
    ]);
  });

  it('keeps the first line when it is not exactly CUP', () => {
    expect(textInputLines('Codice CUP\nA58C15000390001')).toEqual(['Codice CUP', 'A58C15000390001']);
  });

  it('returns empty array for empty input', () => {
    expect(textInputLines('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(textInputLines('   ')).toEqual([]);
    expect(textInputLines('   \n\t\n  ')).toEqual([]);
  });

  it('drops blank and whitespace-only lines between valid entries', () => {
    expect(textInputLines('A58C15000390001\n\n   \nB11B15001360001')).toEqual([
      'A58C15000390001',
      'B11B15001360001',
    ]);
  });

  it('trims surrounding whitespace from each line', () => {
    expect(textInputLines('  A58C15000390001  \n  B11B15001360001  ')).toEqual([
      'A58C15000390001',
      'B11B15001360001',
    ]);
  });
});
