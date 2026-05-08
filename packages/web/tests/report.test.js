import { describe, expect, it } from 'vitest';
import { buildCsvReport, resultDetail } from '../src/report.js';
import { uniqueResultsByCup } from '../src/results.js';
import { validateCup } from '../src/validator.js';

describe('resultDetail', () => {
  it('shows non-blocking normalization warnings for valid CUPs', () => {
    const result = validateCup('  g17h03000130001  ', null, { currentYear: 2026 });

    expect(result.outcome).toBe('FORMATO_VALIDO_DA_VERIFICARE');
    expect(resultDetail(result)).toBe(
      'Formato valido; esistenza non verificata. Avvisi non bloccanti: N1 - spazi bianchi rimossi dal CUP; N2 - lettere convertite in maiuscolo',
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
});
