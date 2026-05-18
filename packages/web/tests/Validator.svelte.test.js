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

  it('verifica CUP da testo, raggruppa duplicati e filtra i risultati', async () => {
    const showModal = vi.fn();
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = vi.fn();

    vi.mocked(loadLatestDataset).mockResolvedValue({
      manifest: { dataset_tag: 'test' },
      hasCup: (cup) => cup === 'G17H03000130001',
    });
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const { container } = render(Validator);
    const textarea = container.querySelector('#cup-textarea');
    textarea.value = ['G17H03000130001', 'G17H03000130001', '123'].join('\n');
    container.querySelector('#text-check-button').click();

    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });
    flushSync();

    expect(container.querySelector('#summary')?.textContent).toContain('2 CUP unici da 3 righe');
    expect(container.querySelector('#summary')?.textContent).toContain('1 trovati OpenCUP');
    expect(container.querySelector('#summary')?.textContent).toContain('1 invalidi');
    expect(container.querySelectorAll('#results-table tbody tr')).toHaveLength(2);

    container.querySelector('.multiple-rows-button')?.click();
    flushSync();
    expect(showModal).toHaveBeenCalledOnce();
    expect(container.querySelector('#detail-dialog-label')?.textContent).toBe(
      'Righe originali: 1, 2',
    );

    const filter = container.querySelector('#filter-select');
    filter.value = 'INVALIDO_FORMATO';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelectorAll('#results-table tbody tr')).toHaveLength(1);
    expect(container.querySelector('.badge.bad')?.textContent).toBe('INVALIDO_FORMATO');

    const search = container.querySelector('#search-input');
    search.value = 'g17h';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(container.querySelector('#results-table tbody')).toBeNull();

    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    filter.value = 'ALL';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    const groupToggle = container.querySelector('#group-same-cups');
    groupToggle.click();
    flushSync();
    expect(container.querySelector('#results-toggle-meta')?.textContent).toBe('3 righe');
    expect(container.querySelectorAll('#results-table tbody tr')).toHaveLength(3);
  });

  it('mostra avanzamento, errore e fallback quando il dataset non si carica', async () => {
    let onProgress;
    vi.mocked(loadLatestDataset).mockImplementation(({ onProgress: progress }) => {
      onProgress = progress;
      return Promise.reject(new Error('offline'));
    });
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const datasetBar = document.createElement('div');
    datasetBar.id = 'dataset-status-bar';
    document.body.appendChild(datasetBar);

    render(Validator);
    onProgress?.({ datasetTag: 'dataset-test', percent: 42 });
    onProgress?.({});

    await waitFor(() => {
      expect(datasetBar.textContent).toContain('non disponibile - solo verifica formato');
    });
    expect(datasetBar.classList.contains('is-emphasis')).toBe(true);

    datasetBar.remove();
  });

  it('limita il rendering dei risultati filtrati oltre 500 righe', async () => {
    vi.mocked(loadLatestDataset).mockResolvedValue({ manifest: null, hasCup: () => false });
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const cups = Array.from(
      { length: 501 },
      (_, index) => `A00A03${String(index).padStart(9, '0')}`,
    );
    const { container } = render(Validator);
    const textarea = container.querySelector('#cup-textarea');
    textarea.value = cups.join('\n');
    container.querySelector('#text-check-button').click();

    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });
    flushSync();

    expect(container.querySelector('#results-table caption')?.textContent).toBe(
      'Mostrate 500 di 501 righe filtrate',
    );
    expect(container.querySelectorAll('#results-table tbody tr')).toHaveLength(500);
  });

  it('apre e chiude i dialog descrittivi dal backdrop', () => {
    const close = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = close;

    vi.mocked(loadLatestDataset).mockResolvedValue({ manifest: null, hasCup: () => false });
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const { container } = render(Validator);
    container.querySelector('#open-limits-desc').click();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();

    container
      .querySelector('#limits-dialog')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container
      .querySelector('#detail-dialog')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(close).toHaveBeenCalledTimes(2);
  });
});
