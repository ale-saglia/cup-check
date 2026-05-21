import type { Outcome, Rule, Warning, ValidationResult, ValidationSummary } from '../types.js';

export const OUTCOMES = {
  INVALID: 'INVALIDO_FORMATO' as Outcome,
  CHECK: 'FORMATO_VALIDO_DA_VERIFICARE' as Outcome,
  FOUND_OPENCUP: 'TROVATO_OPENCUP' as Outcome,
  NOT_FOUND_OPENCUP: 'NON_TROVATO_OPENCUP_DA_VERIFICARE' as Outcome,
};

export const RULES = {
  EMPTY: 'R0' as Rule,
  LENGTH: 'R1' as Rule,
  CHARSET: 'R2' as Rule,
  FIRST_POSITION: 'R3' as Rule,
  YEAR: 'R4' as Rule,
  FOURTH_POSITION: 'R5' as Rule,
};

export const RULE_DESCRIPTIONS: Record<Rule, string> = {
  R0: 'riga o cella CUP vuota',
  R1: 'lunghezza diversa da 15 caratteri dopo trim',
  R2: 'caratteri non ammessi dopo normalizzazione: usa solo lettere A-Z e cifre 0-9',
  R3: 'prima posizione non alfabetica',
  R4: 'anno non plausibile nelle posizioni 5-6 del CUP',
  R5: 'quarta posizione non alfabetica',
};

export const WARNINGS = {
  TRIMMED: 'N1' as Warning,
  UPPERCASED: 'N2' as Warning,
  INTERNAL_WHITESPACE: 'N3' as Warning,
};

export const WARNING_DESCRIPTIONS: Record<Warning, string> = {
  N1: 'spazi bianchi rimossi dal CUP',
  N2: 'lettere convertite in maiuscolo',
  N3: 'spazi bianchi interni presenti nel CUP',
};

export function normalizeCup(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

export function validateCup(
  value: unknown,
  row: number | null = null,
  options: { currentYear?: number } = {},
): ValidationResult {
  const rawValue = String(value ?? '');
  const trimmedValue = rawValue.trim();
  const normalizedValue = normalizeCup(rawValue);
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const currentTwoDigitYear = currentYear % 100;
  const failedRules: Rule[] = [];
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

function normalizationWarnings(
  rawValue: string,
  trimmedValue: string,
  normalizedValue: string,
): Warning[] {
  return [
    rawValue !== trimmedValue ? WARNINGS.TRIMMED : null,
    trimmedValue !== normalizedValue ? WARNINGS.UPPERCASED : null,
    /\s/.test(trimmedValue) ? WARNINGS.INTERNAL_WHITESPACE : null,
  ].filter((w): w is Warning => w !== null);
}

export function isStructurallyPlausible(
  value: unknown,
  options: { yearLookahead?: number; currentYear?: number } = {},
): boolean {
  const { yearLookahead = 0, ...rest } = options;
  const baseYear = rest.currentYear ?? new Date().getFullYear();
  return (
    validateCup(value, null, { ...rest, currentYear: baseYear + yearLookahead }).failedRules
      .length === 0
  );
}

export function validateBatch(
  values: unknown[],
  options: { currentYear?: number } = {},
): { results: ValidationResult[]; summary: ValidationSummary } {
  const startedAt = performance.now();
  const results = values.map((value, index) => validateCup(value, index + 1, options));
  const summary = summarizeResults(results, performance.now() - startedAt);
  return { results, summary };
}

export function summarizeResults(
  results: Pick<ValidationResult, 'outcome'>[],
  durationMs = 0,
): ValidationSummary {
  const total = results.length;
  const counts: Record<Outcome, number> = {
    INVALIDO_FORMATO: 0,
    FORMATO_VALIDO_DA_VERIFICARE: 0,
    TROVATO_OPENCUP: 0,
    NON_TROVATO_OPENCUP_DA_VERIFICARE: 0,
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
    ) as Record<Outcome, number>,
  };
}
