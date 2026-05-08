import { describe, expect, it } from 'vitest';
import { resultDetail } from '../src/report.js';
import { validateCup } from '../src/validator.js';

describe('resultDetail', () => {
  it('shows non-blocking normalization warnings for valid CUPs', () => {
    const result = validateCup('  g17h03000130001  ', null, { currentYear: 2026 });

    expect(result.outcome).toBe('FORMATO_VALIDO_DA_VERIFICARE');
    expect(resultDetail(result)).toBe(
      'Formato valido; esistenza non verificata. Avvisi non bloccanti: N1 - spazi bianchi rimossi dal CUP; N2 - lettere convertite in maiuscolo',
    );
  });
});
