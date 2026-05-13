import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { OUTCOMES, validateBatch, validateCup } from '../src/validator.js';

const fixtureDir = path.resolve(import.meta.dirname, '../../../tests/fixtures');
const fixtureFiles = ['valid-cases.yaml', 'invalid-cases.yaml', 'edge-cases.yaml'];

const cases = fixtureFiles.flatMap((fileName) => {
  const filePath = path.join(fixtureDir, fileName);
  return yaml.load(fs.readFileSync(filePath, 'utf8')).map((testCase) => ({
    ...testCase,
    fileName,
  }));
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
