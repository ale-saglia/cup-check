import { describe, expect, it } from 'vitest';
import { resultRowsLabel, uniqueResultsByCup } from '../src/results.js';
import { validateCup } from '../src/validator.js';

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
