import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import type { Outcome, Rule, ValidationResult, Warning } from '../src/lib/types.js';
import {
  OUTCOMES,
  isStructurallyPlausible,
  normalizeCup,
  summarizeResults,
  validateBatch,
  validateCup,
} from '../src/lib/core/validator.js';

const fixtureDir = path.resolve(import.meta.dirname, '../../../tests/fixtures');
const fixtureFiles = ['valid-cases.yaml', 'invalid-cases.yaml', 'edge-cases.yaml'];

interface FixtureCase {
  id: string;
  input: unknown;
  options?: {
    current_year?: number;
  };
  expected: {
    outcome: Outcome;
    failed_rules: Rule[];
    warnings?: Warning[];
  };
}

const cases = fixtureFiles.flatMap((fileName) => {
  const filePath = path.join(fixtureDir, fileName);
  return (yaml.load(fs.readFileSync(filePath, 'utf8')) as FixtureCase[]).map((testCase) => ({
    ...testCase,
    fileName,
  }));
});

describe('normalizeCup', () => {
  it('returns empty string for null input', () => {
    expect(normalizeCup(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(normalizeCup(undefined)).toBe('');
  });
});

describe('isStructurallyPlausible', () => {
  it('returns true for a structurally valid CUP', () => {
    expect(isStructurallyPlausible('G17H03000130001', { currentYear: 2026 })).toBe(true);
  });

  it('returns false for a CUP with invalid charset', () => {
    expect(isStructurallyPlausible('G17H0300013000!', { currentYear: 2026 })).toBe(false);
  });

  it('returns false for a year-in-the-future CUP without yearLookahead', () => {
    // Year token "35" > currentTwoDigitYear "26"
    expect(isStructurallyPlausible('G17H35000130001', { currentYear: 2026 })).toBe(false);
  });

  it('returns true for a near-future CUP within yearLookahead window', () => {
    // Year "35" <= 2026+15=2041 → within the +15 window
    expect(
      isStructurallyPlausible('G17H35000130001', { currentYear: 2026, yearLookahead: 15 }),
    ).toBe(true);
  });

  it('returns false for an implausibly far-future CUP even with yearLookahead', () => {
    // Year "99" > 2026+15=2041 → still rejected
    expect(
      isStructurallyPlausible('G17H99000130001', { currentYear: 2026, yearLookahead: 15 }),
    ).toBe(false);
  });

  it('falls back to the current calendar year when currentYear is not provided', () => {
    const currentTwoDigit = new Date().getFullYear() % 100;
    const paddedYear = String(currentTwoDigit).padStart(2, '0');
    const cup = `G17H${paddedYear}000130001`;
    expect(isStructurallyPlausible(cup)).toBe(true);
  });
});

describe('validateCup', () => {
  it.each(cases)('$fileName / $id', (testCase) => {
    const currentYear = testCase.options?.current_year ?? 2026;
    const result = validateCup(testCase.input, null, { currentYear });

    expect(result.outcome).toBe(testCase.expected.outcome);
    expect(result.failedRules).toEqual(testCase.expected.failed_rules);
    expect(result.warnings).toEqual(testCase.expected.warnings ?? []);
  });

  it('uses R0 for a missing CUP value', () => {
    const result = validateCup('   ', 7, { currentYear: 2026 });

    expect(result.inputRow).toBe(7);
    expect(result.outcome).toBe('INVALIDO_FORMATO');
    expect(result.failedRules).toEqual(['R0']);
  });

  it('treats null value as empty and returns R0', () => {
    const result = validateCup(null, 1, { currentYear: 2026 });

    expect(result.outcome).toBe('INVALIDO_FORMATO');
    expect(result.failedRules).toEqual(['R0']);
  });

  it('treats undefined value as empty and returns R0', () => {
    const result = validateCup(undefined, 1, { currentYear: 2026 });

    expect(result.outcome).toBe('INVALIDO_FORMATO');
    expect(result.failedRules).toEqual(['R0']);
  });

  it('falls back to current year when options.currentYear is not provided', () => {
    const currentYear = new Date().getFullYear();
    const currentTwoDigit = currentYear % 100;
    const paddedYear = String(currentTwoDigit).padStart(2, '0');
    const result = validateCup(`G17H${paddedYear}000130001`, 1);

    expect(result.outcome).toBe('FORMATO_VALIDO_DA_VERIFICARE');
    expect(result.failedRules).toEqual([]);
  });

  it('validates batches and summarizes known outcomes', () => {
    const { results, summary } = validateBatch(['G17H03000130001', 'errato'], {
      currentYear: 2026,
    });

    expect(results.map((result) => result.inputRow)).toEqual([1, 2]);
    expect(summary.total).toBe(2);
    expect(summary.counts[OUTCOMES.CHECK]).toBe(1);
    expect(summary.counts[OUTCOMES.INVALID]).toBe(1);
    expect(summary.percentages[OUTCOMES.CHECK]).toBe(0.5);
  });
});

describe('summarizeResults', () => {
  it('ignores results with unknown outcome values', () => {
    const results = [{ outcome: OUTCOMES.CHECK }, { outcome: 'UNKNOWN_OUTCOME' }] as Pick<
      ValidationResult,
      'outcome'
    >[];

    const summary = summarizeResults(results);

    expect(summary.total).toBe(2);
    expect(summary.counts[OUTCOMES.CHECK]).toBe(1);
    expect(summary.counts[OUTCOMES.INVALID]).toBe(0);
  });

  it('returns zero percentages when there are no results', () => {
    const summary = summarizeResults([]);

    expect(summary.total).toBe(0);
    expect(summary.percentages[OUTCOMES.CHECK]).toBe(0);
  });
});
