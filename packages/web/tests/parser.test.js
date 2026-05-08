import { describe, expect, it } from 'vitest';
import { buildParsedRows, detectCupColumn, hasHeader, parseFile } from '../src/parser.js';

describe('detectCupColumn', () => {
  it('selects the first header containing CUP', () => {
    expect(detectCupColumn(['id', 'Codice CUP', 'note'])).toBe(1);
  });

  it('falls back to the first column', () => {
    expect(detectCupColumn(['codice', 'note'])).toBe(0);
  });
});

describe('hasHeader', () => {
  it('detects textual headers', () => {
    expect(hasHeader(['CUP', 'Descrizione'])).toBe(true);
  });

  it('does not treat a CUP-only first row as header', () => {
    expect(hasHeader(['G17H03000130001'])).toBe(false);
  });
});

describe('buildParsedRows', () => {
  it('builds rows from CSV data with header', () => {
    const parsed = buildParsedRows(
      [
        ['id', 'CUP', 'note'],
        ['1', 'G17H03000130001', 'ok'],
      ],
      true,
    );

    expect(parsed.headers).toEqual(['id', 'CUP', 'note']);
    expect(parsed.rows).toEqual([
      { originalRowNumber: 2, cells: ['1', 'G17H03000130001', 'ok'] },
    ]);
    expect(parsed.suggestedColumnIndex).toBe(1);
  });

  it('builds rows from CSV data without header', () => {
    const parsed = buildParsedRows(
      [
        ['G17H03000130001', 'ok'],
        ['A58C15000390001', 'ok'],
      ],
      false,
    );

    expect(parsed.headers).toEqual(['Colonna 1', 'Colonna 2']);
    expect(parsed.rows.map((row) => row.originalRowNumber)).toEqual([1, 2]);
  });

  it('lets users override an invalid first row detected as header', () => {
    const rawRows = [
      ['NON_E_UN_CUP', 'nota'],
      ['G17H03000130001', 'ok'],
    ];

    const detected = buildParsedRows(rawRows, true);
    const overridden = buildParsedRows(rawRows, false);

    expect(detected.headerDetectedAutomatically).toBe(true);
    expect(detected.rows[0].originalRowNumber).toBe(2);
    expect(overridden.headers).toEqual(['Colonna 1', 'Colonna 2']);
    expect(overridden.rows[0]).toEqual({ originalRowNumber: 1, cells: ['NON_E_UN_CUP', 'nota'] });
  });
});

describe('parseFile', () => {
  it('parses CSV with header', async () => {
    const file = new File(['CUP,note\nG17H03000130001,ok'], 'cups.csv', { type: 'text/csv' });

    const parsed = await parseFile(file);

    expect(parsed.headerPresent).toBe(true);
    expect(parsed.headers).toEqual(['CUP', 'note']);
    expect(parsed.rows).toEqual([{ originalRowNumber: 2, cells: ['G17H03000130001', 'ok'] }]);
  });

  it('parses CSV without header', async () => {
    const file = new File(['G17H03000130001\nA58C15000390001'], 'cups.csv', {
      type: 'text/csv',
    });

    const parsed = await parseFile(file);

    expect(parsed.headerPresent).toBe(false);
    expect(parsed.headers).toEqual(['Colonna 1']);
    expect(parsed.rows.map((row) => row.originalRowNumber)).toEqual([1, 2]);
  });

  it('keeps raw rows so an invalid first CSV row can be restored as data', async () => {
    const file = new File(['NON_E_UN_CUP,nota\nG17H03000130001,ok'], 'cups.csv', {
      type: 'text/csv',
    });

    const parsed = await parseFile(file);
    const overridden = buildParsedRows(parsed.rawRows, false);

    expect(parsed.headerPresent).toBe(true);
    expect(overridden.rows[0]).toEqual({ originalRowNumber: 1, cells: ['NON_E_UN_CUP', 'nota'] });
  });
});
