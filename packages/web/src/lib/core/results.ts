import type { ValidationResult, UniqueResult } from '../types.js';
import { OUTCOMES } from './validator.js';

export function applyDatasetLookup(
  results: UniqueResult[],
  lookupFn: (cup: string) => boolean,
): UniqueResult[] {
  return results.map((result) => {
    if (result.outcome !== OUTCOMES.CHECK) return result;
    return {
      ...result,
      outcome: lookupFn(result.normalizedValue)
        ? OUTCOMES.FOUND_OPENCUP
        : OUTCOMES.NOT_FOUND_OPENCUP,
    };
  });
}

export function uniqueResultsByCup(results: ValidationResult[]): UniqueResult[] {
  const grouped = new Map<string, UniqueResult>();

  results.forEach((result) => {
    const existing = grouped.get(result.normalizedValue);

    if (!existing) {
      grouped.set(result.normalizedValue, {
        ...result,
        inputRows: [result.inputRow],
        occurrenceCount: 1,
      });
      return;
    }

    existing.inputRows.push(result.inputRow);
    existing.occurrenceCount += 1;
    // A normalized CUP is validated deterministically, so duplicates should produce the same failedRules; keep the merge defensive for future fields.
    existing.failedRules = uniqueValues([...existing.failedRules, ...result.failedRules]);
    existing.warnings = uniqueValues([...(existing.warnings ?? []), ...(result.warnings ?? [])]);
  });

  return [...grouped.values()];
}

export function displayResults(results: UniqueResult[], groupSameCups = true): UniqueResult[] {
  if (groupSameCups) return results;

  return results
    .flatMap((result) => {
      const rows = result.inputRows ?? [result.inputRow];
      return rows.map((row) => ({
        ...result,
        inputRow: row,
        inputRows: [row],
        occurrenceCount: 1,
      }));
    })
    .sort((left, right) => compareRows(left.inputRow, right.inputRow));
}

export function resultRowsLabel(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): string {
  const rows = result.inputRows ?? [result.inputRow];
  return rows.length > 1 ? rows.join(', ') : String(rows[0] ?? '');
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function compareRows(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  return String(left).localeCompare(String(right), 'it', { numeric: true });
}
