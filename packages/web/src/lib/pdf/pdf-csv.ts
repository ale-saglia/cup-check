import type { Entry } from '../types.js';

function safeCell(s: string): string {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function csvComma(value: string): string {
  const s = safeCell(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function csvSemi(value: string): string {
  const s = safeCell(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function completedEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.status === 'done' || e.status === 'error');
}

export function buildVerificatoreCsv(entries: Entry[]): string {
  const rows = ['cup,file_origine'];
  for (const entry of completedEntries(entries)) {
    for (const cup of entry.cups) {
      rows.push(`${csvComma(cup.value)},${csvComma(entry.name)}`);
    }
  }
  return '﻿' + rows.join('\n');
}

export function buildExportCsv(entries: Entry[]): string {
  const rows = [
    'cup;file_origine;formato_valido;fonte;manuale;data_fattura;numero_fattura;importo_totale;causale;piva_fornitore;nome_fornitore;cig',
  ];
  for (const entry of completedEntries(entries)) {
    const inv = entry.invoiceData;
    const invCells = [
      inv?.data ?? '',
      inv?.numero ?? '',
      (inv?.importoTotale ?? '').replace('.', ','),
      inv?.causale ?? '',
      inv?.pivaFornitore ?? '',
      inv?.nomeFornitore ?? '',
      inv?.cig ?? '',
    ].map(csvSemi);

    if (entry.cups.length === 0) {
      if (entry.status === 'done') {
        rows.push(['', entry.name, '', '', ''].map(csvSemi).concat(invCells).join(';'));
      }
    } else {
      for (const cup of entry.cups) {
        rows.push(
          [cup.value, entry.name, cup.formalValid ? 'SI' : 'NO', cup.source ?? '', cup.manual ? 'SI' : 'NO']
            .map(csvSemi)
            .concat(invCells)
            .join(';'),
        );
      }
    }
  }
  return '﻿' + rows.join('\n');
}
