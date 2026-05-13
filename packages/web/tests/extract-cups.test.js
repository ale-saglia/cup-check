import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { extractCupsFromText, extractCupsFromPages } from '../src/pdf/extract-cups.js';

const fixtureDir = path.resolve(import.meta.dirname, '../../../tests/fixtures');
const validCases = yaml.load(fs.readFileSync(path.join(fixtureDir, 'valid-cases.yaml'), 'utf8'));
const invalidCases = yaml.load(
  fs.readFileSync(path.join(fixtureDir, 'invalid-cases.yaml'), 'utf8'),
);

// CUP di riferimento per i test comportamentali (split, occorrenze, multi-CUP)
const validCup = validCases[0].input; // 'G17H03000130001'
const validCup2 = validCases[3].input; // 'J61B21007000007'

const futureYearCase = invalidCases.find((c) => c.id === 'invalid-future-year');
const structurallyInvalidCases = invalidCases.filter((c) =>
  ['invalid-charset', 'invalid-first-position-digit', 'invalid-fourth-position-digit'].includes(
    c.id,
  ),
);

describe('extractCupsFromText', () => {
  it.each(validCases)(
    '$id: trova "$input" nel testo e lo marca formalValid=true',
    ({ input }) => {
      const result = extractCupsFromText(`testo con CUP ${input} nel documento`);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(input);
      expect(result[0].formalValid).toBe(true);
    },
  );

  it(`${futureYearCase.id}: non trovato perché l'anno (99) supera il range +15 anni`, () => {
    // SEARCH_YEAR = currentYear+15: anno 99 è oltre la soglia e viene escluso già
    // dalla verifica strutturale, evitando falsi positivi da anni implausibili.
    expect(extractCupsFromText(futureYearCase.input)).toHaveLength(0);
  });

  it('trova CUP con anno di poco futuro (nel range +15a) ma lo marca formalValid=false', () => {
    // Anno 35 > currentTwoDigitYear (26) → formalValid=false, ma ≤ 41 → struttura OK
    const nearFutureCup = 'G17H35000130001';
    const result = extractCupsFromText(nearFutureCup);
    expect(result).toHaveLength(1);
    expect(result[0].formalValid).toBe(false);
  });

  it.each(structurallyInvalidCases)(
    '$id: non trova "$input" nel testo (strutturalmente non valido)',
    ({ input }) => {
      expect(extractCupsFromText(input)).toHaveLength(0);
    },
  );

  it('conta le occorrenze quando lo stesso CUP appare più volte', () => {
    const result = extractCupsFromText(`${validCup} in intestazione e ${validCup} in calce`);
    expect(result).toEqual([{ value: validCup, occurrences: 2, formalValid: true }]);
  });

  it('trova più CUP distinti nello stesso testo', () => {
    const result = extractCupsFromText(
      `riferimento ${validCup} e anche ${validCup2} nel medesimo documento`,
    );
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.value)).toContain(validCup);
    expect(result.map((c) => c.value)).toContain(validCup2);
  });

  it('restituisce array vuoto se non trova alcun CUP', () => {
    expect(extractCupsFromText('Nessun codice CUP presente nel documento')).toEqual([]);
  });

  it('normalizza il testo in maiuscolo prima di cercare', () => {
    const result = extractCupsFromText(`cup ${validCup.toLowerCase()} nel progetto`);
    expect(result).toEqual([{ value: validCup, occurrences: 1, formalValid: true }]);
  });

  it('ricompone un CUP spezzato da un a-capo', () => {
    const [h1, h2] = [validCup.slice(0, 8), validCup.slice(8)];
    const result = extractCupsFromText(`CUP ${h1}\n${h2} approvato`);
    expect(result).toEqual([{ value: validCup, occurrences: 1, formalValid: true }]);
  });

  it('ricompone un CUP spezzato da uno spazio', () => {
    const [h1, h2] = [validCup.slice(0, 8), validCup.slice(8)];
    const result = extractCupsFromText(`codice ${h1} ${h2} riportato in fattura`);
    expect(result).toEqual([{ value: validCup, occurrences: 1, formalValid: true }]);
  });

  it('ricompone un CUP spezzato in tre parti (output OCR frammentato)', () => {
    const [p1, p2, p3] = [validCup.slice(0, 5), validCup.slice(5, 10), validCup.slice(10)];
    const result = extractCupsFromText(`CUP ${p1} ${p2} ${p3} nel documento`);
    expect(result).toEqual([{ value: validCup, occurrences: 1, formalValid: true }]);
  });

  it('corregge la confusione OCR 1→I in posizione 3 con ocrFix=true', () => {
    // CUP reale: H38I23000670005 → OCR legge "H38123000670005" (I→1 in pos 3)
    const realCup = 'H38I23000670005';
    const ocrRead = 'H38123000670005'; // pos 3 = '1' invece di 'I'
    const result = extractCupsFromText(`CUP ${ocrRead} nel documento`, { ocrFix: true });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(realCup);
    expect(result[0].formalValid).toBe(true);
  });

  it('NON corregge la confusione 1→I senza ocrFix (PDF nativo)', () => {
    const ocrRead = 'H38123000670005';
    const result = extractCupsFromText(`CUP ${ocrRead} nel documento`);
    expect(result).toHaveLength(0);
  });

  it('corregge la confusione OCR 1→I in posizione 0 con ocrFix=true', () => {
    const cupStartingWithI = 'I00H23000000001';
    const ocrRead = '100H23000000001'; // pos 0 = '1' invece di 'I'
    const result = extractCupsFromText(`CUP ${ocrRead} nel documento`, { ocrFix: true });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(cupStartingWithI);
  });
});

describe('extractCupsFromPages', () => {
  it('restituisce status ok e i CUP trovati nelle pagine', () => {
    const result = extractCupsFromPages(
      'fattura.pdf',
      [`Testo pagina uno con CUP ${validCup} rilevato`],
      'text',
    );
    expect(result.fileName).toBe('fattura.pdf');
    expect(result.status).toBe('ok');
    expect(result.source).toBe('text');
    expect(result.cups).toHaveLength(1);
    expect(result.cups[0].value).toBe(validCup);
  });

  it('restituisce status no_cup quando le pagine non contengono CUP', () => {
    const result = extractCupsFromPages('vuoto.pdf', ['nessun cup in questo file'], 'text');
    expect(result.status).toBe('no_cup');
    expect(result.cups).toEqual([]);
  });

  it('unisce il testo di più pagine prima di cercare', () => {
    const result = extractCupsFromPages(
      'multi.pdf',
      ['pagina uno senza cup', `pagina due con ${validCup2} estratto via ocr`],
      'ocr',
    );
    expect(result.status).toBe('ok');
    expect(result.source).toBe('ocr');
    expect(result.cups[0].value).toBe(validCup2);
  });

  it('esclude i CUP formalmente invalidi e restituisce no_cup se non ne rimangono', () => {
    // futureYearCase ha formalValid=false — non deve apparire nei risultati
    const result = extractCupsFromPages('invalid.pdf', [futureYearCase.input], 'text');
    expect(result.status).toBe('no_cup');
    expect(result.cups).toEqual([]);
  });
});
