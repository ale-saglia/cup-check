// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const validCup = 'G17H03000130001';
const missingCup = 'H11B22001230001';

function parsed(overrides = {}) {
  return {
    rawRows: [
      ['CUP', 'Descrizione'],
      [validCup, 'Trovato'],
      ['', 'Vuoto'],
      [missingCup, 'Assente'],
    ],
    headers: ['CUP', 'Descrizione'],
    rows: [
      { originalRowNumber: 2, cells: [validCup, 'Trovato'] },
      { originalRowNumber: 3, cells: ['', 'Vuoto'] },
      { originalRowNumber: 4, cells: [missingCup, 'Assente'] },
    ],
    headerPresent: true,
    headerDetectedAutomatically: true,
    suggestedColumnIndex: 0,
    selectedSheetName: '',
    ...overrides,
  };
}

async function loadMain({
  datasetSucceeds = true,
  parseFails = false,
  parseFailsOnSheet = false,
  serviceWorker = true,
} = {}) {
  vi.resetModules();
  document.body.innerHTML = '<main id="app"></main>';
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('performance', { now: vi.fn().mockReturnValueOnce(10).mockReturnValue(25) });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:report');
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal('Blob', class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  });
  vi.stubGlobal('navigator', serviceWorker ? { serviceWorker: { register: vi.fn() } } : {});

  const parseFile = vi.fn(async (_file, options = {}) => {
    if (parseFails || (parseFailsOnSheet && options.sheetName)) throw new Error('parse failed');
    return parsed({
      selectedSheetName: options.sheetName ?? '',
      sheetNames: ['Foglio 1', 'Foglio 2'],
    });
  });
  const buildParsedRows = vi.fn((rawRows, headerPresent) => parsed({ rawRows, headerPresent }));
  const loadLatestDataset = vi.fn(async ({ onProgress } = {}) => {
    onProgress?.({ datasetTag: 'dataset-2026-05', percent: 50 });
    if (!datasetSucceeds) throw new Error('offline');
    return {
      manifest: { dataset_tag: 'dataset-2026-05' },
      hasCup: (cup) => cup === validCup,
    };
  });

  vi.doMock('../src/parser.js', () => ({ parseFile, buildParsedRows }));
  vi.doMock('../src/dataset-loader.js', () => ({ loadLatestDataset }));

  await import('../src/main.js');
  await Promise.resolve();
  await Promise.resolve();

  return {
    parseFile,
    buildParsedRows,
    loadLatestDataset,
    app: document.querySelector('#app'),
  };
}

describe('main', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('registers the service worker and shows dataset readiness', async () => {
    await loadMain();

    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('./sw.js');
    expect(document.querySelector('#dataset-status-bar')?.textContent).toContain('dataset-2026-05');
  });

  it('starts without service worker support', async () => {
    await loadMain({ serviceWorker: false });

    expect(navigator.serviceWorker).toBeUndefined();
  });

  it('handles dataset discovery failures cautiously', async () => {
    await loadMain({ datasetSucceeds: false });

    expect(document.querySelector('#dataset-status-bar')?.textContent).toContain('non disponibile');
  });

  it('validates pasted CUPs and exports the report', async () => {
    await loadMain();
    document.querySelector('#cup-textarea').value = `${validCup}\n${missingCup}`;

    document.querySelector('#text-check-button').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('#text-toggle-meta').textContent).toBe('2 CUP');
    expect(document.querySelector('#summary').textContent).toContain('1 trovati OpenCUP');
    expect(document.querySelector('#summary').textContent).toContain('1 non trovati OpenCUP');

    const clicked = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === 'a') element.click = clicked;
      return element;
    });

    document.querySelector('#export-button').click();

    expect(URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ options: { type: 'text/csv;charset=utf-8' } }),
    );
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });

  it('alerts when pasted text has no CUP lines', async () => {
    await loadMain();

    document.querySelector('#text-check-button').click();

    expect(alert).toHaveBeenCalledWith('Nessun CUP trovato. Incolla almeno un codice, uno per riga.');
  });

  it('parses files, changes sheet/header/column and validates selected rows', async () => {
    const { parseFile, buildParsedRows } = await loadMain();
    const file = new File(['cup'], 'input.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });

    document.querySelector('#file-input').dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();

    expect(parseFile).toHaveBeenCalledWith(file);
    expect(document.querySelector('#preview-panel').classList.contains('hidden')).toBe(false);

    document.querySelector('#sheet-select').value = 'Foglio 2';
    document.querySelector('#sheet-select').dispatchEvent(new Event('change'));
    await Promise.resolve();
    expect(parseFile).toHaveBeenCalledWith(file, { sheetName: 'Foglio 2' });

    document.querySelector('#column-select').value = '1';
    document.querySelector('#column-select').dispatchEvent(new Event('change'));
    expect(document.querySelector('#preview-table .selected')?.textContent).toBe('Trovato');

    document.querySelector('#header-toggle').checked = false;
    document.querySelector('#header-toggle').dispatchEvent(new Event('change'));
    expect(buildParsedRows).toHaveBeenCalled();

    document.querySelector('#column-select').value = '0';
    document.querySelector('#column-select').dispatchEvent(new Event('change'));
    document.querySelector('#skip-missing-cup').checked = false;
    document.querySelector('#skip-missing-cup').dispatchEvent(new Event('change'));
    document.querySelector('#check-button').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('#summary').textContent).toContain('3 CUP unici da 3 righe');
  });

  it('skips rows with missing CUP cells by default', async () => {
    await loadMain();
    const file = new File(['cup'], 'input.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });
    document.querySelector('#file-input').dispatchEvent(new Event('change'));
    await Promise.resolve();
    document.querySelector('#column-select').append(new Option('Assente', '99'));
    document.querySelector('#column-select').value = '99';
    document.querySelector('#column-select').dispatchEvent(new Event('change'));

    document.querySelector('#check-button').click();
    await Promise.resolve();

    expect(document.querySelector('#summary').textContent).toContain('0 CUP unici da 0 righe');
  });

  it('ignores sheet changes before a file is selected', async () => {
    const { parseFile } = await loadMain();

    document.querySelector('#sheet-select').dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(parseFile).not.toHaveBeenCalled();
  });

  it('ignores empty file selections and alerts parse errors', async () => {
    await loadMain();
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [] });

    document.querySelector('#file-input').dispatchEvent(new Event('change'));
    await Promise.resolve();
    expect(alert).not.toHaveBeenCalled();

    await loadMain({ parseFails: true });
    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });

    document.querySelector('#file-input').dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(alert).toHaveBeenCalledWith('parse failed');
  });

  it('handles sheet parse errors', async () => {
    await loadMain({ parseFailsOnSheet: true });
    const file = new File(['cup'], 'input.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });
    document.querySelector('#file-input').dispatchEvent(new Event('change'));
    await Promise.resolve();

    document.querySelector('#sheet-select').value = 'Foglio 2';
    document.querySelector('#sheet-select').dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(alert).toHaveBeenCalledWith('parse failed');
  });

  it('updates filters, search, grouping and detail dialogs', async () => {
    await loadMain();
    document.querySelector('#cup-textarea').value = `${validCup}\n${validCup}\nerrato`;
    document.querySelector('#text-check-button').click();
    await Promise.resolve();
    await Promise.resolve();

    document.querySelector('#group-same-cups').checked = false;
    document.querySelector('#group-same-cups').dispatchEvent(new Event('change'));
    expect(document.querySelector('#results-toggle-meta').textContent).toBe('3 righe');

    document.querySelector('#filter-select').value = 'INVALIDO_FORMATO';
    document.querySelector('#filter-select').dispatchEvent(new Event('change'));
    document.querySelector('#search-input').value = 'r1';
    document.querySelector('#search-input').dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('#results-table tbody tr')).toHaveLength(1);

    document.querySelector('#filter-select').value = 'ALL';
    document.querySelector('#filter-select').dispatchEvent(new Event('change'));
    document.querySelector('#search-input').value = '';
    document.querySelector('#search-input').dispatchEvent(new Event('input'));
    document.querySelector('#group-same-cups').checked = true;
    document.querySelector('#group-same-cups').dispatchEvent(new Event('change'));
    const rowsButton = document.querySelector('.multiple-rows-button');
    rowsButton.click();
    expect(document.querySelector('#detail-dialog-label').textContent).toBe('Righe originali: 1, 2');

    const detail = document.querySelector('.detail-cell');
    Object.defineProperties(detail, {
      scrollWidth: { configurable: true, value: 100 },
      clientWidth: { configurable: true, value: 10 },
    });
    detail.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('#detail-dialog-label').textContent).toContain('TROVATO_OPENCUP');
  });

  it('clears the app and session state', async () => {
    await loadMain();
    sessionStorage.setItem('cup-check:last-results', 'old');
    document.querySelector('#cup-textarea').value = validCup;
    document.querySelector('#text-check-button').click();
    await Promise.resolve();

    document.querySelector('#clear-button').click();

    expect(document.querySelector('#cup-textarea').value).toBe('');
    expect(sessionStorage.getItem('cup-check:last-results')).toBeNull();
  });

  it('toggles all panels', async () => {
    await loadMain();

    for (const selector of ['#file-toggle', '#text-toggle', '#preview-toggle', '#results-toggle']) {
      document.querySelector(selector).click();
    }

    expect(document.querySelector('#file').classList.contains('collapsed')).toBe(true);
    expect(document.querySelector('#text').classList.contains('collapsed')).toBe(true);
    expect(document.querySelector('#preview-panel').classList.contains('collapsed')).toBe(true);
    expect(document.querySelector('#results-panel').classList.contains('collapsed')).toBe(true);
  });
});
