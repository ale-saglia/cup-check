import { describe, expect, it } from 'vitest';
import {
  buildCsvReport,
  formatRule,
  opencupUrlForResult,
  resultDetail,
} from '../src/lib/core/report.js';
import { displayResults, uniqueResultsByCup } from '../src/lib/core/results.js';
import { OUTCOMES, validateCup } from '../src/lib/core/validator.js';

describe('resultDetail', () => {
  it('shows non-blocking normalization warnings for valid CUPs', () => {
    const result = validateCup('  g17h03000130001  ', null, { currentYear: 2026 });

    expect(result.outcome).toBe('FORMATO_VALIDO_DA_VERIFICARE');
    expect(resultDetail(result)).toBe(
      'Formato formalmente valido; esistenza non verificata. Avvisi non bloccanti: N1 - spazi bianchi rimossi dal CUP; N2 - lettere convertite in maiuscolo',
    );
  });

  it('exports one row per unique CUP with all original rows', () => {
    const results = uniqueResultsByCup([
      validateCup('A12B23000000001', 2, { currentYear: 2026 }),
      validateCup('A12B23000000001', 7, { currentYear: 2026 }),
    ]);

    const csv = buildCsvReport(results);

    expect(csv).toContain('righe_originali;cup_normalizzato;esito;dettaglio;link_opencup');
    expect(csv).toContain('2, 7;A12B23000000001;FORMATO_VALIDO_DA_VERIFICARE');
  });

  it('exports one row per original row when grouped display is disabled', () => {
    const groupedResults = uniqueResultsByCup([
      validateCup('A12B23000000001', 2, { currentYear: 2026 }),
      validateCup('A12B23000000001', 7, { currentYear: 2026 }),
    ]);

    const csv = buildCsvReport(displayResults(groupedResults, false));

    expect(csv).toContain('\n2;A12B23000000001;FORMATO_VALIDO_DA_VERIFICARE');
    expect(csv).toContain('\n7;A12B23000000001;FORMATO_VALIDO_DA_VERIFICARE');
    expect(csv).not.toContain('2, 7;A12B23000000001');
  });

  it('keeps OpenCUP links for manually checkable invalid CUP-shaped values', () => {
    const result = validateCup('A12B99000000001', 3, { currentYear: 2026 });

    expect(result.outcome).toBe('INVALIDO_FORMATO');
    expect(opencupUrlForResult(result)).toBe(
      'https://opencup.gov.it/portale/progetto/-/cup/A12B99000000001',
    );
  });

  it('omits OpenCUP links for values that are not CUP-shaped', () => {
    const result = validateCup('non un cup', 4, { currentYear: 2026 });
    const csv = buildCsvReport([result]);

    expect(opencupUrlForResult(result)).toBe('');
    expect(csv).toContain('4;NON UN CUP;INVALIDO_FORMATO;');
    expect(csv.trim().endsWith(';')).toBe(true);
  });

  it('describes OpenCUP lookup outcomes cautiously', () => {
    const found = {
      ...validateCup('G17H03000130001', 1, { currentYear: 2026 }),
      outcome: OUTCOMES.FOUND_OPENCUP,
    };
    const notFound = {
      ...validateCup('H11B22001230001', 2, { currentYear: 2026 }),
      outcome: OUTCOMES.NOT_FOUND_OPENCUP,
    };

    expect(resultDetail(found)).toBe('CUP presente nel mirror OpenCUP disponibile.');
    expect(resultDetail(notFound)).toBe(
      'CUP non presente nel mirror OpenCUP disponibile; verificare su fonte autoritativa.',
    );
  });

  it('prefixes formula-like CSV cells with an apostrophe', () => {
    const csv = buildCsvReport([
      {
        inputRow: '=1+1',
        normalizedValue: '+SUM(1,1)',
        outcome: '-FORMULA',
        failedRules: [],
        warnings: ['@WARNING'],
      },
    ]);

    expect(csv).toContain("'=1+1;'+SUM(1,1);'-FORMULA;");
    expect(csv).toContain('Avvisi non bloccanti: @WARNING - avviso non documentato');
  });

  it('formatRule falls back to "regola non documentata" for unknown rule codes', () => {
    expect(formatRule('R99')).toBe('R99 - regola non documentata');
  });

  it('csvCell renders null value as empty string in the CSV', () => {
    const csv = buildCsvReport([
      {
        inputRow: null,
        normalizedValue: 'A12B23000000001',
        outcome: OUTCOMES.CHECK,
        failedRules: [],
        warnings: [],
      },
    ]);

    expect(csv).toContain(';A12B23000000001;');
    expect(csv.split('\n')[1]).toMatch(/^;/);
  });
});
