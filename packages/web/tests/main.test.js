// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Svelte 5 defers DOM updates to microtasks; flush() drains the queue.
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

// vi.mock is hoisted so the factory survives vi.resetModules() across tests.
vi.mock('../src/lib/core/parser.js', () => ({ parseFile: vi.fn(), buildParsedRows: vi.fn() }));
vi.mock('../src/lib/data/dataset-loader.js', () => ({ loadLatestDataset: vi.fn() }));

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
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:report');
      static revokeObjectURL = vi.fn();
    },
  );
  vi.stubGlobal(
    'Blob',
    class Blob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    },
  );
  vi.stubGlobal('navigator', serviceWorker ? { serviceWorker: { register: vi.fn() } } : {});

  // Import the mocked modules to obtain the shared vi.fn() references,
  // then configure their implementations for this test scenario.
  const { parseFile, buildParsedRows } = await import('../src/lib/core/parser.js');
  const { loadLatestDataset } = await import('../src/lib/data/dataset-loader.js');

  vi.mocked(parseFile)
    .mockReset()
    .mockImplementation(async (_file, options = {}) => {
      if (parseFails || (parseFailsOnSheet && options.sheetName)) throw new Error('parse failed');
      return parsed({
        selectedSheetName: options.sheetName ?? '',
        sheetNames: ['Foglio 1', 'Foglio 2'],
      });
    });
  vi.mocked(buildParsedRows)
    .mockReset()
    .mockImplementation((rawRows, headerPresent) => parsed({ rawRows, headerPresent }));
  vi.mocked(loadLatestDataset)
    .mockReset()
    .mockImplementation(async ({ onProgress } = {}) => {
      onProgress?.({ datasetTag: 'dataset-2026-05', percent: 50 });
      if (!datasetSucceeds) throw new Error('offline');
      return {
        manifest: { dataset_tag: 'dataset-2026-05' },
        hasCup: (cup) => cup === validCup,
      };
    });

  await import('../src/main.js');
  await flush();

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
    window.history.replaceState({}, '', '#/');
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
    await flush();

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

    expect(alert).toHaveBeenCalledWith(
      'Nessun CUP trovato. Incolla almeno un codice, uno per riga.',
    );
  });

  it('parses files, changes sheet/header/column and validates selected rows', async () => {
    const { parseFile, buildParsedRows } = await loadMain();
    const file = new File(['cup'], 'input.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });

    document.querySelector('#file-input').dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(parseFile).toHaveBeenCalledWith(file);
    expect(document.querySelector('#import-wizard')).toBeTruthy();

    document.querySelector('[id^="sheet-select-"]').value = 'Foglio 2';
    document
      .querySelector('[id^="sheet-select-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(parseFile).toHaveBeenCalledWith(file, { sheetName: 'Foglio 2' });

    document.querySelector('[id^="column-select-"]').value = '1';
    document
      .querySelector('[id^="column-select-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(document.querySelector('.import-preview-table .selected')?.textContent).toBe('Trovato');

    document.querySelector('[id^="header-toggle-"]').checked = false;
    document
      .querySelector('[id^="header-toggle-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(buildParsedRows).toHaveBeenCalled();

    document.querySelector('[id^="column-select-"]').value = '0';
    document
      .querySelector('[id^="column-select-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[id^="skip-missing-cup-"]').checked = false;
    document
      .querySelector('[id^="skip-missing-cup-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    await flush();

    expect(document.querySelector('#summary').textContent).toContain('3 CUP unici da 3 righe');
  });

  it('skips rows with missing CUP cells by default', async () => {
    await loadMain();
    const file = new File(['cup'], 'input.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });
    document.querySelector('#file-input').dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    await flush();

    expect(document.querySelector('#summary').textContent).toContain('2 CUP unici da 2 righe');
  });

  it('does not show the import wizard before a file is selected', async () => {
    const { parseFile } = await loadMain();

    expect(document.querySelector('#import-wizard')).toBeNull();
    expect(parseFile).not.toHaveBeenCalled();
  });

  it('ignores empty file selections and alerts parse errors', async () => {
    await loadMain();
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [] });

    document.querySelector('#file-input').dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(alert).not.toHaveBeenCalled();

    await loadMain({ parseFails: true });
    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });

    document.querySelector('#file-input').dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(alert).toHaveBeenCalledWith('parse failed');
  });

  it('handles sheet parse errors', async () => {
    await loadMain({ parseFailsOnSheet: true });
    const file = new File(['cup'], 'input.csv', { type: 'text/csv' });
    Object.defineProperty(document.querySelector('#file-input'), 'files', { value: [file] });
    document.querySelector('#file-input').dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    document.querySelector('[id^="sheet-select-"]').value = 'Foglio 2';
    document
      .querySelector('[id^="sheet-select-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(document.querySelector('.live-message').textContent).toContain('parse failed');
  });

  it('updates filters, search, grouping and detail dialogs', async () => {
    await loadMain();
    document.querySelector('#cup-textarea').value = `${validCup}\n${validCup}\nerrato`;
    document.querySelector('#text-check-button').click();
    await flush();

    document.querySelector('#group-same-cups').checked = false;
    document
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(document.querySelector('#results-toggle-meta').textContent).toBe('3 righe');

    document.querySelector('#filter-select').value = 'INVALIDO_FORMATO';
    document.querySelector('#filter-select').dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#search-input').value = 'r1';
    document.querySelector('#search-input').dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(document.querySelectorAll('#results-table tbody tr')).toHaveLength(1);

    document.querySelector('#filter-select').value = 'ALL';
    document.querySelector('#filter-select').dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#search-input').value = '';
    document.querySelector('#search-input').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#group-same-cups').checked = true;
    document
      .querySelector('#group-same-cups')
      .dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    const sourceButton = document.querySelector('.source-button');
    expect(sourceButton.textContent).toBe('1++');
    sourceButton.click();
    await flush();
    const sourceRows = Array.from(document.querySelectorAll('.detail-source-table tr')).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(sourceRows).toEqual([
      ['Fonte', '-'],
      ['Scheda', '-'],
      ['Colonna', '-'],
      ['Righe', '1, 2'],
    ]);

    document.querySelector('.outcome-detail-button').click();
    await flush();
    expect(document.querySelector('#detail-dialog-label').textContent).toContain(
      'CUP presente nel mirror OpenCUP disponibile.',
    );
    expect(document.querySelector('#detail-dialog-label').textContent).not.toContain(
      'TROVATO_OPENCUP:',
    );
  });

  it('clears the app and session state', async () => {
    await loadMain();
    sessionStorage.setItem('cup-check:last-results', 'old');
    document.querySelector('#cup-textarea').value = validCup;
    document.querySelector('#text-check-button').click();
    await flush();

    document.querySelector('#clear-button').click();

    expect(document.querySelector('#cup-textarea').value).toBe('');
    expect(sessionStorage.getItem('cup-check:last-results')).toBeNull();
  });

  it("smonta il componente Validator quando si naviga verso un'altra rotta", async () => {
    await loadMain();
    expect(document.querySelector('#cup-textarea')).toBeTruthy();

    window.history.replaceState({}, '', '#/pdf-extract');
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    expect(document.querySelector('#cup-textarea')).toBeNull();
  });

  it('toggles all panels', async () => {
    await loadMain();

    for (const selector of ['#file-toggle', '#text-toggle', '#preview-toggle', '#results-toggle']) {
      document.querySelector(selector).click();
    }
    await flush();

    expect(document.querySelector('#file').classList.contains('collapsed')).toBe(true);
    expect(document.querySelector('#text').classList.contains('collapsed')).toBe(true);
    expect(document.querySelector('#preview-panel').classList.contains('collapsed')).toBe(true);
    expect(document.querySelector('#results-panel').classList.contains('collapsed')).toBe(true);
  });
});
