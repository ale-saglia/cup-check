import { describe, expect, it } from 'vitest';
import {
  buildCsvReport,
  formatRule,
  opencupUrlForResult,
  resultDetail,
} from '../src/lib/core/report.js';
import { displayResults, uniqueResultsByCup } from '../src/lib/core/results.js';
import { OUTCOMES, validateCup } from '../src/lib/core/validator.js';

/** @param {Partial<import('../src/lib/core/import-plan.js').ImportedCupRow>[]} overrides */
function makeImportedRow(overrides) {
  return {
    value: 'A12B23000000001',
    row: 1,
    fileOrigine: 'file.csv',
    colonnaOrigine: 'CUP',
    sourceRowNumber: 1,
    ...overrides,
  };
}

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
});

describe('buildCsvReport — colonne origine', () => {
  it('aggiunge le 4 colonne origine quando importedRows è fornito', () => {
    const result = validateCup('A12B23000000001', 1, { currentYear: 2026 });
    const importedRows = [
      makeImportedRow({
        row: 1,
        fileOrigine: 'dati.csv',
        colonnaOrigine: 'CUP',
        sourceRowNumber: 5,
      }),
    ];

    const csv = buildCsvReport([result], importedRows);
    const header = csv.split('\n')[0];
    const dataRow = csv.split('\n')[1];

    expect(header).toContain('file_origine;scheda_origine;riga_origine;colonna_origine');
    expect(dataRow).toContain('dati.csv;;5;CUP');
  });

  it('include la scheda quando presente', () => {
    const result = validateCup('A12B23000000001', 1, { currentYear: 2026 });
    const importedRows = [
      makeImportedRow({
        row: 1,
        fileOrigine: 'dati.xlsx',
        schedaOrigine: 'Foglio1',
        colonnaOrigine: 'Codice',
        sourceRowNumber: 3,
      }),
    ];

    const csv = buildCsvReport([result], importedRows);
    expect(csv.split('\n')[1]).toContain('dati.xlsx;Foglio1;3;Codice');
  });

  it('non aggiunge le colonne origine quando importedRows è vuoto', () => {
    const result = validateCup('A12B23000000001', 1, { currentYear: 2026 });

    const csv = buildCsvReport([result], []);
    expect(csv).not.toContain('file_origine');
  });

  it('in modalità raggruppata, un CUP con 2 occorrenze da file diversi aggrega i valori', () => {
    const results = uniqueResultsByCup([
      validateCup('A12B23000000001', 1, { currentYear: 2026 }),
      validateCup('A12B23000000001', 2, { currentYear: 2026 }),
    ]);
    const importedRows = [
      makeImportedRow({ row: 1, fileOrigine: 'a.csv', colonnaOrigine: 'CUP', sourceRowNumber: 10 }),
      makeImportedRow({ row: 2, fileOrigine: 'b.csv', colonnaOrigine: 'CUP', sourceRowNumber: 7 }),
    ];

    const csv = buildCsvReport(results, importedRows);
    const dataRow = csv.split('\n')[1];

    expect(dataRow).toContain('a.csv, b.csv');
    expect(dataRow).toContain('10, 7');
  });

  it('in modalità non raggruppata, ogni riga ha la propria origine', () => {
    const grouped = uniqueResultsByCup([
      validateCup('A12B23000000001', 1, { currentYear: 2026 }),
      validateCup('A12B23000000001', 2, { currentYear: 2026 }),
    ]);
    const importedRows = [
      makeImportedRow({ row: 1, fileOrigine: 'a.csv', colonnaOrigine: 'CUP', sourceRowNumber: 10 }),
      makeImportedRow({ row: 2, fileOrigine: 'b.csv', colonnaOrigine: 'CUP', sourceRowNumber: 7 }),
    ];

    const csv = buildCsvReport(displayResults(grouped, false), importedRows);
    const rows = csv.split('\n').slice(1);

    expect(rows[0]).toContain('a.csv;;10;CUP');
    expect(rows[1]).toContain('b.csv;;7;CUP');
  });

  it('lascia le colonne origine vuote se il batch row non è in importedRows', () => {
    const result = validateCup('A12B23000000001', 99, { currentYear: 2026 });
    const importedRows = [makeImportedRow({ row: 1 })];

    const csv = buildCsvReport([result], importedRows);
    const dataRow = csv.split('\n')[1];
    // file_origine, scheda_origine, riga_origine, colonna_origine tutti vuoti
    expect(dataRow).toMatch(/;;;;$/);
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
