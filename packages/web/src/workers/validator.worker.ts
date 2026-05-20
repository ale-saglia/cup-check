import type { Outcome, UniqueResult } from '../lib/types.js';
import { uniqueResultsByCup } from '../lib/core/results.js';
import { OUTCOMES, validateCup } from '../lib/core/validator.js';
import type { BatchInputRow, BatchProgress } from '../lib/core/validation-worker.js';

type StartMessage = {
  type: 'start';
  rows: BatchInputRow[];
  currentYear?: number;
  lookup: boolean;
  chunkSize: number;
  lookupTimeoutMs?: number;
};

type LookupResultMessage = {
  type: 'lookup-result';
  requestId: number;
  foundCups: string[];
};

type IncomingMessage = StartMessage | LookupResultMessage;

type WorkerCtx = {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
};

const ctx = self as unknown as WorkerCtx;
const DEFAULT_LOOKUP_TIMEOUT_MS = 30_000;
const lookupResolvers = new Map<
  number,
  { resolve: (foundCups: Set<string>) => void; timeoutId: ReturnType<typeof setTimeout> }
>();
let nextLookupRequestId = 1;

ctx.onmessage = (event) => {
  const message = event.data;

  if (message.type === 'lookup-result') {
    const pendingLookup = lookupResolvers.get(message.requestId);
    lookupResolvers.delete(message.requestId);
    if (pendingLookup) {
      clearTimeout(pendingLookup.timeoutId);
      pendingLookup.resolve(new Set(message.foundCups));
    }
    return;
  }

  void runBatch(message).catch((error: unknown) => {
    ctx.postMessage({
      type: 'error',
      /* v8 ignore next -- Promise rejections from this worker are Error instances in practice. */
      ...(error instanceof Error
        ? { message: error.message }
        : { messageKey: 'error.validationWorkerFailed' }),
    });
  });
};

async function runBatch(message: StartMessage) {
  const startedAt = performance.now();
  const {
    rows,
    currentYear,
    lookup,
    chunkSize,
    lookupTimeoutMs = DEFAULT_LOOKUP_TIMEOUT_MS,
  } = message;
  const raw = [];

  postProgress('validate', 0, rows.length);
  for (let index = 0; index < rows.length; index += chunkSize) {
    for (const row of rows.slice(index, index + chunkSize)) {
      raw.push(validateCup(row.value, row.row, { currentYear }));
    }
    postProgress('validate', Math.min(index + chunkSize, rows.length), rows.length);
    await yieldToEventLoop();
  }

  const unique = uniqueResultsByCup(raw);
  const checked = lookup ? await applyLookup(unique, chunkSize, lookupTimeoutMs) : unique;

  for (let index = 0; index < checked.length; index += chunkSize) {
    ctx.postMessage({ type: 'result-chunk', results: checked.slice(index, index + chunkSize) });
  }

  ctx.postMessage({ type: 'complete', durationMs: performance.now() - startedAt });
}

async function applyLookup(
  results: UniqueResult[],
  chunkSize: number,
  lookupTimeoutMs: number,
): Promise<UniqueResult[]> {
  const checked: UniqueResult[] = [];
  postProgress('lookup', 0, results.length);

  for (let index = 0; index < results.length; index += chunkSize) {
    const chunk = results.slice(index, index + chunkSize);
    const cups = chunk
      .filter((result) => result.outcome === OUTCOMES.CHECK)
      .map((result) => result.normalizedValue);
    const foundCups =
      cups.length > 0 ? await requestLookup(cups, lookupTimeoutMs) : new Set<string>();

    checked.push(
      ...chunk.map((result) => {
        if (result.outcome !== OUTCOMES.CHECK) return result;
        return {
          ...result,
          outcome: foundCups.has(result.normalizedValue)
            ? OUTCOMES.FOUND_OPENCUP
            : OUTCOMES.NOT_FOUND_OPENCUP,
        } satisfies UniqueResult & { outcome: Outcome };
      }),
    );
    postProgress('lookup', Math.min(index + chunkSize, results.length), results.length);
    await yieldToEventLoop();
  }

  return checked;
}

function requestLookup(cups: string[], timeoutMs: number): Promise<Set<string>> {
  const requestId = nextLookupRequestId;
  nextLookupRequestId += 1;
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      lookupResolvers.delete(requestId);
      resolve(new Set<string>());
    }, timeoutMs);
    lookupResolvers.set(requestId, { resolve, timeoutId });
    ctx.postMessage({ type: 'lookup-request', requestId, cups });
  });
}

function postProgress(phase: BatchProgress['phase'], processed: number, total: number) {
  ctx.postMessage({
    type: 'progress',
    progress: {
      phase,
      processed,
      total,
      percent: total === 0 ? 100 : Math.floor((processed / total) * 100),
    } satisfies BatchProgress,
  });
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
