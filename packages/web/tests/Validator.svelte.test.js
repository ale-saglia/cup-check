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
    expect(parseFile).toHaveBeenCalledWith(
      pendingFile,
      expect.objectContaining({ columnLabel: expect.any(Function) }),
    );

    expect(container.querySelector('#import-wizard')).toBeTruthy();
    expect(container.querySelector('.import-source-nav')).toBeNull();
    expect(container.textContent).not.toContain('Configura ogni sorgente');
    expect(container.querySelector('.import-wizard-count')?.textContent?.trim()).toBe(
      '0 righe CUP',
    );
    expect(container.querySelector('#preview-panel')?.classList.contains('hidden')).toBe(true);
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

    const headers = container.querySelectorAll('#import-wizard table thead th');
    expect(headers).toHaveLength(4);
    expect(Array.from(headers).map((th) => th.textContent)).toEqual(['Riga', 'CUP', 'CUP', 'Data']);
  });

  it('annulla una importazione non confermata e ripristina il focus', async () => {
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(null);
    vi.mocked(parseFile).mockResolvedValue({
      ...makeParsed(),
      headers: ['CUP'],
      rows: [{ cells: ['G17H03000130001'], originalRowNumber: 2 }],
      rawRows: [['CUP'], ['G17H03000130001']],
      headerPresent: true,
      headerDetectedAutomatically: true,
    });

    const { container } = render(Validator);
    const input = container.querySelector('#file-input');
    const focusSpy = vi.spyOn(document.body, 'focus');
    Object.defineProperty(input, 'files', { value: [new File(['cup'], 'annulla.csv')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(container.querySelector('#import-wizard')).toBeTruthy());
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Annulla'))
      ?.click();
    flushSync();

    await waitFor(() => expect(container.querySelector('#import-wizard')).toBeNull());
    expect(container.querySelector('#file-toggle-meta')?.textContent).toBe('Nessun file caricato');
    await waitFor(() => expect(focusSpy).toHaveBeenCalledOnce());
  });

  it('conferma il wizard di importazione e abilita la verifica del batch normalizzato', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    const pendingFile = new File(['CUP\nG17H03000130001'], 'cups.csv', { type: 'text/csv' });
    vi.mocked(loadLatestDataset).mockResolvedValue({
      manifest: { dataset_tag: 'test' },
      hasCup: (cup) => cup === 'G17H03000130001',
    });
    vi.mocked(consumeTransfer).mockImplementation((id) => (id === 'batch' ? pendingFile : null));
    vi.mocked(parseFile).mockResolvedValue({
      ...makeParsed(),
      headers: ['CUP'],
      rows: [{ cells: ['G17H03000130001'], originalRowNumber: 2 }],
      rawRows: [['CUP'], ['G17H03000130001']],
      headerPresent: true,
      headerDetectedAutomatically: true,
    });

    window.history.replaceState({}, '', '#/?transfer=batch');
    const { container } = render(Validator);

    await waitFor(() => {
      expect(container.querySelector('#import-wizard')).toBeTruthy();
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Conferma importazione'),
    );
    confirmButton?.click();
    flushSync();

    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });
    container.querySelector('#group-same-cups').checked = true;
    container
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelector('#preview-panel')?.classList.contains('hidden')).toBe(false);
    expect(container.querySelector('#preview-panel')?.classList.contains('collapsed')).toBe(true);
    expect(container.querySelector('#summary')?.textContent).toContain('1 CUP unici da 1 righe');
    const cells = Array.from(container.querySelectorAll('#results-table tbody td')).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(cells[0]).toBe('2');
    container.querySelector('.source-button')?.click();
    flushSync();
    const sourceRows = Array.from(container.querySelectorAll('.detail-source-table tr')).map(
      (row) => Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(sourceRows).toEqual([
      ['Fonte', 'cups.csv'],
      ['Scheda', '-'],
      ['Colonna', 'CUP'],
      ['Riga', '2'],
    ]);
  });

  it('mostra una colonna fonte per ogni file quando il CUP appare in piu file', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const first = new File(['CUP\nG17H03000130001'], 'primo.csv', { type: 'text/csv' });
    const second = new File(['Codice CUP\nG17H03000130001'], 'secondo.csv', { type: 'text/csv' });
    vi.mocked(parseFile)
      .mockResolvedValueOnce({
        ...makeParsed(),
        headers: ['CUP'],
        rows: [{ cells: ['G17H03000130001'], originalRowNumber: 2 }],
        rawRows: [['CUP'], ['G17H03000130001']],
        headerPresent: true,
        headerDetectedAutomatically: true,
      })
      .mockResolvedValueOnce({
        ...makeParsed(),
        headers: ['Codice CUP'],
        rows: [{ cells: ['G17H03000130001'], originalRowNumber: 2 }],
        rawRows: [['Codice CUP'], ['G17H03000130001']],
        headerPresent: true,
        headerDetectedAutomatically: true,
      });

    const { container } = render(Validator);
    Object.defineProperty(container.querySelector('#file-input'), 'files', {
      value: [first, second],
    });
    container.querySelector('#file-input')?.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(container.querySelector('#import-wizard')).toBeTruthy());
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();

    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });
    container.querySelector('#group-same-cups').checked = true;
    container
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelector('.source-button')?.textContent).toBe('2++');
    container.querySelector('.source-button')?.click();
    flushSync();

    const sourceRows = Array.from(container.querySelectorAll('.detail-source-table tr')).map(
      (row) => Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(sourceRows).toEqual([
      ['Fonte', 'primo.csv', 'secondo.csv'],
      ['Scheda', '-', '-'],
      ['Colonna', 'CUP', 'Codice CUP'],
      ['Righe', '2', '2'],
    ]);
  });

  it('separa le fonti dello stesso file quando il CUP appare in schede diverse', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const file = new File(['xlsx'], 'cartella.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    vi.mocked(parseFile)
      .mockResolvedValueOnce({
        ...makeParsed(),
        headers: ['CUP A'],
        rows: [{ cells: ['G17H03000130001'], originalRowNumber: 2 }],
        rawRows: [['CUP A'], ['G17H03000130001']],
        headerPresent: true,
        headerDetectedAutomatically: true,
        selectedSheetName: 'Scheda A',
        sheetNames: ['Scheda A', 'Scheda B'],
      })
      .mockResolvedValueOnce({
        ...makeParsed(),
        headers: ['CUP B'],
        rows: [{ cells: ['G17H03000130001'], originalRowNumber: 4 }],
        rawRows: [['CUP B'], [''], [''], ['G17H03000130001']],
        headerPresent: true,
        headerDetectedAutomatically: true,
        selectedSheetName: 'Scheda B',
        sheetNames: ['Scheda A', 'Scheda B'],
      });

    const { container } = render(Validator);
    Object.defineProperty(container.querySelector('#file-input'), 'files', { value: [file] });
    container.querySelector('#file-input')?.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(container.querySelector('#import-wizard')).toBeTruthy());
    const sheetSelect = container.querySelector('.additional-sheet-controls select');
    sheetSelect.value = 'Scheda B';
    sheetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Carica colonna da scheda'))
      ?.click();
    await waitFor(() =>
      expect(parseFile).toHaveBeenCalledWith(
        file,
        expect.objectContaining({ sheetName: 'Scheda B', columnLabel: expect.any(Function) }),
      ),
    );
    await waitFor(() =>
      expect(container.querySelector('.import-wizard-count')?.textContent).toContain('2 righe CUP'),
    );

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();

    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });
    container.querySelector('#group-same-cups').checked = true;
    container
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelector('.source-button')?.textContent).toBe('2++');
    container.querySelector('.source-button')?.click();
    flushSync();

    const sourceRows = Array.from(container.querySelectorAll('.detail-source-table tr')).map(
      (row) => Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(sourceRows).toEqual([
      ['Fonte', 'cartella.xlsx', 'cartella.xlsx'],
      ['Scheda', 'Scheda A', 'Scheda B'],
      ['Colonna', 'CUP A', 'CUP B'],
      ['Righe', '2', '4'],
    ]);
  });

  it('non duplica la fonte quando si carica due volte la stessa colonna della stessa scheda', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const file = new File(['xlsx'], 'cartella.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const parsedSheet = {
      ...makeParsed(),
      headers: ['CUP'],
      rows: [{ cells: ['G17H03000130001'], originalRowNumber: 2 }],
      rawRows: [['CUP'], ['G17H03000130001']],
      headerPresent: true,
      headerDetectedAutomatically: true,
      selectedSheetName: 'CUP',
      sheetNames: ['CUP'],
    };
    vi.mocked(parseFile).mockResolvedValue(parsedSheet);

    const { container } = render(Validator);
    Object.defineProperty(container.querySelector('#file-input'), 'files', { value: [file] });
    container.querySelector('#file-input')?.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(container.querySelector('#import-wizard')).toBeTruthy());
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Carica colonna da scheda'))
      ?.click();
    await waitFor(() =>
      expect(container.querySelectorAll('.import-source-preview')).toHaveLength(2),
    );

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();

    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });
    container.querySelector('#group-same-cups').checked = true;
    container
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelector('#summary')?.textContent).toContain('1 CUP unici da 1 righe');
    expect(container.querySelector('.source-button')?.textContent).toBe('2');
  });

  it('raggruppa righe duplicate della stessa colonna nel popup fonte e permette rilancio manuale', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    vi.mocked(loadLatestDataset).mockResolvedValue(makeDataset());
    vi.mocked(consumeTransfer).mockReturnValue(null);

    const file = new File(['CUP\nG17H03000130001\nG17H03000130001'], 'duplicati.csv', {
      type: 'text/csv',
    });
    vi.mocked(parseFile).mockResolvedValue({
      ...makeParsed(),
      headers: ['CUP'],
      rows: [
        { cells: ['G17H03000130001'], originalRowNumber: 2 },
        { cells: ['G17H03000130001'], originalRowNumber: 3 },
      ],
      rawRows: [['CUP'], ['G17H03000130001'], ['G17H03000130001']],
      headerPresent: true,
      headerDetectedAutomatically: true,
    });

    const { container } = render(Validator);
    Object.defineProperty(container.querySelector('#file-input'), 'files', { value: [file] });
    container.querySelector('#file-input')?.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(container.querySelector('#import-wizard')).toBeTruthy());
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    await waitFor(() => {
      expect(container.querySelector('#results-panel')?.classList.contains('hidden')).toBe(false);
    });

    container.querySelector('#preview-toggle')?.click();
    flushSync();
    container.querySelector('#check-button')?.click();
    const groupToggle = container.querySelector('#group-same-cups');
    groupToggle.checked = true;
    groupToggle.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(container.querySelector('.source-button')?.textContent).toBe('2++'));
    container.querySelector('.source-button')?.click();
    flushSync();

    const sourceRows = Array.from(container.querySelectorAll('.detail-source-table tr')).map(
      (row) => Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(sourceRows).toEqual([
      ['Fonte', 'duplicati.csv'],
      ['Scheda', '-'],
      ['Colonna', 'CUP'],
      ['Righe', '2, 3'],
    ]);
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
    container.querySelector('#group-same-cups').checked = true;
    container
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(container.querySelector('#batch-progress')).toBeNull();
    expect(container.querySelector('#summary')?.textContent).toContain('2 CUP unici da 3 righe');
    expect(container.querySelector('#summary')?.textContent).toContain('1 trovati OpenCUP');
    expect(container.querySelector('#summary')?.textContent).toContain('1 invalidi');
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Verifica completata',
    );
    expect(container.querySelectorAll('#results-table tbody tr')).toHaveLength(2);
    expect(container.querySelector('#results-table thead')?.textContent).toContain('Fonte');
    expect(container.querySelector('#results-table thead')?.textContent).not.toContain('Dettaglio');
    expect(container.querySelector('.source-button')?.textContent).toBe('1++');
    container.querySelector('.source-button')?.click();
    flushSync();
    expect(showModal).toHaveBeenCalledOnce();
    const sourceRows = Array.from(container.querySelectorAll('.detail-source-table tr')).map(
      (row) => Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(sourceRows).toEqual([
      ['Fonte', '-'],
      ['Scheda', '-'],
      ['Colonna', '-'],
      ['Righe', '1, 2'],
    ]);

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
