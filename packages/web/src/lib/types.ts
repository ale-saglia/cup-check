// Shared types for cup-check web — imported by TS/Svelte modules.
// JS modules still use implicit conventions; this file is the authoritative
// source as they are progressively converted.

export type Outcome =
  | 'INVALIDO_FORMATO'
  | 'FORMATO_VALIDO_DA_VERIFICARE'
  | 'TROVATO_OPENCUP'
  | 'NON_TROVATO_OPENCUP_DA_VERIFICARE';

export type Rule = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type Warning = 'N1' | 'N2' | 'N3';

export interface ValidationResult {
  inputRow: number | null;
  rawValue: string;
  normalizedValue: string;
  outcome: Outcome;
  failedRules: Rule[];
  warnings: Warning[];
}

export interface UniqueResult extends ValidationResult {
  inputRows: (number | null)[];
  occurrenceCount: number;
}

export interface ValidationSummary {
  total: number;
  durationMs: number;
  counts: Record<Outcome, number>;
  percentages: Record<Outcome, number>;
}

export interface ParsedRow {
  originalRowNumber: number;
  cells: string[];
}

export interface ParsedFile {
  rawRows: string[][];
  headers: string[];
  rows: ParsedRow[];
  headerPresent: boolean;
  headerDetectedAutomatically: boolean;
  suggestedColumnIndex: number;
  sheetNames?: string[];
  selectedSheetName?: string;
}

export interface DatasetLatestPointer {
  dataset_tag: string;
  manifest_url: string;
  sources_snapshot_date: string;
  released_at: string;
}

export interface DatasetCupIndex {
  base_url: string;
  files: string[];
  files_sha256: string[];
  sha256: string;
  total_size_bytes: number;
}

export interface DatasetManifest {
  schema_version: number;
  schema: { table: string };
  dataset_tag: string;
  cup_index: DatasetCupIndex;
}

export interface Dataset {
  latest: DatasetLatestPointer;
  manifest: DatasetManifest;
  hasCup(cup: string): boolean;
  close(): void;
}

export interface DownloadProgress {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  datasetTag: string;
}

// ── PdfExtract types ──────────────────────────────────────────────────────────

export interface InvoiceData {
  data: string;
  numero: string;
  importoTotale: string;
  causale: string;
  pivaFornitore: string;
  nomeFornitore: string;
  cig: string;
}

export type EntryStatus = 'queued' | 'parsing' | 'ocr' | 'done' | 'error';
export type CupSource = 'text' | 'ocr' | 'xml' | 'manuale';

export interface OcrProgress {
  ocrLoading: boolean;
  page: number;
  totalPages: number;
}

export interface Cup {
  id: string;
  value: string;
  source: CupSource;
  manual: boolean;
  editing: boolean;
}

export interface Entry {
  id: number;
  file: File | null;
  objectUrl: string | null;
  name: string;
  status: EntryStatus;
  source: 'text' | 'ocr' | 'xml' | null;
  cups: Cup[];
  ocrProgress: OcrProgress | null;
  error: string | null;
  invoiceData?: InvoiceData | null;
}
