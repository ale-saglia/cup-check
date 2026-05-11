import { describe, expect, it } from 'vitest';
import { applyDatasetLookup, resultRowsLabel, uniqueResultsByCup } from '../src/results.js';
import { OUTCOMES, validateCup } from '../src/validator.js';

describe('applyDatasetLookup', () => {
  it('turns CHECK into OpenCUP outcomes', () => {
    const results = uniqueResultsByCup([
      validateCup('G17H03000130001', 1, { currentYear: 2026 }),
      validateCup('H11B22001230001', 2, { currentYear: 2026 }),
      validateCup('TOOSHORT', 3, { currentYear: 2026 }),
    ]);

    const updated = applyDatasetLookup(results, (cup) => cup === 'G17H03000130001');

    expect(updated.map((result) => result.outcome)).toEqual([
      OUTCOMES.FOUND_OPENCUP,
      OUTCOMES.NOT_FOUND_OPENCUP,
      OUTCOMES.INVALID,
    ]);
  });
});

describe('uniqueResultsByCup', () => {
  it('keeps CUPs ordered by first occurrence and aggregates duplicate rows', () => {
    const results = [
      validateCup('a12b23000000001', 4, { currentYear: 2026 }),
      validateCup('Z99C00000000002', 5, { currentYear: 2026 }),
      validateCup(' A12B23000000001 ', 9, { currentYear: 2026 }),
    ];

    const uniqueResults = uniqueResultsByCup(results);

    expect(uniqueResults.map((result) => result.normalizedValue)).toEqual([
      'A12B23000000001',
      'Z99C00000000002',
    ]);
    expect(uniqueResults[0].inputRows).toEqual([4, 9]);
    expect(uniqueResults[0].occurrenceCount).toBe(2);
    expect(uniqueResults[0].warnings).toEqual(['N2', 'N1']);
    expect(resultRowsLabel(uniqueResults[0])).toBe('4, 9');
  });
});
