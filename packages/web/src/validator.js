export const OUTCOMES = {
  INVALID: 'INVALIDO_FORMATO',
  CHECK: 'FORMATO_VALIDO_DA_VERIFICARE',
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
  [RULES.CHARSET]: 'caratteri non ammessi: usa solo lettere maiuscole A-Z e cifre 0-9',
  [RULES.FIRST_POSITION]: 'prima posizione non alfabetica',
  [RULES.YEAR]: 'anno non plausibile nelle posizioni 5-6 del CUP',
  [RULES.FOURTH_POSITION]: 'quarta posizione non alfabetica',
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

  if (trimmedValue.length === 0) {
    return {
      inputRow: row,
      rawValue,
      normalizedValue,
      outcome: OUTCOMES.INVALID,
      failedRules: [RULES.EMPTY],
    };
  }

  if (trimmedValue.length !== 15) {
    failedRules.push(RULES.LENGTH);
  }

  if (!/^[A-Z0-9]*$/.test(trimmedValue)) {
    failedRules.push(RULES.CHARSET);
  }

  if (!/^[A-Z]/.test(trimmedValue)) {
    failedRules.push(RULES.FIRST_POSITION);
  }

  const yearToken = trimmedValue.slice(4, 6);
  const year = Number.parseInt(yearToken, 10);
  if (!/^\d{2}$/.test(yearToken) || year > currentTwoDigitYear) {
    failedRules.push(RULES.YEAR);
  }

  if (!/^[A-Z]$/.test(trimmedValue.charAt(3))) {
    failedRules.push(RULES.FOURTH_POSITION);
  }

  return {
    inputRow: row,
    rawValue,
    normalizedValue,
    outcome: failedRules.length === 0 ? OUTCOMES.CHECK : OUTCOMES.INVALID,
    failedRules,
  };
}

export function validateBatch(values, options = {}) {
  const startedAt = performance.now();
  const results = values.map((value, index) => validateCup(value, index + 1, options));
  const summary = summarizeResults(results, performance.now() - startedAt);

  return { results, summary };
}

export function summarizeResults(results, durationMs = 0) {
  const total = results.length;
  const invalid = results.filter((result) => result.outcome === OUTCOMES.INVALID).length;
  const toCheck = total - invalid;

  return {
    total,
    durationMs,
    counts: {
      [OUTCOMES.INVALID]: invalid,
      [OUTCOMES.CHECK]: toCheck,
    },
    percentages: {
      [OUTCOMES.INVALID]: total === 0 ? 0 : invalid / total,
      [OUTCOMES.CHECK]: total === 0 ? 0 : toCheck / total,
    },
  };
}
