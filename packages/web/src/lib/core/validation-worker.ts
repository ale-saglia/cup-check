import type { MessageKey } from '../../i18n/i18n.svelte.js';
import type { Dataset, UniqueResult } from '../types.js';
import { LocalizedError } from './errors.js';
import { applyDatasetLookup, uniqueResultsByCup } from './results.js';
import { OUTCOMES, validateCup } from './validator.js';

const WORKER_THRESHOLD_ROWS = 100_000;
const DEFAULT_CHUNK_SIZE = 2_000;

export interface BatchInputRow {
  value: string;
  row: number | null;
}

export interface BatchProgress {
  phase: 'validate' | 'lookup' | 'complete';
  processed: number;
  total: number;
  percent: number;
}

export interface ValidateRowsOptions {
  currentYear?: number;
  dataset?: Dataset | null;
  forceWorker?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: BatchProgress) => void;
  workerFactory?: () => Worker;
  thresholdRows?: number;
  chunkSize?: number;
}

export interface ValidateRowsResult {
  results: UniqueResult[];
  sourceRowCount: number;
  durationMs: number;
  usedWorker: boolean;
}

type WorkerMessage =
  | { type: 'progress'; progress: BatchProgress }
  | { type: 'lookup-request'; requestId: number; cups: string[] }
  | { type: 'result-chunk'; results: UniqueResult[] }
  | { type: 'complete'; durationMs: number }
  | { type: 'error'; message?: string; messageKey?: MessageKey };

export async function validateRows(
  rows: BatchInputRow[],
  options: ValidateRowsOptions = {},
): Promise<ValidateRowsResult> {
  const shouldUseWorker =
    (options.forceWorker ?? rows.length > (options.thresholdRows ?? WORKER_THRESHOLD_ROWS)) &&
    canCreateWorker(options);

  if (!shouldUseWorker) {
    return validateRowsInline(rows, options);
  }

  return validateRowsWithWorker(rows, options);
}

function canCreateWorker(options: ValidateRowsOptions): boolean {
  return typeof options.workerFactory === 'function' || typeof Worker !== 'undefined';
}

async function validateRowsInline(
  rows: BatchInputRow[],
  { currentYear, dataset, onProgress, signal }: ValidateRowsOptions,
): Promise<ValidateRowsResult> {
  const startedAt = performance.now();
  throwIfAborted(signal);
  onProgress?.(makeProgress('validate', 0, rows.length));
  const raw = rows.map((row) => validateCup(row.value, row.row, { currentYear }));
  throwIfAborted(signal);
  onProgress?.(makeProgress('validate', rows.length, rows.length));
  let unique = uniqueResultsByCup(raw);

  if (dataset && unique.some((result) => result.outcome === OUTCOMES.CHECK)) {
    onProgress?.(makeProgress('lookup', 0, unique.length));
    unique = applyDatasetLookup(unique, (cup) => dataset.hasCup(cup)) as UniqueResult[];
    throwIfAborted(signal);
    onProgress?.(makeProgress('lookup', unique.length, unique.length));
  }

  onProgress?.(makeProgress('complete', rows.length, rows.length));
  return {
    results: unique,
    sourceRowCount: rows.length,
    durationMs: performance.now() - startedAt,
    usedWorker: false,
  };
}

function validateRowsWithWorker(
  rows: BatchInputRow[],
  options: ValidateRowsOptions,
): Promise<ValidateRowsResult> {
  const worker =
    options.workerFactory?.() ??
    new Worker(new URL('../../workers/validator.worker.ts', import.meta.url), { type: 'module' });
  const results: UniqueResult[] = [];
  let settled = false;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener('abort', abort);
      worker.onmessage = null;
      worker.onerror = null;
    };

    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      worker.terminate();
      reject(error);
    };

    const abort = () => finishReject(abortError());

    if (options.signal?.aborted) {
      abort();
      return;
    }

    options.signal?.addEventListener('abort', abort, { once: true });

    worker.onerror = (event) => {
      finishReject(event.message ? new Error(event.message) : new LocalizedError('error.validationWorkerFailed'));
    };

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === 'progress') {
        options.onProgress?.(message.progress);
        return;
      }

      if (message.type === 'lookup-request') {
        const foundCups = options.dataset
          ? message.cups.filter((cup) => options.dataset?.hasCup(cup))
          : [];
        worker.postMessage({
          type: 'lookup-result',
          requestId: message.requestId,
          foundCups,
        });
        return;
      }

      if (message.type === 'result-chunk') {
        results.push(...message.results);
        return;
      }

      if (message.type === 'error') {
        finishReject(message.messageKey ? new LocalizedError(message.messageKey) : new Error(message.message));
        return;
      }

      if (message.type === 'complete') {
        /* v8 ignore next -- duplicate terminal worker messages are defensive noise. */
        if (settled) return;
        settled = true;
        options.onProgress?.(makeProgress('complete', rows.length, rows.length));
        cleanup();
        worker.terminate();
        resolve({
          results,
          sourceRowCount: rows.length,
          durationMs: message.durationMs,
          usedWorker: true,
        });
      }
    };

    worker.postMessage({
      type: 'start',
      rows,
      currentYear: options.currentYear,
      lookup: Boolean(options.dataset),
      chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
    });
  });
}

function makeProgress(
  phase: BatchProgress['phase'],
  processed: number,
  total: number,
): BatchProgress {
  return {
    phase,
    processed,
    total,
    percent: total === 0 ? 100 : Math.floor((processed / total) * 100),
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException('error.operationCancelled', 'AbortError');
}
