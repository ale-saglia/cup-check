import { validateCup, isStructurallyPlausible, OUTCOMES } from '../core/validator.js';
import { extractCupsFromText, type CupCandidate } from '../pdf/extract-cups.js';

function addCup(counts: Map<string, number>, raw: string): void {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!isStructurallyPlausible(value, { yearLookahead: 15 })) return;
  if (validateCup(value).outcome === OUTCOMES.INVALID) return;
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

export function extractCupsFromXml(xmlText: string): CupCandidate[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

  if (doc.querySelector('parsererror')) return [];

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

export function extractCupsFromXmlFile(
  fileName: string,
  xmlText: string,
): { fileName: string; status: 'ok' | 'no_cup'; cups: CupCandidate[] } {
  const cups = extractCupsFromXml(xmlText);
  return { fileName, status: cups.length > 0 ? 'ok' : 'no_cup', cups };
}
