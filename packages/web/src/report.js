import { RULE_DESCRIPTIONS, WARNING_DESCRIPTIONS } from './validator.js';

export const PRODUCT_VERSION = '0.1.0';

export function resultDetail(result) {
  const warnings = result.warnings?.length
    ? ` Avvisi non bloccanti: ${result.warnings.map(formatWarning).join('; ')}`
    : '';

  if (result.failedRules.length > 0) {
    return `Regole fallite: ${result.failedRules.map(formatRule).join('; ')}.${warnings}`;
  }

  return `Formato valido; esistenza non verificata.${warnings}`;
}

export function formatRule(rule) {
  return `${rule} - ${RULE_DESCRIPTIONS[rule] ?? 'regola non documentata'}`;
}

export function formatWarning(warning) {
  return `${warning} - ${WARNING_DESCRIPTIONS[warning] ?? 'avviso non documentato'}`;
}

export function opencupUrl(cup) {
  return `https://opencup.gov.it/portale/progetto/-/cup/${encodeURIComponent(cup)}`;
}

export function buildCsvReport(results) {
  const headers = ['riga_originale', 'cup_normalizzato', 'esito', 'dettaglio', 'link_opencup'];
  const lines = [
    headers.join(';'),
    ...results.map((result) =>
      [
        result.inputRow,
        result.normalizedValue,
        result.outcome,
        resultDetail(result),
        opencupUrl(result.normalizedValue),
      ]
        .map(csvCell)
        .join(';'),
    ),
  ];

  return `\ufeff${lines.join('\n')}`;
}

function csvCell(value) {
  const text = String(value ?? '');

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
