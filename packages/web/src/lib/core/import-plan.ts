import type { ParsedFile } from '../types.js';
import type { BatchInputRow } from './validation-worker.js';
import { buildParsedRows, parseFile } from './parser.js';

export interface ImportSource {
  id: string;
  file: File;
  fileName: string;
  sheetName?: string;
  parsed: ParsedFile;
  headerPresent: boolean;
  selectedColumnIndexes: number[];
  included: boolean;
  skipMissingCup: boolean;
}

export interface ImportedCupRow {
  value: string;
  row: number;
  fileOrigine: string;
  schedaOrigine?: string;
  colonnaOrigine: string;
  sourceRowNumber: number;
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
    selectedColumnIndexes: parsed.headers.length > 0 ? [parsed.suggestedColumnIndex] : [],
    included: parsed.headers.length > 0,
  };
}

export async function createSourceFromSheet(
  source: ImportSource,
  sheetName: string,
  index: number,
): Promise<ImportSource> {
  if (!source.parsed.sheetNames?.includes(sheetName)) return source;

  const parsed = await parseFile(source.file, { sheetName });
  return createImportSource(source.file, parsed, index);
}

export function updateSourceHeader(source: ImportSource, headerPresent: boolean): ImportSource {
  const parsed = buildParsedRows(source.parsed.rawRows, headerPresent) as ParsedFile;
  return {
    ...source,
    parsed: {
      ...parsed,
      ...(source.parsed.sheetNames ? { sheetNames: source.parsed.sheetNames } : {}),
      ...(source.sheetName ? { selectedSheetName: source.sheetName } : {}),
    },
    headerPresent,
    selectedColumnIndexes: parsed.headers.length > 0 ? [parsed.suggestedColumnIndex] : [],
    included: parsed.headers.length > 0 ? source.included : false,
  };
}

export function updateSourceColumn(source: ImportSource, columnIndex: number): ImportSource {
  if (source.parsed.headers.length === 0) {
    return {
      ...source,
      selectedColumnIndexes: [],
      included: false,
    };
  }

  const safeIndex = Math.max(0, Math.min(columnIndex, source.parsed.headers.length - 1));
  return {
    ...source,
    selectedColumnIndexes: [safeIndex],
  };
}

export function updateSourceIncluded(source: ImportSource, included: boolean): ImportSource {
  return {
    ...source,
    included: source.parsed.headers.length > 0 ? included : false,
  };
}

export function updateSourceSkipMissingCup(
  source: ImportSource,
  skipMissingCup: boolean,
): ImportSource {
  return {
    ...source,
    skipMissingCup,
  };
}

export function buildImportedCupRows(sources: ImportSource[]): ImportedCupRow[] {
  const importedRows: ImportedCupRow[] = [];
  const importedSourceColumns = new Set<string>();
  const fileIds = new Map<File, number>();

  for (const source of sources) {
    if (!source.included) continue;

    for (const columnIndex of source.selectedColumnIndexes) {
      const sourceColumnKey = importSourceColumnKey(source, columnIndex, fileIds);
      if (importedSourceColumns.has(sourceColumnKey)) continue;
      importedSourceColumns.add(sourceColumnKey);

      for (const row of source.parsed.rows) {
        const value = String(row.cells[columnIndex] ?? '');
        if (source.skipMissingCup && value.trim() === '') continue;

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

function importSourceColumnKey(
  source: ImportSource,
  columnIndex: number,
  fileIds: Map<File, number>,
): string {
  let fileId = fileIds.get(source.file);
  if (fileId === undefined) {
    fileId = fileIds.size;
    fileIds.set(source.file, fileId);
  }

  return [fileId, source.sheetName ?? '', source.headerPresent ? 'header' : 'data', columnIndex].join('\0');
}

function createImportSource(file: File, parsed: ParsedFile, index: number): ImportSource {
  return {
    id: sourceId(file.name, parsed.selectedSheetName, index),
    file,
    fileName: file.name,
    ...(parsed.selectedSheetName ? { sheetName: parsed.selectedSheetName } : {}),
    parsed,
    headerPresent: parsed.headerPresent,
    selectedColumnIndexes: parsed.headers.length > 0 ? [parsed.suggestedColumnIndex] : [],
    included: parsed.headers.length > 0,
    skipMissingCup: true,
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
