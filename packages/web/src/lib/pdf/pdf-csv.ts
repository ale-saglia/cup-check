import type { Entry } from '../types.js';
import { isFormallyValid } from '../core/cup.js';
import { csvCell } from '../core/csv.js';

function completedEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.status === 'done' || e.status === 'error');
}

export function buildVerificatoreCsv(entries: Entry[]): string {
  const rows = ['cup,file_origine'];
  for (const entry of completedEntries(entries)) {
    for (const cup of entry.cups) {
      rows.push([cup.value, entry.name].map((value) => csvCell(value, ',')).join(','));
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
    ].map((value) => csvCell(value, ';'));

    if (entry.cups.length === 0) {
      if (entry.status === 'done') {
        rows.push(
          ['', entry.name, '', '', '']
            .map((value) => csvCell(value, ';'))
            .concat(invCells)
            .join(';'),
        );
      }
    } else {
      for (const cup of entry.cups) {
        rows.push(
          [
            cup.value,
            entry.name,
            isFormallyValid(cup) ? 'SI' : 'NO',
            cup.source ?? '',
            cup.manual ? 'SI' : 'NO',
          ]
            .map((value) => csvCell(value, ';'))
            .concat(invCells)
            .join(';'),
        );
      }
    }
  }
  return '﻿' + rows.join('\n');
}
