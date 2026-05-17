// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';

vi.mock('../src/lib/data/dataset-loader.js', () => ({
  loadLatestDataset: vi.fn(),
}));
vi.mock('../src/lib/core/parser.js', () => ({
  parseFile: vi.fn(),
  buildParsedRows: vi.fn(),
}));
vi.mock('../src/lib/data/transfer.js', () => ({
  consumeTransfer: vi.fn(),
}));

import { loadLatestDataset } from '../src/lib/data/dataset-loader.js';
import { parseFile } from '../src/lib/core/parser.js';
import { consumeTransfer } from '../src/lib/data/transfer.js';
import Validator from '../src/routes/Validator.svelte';

function makeDataset() {
  return { manifest: { dataset_tag: 'test' }, hasCup: () => false };
}

function makeParsed() {
  return {
    rows: [],
    rawRows: [],
    suggestedColumnIndex: 0,
    selectedSheetName: '',
    sheetNames: null,
    headers: [],
    headerPresent: false,
    headerDetectedAutomatically: false,
  };
}

describe('Validator', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '#/');
  });

  it('monta e mostra il testo descrittivo', () => {
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const { container } = render(Validator);

    expect(container.querySelector('.project-note')).toBeTruthy();
    expect(container.querySelector('#file-input')).toBeTruthy();
    expect(container.querySelector('#cup-textarea')).toBeTruthy();
  });

  it("consuma il file dal registry transfer al mount e mostra l'anteprima", async () => {
    const pendingFile = new File(['cup\n'], 'estrazione.csv', { type: 'text/csv' });
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockImplementation((id) =>
      id === 'testid123' ? pendingFile : null,
    );
    vi.mocked(parseFile).mockResolvedValue(makeParsed());

    window.history.replaceState({}, '', '#/?transfer=testid123');
    const { container } = render(Validator);

    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    expect(consumeTransfer).toHaveBeenCalledWith('testid123');
    expect(parseFile).toHaveBeenCalledWith(pendingFile, {});

    const previewPanel = container.querySelector('#preview-panel');
    expect(previewPanel?.classList.contains('hidden')).toBe(false);
  });

  it('renderizza la tabella anteprima senza errori con intestazioni duplicate (regressione each_key_duplicate)', async () => {
    const pendingFile = new File(['CUP,CUP,Data\n'], 'doppie.csv', { type: 'text/csv' });
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockImplementation((id) => (id === 'abc' ? pendingFile : null));
    vi.mocked(parseFile).mockResolvedValue({
      ...makeParsed(),
      headers: ['CUP', 'CUP', 'Data'],
      rows: [{ cells: ['A12B23000000001', 'B12C23000000002', '2024-01-01'], originalRowNumber: 1 }],
      rawRows: [['A12B23000000001', 'B12C23000000002', '2024-01-01']],
      headerPresent: true,
      headerDetectedAutomatically: true,
    });

    window.history.replaceState({}, '', '#/?transfer=abc');
    const { container } = render(Validator);

    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    const headers = container.querySelectorAll('#preview-table thead th');
    expect(headers).toHaveLength(3);
    expect(Array.from(headers).map((th) => th.textContent)).toEqual(['CUP', 'CUP', 'Data']);
  });

  it("gestisce l'errore di parseFile durante il flusso transfer", async () => {
    const pendingFile = new File(['invalid'], 'estrazione.csv', { type: 'text/csv' });
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(pendingFile);
    vi.mocked(parseFile).mockRejectedValue(new Error('parse error'));

    window.history.replaceState({}, '', '#/?transfer=testid123');
    render(Validator);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('parse error');
    });

    vi.unstubAllGlobals();
  });
});
