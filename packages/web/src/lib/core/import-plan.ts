import type { ParsedFile } from '../types.js';
import type { BatchInputRow } from './validation-worker.js';
import { parseFile } from './parser.js';

export interface ImportSource {
  id: string;
  file: File;
  fileName: string;
  sheetName?: string;
  parsed: ParsedFile;
  headerPresent: boolean;
  selectedColumnIndexes: number[];
  included: boolean;
}

export interface ImportedCupRow {
  value: string;
  row: number;
  fileOrigine: string;
  schedaOrigine?: string;
  colonnaOrigine: string;
  sourceRowNumber: number;
}

export interface BuildImportedCupRowsOptions {
  skipMissingCup?: boolean;
}

export async function createImportSources(files: File[]): Promise<ImportSource[]> {
  const sources = await Promise.all(
    files.map(async (file, index) => {
      const parsed = await parseFile(file);
      return createImportSource(file, parsed, index);
    }),
  );

  return sources;
}

export async function updateSourceSheet(
  source: ImportSource,
  sheetName: string,
): Promise<ImportSource> {
  if (!source.parsed.sheetNames?.includes(sheetName)) return source;

  const parsed = await parseFile(source.file, { sheetName });
  return {
    ...source,
    id: source.id,
    sheetName: parsed.selectedSheetName,
    parsed,
    headerPresent: parsed.headerPresent,
    selectedColumnIndexes: [parsed.suggestedColumnIndex],
  };
}

export function buildImportedCupRows(
  sources: ImportSource[],
  { skipMissingCup = true }: BuildImportedCupRowsOptions = {},
): ImportedCupRow[] {
  const importedRows: ImportedCupRow[] = [];

  for (const source of sources) {
    if (!source.included) continue;

    for (const row of source.parsed.rows) {
      for (const columnIndex of source.selectedColumnIndexes) {
        const value = String(row.cells[columnIndex] ?? '');
        if (skipMissingCup && value.trim() === '') continue;

        importedRows.push({
          value,
          row: importedRows.length + 1,
          fileOrigine: source.fileName,
          ...(source.sheetName ? { schedaOrigine: source.sheetName } : {}),
          colonnaOrigine: columnLabel(source.parsed, columnIndex),
          sourceRowNumber: row.originalRowNumber,
        });
      }
    }
  }

  return importedRows;
}

export function buildBatchRows(importedRows: ImportedCupRow[]): BatchInputRow[] {
  return importedRows.map((row) => ({
    value: row.value,
    row: row.row,
  }));
}

function createImportSource(file: File, parsed: ParsedFile, index: number): ImportSource {
  return {
    id: sourceId(file.name, parsed.selectedSheetName, index),
    file,
    fileName: file.name,
    ...(parsed.selectedSheetName ? { sheetName: parsed.selectedSheetName } : {}),
    parsed,
    headerPresent: parsed.headerPresent,
    selectedColumnIndexes: [parsed.suggestedColumnIndex],
    included: true,
  };
}

function sourceId(fileName: string, sheetName: string | undefined, index: number): string {
  const suffix = sheetName ? `:${sheetName}` : '';
  return `${index}:${fileName}${suffix}`;
}

function columnLabel(parsed: ParsedFile, columnIndex: number): string {
  const header = parsed.headers[columnIndex];
  return header && header.trim() ? header : `Colonna ${columnIndex + 1}`;
}
