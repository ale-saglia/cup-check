export const OUTCOMES = {
  INVALID: 'INVALIDO_FORMATO',
  CHECK: 'FORMATO_VALIDO_DA_VERIFICARE',
  FOUND_OPENCUP: 'TROVATO_OPENCUP',
  NOT_FOUND_OPENCUP: 'NON_TROVATO_OPENCUP_DA_VERIFICARE',
};

export const RULES = {
  EMPTY: 'R0',
  LENGTH: 'R1',
  CHARSET: 'R2',
  FIRST_POSITION: 'R3',
  YEAR: 'R4',
  FOURTH_POSITION: 'R5',
};

export const RULE_DESCRIPTIONS = {
  [RULES.EMPTY]: 'riga o cella CUP vuota',
  [RULES.LENGTH]: 'lunghezza diversa da 15 caratteri dopo trim',
  [RULES.CHARSET]: 'caratteri non ammessi dopo normalizzazione: usa solo lettere A-Z e cifre 0-9',
  [RULES.FIRST_POSITION]: 'prima posizione non alfabetica',
  [RULES.YEAR]: 'anno non plausibile nelle posizioni 5-6 del CUP',
  [RULES.FOURTH_POSITION]: 'quarta posizione non alfabetica',
};

export const WARNINGS = {
  TRIMMED: 'N1',
  UPPERCASED: 'N2',
};

export const WARNING_DESCRIPTIONS = {
  [WARNINGS.TRIMMED]: 'spazi bianchi rimossi dal CUP',
  [WARNINGS.UPPERCASED]: 'lettere convertite in maiuscolo',
};

export function normalizeCup(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

export function validateCup(value, row = null, options = {}) {
  const rawValue = String(value ?? '');
  const trimmedValue = rawValue.trim();
  const normalizedValue = normalizeCup(rawValue);
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const currentTwoDigitYear = currentYear % 100;
  const failedRules = [];
  const warnings = normalizationWarnings(rawValue, trimmedValue, normalizedValue);

  if (trimmedValue.length === 0) {
    return {
      inputRow: row,
      rawValue,
      normalizedValue,
      outcome: OUTCOMES.INVALID,
      failedRules: [RULES.EMPTY],
      warnings,
    };
  }

  if (normalizedValue.length !== 15) {
    failedRules.push(RULES.LENGTH);
  }

  if (!/^[A-Z0-9]*$/.test(normalizedValue)) {
    failedRules.push(RULES.CHARSET);
  }

  if (!/^[A-Z]/.test(normalizedValue)) {
    failedRules.push(RULES.FIRST_POSITION);
  }

  const yearToken = normalizedValue.slice(4, 6);
  const year = Number.parseInt(yearToken, 10);
  // Il formato CUP espone l'anno con due sole cifre: R4 lo confronta quindi
  // con le due cifre finali dell'anno corrente, preservando questo limite intrinseco.
  if (!/^\d{2}$/.test(yearToken) || year > currentTwoDigitYear) {
    failedRules.push(RULES.YEAR);
  }

  if (!/^[A-Z]$/.test(normalizedValue.charAt(3))) {
    failedRules.push(RULES.FOURTH_POSITION);
  }

  return {
    inputRow: row,
    rawValue,
    normalizedValue,
    outcome: failedRules.length === 0 ? OUTCOMES.CHECK : OUTCOMES.INVALID,
    failedRules,
    warnings,
  };
}

function normalizationWarnings(rawValue, trimmedValue, normalizedValue) {
  return [
    rawValue !== trimmedValue ? WARNINGS.TRIMMED : null,
    trimmedValue !== normalizedValue ? WARNINGS.UPPERCASED : null,
  ].filter(Boolean);
}

export function validateBatch(values, options = {}) {
  const startedAt = performance.now();
  const results = values.map((value, index) => validateCup(value, index + 1, options));
  const summary = summarizeResults(results, performance.now() - startedAt);

  return { results, summary };
}

export function summarizeResults(results, durationMs = 0) {
  const total = results.length;
  const counts = {
    [OUTCOMES.INVALID]: 0,
    [OUTCOMES.CHECK]: 0,
    [OUTCOMES.FOUND_OPENCUP]: 0,
    [OUTCOMES.NOT_FOUND_OPENCUP]: 0,
  };
  for (const result of results) {
    if (result.outcome in counts) counts[result.outcome] += 1;
  }
  return {
    total,
    durationMs,
    counts,
    percentages: Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, total === 0 ? 0 : v / total]),
    ),
  };
}
