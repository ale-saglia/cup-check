import { validateCup, isStructurallyPlausible, OUTCOMES } from '../core/validator.js';
import { extractCupsFromText, type CupCandidate } from '../pdf/extract-cups.js';
import type { InvoiceData } from '../types.js';

function addCup(counts: Map<string, number>, raw: string): void {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!isStructurallyPlausible(value, { yearLookahead: 15 })) return;
  if (validateCup(value).outcome === OUTCOMES.INVALID) return;
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function extractCupsFromDoc(doc: Document): CupCandidate[] {
  const counts = new Map<string, number>();

  // Campi espliciti CodiceCUP presenti in DatiOrdineAcquisto, DatiContratto,
  // DatiConvenzione, DatiRicezione, DatiFattureCollegate secondo lo schema FatturaPA.
  for (const el of doc.querySelectorAll('CodiceCUP')) {
    if (el.textContent) addCup(counts, el.textContent);
  }

  // AltriDatiGestionali con TipoDato che contiene "CUP".
  for (const el of doc.querySelectorAll('AltriDatiGestionali')) {
    const tipo = el.querySelector('TipoDato')?.textContent?.trim().toUpperCase() ?? '';
    if (tipo.includes('CUP')) {
      const testo = el.querySelector('RiferimentoTesto')?.textContent;
      if (testo) addCup(counts, testo);
    }
  }

  // Fallback: testo libero in Causale e Descrizione.
  const textParts: string[] = [];
  for (const el of doc.querySelectorAll('Causale, Descrizione')) {
    if (el.textContent) textParts.push(el.textContent);
  }
  if (textParts.length > 0) {
    for (const candidate of extractCupsFromText(textParts.join('\n'))) {
      if (candidate.formalValid && !counts.has(candidate.value)) {
        counts.set(candidate.value, candidate.occurrences);
      }
    }
  }

  return Array.from(counts.entries()).map(([value, occurrences]) => ({
    value,
    occurrences,
    formalValid: true,
  }));
}

function extractInvoiceData(doc: Document): InvoiceData {
  const q = (sel: string) => doc.querySelector(sel)?.textContent?.trim() ?? '';

  const cigs = new Set<string>();
  for (const el of doc.querySelectorAll('CodiceCIG')) {
    const v = el.textContent?.trim();
    if (v) cigs.add(v);
  }

  const denominazione = q('CedentePrestatore Anagrafica > Denominazione');
  const nomeFornitore =
    denominazione ||
    [q('CedentePrestatore Anagrafica > Nome'), q('CedentePrestatore Anagrafica > Cognome')]
      .filter(Boolean)
      .join(' ');

  return {
    data: q('DatiGeneraliDocumento > Data'),
    numero: q('DatiGeneraliDocumento > Numero'),
    importoTotale: q('DatiGeneraliDocumento > ImportoTotaleDocumento'),
    causale: q('DatiGeneraliDocumento > Causale'),
    pivaFornitore: q('CedentePrestatore IdFiscaleIVA > IdCodice'),
    nomeFornitore,
    cig: [...cigs].join(' '),
  };
}

export function extractCupsFromXml(xmlText: string): CupCandidate[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  return extractCupsFromDoc(doc);
}

export function extractCupsFromXmlFile(
  fileName: string,
  xmlText: string,
): { fileName: string; status: 'ok' | 'no_cup'; cups: CupCandidate[]; invoiceData: InvoiceData | null } {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return { fileName, status: 'no_cup', cups: [], invoiceData: null };
  }
  const cups = extractCupsFromDoc(doc);
  const invoiceData = extractInvoiceData(doc);
  return { fileName, status: cups.length > 0 ? 'ok' : 'no_cup', cups, invoiceData };
}
