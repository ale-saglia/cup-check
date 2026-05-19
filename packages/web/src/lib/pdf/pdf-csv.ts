import type { Entry } from '../types.js';

function safeCell(s: string): string {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function csvComma(value: unknown): string {
  const s = String(value ?? '');
  if (/[,"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return safeCell(s);
}

function csvSemi(value: unknown): string {
  const s = String(value ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return safeCell(s);
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
  const rows = ['cup;file_origine;formato_valido;fonte;manuale'];
  for (const entry of completedEntries(entries)) {
    for (const cup of entry.cups) {
      rows.push(
        [cup.value, entry.name, cup.formalValid ? 'SI' : 'NO', cup.source ?? '', cup.manual ? 'SI' : 'NO']
          .map(csvSemi)
          .join(';'),
      );
    }
  }
  return '﻿' + rows.join('\n');
}
