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
