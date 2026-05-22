// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  applyDatasetLookup,
  displayResults,
  resultRowsLabel,
  uniqueResultsByCup,
} from '../src/lib/core/results.js';
import { OUTCOMES, validateCup } from '../src/lib/core/validator.js';

function makeResult(overrides = {}) {
  return {
    inputRow: 1,
    rawValue: 'A12B23000000001',
    normalizedValue: 'A12B23000000001',
    outcome: OUTCOMES.CHECK,
    failedRules: [],
    warnings: [],
    ...overrides,
  };
}

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

  it('merges duplicate CUPs when warnings is undefined on the existing entry', () => {
    const first = makeResult({ normalizedValue: 'A12B23000000001', warnings: undefined });
    const second = makeResult({
      normalizedValue: 'A12B23000000001',
      inputRow: 2,
      warnings: ['N1'],
    });

    const uniqueResults = uniqueResultsByCup([first, second]);

    expect(uniqueResults).toHaveLength(1);
    expect(uniqueResults[0].warnings).toEqual(['N1']);
  });

  it('merges duplicate CUPs when warnings is undefined on the incoming result', () => {
    const first = makeResult({ normalizedValue: 'A12B23000000001', warnings: ['N1'] });
    const second = makeResult({
      normalizedValue: 'A12B23000000001',
      inputRow: 2,
      warnings: undefined,
    });

    const uniqueResults = uniqueResultsByCup([first, second]);

    expect(uniqueResults).toHaveLength(1);
    expect(uniqueResults[0].warnings).toEqual(['N1']);
  });

  it('deduplica le righe durante l’accumulo mantenendo il conteggio occorrenze', () => {
    const first = makeResult({ normalizedValue: 'A12B23000000001', inputRow: 2 });
    const second = makeResult({ normalizedValue: 'A12B23000000001', inputRow: 2 });

    const uniqueResults = uniqueResultsByCup([first, second]);

    expect(uniqueResults).toHaveLength(1);
    expect(uniqueResults[0].inputRows).toEqual([2]);
    expect(uniqueResults[0].occurrenceCount).toBe(2);
  });
});

describe('displayResults', () => {
  it('keeps grouped results unchanged when grouping is enabled', () => {
    const results = uniqueResultsByCup([
      validateCup('A12B23000000001', 2, { currentYear: 2026 }),
      validateCup('A12B23000000001', 7, { currentYear: 2026 }),
    ]);

    expect(displayResults(results, true)).toBe(results);
  });

  it('expands grouped results into original row order when grouping is disabled', () => {
    const results = uniqueResultsByCup([
      validateCup('a12b23000000001', 4, { currentYear: 2026 }),
      validateCup('Z99C00000000002', 5, { currentYear: 2026 }),
      validateCup(' A12B23000000001 ', 9, { currentYear: 2026 }),
    ]);

    const expanded = displayResults(results, false);

    expect(expanded.map((result) => result.normalizedValue)).toEqual([
      'A12B23000000001',
      'Z99C00000000002',
      'A12B23000000001',
    ]);
    expect(expanded.map((result) => resultRowsLabel(result))).toEqual(['4', '5', '9']);
    expect(expanded.map((result) => result.occurrenceCount)).toEqual([1, 1, 1]);
    expect(expanded[0].outcome).toBe(results[0].outcome);
    expect(expanded[2].failedRules).toEqual(results[0].failedRules);
  });

  it('sorts expanded rows with missing and textual row labels', () => {
    const results = [
      { ...validateCup('A12B23000000001', null, { currentYear: 2026 }), inputRows: [null, '10'] },
      { ...validateCup('B12B23000000002', '2', { currentYear: 2026 }), inputRows: ['2'] },
    ];

    expect(displayResults(results, false).map((result) => result.inputRow)).toEqual([
      '2',
      '10',
      null,
    ]);
  });

  it('expands a result that has only inputRow (no inputRows array)', () => {
    const result = makeResult({ inputRow: 5, inputRows: undefined });

    const expanded = displayResults([result], false);

    expect(expanded).toHaveLength(1);
    expect(expanded[0].inputRow).toBe(5);
  });

  it('sorts two null rows as equal (compareRows both null)', () => {
    const results = [
      makeResult({ normalizedValue: 'A12B23000000001', inputRows: [null] }),
      makeResult({ normalizedValue: 'B12B23000000002', inputRows: [null] }),
    ];

    const expanded = displayResults(results, false);

    expect(expanded).toHaveLength(2);
    expect(expanded.every((r) => r.inputRow === null)).toBe(true);
  });

  it('places a null left row after a non-null right row (compareRows left null)', () => {
    const results = [
      makeResult({ normalizedValue: 'A12B23000000001', inputRows: [null] }),
      makeResult({ normalizedValue: 'B12B23000000002', inputRows: ['1'] }),
    ];

    const expanded = displayResults(results, false);

    expect(expanded[0].inputRow).toBe('1');
    expect(expanded[1].inputRow).toBe(null);
  });

  it('places a non-null left row before a null right row (compareRows right null)', () => {
    const results = [
      makeResult({ normalizedValue: 'A12B23000000001', inputRows: ['1'] }),
      makeResult({ normalizedValue: 'B12B23000000002', inputRows: [null] }),
    ];

    const expanded = displayResults(results, false);

    expect(expanded[0].inputRow).toBe('1');
    expect(expanded[1].inputRow).toBe(null);
  });
});

describe('resultRowsLabel', () => {
  it('returns the string of a single numeric inputRow via inputRow field', () => {
    const result = makeResult({ inputRow: 3, inputRows: undefined });

    expect(resultRowsLabel(result)).toBe('3');
  });

  it('returns empty string when inputRow is null and no inputRows array', () => {
    const result = makeResult({ inputRow: null, inputRows: undefined });

    expect(resultRowsLabel(result)).toBe('');
  });
});
