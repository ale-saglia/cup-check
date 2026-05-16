import type { Rule, Warning, UniqueResult } from '../types.js';
import { OUTCOMES, RULE_DESCRIPTIONS, WARNING_DESCRIPTIONS } from './validator.js';
import { resultRowsLabel } from './results.js';

export function resultDetail(result: Pick<UniqueResult, 'warnings' | 'failedRules' | 'outcome'>): string {
  const warnings = result.warnings?.length
    ? ` Avvisi non bloccanti: ${result.warnings.map(formatWarning).join('; ')}`
    : '';

  if (result.failedRules.length > 0) {
    return `Regole fallite: ${result.failedRules.map(formatRule).join('; ')}.${warnings}`;
  }

  if (result.outcome === OUTCOMES.FOUND_OPENCUP) {
    return `TROVATO_OPENCUP: CUP presente nel mirror OpenCUP disponibile.${warnings}`;
  }

  if (result.outcome === OUTCOMES.NOT_FOUND_OPENCUP) {
    return `NON_TROVATO_OPENCUP_DA_VERIFICARE: CUP non presente nel mirror OpenCUP disponibile; verificare su fonte autoritativa.${warnings}`;
  }

  return `FORMATO_VALIDO_DA_VERIFICARE: formato formalmente valido; esistenza non verificata.${warnings}`;
}

export function formatRule(rule: Rule): string {
  return `${rule} - ${RULE_DESCRIPTIONS[rule] ?? 'regola non documentata'}`;
}

export function formatWarning(warning: Warning): string {
  return `${warning} - ${WARNING_DESCRIPTIONS[warning] ?? 'avviso non documentato'}`;
}

export function opencupUrl(cup: string): string {
  return `https://opencup.gov.it/portale/progetto/-/cup/${encodeURIComponent(cup)}`;
}

export function opencupUrlForResult(result: Pick<UniqueResult, 'normalizedValue'>): string {
  if (!/^[A-Z0-9]{15}$/.test(result.normalizedValue)) {
    return '';
  }

  return opencupUrl(result.normalizedValue);
}

export function buildCsvReport(results: UniqueResult[]): string {
  const headers = ['righe_originali', 'cup_normalizzato', 'esito', 'dettaglio', 'link_opencup'];
  const lines = [
    headers.join(';'),
    ...results.map((result) =>
      [
        resultRowsLabel(result),
        result.normalizedValue,
        result.outcome,
        resultDetail(result),
        opencupUrlForResult(result),
      ]
        .map(csvCell)
        .join(';'),
    ),
  ];

  return `\ufeff${lines.join('\n')}`;
}

function csvCell(value: unknown): string {
  const text = protectCsvFormula(String(value ?? ''));

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function protectCsvFormula(text: string): string {
  if (/^[=+\-@]/.test(text)) {
    // A leading apostrophe prevents formula execution in Excel/Sheets and is ignored as a text prefix;
    // unlike a tab, it does not risk being treated as a field separator by TSV-aware parsers.
    return `'${text}`;
  }

  return text;
}
