import type { MessageKey } from '../../i18n/i18n.svelte.js';
import type { BatchProgress } from './validation-worker.js';
import type { ImportedCupRow } from './import-plan.js';
import type { UniqueResult } from '../types.js';
import { resultRowsLabel } from './results.js';

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;
type ResultSource = Pick<UniqueResult, 'inputRows' | 'inputRow'>;
type SourceGroup = { key: string; fileName: string; sheetName?: string; rows: ImportedCupRow[] };

export function batchProgressLabel(
  batchProgress: BatchProgress | null,
  batchUsedWorker: boolean,
  t: Translate,
): string {
  if (!batchProgress) return '';
  if (batchProgress.phase === 'lookup') return t('validator.progressLookup');
  if (batchProgress.phase === 'complete') return '';
  return batchUsedWorker ? t('validator.progressWorker') : t('validator.progressInline');
}

export function originRowsForResult(
  result: ResultSource,
  importedRowsByRow: Map<number, ImportedCupRow>,
  hasImportedRows: boolean,
): ImportedCupRow[] {
  if (!hasImportedRows) return [];
  const rowNums = result.inputRows ?? [result.inputRow];
  return rowNums
    .map((n) => (n !== null ? importedRowsByRow.get(n) : undefined))
    .filter((row): row is ImportedCupRow => row !== undefined);
}

export function sourceRowsForResult(
  result: ResultSource,
  importedRowsByRow: Map<number, ImportedCupRow>,
  hasImportedRows: boolean,
): string[] {
  const originRows = originRowsForResult(result, importedRowsByRow, hasImportedRows);
  if (originRows.length === 0) {
    return (result.inputRows ?? [result.inputRow]).map((row) => String(row ?? ''));
  }

  return originRows.map((row) => String(row.sourceRowNumber));
}

export function sourceButtonLabel(
  result: ResultSource,
  importedRowsByRow: Map<number, ImportedCupRow>,
  hasImportedRows: boolean,
): string {
  const rows = sourceRowsForResult(result, importedRowsByRow, hasImportedRows);
  if (rows.length <= 1) return rows[0] ?? '-';
  return `${rows[0]}++`;
}

export function sourceSummary(
  result: ResultSource,
  importedRowsByRow: Map<number, ImportedCupRow>,
  hasImportedRows: boolean,
  t: Translate,
): string {
  const originRows = originRowsForResult(result, importedRowsByRow, hasImportedRows);
  if (originRows.length === 0) return resultRowsLabel(result);

  return originRows
    .map((row) => {
      if (row.schedaOrigine) {
        return t('validator.sourceSummarySheet', {
          row: row.sourceRowNumber,
          file: row.fileOrigine,
          sheet: row.schedaOrigine,
          column: row.colonnaOrigine,
        });
      }
      return t('validator.sourceSummaryNoSheet', {
        row: row.sourceRowNumber,
        file: row.fileOrigine,
        column: row.colonnaOrigine,
      });
    })
    .join(' ');
}

export function sourceDetailTable(
  result: ResultSource,
  importedRowsByRow: Map<number, ImportedCupRow>,
  hasImportedRows: boolean,
  t: Translate,
): { columns: string[]; rows: { label: string; values: string[] }[] } {
  const originRows = originRowsForResult(result, importedRowsByRow, hasImportedRows);

  if (originRows.length === 0) {
    const sourceRows = sourceRowsForResult(result, importedRowsByRow, hasImportedRows);
    return {
      columns: ['-'],
      rows: [
        { label: t('validator.sheet'), values: ['-'] },
        { label: t('validator.column'), values: ['-'] },
        {
          label: sourceRows.length === 1 ? t('validator.row') : t('validator.rowPlural'),
          values: [sourceRows.join(', ')],
        },
      ],
    };
  }

  const groups = sourceGroups(originRows);
  const sourceRows = sourceRowsForResult(result, importedRowsByRow, hasImportedRows);

  return {
    columns: groups.map((group) => group.fileName),
    rows: [
      { label: t('validator.sheet'), values: groups.map((group) => group.sheetName ?? '-') },
      {
        label: t('validator.column'),
        values: groups.map((group) =>
          uniqueSourceValues(group.rows.map((row) => row.colonnaOrigine)),
        ),
      },
      {
        label: sourceRows.length === 1 ? t('validator.row') : t('validator.rowPlural'),
        values: groups.map((group) =>
          uniqueSourceValues(group.rows.map((row) => String(row.sourceRowNumber))),
        ),
      },
    ],
  };
}

export function sourceGroups(originRows: ImportedCupRow[]): SourceGroup[] {
  const groupsByKey = new Map<string, SourceGroup>();

  for (const row of originRows) {
    const key = `${row.fileOrigine}\u0000${row.schedaOrigine ?? ''}`;
    let existing = groupsByKey.get(key);
    if (!existing) {
      existing = {
        key,
        fileName: row.fileOrigine,
        ...(row.schedaOrigine ? { sheetName: row.schedaOrigine } : {}),
        rows: [],
      };
      groupsByKey.set(key, existing);
    }
    existing.rows.push(row);
  }

  return [...groupsByKey.values()];
}

export function uniqueSourceValues(values: Array<string | undefined>): string {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];
  return unique.length > 0 ? unique.join(', ') : '-';
}
