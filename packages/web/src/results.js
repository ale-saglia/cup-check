import { OUTCOMES } from './validator.js';

export function applyDatasetLookup(results, lookupFn) {
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

export function uniqueResultsByCup(results) {
  const grouped = new Map();

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

export function resultRowsLabel(result) {
  const rows = result.inputRows ?? [result.inputRow];
  return rows.length > 1 ? rows.join(', ') : String(rows[0] ?? '');
}

function uniqueValues(values) {
  return [...new Set(values)];
}
