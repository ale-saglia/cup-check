// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';

vi.mock('../src/lib/data/dataset-loader.js', () => ({
  loadLatestDataset: vi.fn(),
}));
vi.mock('../src/lib/data/transfer.js', () => ({
  consumeTransfer: vi.fn(),
}));
vi.mock('../src/lib/core/validation-worker.js', () => ({
  validateRows: vi.fn(),
}));

import { loadLatestDataset } from '../src/lib/data/dataset-loader.js';
import { consumeTransfer } from '../src/lib/data/transfer.js';
import { validateRows } from '../src/lib/core/validation-worker.js';
import Validator from '../src/routes/Validator.svelte';

describe('Validator batch controls', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('annulla il batch in corso senza mostrare alert', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.mocked(loadLatestDataset).mockResolvedValue({ manifest: null, hasCup: () => false });
    vi.mocked(consumeTransfer).mockReturnValue(null);
    let capturedSignal;
    vi.mocked(validateRows).mockImplementation((_rows, { onProgress, signal }) => {
      capturedSignal = signal;
      onProgress?.({ phase: 'lookup', processed: 1, total: 10, percent: 10 });
      return new Promise(() => {});
    });

    const { container } = render(Validator);
    const textarea = container.querySelector('#cup-textarea');
    textarea.value = 'G17H03000130001';
    container.querySelector('#text-check-button').click();

    await waitFor(() => {
      expect(validateRows).toHaveBeenCalled();
      expect(container.querySelector('#cancel-batch-button')).toBeTruthy();
      expect(container.querySelector('.progress-block')?.getAttribute('aria-label')).toBe(
        'Verifica presenza nel dataset OpenCUP',
      );
    });
    container.querySelector('#cancel-batch-button').click();

    expect(capturedSignal.aborted).toBe(true);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('ignora gli AbortError restituiti dalla validazione batch', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.mocked(loadLatestDataset).mockResolvedValue({ manifest: null, hasCup: () => false });
    vi.mocked(consumeTransfer).mockReturnValue(null);
    vi.mocked(validateRows).mockRejectedValue(
      Object.assign(new Error('Operazione annullata'), { name: 'AbortError' }),
    );

    const { container } = render(Validator);
    const textarea = container.querySelector('#cup-textarea');
    textarea.value = 'G17H03000130001';
    container.querySelector('#text-check-button').click();

    await waitFor(() => {
      expect(validateRows).toHaveBeenCalled();
    });
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('mostra alert quando la validazione batch fallisce', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.mocked(loadLatestDataset).mockResolvedValue({ manifest: null, hasCup: () => false });
    vi.mocked(consumeTransfer).mockReturnValue(null);
    vi.mocked(validateRows).mockRejectedValue(new Error('batch fallito'));

    const { container } = render(Validator);
    const textarea = container.querySelector('#cup-textarea');
    textarea.value = 'G17H03000130001';
    container.querySelector('#text-check-button').click();

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('batch fallito');
    });
  });
});
