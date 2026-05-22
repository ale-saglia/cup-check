// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyDatasetLookup, uniqueResultsByCup } from '../src/lib/core/results.js';
import { validateCup } from '../src/lib/core/validator.js';
import { validateRows } from '../src/lib/core/validation-worker.js';

function makeRows(values) {
  return values.map((value, index) => ({ value, row: index + 1 }));
}

function makeDataset(foundCup) {
  return {
    manifest: { dataset_tag: 'test' },
    hasCup: (cup) => cup === foundCup,
    close: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function waitForMessage(messages, type) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const message = messages.find((item) => item.type === type);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`messaggio worker non ricevuto: ${type}`);
}

async function loadRealWorkerScope({ respondToLookup = true } = {}) {
  const messages = [];
  const scope = {
    onmessage: null,
    postMessage(message) {
      messages.push(message);
      if (message.type === 'lookup-request' && respondToLookup) {
        queueMicrotask(() => {
          scope.onmessage?.({
            data: {
              type: 'lookup-result',
              requestId: message.requestId,
              foundCups: ['G17H03000130001'],
            },
          });
        });
      }
    },
  };

  vi.resetModules();
  vi.stubGlobal('self', scope);
  await import('../src/workers/validator.worker.ts');
  return { scope, messages };
}

class UnknownTypeWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      const handler = this.onmessage;
      handler?.({ data: { type: 'unknown-message-type' } });
      handler?.({ data: { type: 'result-chunk', results: [] } });
      handler?.({ data: { type: 'complete', durationMs: 1 } });
    });
  }

  terminate = vi.fn();
}

class DoubleCompleteWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      const handler = this.onmessage;
      handler?.({ data: { type: 'result-chunk', results: [] } });
      handler?.({ data: { type: 'complete', durationMs: 1 } });
      handler?.({ data: { type: 'complete', durationMs: 2 } });
    });
  }

  terminate = vi.fn();
}

class DoubleErrorWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      const handler = this.onmessage;
      handler?.({ data: { type: 'error', message: 'first' } });
      handler?.({ data: { type: 'error', message: 'second' } });
    });
  }

  terminate = vi.fn();
}

class ErrorMessageWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'error', message: 'boom' } });
    });
  }

  terminate = vi.fn();
}

class ErrorEventWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      this.onerror?.({ message: '' });
    });
  }

  terminate = vi.fn();
}

class ErrorEventWithMessageWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      this.onerror?.({ message: 'worker crashed' });
    });
  }

  terminate = vi.fn();
}

class ErrorKeyWorker {
  onmessage = null;
  onerror = null;

  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'error', messageKey: 'error.validationWorkerFailed' } });
    });
  }

  terminate = vi.fn();
}

class FakeValidationWorker {
  onmessage = null;
  onerror = null;
  #pending = null;

  postMessage(message) {
    if (message.type === 'start') {
      const raw = message.rows.map((row) => validateCup(row.value, row.row));
      const unique = uniqueResultsByCup(raw);
      const cups = unique
        .filter((result) => result.outcome === 'FORMATO_VALIDO_DA_VERIFICARE')
        .map((result) => result.normalizedValue);
      this.#pending = unique;
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            type: 'progress',
            progress: {
              phase: 'validate',
              processed: message.rows.length,
              total: message.rows.length,
              percent: 100,
            },
          },
        });
        this.onmessage?.({ data: { type: 'lookup-request', requestId: 1, cups } });
      });
      return;
    }

    if (message.type === 'lookup-result') {
      const found = new Set(message.foundCups);
      const checked = applyDatasetLookup(this.#pending, (cup) => found.has(cup));
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'result-chunk', results: checked } });
        this.onmessage?.({ data: { type: 'complete', durationMs: 12 } });
      });
    }
  }

  terminate = vi.fn();
}

class HangingLookupWorker {
  onmessage = null;
  onerror = null;

  postMessage(message) {
    if (message.type !== 'start') return;
    queueMicrotask(() => {
      this.onmessage?.({
        data: { type: 'lookup-request', requestId: 7, cups: ['G17H03000130001'] },
      });
    });
  }

  terminate = vi.fn();
}

describe('validateRows', () => {
  it('valida in fallback sincrono con lookup OpenCUP', async () => {
    const dataset = makeDataset('G17H03000130001');

    const result = await validateRows(makeRows(['G17H03000130001', 'G17H03000130001', '123']), {
      dataset,
      thresholdRows: Number.POSITIVE_INFINITY,
    });

    expect(result.usedWorker).toBe(false);
    expect(result.sourceRowCount).toBe(3);
    expect(result.results.map((r) => [r.normalizedValue, r.outcome, r.inputRows])).toEqual([
      ['G17H03000130001', 'TROVATO_OPENCUP', [1, 2]],
      ['123', 'INVALIDO_FORMATO', [3]],
    ]);
  });

  it('valida senza dataset e segnala progresso al 100 anche con input vuoto', async () => {
    const progress = vi.fn();

    const result = await validateRows([], {
      thresholdRows: Number.POSITIVE_INFINITY,
      onProgress: progress,
    });

    expect(result.results).toEqual([]);
    expect(result.sourceRowCount).toBe(0);
    expect(progress).toHaveBeenCalledWith({
      phase: 'validate',
      processed: 0,
      total: 0,
      percent: 100,
    });
    expect(progress).toHaveBeenCalledWith({
      phase: 'complete',
      processed: 0,
      total: 0,
      percent: 100,
    });
  });

  it('interrompe il fallback sincrono quando il segnale viene annullato', async () => {
    const controller = new AbortController();

    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        thresholdRows: Number.POSITIVE_INFINITY,
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('interrompe il fallback sincrono dopo il lookup dataset', async () => {
    const controller = new AbortController();
    const dataset = {
      manifest: { dataset_tag: 'test' },
      hasCup: (cup) => {
        controller.abort();
        return cup === 'G17H03000130001';
      },
      close: vi.fn(),
    };

    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        dataset,
        thresholdRows: Number.POSITIVE_INFINITY,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('gestisce il percorso worker e conserva la parita dei risultati', async () => {
    const dataset = makeDataset('G17H03000130001');
    const worker = new FakeValidationWorker();
    const progress = vi.fn();

    const result = await validateRows(makeRows(['G17H03000130001', '123']), {
      dataset,
      forceWorker: true,
      workerFactory: () => worker,
      onProgress: progress,
    });

    expect(result.usedWorker).toBe(true);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'validate', percent: 100 }),
    );
    expect(result.results.map((r) => [r.normalizedValue, r.outcome])).toEqual([
      ['G17H03000130001', 'TROVATO_OPENCUP'],
      ['123', 'INVALIDO_FORMATO'],
    ]);
  });

  it('usa automaticamente il worker oltre 100000 righe', async () => {
    const worker = new FakeValidationWorker();
    const rows = Array.from({ length: 100_001 }, (_, index) => ({
      value: index === 100_000 ? '123' : 'G17H03000130001',
      row: index + 1,
    }));

    const result = await validateRows(rows, {
      workerFactory: () => worker,
    });

    expect(result.usedWorker).toBe(true);
    expect(result.sourceRowCount).toBe(100_001);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(result.results.map((r) => [r.normalizedValue, r.occurrenceCount])).toEqual([
      ['G17H03000130001', 100_000],
      ['123', 1],
    ]);
  });

  it('risponde alle richieste lookup del worker anche senza dataset', async () => {
    const worker = new FakeValidationWorker();

    const result = await validateRows(makeRows(['G17H03000130001']), {
      forceWorker: true,
      workerFactory: () => worker,
    });

    expect(result.usedWorker).toBe(true);
    expect(result.results[0].outcome).toBe('NON_TROVATO_OPENCUP_DA_VERIFICARE');
  });

  it('annulla il worker se il segnale e gia abortito', async () => {
    const controller = new AbortController();
    const worker = new FakeValidationWorker();
    controller.abort();

    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        forceWorker: true,
        workerFactory: () => worker,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('termina il worker se il segnale viene annullato durante una lookup-request', async () => {
    const controller = new AbortController();
    const worker = new HangingLookupWorker();

    const pending = validateRows(makeRows(['G17H03000130001']), {
      dataset: makeDataset('G17H03000130001'),
      forceWorker: true,
      workerFactory: () => worker,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(worker.onmessage).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('crea il worker browser quando non riceve una factory esplicita', async () => {
    vi.stubGlobal('Worker', FakeValidationWorker);

    const result = await validateRows(makeRows(['G17H03000130001']), {
      dataset: makeDataset('G17H03000130001'),
      forceWorker: true,
    });

    expect(result.usedWorker).toBe(true);
    expect(result.results[0].outcome).toBe('TROVATO_OPENCUP');
  });

  it('ignora messaggi terminali duplicati dal worker', async () => {
    const worker = new DoubleCompleteWorker();

    const result = await validateRows(makeRows(['G17H03000130001']), {
      forceWorker: true,
      workerFactory: () => worker,
    });

    expect(result.usedWorker).toBe(true);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('ignora errori duplicati dopo il primo fallimento del worker', async () => {
    const worker = new DoubleErrorWorker();

    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        forceWorker: true,
        workerFactory: () => worker,
      }),
    ).rejects.toThrow('first');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('propaga errori inviati dal worker', async () => {
    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        forceWorker: true,
        workerFactory: () => new ErrorMessageWorker(),
      }),
    ).rejects.toThrow('boom');
  });

  it('propaga errori runtime del worker con chiave di fallback traducibile', async () => {
    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        forceWorker: true,
        workerFactory: () => new ErrorEventWorker(),
      }),
    ).rejects.toMatchObject({
      name: 'LocalizedError',
      key: 'error.validationWorkerFailed',
    });
  });

  it('propaga errori runtime del worker come Error quando onerror ha un messaggio', async () => {
    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        forceWorker: true,
        workerFactory: () => new ErrorEventWithMessageWorker(),
      }),
    ).rejects.toThrow('worker crashed');
  });

  it('propaga errori worker con messageKey come LocalizedError', async () => {
    await expect(
      validateRows(makeRows(['G17H03000130001']), {
        forceWorker: true,
        workerFactory: () => new ErrorKeyWorker(),
      }),
    ).rejects.toMatchObject({
      name: 'LocalizedError',
      key: 'error.validationWorkerFailed',
    });
  });

  it('ignora messaggi di tipo sconosciuto dal worker', async () => {
    const result = await validateRows(makeRows(['G17H03000130001']), {
      forceWorker: true,
      workerFactory: () => new UnknownTypeWorker(),
    });
    expect(result.usedWorker).toBe(true);
  });
});

describe('validator.worker', () => {
  it('valida a chunk e applica il lookup OpenCUP richiesto al main thread', async () => {
    const { scope, messages } = await loadRealWorkerScope();

    scope.onmessage?.({
      data: {
        type: 'start',
        rows: makeRows(['G17H03000130001', '123']),
        lookup: true,
        chunkSize: 1,
      },
    });

    await waitForMessage(messages, 'complete');

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'progress',
          progress: expect.objectContaining({ phase: 'validate' }),
        }),
        expect.objectContaining({
          type: 'progress',
          progress: expect.objectContaining({ phase: 'lookup' }),
        }),
        expect.objectContaining({ type: 'lookup-request', cups: ['G17H03000130001'] }),
      ]),
    );
    const workerResults = messages
      .filter((message) => message.type === 'result-chunk')
      .flatMap((message) => message.results);
    expect(workerResults.map((result) => [result.normalizedValue, result.outcome])).toEqual([
      ['G17H03000130001', 'TROVATO_OPENCUP'],
      ['123', 'INVALIDO_FORMATO'],
    ]);
  });

  it('completa il lookup senza richieste quando non ci sono CUP formalmente validi', async () => {
    const { scope, messages } = await loadRealWorkerScope();

    scope.onmessage?.({
      data: {
        type: 'start',
        rows: makeRows(['123']),
        lookup: true,
        chunkSize: 1,
      },
    });

    await waitForMessage(messages, 'complete');

    expect(messages.some((message) => message.type === 'lookup-request')).toBe(false);
    const resultChunk = messages.find((message) => message.type === 'result-chunk');
    expect(resultChunk.results[0].outcome).toBe('INVALIDO_FORMATO');
  });

  it('non resta appeso se il main thread non risponde al lookup', async () => {
    const { scope, messages } = await loadRealWorkerScope({ respondToLookup: false });

    scope.onmessage?.({
      data: {
        type: 'start',
        rows: makeRows(['G17H03000130001']),
        lookup: true,
        chunkSize: 1,
        lookupTimeoutMs: 1,
      },
    });

    await waitForMessage(messages, 'complete');

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'lookup-request', cups: ['G17H03000130001'] }),
      ]),
    );
    const resultChunk = messages.find((message) => message.type === 'result-chunk');
    expect(resultChunk.results[0].outcome).toBe('NON_TROVATO_OPENCUP_DA_VERIFICARE');
  });

  it('riporta progresso completo anche con batch vuoto nel worker', async () => {
    const { scope, messages } = await loadRealWorkerScope();

    scope.onmessage?.({
      data: {
        type: 'start',
        rows: [],
        lookup: true,
        chunkSize: 1,
      },
    });

    await waitForMessage(messages, 'complete');

    expect(messages).toContainEqual(
      expect.objectContaining({
        type: 'progress',
        progress: expect.objectContaining({ phase: 'validate', percent: 100 }),
      }),
    );
    expect(messages).toContainEqual(
      expect.objectContaining({
        type: 'progress',
        progress: expect.objectContaining({ phase: 'lookup', percent: 100 }),
      }),
    );
  });

  it('pubblica un messaggio di errore se il batch nel worker fallisce', async () => {
    const { scope, messages } = await loadRealWorkerScope();

    scope.onmessage?.({
      data: {
        type: 'start',
        rows: null,
        lookup: false,
        chunkSize: 1,
      },
    });

    const error = await waitForMessage(messages, 'error');
    expect(error.message).toContain('Cannot read');
  });

  it('ignora risultati lookup senza richiesta pendente e completa senza lookup', async () => {
    const { scope, messages } = await loadRealWorkerScope();

    scope.onmessage?.({ data: { type: 'lookup-result', requestId: 999, foundCups: [] } });
    scope.onmessage?.({
      data: {
        type: 'start',
        rows: makeRows(['G17H03000130001']),
        lookup: false,
        chunkSize: 1,
      },
    });

    await waitForMessage(messages, 'complete');

    expect(messages.some((message) => message.type === 'lookup-request')).toBe(false);
    const resultChunk = messages.find((message) => message.type === 'result-chunk');
    expect(resultChunk.results[0].outcome).toBe('FORMATO_VALIDO_DA_VERIFICARE');
  });
});
