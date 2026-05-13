import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { buildParsedRows, detectCupColumn, hasHeader, parseFile } from '../src/parser.js';

globalThis.DOMParser = DOMParser;

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
    expect(parsed.rows).toEqual([{ originalRowNumber: 2, cells: ['1', 'G17H03000130001', 'ok'] }]);
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

  it('parses CSV when the CUP column is not first', async () => {
    const file = new File(['id,Codice CUP,note\n42,G17H03000130001,ok'], 'cups.csv', {
      type: 'text/csv',
    });

    const parsed = await parseFile(file);

    expect(parsed.headers).toEqual(['id', 'Codice CUP', 'note']);
    expect(parsed.suggestedColumnIndex).toBe(1);
    expect(parsed.rows).toEqual([{ originalRowNumber: 2, cells: ['42', 'G17H03000130001', 'ok'] }]);
  });

  it('keeps empty CSV rows and mixed numeric/text cells', async () => {
    const file = new File(
      ['CUP,quantità,note\nG17H03000130001,12,testo\n,,\nA58C15000390001,7,ok'],
      'cups.csv',
      {
        type: 'text/csv',
      },
    );

    const parsed = await parseFile(file);

    expect(parsed.rows).toEqual([
      { originalRowNumber: 2, cells: ['G17H03000130001', '12', 'testo'] },
      { originalRowNumber: 3, cells: ['', '', ''] },
      { originalRowNumber: 4, cells: ['A58C15000390001', '7', 'ok'] },
    ]);
  });

  it('parses XLSX with header', async () => {
    const file = await workbookFile([
      ['CUP', 'note'],
      ['G17H03000130001', 'ok'],
    ]);

    const parsed = await parseFile(file);

    expect(parsed.headerPresent).toBe(true);
    expect(parsed.headers).toEqual(['CUP', 'note']);
    expect(parsed.rows).toEqual([{ originalRowNumber: 2, cells: ['G17H03000130001', 'ok'] }]);
  });

  it('exposes sheet names and parses the selected XLSX sheet', async () => {
    const file = await workbookFileWithSheets([
      {
        name: 'Info',
        rows: [['note'], ['nessun CUP qui']],
      },
      {
        name: 'CUP',
        rows: [
          ['id', 'Codice CUP'],
          [42, 'G17H03000130001'],
        ],
      },
    ]);

    const firstSheet = await parseFile(file);
    const selectedSheet = await parseFile(file, { sheetName: 'CUP' });

    expect(firstSheet.sheetNames).toEqual(['Info', 'CUP']);
    expect(firstSheet.selectedSheetName).toBe('Info');
    expect(firstSheet.headers).toEqual(['note']);
    expect(selectedSheet.sheetNames).toEqual(['Info', 'CUP']);
    expect(selectedSheet.selectedSheetName).toBe('CUP');
    expect(selectedSheet.headers).toEqual(['id', 'Codice CUP']);
    expect(selectedSheet.suggestedColumnIndex).toBe(1);
    expect(selectedSheet.rows).toEqual([
      { originalRowNumber: 2, cells: ['42', 'G17H03000130001'] },
    ]);
  });

  it('parses XLSX without header', async () => {
    const file = await workbookFile([['G17H03000130001'], ['A58C15000390001']]);

    const parsed = await parseFile(file);

    expect(parsed.headerPresent).toBe(false);
    expect(parsed.headers).toEqual(['Colonna 1']);
    expect(parsed.rows.map((row) => row.originalRowNumber)).toEqual([1, 2]);
  });

  it('keeps raw XLSX rows so an invalid first row can be restored as data', async () => {
    const file = await workbookFile([
      ['NON_E_UN_CUP', 'nota'],
      ['G17H03000130001', 'ok'],
    ]);

    const parsed = await parseFile(file);
    const overridden = buildParsedRows(parsed.rawRows, false);

    expect(parsed.headerPresent).toBe(true);
    expect(overridden.rows[0]).toEqual({ originalRowNumber: 1, cells: ['NON_E_UN_CUP', 'nota'] });
  });

  it('parses XLSX when the CUP column is not first', async () => {
    const file = await workbookFile([
      ['id', 'Codice CUP', 'note'],
      [42, 'G17H03000130001', 'ok'],
    ]);

    const parsed = await parseFile(file);

    expect(parsed.headers).toEqual(['id', 'Codice CUP', 'note']);
    expect(parsed.suggestedColumnIndex).toBe(1);
    expect(parsed.rows).toEqual([{ originalRowNumber: 2, cells: ['42', 'G17H03000130001', 'ok'] }]);
  });

  it('keeps empty XLSX rows and mixed numeric/text cells', async () => {
    const file = await workbookFile([
      ['CUP', 'quantità', 'note'],
      ['G17H03000130001', 12, 'testo'],
      ['', '', ''],
      ['A58C15000390001', 7, 'ok'],
    ]);

    const parsed = await parseFile(file);

    expect(parsed.rows).toEqual([
      { originalRowNumber: 2, cells: ['G17H03000130001', '12', 'testo'] },
      { originalRowNumber: 3, cells: ['', '', ''] },
      { originalRowNumber: 4, cells: ['A58C15000390001', '7', 'ok'] },
    ]);
  });

  it('rejects unsupported file formats', async () => {
    const file = new File(['{}'], 'cups.json', { type: 'application/json' });

    await expect(parseFile(file)).rejects.toThrow(
      'Formato non supportato. Carica un file CSV o XLSX.',
    );
  });
});

async function workbookFile(rows, name = 'cups.xlsx') {
  return workbookFileWithSheets([{ name: 'CUP', rows }], name);
}

async function workbookFileWithSheets(sheets, name = 'cups.xlsx') {
  const zip = new JSZip();
  const worksheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');
  const workbookSheets = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');
  const workbookRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${worksheetOverrides}</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}</Relationships>`,
  );
  sheets.forEach((sheet, index) => {
    zip.file(
      `xl/worksheets/sheet${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows(sheet.rows)}</sheetData></worksheet>`,
    );
  });

  return new File([await zip.generateAsync({ type: 'arraybuffer' })], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function sheetRows(rows) {
  return rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, cellIndex) => {
          const ref = `${columnName(cellIndex + 1)}${rowIndex + 1}`;
          if (typeof value === 'number') {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');
}

function columnName(number) {
  let name = '';
  let current = number;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
