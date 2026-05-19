import type { ParsedFile } from '../types.js';

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
