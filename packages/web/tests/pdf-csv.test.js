import { describe, it, expect } from 'vitest';
import { buildVerificatoreCsv, buildExportCsv } from '../src/lib/pdf/pdf-csv.js';

const CUP = 'G17H03000130001';

function makeEntry(overrides = {}) {
  return {
    id: 0,
    file: null,
    name: 'fattura.pdf',
    status: 'done',
    source: 'text',
    cups: [{ id: '0-0', value: CUP, source: 'text', manual: false, editing: false }],
    ocrProgress: null,
    error: null,
    ...overrides,
  };
}

describe('buildVerificatoreCsv', () => {
  it('include solo le entry done/error, non quelle queued/parsing/ocr', () => {
    const entries = [
      makeEntry({ status: 'done' }),
      makeEntry({ status: 'error', cups: [] }),
      makeEntry({ status: 'queued', cups: [] }),
      makeEntry({ status: 'parsing', cups: [] }),
    ];
    const csv = buildVerificatoreCsv(entries);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 cup dalla entry done
  });

  it('produce header cup,file_origine e una riga per CUP', () => {
    const csv = buildVerificatoreCsv([makeEntry()]);
    expect(csv).toContain('cup,file_origine');
    expect(csv).toContain(CUP);
    expect(csv).toContain('fattura.pdf');
  });

  it('inizia con il BOM UTF-8', () => {
    const csv = buildVerificatoreCsv([makeEntry()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('nessuna entry completata → solo header', () => {
    const csv = buildVerificatoreCsv([makeEntry({ status: 'queued' })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('cup,file_origine');
  });

  it('csvComma: escape di virgola nel nome file', () => {
    const csv = buildVerificatoreCsv([makeEntry({ name: 'fat,tura.pdf' })]);
    expect(csv).toContain('"fat,tura.pdf"');
  });

  it('csvComma: escape di doppi apici nel nome file', () => {
    const csv = buildVerificatoreCsv([makeEntry({ name: 'fat"tura.pdf' })]);
    expect(csv).toContain('"fat""tura.pdf"');
  });

  it('csvComma: prefisso apostrofo per formule nel nome file', () => {
    const csv = buildVerificatoreCsv([makeEntry({ name: '=formula.pdf' })]);
    expect(csv).toContain("'=formula.pdf");
  });

  it('csvComma: prefisso apostrofo per + nel nome file', () => {
    const csv = buildVerificatoreCsv([makeEntry({ name: '+bonus.pdf' })]);
    expect(csv).toContain("'+bonus.pdf");
  });

  it('csvComma: nessun escaping per nome file normale', () => {
    const csv = buildVerificatoreCsv([makeEntry({ name: 'fattura.pdf' })]);
    expect(csv).not.toContain('"fattura.pdf"');
    expect(csv).toContain('fattura.pdf');
  });

  it('csvComma: formula + virgola → apostrofo E quoting', () => {
    const csv = buildVerificatoreCsv([makeEntry({ name: '=test,name.pdf' })]);
    expect(csv).toContain('"\'=test,name.pdf"');
  });
});

describe('buildExportCsv', () => {
  it('produce header con tutte le colonne', () => {
    const csv = buildExportCsv([makeEntry()]);
    expect(csv).toContain(
      'cup;file_origine;formato_valido;fonte;manuale;data_fattura;numero_fattura;importo_totale;causale;piva_fornitore;nome_fornitore;cig',
    );
  });

  it('formato_valido SI/NO', () => {
    const validEntry = makeEntry({
      cups: [{ id: '0-0', value: CUP, source: 'text', manual: false, editing: false }],
    });
    const invalidEntry = makeEntry({
      cups: [
        {
          id: '0-0',
          value: 'INVALID123456789',
          source: 'text',
          manual: false,
          editing: false,
        },
      ],
    });
    const csv = buildExportCsv([validEntry, invalidEntry]);
    const lines = csv.split('\n');
    expect(lines[1].split(';')[2]).toBe('SI');
    expect(lines[2].split(';')[2]).toBe('NO');
  });

  it('manuale SI/NO', () => {
    const manuale = makeEntry({
      cups: [
        {
          id: '0-0',
          value: CUP,
          source: 'manuale',
          manual: true,
          editing: false,
        },
      ],
    });
    const auto = makeEntry({
      cups: [{ id: '0-1', value: CUP, source: 'text', manual: false, editing: false }],
    });
    const csv = buildExportCsv([manuale, auto]);
    const lines = csv.split('\n');
    expect(lines[1].split(';')[4]).toBe('SI');
    expect(lines[2].split(';')[4]).toBe('NO');
  });

  it('csvSemi: escape di punto-e-virgola nel nome file', () => {
    const csv = buildExportCsv([makeEntry({ name: 'fat;tura.pdf' })]);
    expect(csv).toContain('"fat;tura.pdf"');
  });

  it('csvSemi: escape di doppi apici nel nome file', () => {
    const csv = buildExportCsv([makeEntry({ name: 'fat"tura.pdf' })]);
    expect(csv).toContain('"fat""tura.pdf"');
  });

  it('csvSemi: prefisso apostrofo per formule nel nome file', () => {
    const csv = buildExportCsv([makeEntry({ name: '-formula.pdf' })]);
    expect(csv).toContain("'-formula.pdf");
  });

  it('csvSemi: prefisso apostrofo per @ nel nome file', () => {
    const csv = buildExportCsv([makeEntry({ name: '@note.pdf' })]);
    expect(csv).toContain("'@note.pdf");
  });

  it('csvSemi: formula + punto-e-virgola → apostrofo E quoting', () => {
    const csv = buildExportCsv([makeEntry({ name: '=test;name.pdf' })]);
    expect(csv).toContain('"\'=test;name.pdf"');
  });

  it('source null → stringa vuota nella colonna fonte', () => {
    const entry = makeEntry({
      cups: [{ id: '0-0', value: CUP, source: null, manual: false, editing: false }],
    });
    const csv = buildExportCsv([entry]);
    const dataLine = csv.split('\n')[1];
    const fields = dataLine.split(';');
    expect(fields[3]).toBe('');
  });

  it('inizia con il BOM UTF-8', () => {
    const csv = buildExportCsv([makeEntry()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('entry done senza CUP emette riga con cup vuoto e file_origine', () => {
    const entry = makeEntry({ cups: [], status: 'done' });
    const csv = buildExportCsv([entry]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 riga senza cup
    const fields = lines[1].split(';');
    expect(fields[0]).toBe('');
    expect(fields[1]).toBe('fattura.pdf');
  });

  it('entry error senza CUP non emette righe', () => {
    const entry = makeEntry({ cups: [], status: 'error' });
    const csv = buildExportCsv([entry]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // solo header
  });

  it('include dati fattura se invoiceData è presente', () => {
    const entry = makeEntry({
      invoiceData: {
        data: '2025-12-22',
        numero: '259/B',
        importoTotale: '1064653.34',
        causale: 'Causale test',
        pivaFornitore: '09740180014',
        nomeFornitore: 'S.C.R. PIEMONTE S.p.A.',
        cig: 'CIG123456789',
      },
    });
    const csv = buildExportCsv([entry]);
    const fields = csv.split('\n')[1].split(';');
    expect(fields[5]).toBe('2025-12-22');
    expect(fields[6]).toBe('259/B');
    expect(fields[7]).toBe('1064653,34');
    expect(fields[8]).toBe('Causale test');
    expect(fields[9]).toBe('09740180014');
    expect(fields[11]).toBe('CIG123456789');
  });

  it('campi fattura vuoti se invoiceData è assente', () => {
    const entry = makeEntry();
    const csv = buildExportCsv([entry]);
    const fields = csv.split('\n')[1].split(';');
    expect(fields[5]).toBe('');
    expect(fields[11]).toBe('');
  });
});
