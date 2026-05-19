import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractCupsFromXml, extractCupsFromXmlFile } from '../src/lib/xml/extract-cups.js';

// DOMParser non è disponibile nell'ambiente node; usiamo l'implementazione di jsdom.
// È sufficiente impostarlo prima dell'esecuzione dei test: le funzioni lo chiamano
// solo quando invocate, non al momento dell'import.
beforeAll(() => {
  globalThis.DOMParser = new JSDOM('').window.DOMParser;
});

const samplesDir = path.resolve(import.meta.dirname, '../../../samples/xml');
const readSample = (name) => fs.readFileSync(path.join(samplesDir, name), 'utf8');

describe('extractCupsFromXml — CodiceCUP esplicito', () => {
  it('estrae il CUP da CodiceCUP in DatiOrdineAcquisto', () => {
    const result = extractCupsFromXml(readSample('codice-cup-esplicito.xml'));
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('G17H03000130001');
    expect(result[0].formalValid).toBe(true);
  });
});

describe('extractCupsFromXml — AltriDatiGestionali', () => {
  it('estrae il CUP da AltriDatiGestionali con TipoDato=CUP', () => {
    const result = extractCupsFromXml(readSample('altri-dati-gestionali.xml'));
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('J61B21007000007');
    expect(result[0].formalValid).toBe(true);
  });
});

describe('extractCupsFromXml — fallback testo libero', () => {
  it('estrae il CUP dalla Causale quando non ci sono campi strutturati', () => {
    const result = extractCupsFromXml(readSample('cup-in-causale.xml'));
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('A58C15000390001');
  });
});

describe('extractCupsFromXml — senza CUP', () => {
  it('restituisce array vuoto se il documento non contiene CUP', () => {
    expect(extractCupsFromXml(readSample('senza-cup.xml'))).toHaveLength(0);
  });
});

describe('extractCupsFromXml — XML malformato', () => {
  it('restituisce array vuoto su XML non parsabile', () => {
    expect(extractCupsFromXml('non xml <<')).toHaveLength(0);
  });

  it('restituisce array vuoto su stringa vuota', () => {
    expect(extractCupsFromXml('')).toHaveLength(0);
  });
});

describe('extractCupsFromXml — deduplicazione', () => {
  it('conta le occorrenze senza duplicare il CUP', () => {
    const xml = `<?xml version="1.0"?>
      <Fattura>
        <CodiceCUP>G17H03000130001</CodiceCUP>
        <CodiceCUP>G17H03000130001</CodiceCUP>
      </Fattura>`;
    const result = extractCupsFromXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBe(2);
  });
});

describe('extractCupsFromXml — branch addCup', () => {
  it('ignora CodiceCUP strutturalmente non plausibile (troppo corto)', () => {
    const xml = `<?xml version="1.0"?><F><CodiceCUP>TROPPO_CORTO</CodiceCUP></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('ignora CodiceCUP formalmente non valido (anno implausibile ma struttura ok)', () => {
    // Anno 99 è strutturalmente plausibile (dentro il range +15a? No: 99 > 26+15=41)
    // Usiamo un CUP con anno 35 (> currentYear 26, < 26+15=41 → strutturalmente plausibile
    // ma con validateCup che lo marca INVALIDO perché non trovato in OpenCUP).
    // extractCupsFromXml filtra SOLO i formalmente invalidi (validateCup outcome=INVALID).
    // G17H35000130001 ha anno 35 → isStructurallyPlausible=true, validateCup=INVALIDO_FORMATO.
    const xml = `<?xml version="1.0"?><F><CodiceCUP>G17H35000130001</CodiceCUP></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('ignora AltriDatiGestionali con TipoDato diverso da CUP', () => {
    const xml = `<?xml version="1.0"?>
      <F><AltriDatiGestionali>
        <TipoDato>CIG</TipoDato>
        <RiferimentoTesto>G17H03000130001</RiferimentoTesto>
      </AltriDatiGestionali></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('ignora AltriDatiGestionali con TipoDato=CUP ma RiferimentoTesto assente', () => {
    const xml = `<?xml version="1.0"?>
      <F><AltriDatiGestionali>
        <TipoDato>CUP</TipoDato>
      </AltriDatiGestionali></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('non duplica CUP trovato sia in CodiceCUP che nel testo libero', () => {
    const xml = `<?xml version="1.0"?>
      <F>
        <CodiceCUP>G17H03000130001</CodiceCUP>
        <Causale>Progetto CUP G17H03000130001</Causale>
      </F>`;
    const result = extractCupsFromXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('G17H03000130001');
  });

  it('restituisce array vuoto su XML senza Causale né Descrizione', () => {
    const xml = `<?xml version="1.0"?><F><DatiTrasmissione/></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('AltriDatiGestionali senza elemento TipoDato non causa errori e viene ignorato', () => {
    // Copre il branch null di el.querySelector('TipoDato')?.textContent
    const xml = `<?xml version="1.0"?>
      <F><AltriDatiGestionali>
        <RiferimentoTesto>G17H03000130001</RiferimentoTesto>
      </AltriDatiGestionali></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('ignora Causale vuota (textContent falsy)', () => {
    // Copre il branch false di if (el.textContent)
    const xml = `<?xml version="1.0"?><F><Causale></Causale></F>`;
    expect(extractCupsFromXml(xml)).toHaveLength(0);
  });

  it('ignora CUP nel testo libero già trovato via campo strutturato', () => {
    // Copre il branch false di !counts.has(candidate.value) — CUP già in counts
    const xml = `<?xml version="1.0"?>
      <F>
        <CodiceCUP>G17H03000130001</CodiceCUP>
        <Causale>Riferimento CUP G17H03000130001</Causale>
      </F>`;
    const result = extractCupsFromXml(xml);
    expect(result).toHaveLength(1);
  });
});

describe('extractCupsFromXmlFile', () => {
  it('restituisce status ok se ci sono CUP', () => {
    const r = extractCupsFromXmlFile('fattura.xml', readSample('codice-cup-esplicito.xml'));
    expect(r.status).toBe('ok');
    expect(r.fileName).toBe('fattura.xml');
    expect(r.cups).toHaveLength(1);
  });

  it('restituisce status no_cup se non ci sono CUP', () => {
    const r = extractCupsFromXmlFile('senza-cup.xml', readSample('senza-cup.xml'));
    expect(r.status).toBe('no_cup');
    expect(r.cups).toHaveLength(0);
  });
});
