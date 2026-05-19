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
    cups: [
      { id: '0-0', value: CUP, formalValid: true, source: 'text', manual: false, editing: false },
    ],
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
});

describe('buildExportCsv', () => {
  it('produce header con colonne semicolon', () => {
    const csv = buildExportCsv([makeEntry()]);
    expect(csv).toContain('cup;file_origine;formato_valido;fonte;manuale');
  });

  it('formato_valido SI/NO', () => {
    const validEntry = makeEntry({
      cups: [
        { id: '0-0', value: CUP, formalValid: true, source: 'text', manual: false, editing: false },
      ],
    });
    const invalidEntry = makeEntry({
      cups: [
        {
          id: '0-0',
          value: 'INVALID123456789',
          formalValid: false,
          source: 'text',
          manual: false,
          editing: false,
        },
      ],
    });
    const csv = buildExportCsv([validEntry, invalidEntry]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain(';SI;');
    expect(lines[2]).toContain(';NO;');
  });

  it('manuale SI/NO', () => {
    const manuale = makeEntry({
      cups: [
        {
          id: '0-0',
          value: CUP,
          formalValid: true,
          source: 'manuale',
          manual: true,
          editing: false,
        },
      ],
    });
    const auto = makeEntry({
      cups: [
        { id: '0-1', value: CUP, formalValid: true, source: 'text', manual: false, editing: false },
      ],
    });
    const csv = buildExportCsv([manuale, auto]);
    const lines = csv.split('\n');
    expect(lines[1].endsWith(';SI')).toBe(true);
    expect(lines[2].endsWith(';NO')).toBe(true);
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

  it('source null → stringa vuota nella colonna fonte', () => {
    const entry = makeEntry({
      cups: [
        { id: '0-0', value: CUP, formalValid: true, source: null, manual: false, editing: false },
      ],
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
});
