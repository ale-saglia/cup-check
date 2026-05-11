import { describe, expect, it } from 'vitest';
import { buildCsvReport, opencupUrlForResult, resultDetail } from '../src/report.js';
import { uniqueResultsByCup } from '../src/results.js';
import { validateCup } from '../src/validator.js';

describe('resultDetail', () => {
  it('shows non-blocking normalization warnings for valid CUPs', () => {
    const result = validateCup('  g17h03000130001  ', null, { currentYear: 2026 });

    expect(result.outcome).toBe('FORMATO_VALIDO_DA_VERIFICARE');
    expect(resultDetail(result)).toBe(
      'FORMATO_VALIDO_DA_VERIFICARE: formato formalmente valido; esistenza non verificata. Avvisi non bloccanti: N1 - spazi bianchi rimossi dal CUP; N2 - lettere convertite in maiuscolo',
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

  it('prefixes formula-like CSV cells with a tab', () => {
    const csv = buildCsvReport([
      {
        inputRow: '=1+1',
        normalizedValue: '+SUM(1,1)',
        outcome: '-FORMULA',
        failedRules: [],
        warnings: ['@WARNING'],
      },
    ]);

    expect(csv).toContain('\t=1+1;\t+SUM(1,1);\t-FORMULA;');
    expect(csv).toContain('Avvisi non bloccanti: @WARNING - avviso non documentato');
  });
});
