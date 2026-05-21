import Papa from 'papaparse';
import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import type { ParsedFile, ParsedRow } from '../types.js';
import { LocalizedError } from './errors.js';

const SUPPORTED_CSV_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const CSV_DELIMITERS_TO_GUESS = [',', ';', '\t', '|'];

export type ColumnLabelFormatter = (index: number) => string;

interface ParseOptions {
  sheetName?: string;
  columnLabel?: ColumnLabelFormatter;
}

export async function parseFile(file: File, options: ParseOptions = {}): Promise<ParsedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx') {
    return parseXlsx(file, options);
  }

  if (extension === 'csv' || SUPPORTED_CSV_TYPES.includes(file.type)) {
    return parseCsv(file, options.columnLabel);
  }

  throw new LocalizedError('error.unsupportedFile');
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

export function buildParsedRows(
  rawRows: string[][],
  headerPresent: boolean,
  columnLabel: ColumnLabelFormatter = defaultColumnLabel,
): ParsedFile {
  const firstRow = rawRows[0] ?? [];
  const headers = headerPresent ? firstRow : firstRow.map((_, index) => columnLabel(index));
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

async function parseCsv(file: File, columnLabel?: ColumnLabelFormatter): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const utf8Text = decodeCsv(buffer, 'utf-8');
  const utf8Rows = await parseCsvText(utf8Text);

  if (!shouldRetryWithWindows1252(file, buffer, utf8Text, utf8Rows)) {
    return normalizeRows(utf8Rows, {}, columnLabel);
  }

  const windows1252Text = decodeCsv(buffer, 'windows-1252');
  const windows1252Rows = await parseCsvText(windows1252Text);
  return normalizeRows(windows1252Rows, {}, columnLabel);
}

async function parseXlsx(file: File, options: ParseOptions): Promise<ParsedFile> {
  const sheets = await readXlsxFile(file);
  const sheetNames = sheets.map((s) => s.sheet);
  const selectedSheetName = options.sheetName ?? sheetNames[0];
  const rows = await readSheet(file, selectedSheetName);
  return normalizeRows(rows as string[][], { sheetNames, selectedSheetName }, options.columnLabel);
}

function normalizeRows(
  rawRows: string[][],
  metadata: Partial<Pick<ParsedFile, 'sheetNames' | 'selectedSheetName'>> = {},
  columnLabel: ColumnLabelFormatter = defaultColumnLabel,
): ParsedFile {
  const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '')));
  return {
    ...buildParsedRows(rows, hasHeader(rows[0] ?? []), columnLabel),
    ...metadata,
  };
}

function defaultColumnLabel(index: number): string {
  return `Column ${index + 1}`;
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

function shouldRetryWithWindows1252(
  file: File,
  buffer: ArrayBuffer,
  text: string,
  rows: string[][],
): boolean {
  if (hasReplacementCharacterInPreview(text)) return true;
  return (
    file.size > 1024 &&
    hasNonAsciiByte(buffer) &&
    !hasValidUtf8Encoding(buffer) &&
    parsesAsSingleColumn(rows)
  );
}

function hasReplacementCharacterInPreview(text: string): boolean {
  return text.split(/\r\n|\n|\r/, 5).some((line) => line.includes('\uFFFD'));
}

function parsesAsSingleColumn(rows: string[][]): boolean {
  const meaningfulRows = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
  return meaningfulRows.length > 0 && meaningfulRows.every((row) => row.length <= 1);
}

function hasNonAsciiByte(buffer: ArrayBuffer): boolean {
  return new Uint8Array(buffer).some((byte) => byte > 0x7f);
}

function hasValidUtf8Encoding(buffer: ArrayBuffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}
