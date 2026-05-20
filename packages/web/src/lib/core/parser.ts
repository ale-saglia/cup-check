import Papa from 'papaparse';
import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import type { ParsedFile, ParsedRow } from '../types.js';

const SUPPORTED_CSV_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const CSV_DELIMITERS_TO_GUESS = [',', ';', '\t', '|'];

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
  const buffer = await file.arrayBuffer();
  const utf8Text = decodeCsv(buffer, 'utf-8');
  const utf8Rows = await parseCsvText(utf8Text);

  if (!shouldRetryWithWindows1252(file, utf8Text, utf8Rows)) return normalizeRows(utf8Rows);

  const windows1252Text = decodeCsv(buffer, 'windows-1252');
  const windows1252Rows = await parseCsvText(windows1252Text);
  return normalizeRows(windows1252Rows);
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

function decodeCsv(buffer: ArrayBuffer, encoding: 'utf-8' | 'windows-1252'): string {
  return new TextDecoder(encoding, { fatal: false }).decode(buffer).replace(/^\uFEFF/, '');
}

function parseCsvText(text: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      delimiter: '',
      delimitersToGuess: CSV_DELIMITERS_TO_GUESS,
      // Preserve empty rows so row numbers in validation results match the original file.
      skipEmptyLines: false,
      complete: (result) => resolve(result.data),
      error: reject,
    });
  });
}

function shouldRetryWithWindows1252(file: File, text: string, rows: string[][]): boolean {
  return hasReplacementCharacterInPreview(text) || (file.size > 1024 && parsesAsSingleColumn(rows));
}

function hasReplacementCharacterInPreview(text: string): boolean {
  return text.split(/\r\n|\n|\r/, 5).some((line) => line.includes('\uFFFD'));
}

function parsesAsSingleColumn(rows: string[][]): boolean {
  const meaningfulRows = rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  return meaningfulRows.length > 0 && meaningfulRows.every((row) => row.length <= 1);
}
