import { describe, expect, it } from 'vitest';
import {
  batchProgressLabel,
  originRowsForResult,
  sourceButtonLabel,
  sourceDetailTable,
  sourceGroups,
  sourceRowsForResult,
  sourceSummary,
  uniqueSourceValues,
} from '../src/lib/core/validator-view-model.js';

const t = (key, values = {}) =>
  `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ''}`;

function row(overrides = {}) {
  return {
    row: 1,
    value: 'G17H03000130001',
    fileOrigine: 'a.csv',
    schedaOrigine: '',
    sourceRowNumber: 2,
    colonnaOrigine: 'CUP',
    ...overrides,
  };
}

describe('validator view model', () => {
  it('costruisce label progresso per ogni fase', () => {
    expect(batchProgressLabel(null, false, t)).toBe('');
    expect(
      batchProgressLabel({ phase: 'lookup', percent: 1, processed: 1, total: 2 }, false, t),
    ).toBe('validator.progressLookup');
    expect(
      batchProgressLabel({ phase: 'complete', percent: 100, processed: 2, total: 2 }, false, t),
    ).toBe('');
    expect(
      batchProgressLabel({ phase: 'validate', percent: 1, processed: 1, total: 2 }, true, t),
    ).toBe('validator.progressWorker');
    expect(
      batchProgressLabel({ phase: 'validate', percent: 1, processed: 1, total: 2 }, false, t),
    ).toBe('validator.progressInline');
  });

  it('restituisce righe sorgente fallback quando non ci sono righe importate', () => {
    const importedRowsByRow = new Map();

    expect(originRowsForResult({ inputRows: [1] }, importedRowsByRow, false)).toEqual([]);
    expect(sourceRowsForResult({ inputRows: [1, null] }, importedRowsByRow, false)).toEqual([
      '1',
      '',
    ]);
    expect(sourceRowsForResult({ inputRow: null }, importedRowsByRow, false)).toEqual(['']);
    expect(sourceButtonLabel({ inputRow: null }, importedRowsByRow, false)).toBe('');
    expect(sourceButtonLabel({ inputRows: [] }, importedRowsByRow, false)).toBe('-');
    expect(sourceSummary({ inputRows: [1, 2] }, importedRowsByRow, false, t)).toBe('1, 2');
  });

  it('costruisce riepiloghi e dialog fonte da righe importate', () => {
    const rows = [
      row({ row: 1, sourceRowNumber: 2 }),
      row({ row: 2, sourceRowNumber: 3 }),
      row({
        row: 3,
        fileOrigine: 'b.xlsx',
        schedaOrigine: 'Foglio 1',
        sourceRowNumber: 4,
        colonnaOrigine: 'Codice CUP',
      }),
    ];
    const byRow = new Map(rows.map((item) => [item.row, item]));

    expect(originRowsForResult({ inputRows: [1, 99, null, 3] }, byRow, true)).toEqual([
      rows[0],
      rows[2],
    ]);
    expect(originRowsForResult({ inputRow: 1 }, byRow, true)).toEqual([rows[0]]);
    expect(sourceRowsForResult({ inputRows: [1, 2, 3] }, byRow, true)).toEqual(['2', '3', '4']);
    expect(sourceButtonLabel({ inputRows: [1, 2] }, byRow, true)).toBe('2++');
    expect(sourceSummary({ inputRows: [1, 3] }, byRow, true, t)).toBe(
      'validator.sourceSummaryNoSheet:{"row":2,"file":"a.csv","column":"CUP"} validator.sourceSummarySheet:{"row":4,"file":"b.xlsx","sheet":"Foglio 1","column":"Codice CUP"}',
    );

    expect(sourceDetailTable({ inputRows: [1, 2, 3] }, byRow, true, t)).toEqual({
      columns: ['a.csv', 'b.xlsx'],
      rows: [
        { label: 'validator.sheet', values: ['-', 'Foglio 1'] },
        { label: 'validator.column', values: ['CUP', 'Codice CUP'] },
        { label: 'validator.rowPlural', values: ['2, 3', '4'] },
      ],
    });
  });

  it('costruisce dialog fonte fallback senza righe importate', () => {
    expect(sourceDetailTable({ inputRows: [1, 2] }, new Map(), false, t)).toEqual({
      columns: ['-'],
      rows: [
        { label: 'validator.sheet', values: ['-'] },
        { label: 'validator.column', values: ['-'] },
        { label: 'validator.rowPlural', values: ['1, 2'] },
      ],
    });
    expect(sourceDetailTable({ inputRow: 1 }, new Map(), false, t).rows[2].label).toBe(
      'validator.row',
    );
  });

  it('raggruppa sorgenti e normalizza valori unici', () => {
    const rows = [
      row({ sourceRowNumber: 2 }),
      row({ sourceRowNumber: 3 }),
      row({ fileOrigine: 'a.csv', schedaOrigine: 'Extra', sourceRowNumber: 4 }),
    ];

    expect(
      sourceGroups(rows).map((group) => [group.fileName, group.sheetName, group.rows.length]),
    ).toEqual([
      ['a.csv', undefined, 2],
      ['a.csv', 'Extra', 1],
    ]);
    expect(uniqueSourceValues(['CUP', '', undefined, 'CUP', 'Altro'])).toBe('CUP, Altro');
    expect(uniqueSourceValues(['', undefined])).toBe('-');
  });
});
