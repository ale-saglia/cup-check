import { describe, expect, it } from 'vitest';
import { csvCell, protectCsvFormula } from '../src/lib/core/csv.js';

describe('csvCell', () => {
  it('quota celle con delimitatore e raddoppia i doppi apici', () => {
    expect(csvCell('uno;due "tre"')).toBe('"uno;due ""tre"""');
    expect(csvCell('uno,due', ',')).toBe('"uno,due"');
  });

  it('protegge e quota sempre le celle formula-like', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('+1')).toBe('"\'+1"');
    expect(csvCell('-1')).toBe('"\'-1"');
    expect(csvCell('@cmd')).toBe('"\'@cmd"');
  });

  it('lascia invariata una cella semplice', () => {
    expect(csvCell('G17H03000130001')).toBe('G17H03000130001');
  });
});

describe('protectCsvFormula', () => {
  it('aggiunge apostrofo solo ai prefissi interpretati come formula', () => {
    expect(protectCsvFormula('=A1')).toBe("'=A1");
    expect(protectCsvFormula('test')).toBe('test');
  });
});
