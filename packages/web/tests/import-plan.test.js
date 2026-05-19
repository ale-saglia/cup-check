import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import {
  buildBatchRows,
  buildImportedCupRows,
  createImportSources,
  createSourceFromSheet,
  updateSourceColumn,
  updateSourceHeader,
  updateSourceIncluded,
  updateSourceSheet,
} from '../src/lib/core/import-plan.js';

globalThis.DOMParser = DOMParser;

describe('import-plan', () => {
  it('crea una sorgente per ogni CSV e permette colonne CUP diverse prima della concatenazione', async () => {
    const first = new File(['CUP,note\nG17H03000130001,ok\n,vuota'], 'primo.csv', {
      type: 'text/csv',
    });
    const second = new File(['id,Codice CUP\n42,A58C15000390001'], 'secondo.csv', {
      type: 'text/csv',
    });

    const sources = await createImportSources([first, second]);
    sources[0].selectedColumnIndexes = [0];
    sources[1].selectedColumnIndexes = [1];

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      fileName: 'primo.csv',
      headerPresent: true,
      selectedColumnIndexes: [0],
      included: true,
    });
    expect(sources[0]).not.toHaveProperty('sheetName');
    expect(sources[1]).toMatchObject({
      fileName: 'secondo.csv',
      headerPresent: true,
      selectedColumnIndexes: [1],
      included: true,
    });
    expect(sources[1]).not.toHaveProperty('sheetName');

    const importedRows = buildImportedCupRows(sources);

    expect(importedRows).toEqual([
      {
        value: 'G17H03000130001',
        row: 1,
        fileOrigine: 'primo.csv',
        colonnaOrigine: 'CUP',
        sourceRowNumber: 2,
      },
      {
        value: 'A58C15000390001',
        row: 2,
        fileOrigine: 'secondo.csv',
        colonnaOrigine: 'Codice CUP',
        sourceRowNumber: 2,
      },
    ]);
    expect(buildBatchRows(importedRows)).toEqual([
      { value: 'G17H03000130001', row: 1 },
      { value: 'A58C15000390001', row: 2 },
    ]);
  });

  it('mantiene le celle CUP vuote quando skipMissingCup e disattivato', async () => {
    const file = new File(['CUP,note\n,vuota'], 'vuote.csv', { type: 'text/csv' });
    const sources = await createImportSources([file]);
    sources[0].skipMissingCup = false;

    const importedRows = buildImportedCupRows(sources);

    expect(importedRows).toEqual([
      {
        value: '',
        row: 1,
        fileOrigine: 'vuote.csv',
        colonnaOrigine: 'CUP',
        sourceRowNumber: 2,
      },
    ]);
  });

  it('ignora le sorgenti escluse', async () => {
    const first = new File(['CUP\nG17H03000130001'], 'incluso.csv', { type: 'text/csv' });
    const second = new File(['CUP\nA58C15000390001'], 'escluso.csv', { type: 'text/csv' });
    const sources = await createImportSources([first, second]);
    sources[1].included = false;

    expect(buildImportedCupRows(sources).map((row) => row.fileOrigine)).toEqual(['incluso.csv']);
  });

  it('aggiunge una sorgente XLSX solo quando si carica esplicitamente un altra scheda', async () => {
    const file = await workbookFileWithSheets([
      {
        name: 'Prima',
        rows: [['CUP'], ['G17H03000130001']],
      },
      {
        name: 'Seconda',
        rows: [['Codice CUP'], ['A58C15000390001']],
      },
    ]);

    const [source] = await createImportSources([file]);
    expect(source.sheetName).toBe('Prima');

    const extra = await createSourceFromSheet(source, 'Seconda', 1);
    const importedRows = buildImportedCupRows([source, extra]);

    expect(extra).toMatchObject({
      fileName: 'cups.xlsx',
      sheetName: 'Seconda',
      selectedColumnIndexes: [0],
    });
    expect(importedRows.map((row) => row.schedaOrigine)).toEqual(['Prima', 'Seconda']);
  });

  it('permette di aggiungere la stessa scheda XLSX per selezionare una seconda colonna CUP', async () => {
    const file = await workbookFileWithSheets([
      {
        name: 'CUP',
        rows: [
          ['CUP primario', 'CUP secondario'],
          ['G17H03000130001', 'A58C15000390001'],
        ],
      },
    ]);

    const [source] = await createImportSources([file]);
    const extra = await createSourceFromSheet(source, 'CUP', 1);
    source.selectedColumnIndexes = [0];
    extra.selectedColumnIndexes = [1];

    expect([source.sheetName, extra.sheetName]).toEqual(['CUP', 'CUP']);
    expect(buildImportedCupRows([source, extra])).toEqual([
      {
        value: 'G17H03000130001',
        row: 1,
        fileOrigine: 'cups.xlsx',
        schedaOrigine: 'CUP',
        colonnaOrigine: 'CUP primario',
        sourceRowNumber: 2,
      },
      {
        value: 'A58C15000390001',
        row: 2,
        fileOrigine: 'cups.xlsx',
        schedaOrigine: 'CUP',
        colonnaOrigine: 'CUP secondario',
        sourceRowNumber: 2,
      },
    ]);
  });

  it('ignora la stessa colonna della stessa scheda caricata due volte', async () => {
    const file = await workbookFileWithSheets([
      {
        name: 'CUP',
        rows: [['CUP'], ['G17H03000130001']],
      },
    ]);

    const [source] = await createImportSources([file]);
    const duplicate = await createSourceFromSheet(source, 'CUP', 1);
    source.selectedColumnIndexes = [0];
    duplicate.selectedColumnIndexes = [0];

    expect(buildImportedCupRows([source, duplicate])).toEqual([
      {
        value: 'G17H03000130001',
        row: 1,
        fileOrigine: 'cups.xlsx',
        schedaOrigine: 'CUP',
        colonnaOrigine: 'CUP',
        sourceRowNumber: 2,
      },
    ]);
  });

  it('crea una sorgente XLSX sulla prima scheda e permette di cambiarla', async () => {
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

    const [source] = await createImportSources([file]);
    expect(source.sheetName).toBe('Info');
    expect(source.parsed.sheetNames).toEqual(['Info', 'CUP']);

    const updated = await updateSourceSheet(source, 'CUP');
    const importedRows = buildImportedCupRows([updated]);

    expect(updated).toMatchObject({
      fileName: 'cups.xlsx',
      sheetName: 'CUP',
      headerPresent: true,
      selectedColumnIndexes: [1],
    });
    expect(importedRows).toEqual([
      {
        value: 'G17H03000130001',
        row: 1,
        fileOrigine: 'cups.xlsx',
        schedaOrigine: 'CUP',
        colonnaOrigine: 'Codice CUP',
        sourceRowNumber: 2,
      },
    ]);
  });

  it('non applica cambio scheda a una sorgente CSV', async () => {
    const file = new File(['CUP\nG17H03000130001'], 'cups.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);

    await expect(updateSourceSheet(source, 'Qualsiasi')).resolves.toBe(source);
  });

  it('non aggiunge scheda se il nome non e presente nella sorgente CSV', async () => {
    const file = new File(['CUP\nG17H03000130001'], 'cups.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);

    await expect(createSourceFromSheet(source, 'Inesistente', 1)).resolves.toBe(source);
  });

  it('aggiorna intestazione CSV preservando la struttura senza schede', async () => {
    const file = new File(['CUP,Note\nG17H03000130001,ok'], 'test.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);
    expect(source.headerPresent).toBe(true);

    const updated = updateSourceHeader(source, false);
    expect(updated.headerPresent).toBe(false);
    expect(updated.parsed.sheetNames).toBeFalsy();
    expect(updated).not.toHaveProperty('sheetName');

    const rows = buildImportedCupRows([updated]);
    expect(rows).toHaveLength(2);
    expect(rows[0].colonnaOrigine).toBeDefined();
  });

  it('aggiorna intestazione XLSX mantenendo nome scheda e lista schede', async () => {
    const file = await workbookFileWithSheets([
      {
        name: 'Dati',
        rows: [
          ['CUP', 'Note'],
          ['G17H03000130001', 'ok'],
        ],
      },
    ]);
    const [source] = await createImportSources([file]);

    const updated = updateSourceHeader(source, false);
    expect(updated.headerPresent).toBe(false);
    expect(updated.parsed.sheetNames).toEqual(['Dati']);
    expect(updated.parsed.selectedSheetName).toBe('Dati');
  });

  it('usa Colonna N come etichetta quando la intestazione della colonna e vuota', async () => {
    const file = new File([',Note\nG17H03000130001,ok'], 'no-header.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);
    source.selectedColumnIndexes = [0];

    const rows = buildImportedCupRows([source]);
    expect(rows[0].colonnaOrigine).toBe('Colonna 1');
  });

  it('esclude e include una sorgente tramite updateSourceIncluded', async () => {
    const file = new File(['CUP\nG17H03000130001'], 'cups.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);

    const excluded = updateSourceIncluded(source, false);
    expect(excluded.included).toBe(false);
    expect(buildImportedCupRows([excluded])).toHaveLength(0);

    const reincluded = updateSourceIncluded(excluded, true);
    expect(reincluded.included).toBe(true);
    expect(buildImportedCupRows([reincluded])).toHaveLength(1);
  });

  it('usa stringa vuota per celle null o undefined nella costruzione delle righe CUP', async () => {
    const file = new File(['CUP\nG17H03000130001'], 'test.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);
    const sourceWithNullCell = {
      ...source,
      parsed: { ...source.parsed, rows: [{ originalRowNumber: 2, cells: [null] }] },
      skipMissingCup: false,
    };

    const rows = buildImportedCupRows([sourceWithNullCell]);
    expect(rows[0].value).toBe('');
  });

  it('aggiorna la colonna selezionata e la limita ai valori validi', async () => {
    const file = new File(['A,CUP,C\n1,G17H03000130001,3'], 'multi.csv', { type: 'text/csv' });
    const [source] = await createImportSources([file]);

    const updated = updateSourceColumn(source, 1);
    expect(updated.selectedColumnIndexes).toEqual([1]);

    const clamped = updateSourceColumn(source, 99);
    expect(clamped.selectedColumnIndexes).toEqual([2]);
  });
});

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
