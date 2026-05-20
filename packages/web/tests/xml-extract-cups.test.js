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

  it('ignora CodiceCUP vuoto (textContent falsy)', () => {
    const xml = `<?xml version="1.0"?><F><CodiceCUP></CodiceCUP></F>`;
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

describe('extractCupsFromXmlFile — invoiceData', () => {
  it('restituisce i dati fattura se presenti', () => {
    const xml = `<?xml version="1.0"?>
      <FatturaElettronica>
        <FatturaElettronicaHeader>
          <CedentePrestatore>
            <DatiAnagrafici>
              <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>12345678901</IdCodice></IdFiscaleIVA>
              <Anagrafica><Denominazione>Fornitore Test S.r.l.</Denominazione></Anagrafica>
            </DatiAnagrafici>
          </CedentePrestatore>
        </FatturaElettronicaHeader>
        <FatturaElettronicaBody>
          <DatiGenerali>
            <DatiGeneraliDocumento>
              <TipoDocumento>TD01</TipoDocumento>
              <Data>2025-06-15</Data>
              <Numero>42/A</Numero>
              <ImportoTotaleDocumento>5000.00</ImportoTotaleDocumento>
              <Causale>Prestazioni servizi</Causale>
            </DatiGeneraliDocumento>
            <DatiOrdineAcquisto>
              <CodiceCIG>CIG123456789</CodiceCIG>
            </DatiOrdineAcquisto>
          </DatiGenerali>
        </FatturaElettronicaBody>
      </FatturaElettronica>`;
    const r = extractCupsFromXmlFile('fattura.xml', xml);
    expect(r.invoiceData).not.toBeNull();
    expect(r.invoiceData?.data).toBe('2025-06-15');
    expect(r.invoiceData?.numero).toBe('42/A');
    expect(r.invoiceData?.importoTotale).toBe('5000.00');
    expect(r.invoiceData?.causale).toBe('Prestazioni servizi');
    expect(r.invoiceData?.pivaFornitore).toBe('12345678901');
    expect(r.invoiceData?.nomeFornitore).toBe('Fornitore Test S.r.l.');
    expect(r.invoiceData?.cig).toBe('CIG123456789');
  });

  it('nomeFornitore da Nome+Cognome se Denominazione assente', () => {
    const xml = `<?xml version="1.0"?>
      <F>
        <CedentePrestatore>
          <DatiAnagrafici>
            <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>RSSMRA80A01H501Z</IdCodice></IdFiscaleIVA>
            <Anagrafica><Nome>Mario</Nome><Cognome>Rossi</Cognome></Anagrafica>
          </DatiAnagrafici>
        </CedentePrestatore>
      </F>`;
    const r = extractCupsFromXmlFile('persona.xml', xml);
    expect(r.invoiceData?.nomeFornitore).toBe('Mario Rossi');
  });

  it('CIG multipli uniti con spazio', () => {
    const xml = `<?xml version="1.0"?>
      <F>
        <DatiOrdineAcquisto><CodiceCIG>CIG111</CodiceCIG></DatiOrdineAcquisto>
        <DatiContratto><CodiceCIG>CIG222</CodiceCIG></DatiContratto>
      </F>`;
    const r = extractCupsFromXmlFile('multi-cig.xml', xml);
    expect(r.invoiceData?.cig).toBe('CIG111 CIG222');
  });

  it('CodiceCIG vuoto non viene aggiunto al set', () => {
    const xml = `<?xml version="1.0"?>
      <F>
        <CodiceCIG></CodiceCIG>
        <CodiceCIG>CIG111</CodiceCIG>
      </F>`;
    const r = extractCupsFromXmlFile('test.xml', xml);
    expect(r.invoiceData?.cig).toBe('CIG111');
  });

  it('CIG duplicati vengono deduplicati', () => {
    const xml = `<?xml version="1.0"?>
      <F>
        <CodiceCIG>CIG111</CodiceCIG>
        <CodiceCIG>CIG111</CodiceCIG>
      </F>`;
    const r = extractCupsFromXmlFile('dup-cig.xml', xml);
    expect(r.invoiceData?.cig).toBe('CIG111');
  });

  it('campi stringa vuota se i tag non sono presenti', () => {
    const xml = `<?xml version="1.0"?><F><CodiceCUP>G17H03000130001</CodiceCUP></F>`;
    const r = extractCupsFromXmlFile('minimal.xml', xml);
    expect(r.invoiceData).not.toBeNull();
    expect(r.invoiceData?.numero).toBe('');
    expect(r.invoiceData?.cig).toBe('');
  });

  it('restituisce null per invoiceData su XML malformato', () => {
    const r = extractCupsFromXmlFile('bad.xml', 'non xml <<');
    expect(r.invoiceData).toBeNull();
  });
});
