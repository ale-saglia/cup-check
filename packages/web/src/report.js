import { RULE_DESCRIPTIONS, WARNING_DESCRIPTIONS } from './validator.js';
import { resultRowsLabel } from './results.js';

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

export function opencupUrlForResult(result) {
  if (!/^[A-Z0-9]{15}$/.test(result.normalizedValue)) {
    return '';
  }

  return opencupUrl(result.normalizedValue);
}

export function buildCsvReport(results) {
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

function csvCell(value) {
  const text = protectCsvFormula(String(value ?? ''));

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function protectCsvFormula(text) {
  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}
