import Papa from 'papaparse';
import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import type { ParsedFile, ParsedRow } from '../types.js';

const SUPPORTED_CSV_TYPES = ['text/csv', 'application/vnd.ms-excel'];

export async function parseFile(file: File, options: { sheetName?: string } = {}): Promise<ParsedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx') {
    return parseXlsx(file, options.sheetName);
  }

  if (extension === 'csv' || SUPPORTED_CSV_TYPES.includes(file.type)) {
    return parseCsv(file);
  }

  throw new Error('Formato non supportato. Carica un file CSV o XLSX.');
}

export function detectCupColumn(headers: string[]): number {
  const index = headers.findIndex((header) => String(header).toLowerCase().includes('cup'));
  return index === -1 ? 0 : index;
}

export function hasHeader(row: string[]): boolean {
  return row.some((cell) => {
    const value = String(cell ?? '').trim();
    return value !== '' && !/^[A-Za-z0-9]{15}$/.test(value);
  });
}

export function buildParsedRows(rawRows: string[][], headerPresent: boolean): ParsedFile {
  const firstRow = rawRows[0] ?? [];
  const headers = headerPresent ? firstRow : firstRow.map((_, index) => `Colonna ${index + 1}`);
  const dataRows = headerPresent ? rawRows.slice(1) : rawRows;

  return {
    rawRows,
    headers,
    rows: dataRows.map((cells, index): ParsedRow => ({
      originalRowNumber: headerPresent ? index + 2 : index + 1,
      cells,
    })),
    headerPresent,
    headerDetectedAutomatically: hasHeader(firstRow),
    suggestedColumnIndex: detectCupColumn(headers),
  };
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      // Preserve empty rows so row numbers in validation results match the original file.
      skipEmptyLines: false,
      complete: (result) => resolve(normalizeRows(result.data)),
      error: reject,
    });
  });
}

async function parseXlsx(file: File, sheetName?: string): Promise<ParsedFile> {
  const sheets = await readXlsxFile(file);
  const sheetNames = sheets.map((s) => s.sheet);
  const selectedSheetName = sheetName ?? sheetNames[0];
  const rows = await readSheet(file, selectedSheetName);
  return normalizeRows(rows as string[][], { sheetNames, selectedSheetName });
}

function normalizeRows(
  rawRows: string[][],
  metadata: Partial<Pick<ParsedFile, 'sheetNames' | 'selectedSheetName'>> = {},
): ParsedFile {
  const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '')));
  return {
    ...buildParsedRows(rows, hasHeader(rows[0] ?? [])),
    ...metadata,
  };
}
