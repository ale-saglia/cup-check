// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from '../src/dom.js';
import {
  collapsePanel,
  expandPanel,
  renderDatasetError,
  renderDatasetChecking,
  renderDatasetProgress,
  renderDatasetReady,
  renderDatasetSearching,
  renderPreview,
  renderPreviewData,
  renderPreviewTable,
  renderResults,
  renderResultsTable,
  resetView,
  togglePanel,
} from '../src/render.js';
import { applyDatasetLookup, uniqueResultsByCup } from '../src/results.js';
import { validateCup } from '../src/validator.js';

let dom;

function parsed(overrides = {}) {
  return {
    rawRows: [
      ['CUP', 'Descrizione'],
      ['G17H03000130001', 'Uno'],
      ['H11B22001230001', 'Due'],
    ],
    headers: ['CUP', 'Descrizione'],
    rows: [
      { originalRowNumber: 2, cells: ['G17H03000130001', 'Uno'] },
      { originalRowNumber: 3, cells: ['H11B22001230001', 'Due'] },
    ],
    headerPresent: true,
    headerDetectedAutomatically: true,
    suggestedColumnIndex: 0,
    ...overrides,
  };
}

function renderState(overrides = {}) {
  return {
    parsed: parsed(),
    selectedColumnIndex: 0,
    results: [],
    sourceRowCount: 0,
    durationMs: 12,
    filter: 'ALL',
    query: '',
    fileName: 'report',
    displayFileName: 'input.csv',
    selectedSheetName: '',
    skipMissingCup: true,
    groupSameCups: true,
    ...overrides,
  };
}

describe('render', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    dom = mountApp();
  });

  it('renders dataset status states', () => {
    renderDatasetSearching(dom);
    expect(dom.datasetStatusBar.textContent).toBe('');

    renderDatasetProgress(dom, {});
    expect(dom.datasetStatusBar.textContent).toBe('');

    renderDatasetProgress(dom, { datasetTag: 'dataset-2026-05', percent: 42 });
    expect(dom.datasetStatusBar.classList.contains('is-loading')).toBe(true);
    expect(dom.datasetStatusBar.textContent).toContain('dataset-2026-05');
    expect(dom.datasetStatusBar.textContent).toContain('Loading 42%');

    renderDatasetReady(dom, { dataset_tag: 'dataset-2026-05' });
    expect(dom.datasetStatusBar.classList.contains('is-loading')).toBe(false);
    expect(dom.datasetStatusBar.textContent).toContain('dataset-2026-05');

    renderDatasetReady(dom);
    expect(dom.datasetStatusBar.textContent).toContain('non caricato');

    renderDatasetError(dom);
    expect(dom.datasetStatusBar.classList.contains('is-emphasis')).toBe(true);
    expect(dom.datasetStatusBar.textContent).toContain('non disponibile');

    expect(renderDatasetChecking(dom)).toBeUndefined();
  });

  it('toggles, collapses and expands panels', () => {
    togglePanel(dom.filePanel, dom.fileToggle);
    expect(dom.filePanel.classList.contains('collapsed')).toBe(true);
    expect(dom.fileToggle.getAttribute('aria-expanded')).toBe('false');

    expandPanel(dom.filePanel, dom.fileToggle);
    expect(dom.filePanel.classList.contains('collapsed')).toBe(false);
    expect(dom.fileToggle.getAttribute('aria-expanded')).toBe('true');

    collapsePanel(dom.filePanel, dom.fileToggle);
    expect(dom.filePanel.classList.contains('collapsed')).toBe(true);
    expect(dom.fileToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders preview data, sheets and selected columns', () => {
    const state = renderState({
      parsed: parsed({
        headerDetectedAutomatically: false,
        sheetNames: ['Foglio 1', 'Foglio 2'],
        selectedSheetName: 'Foglio 2',
      }),
      selectedSheetName: '',
    });

    renderPreview(state, dom, { name: 'elenco.xlsx' });

    expect(dom.filePanel.classList.contains('collapsed')).toBe(true);
    expect(dom.textPanel.classList.contains('collapsed')).toBe(true);
    expect(dom.previewPanel.classList.contains('hidden')).toBe(false);
    expect(dom.fileMeta.textContent).toContain('elenco.xlsx');
    expect(dom.fileMeta.textContent).toContain('intestazione impostata manualmente');
    expect(dom.previewToggleMeta.textContent).toBe('2 righe');
    expect(dom.sheetSelectLabel.classList.contains('hidden')).toBe(false);
    expect(dom.sheetSelect.disabled).toBe(false);
    expect(dom.sheetSelect.value).toBe('Foglio 2');
    expect(dom.columnSelect.value).toBe('0');
    expect(dom.previewTable.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(dom.previewTable.querySelector('.selected')?.textContent).toBe('G17H03000130001');
  });

  it('handles preview data without multiple sheets and without a file name', () => {
    const state = renderState({
      parsed: parsed({
        headerPresent: false,
        headerDetectedAutomatically: true,
        headers: [''],
        rows: [{ originalRowNumber: 1, cells: ['A12B23000000001'] }],
      }),
      selectedColumnIndex: 0,
      displayFileName: null,
    });

    renderPreviewData(state, dom);

    expect(dom.fileMeta.textContent).toContain('1 righe dati');
    expect(dom.fileMeta.textContent).toContain('prima riga trattata manualmente come dati');
    expect(dom.sheetSelectLabel.classList.contains('hidden')).toBe(true);
    expect(dom.sheetSelect.disabled).toBe(true);
    expect(dom.columnSelect.options[0].textContent).toBe('Colonna 1');
  });

  it('renders preview rows with empty cells', () => {
    const state = renderState({
      parsed: parsed({
        headers: ['CUP', 'Note'],
        rows: [{ originalRowNumber: 4, cells: ['A12B23000000001', null] }],
      }),
      selectedColumnIndex: 1,
    });

    renderPreviewTable(state, dom);

    expect(dom.previewTable.querySelector('thead th')?.textContent).toBe('CUP');
    expect(dom.previewTable.querySelector('.selected')?.textContent).toBe('');
  });

  it('renders grouped and expanded results', () => {
    const grouped = uniqueResultsByCup([
      validateCup('G17H03000130001', 2, { currentYear: 2026 }),
      validateCup('G17H03000130001', 8, { currentYear: 2026 }),
      validateCup('H11B22001230001', 3, { currentYear: 2026 }),
      validateCup('errato', 4, { currentYear: 2026 }),
    ]);
    const results = applyDatasetLookup(grouped, (cup) => cup === 'G17H03000130001');
    const state = renderState({
      results,
      sourceRowCount: 4,
      durationMs: 12.3,
      groupSameCups: true,
    });

    renderResults(state, dom, state.durationMs);

    expect(dom.resultsPanel.classList.contains('hidden')).toBe(false);
    expect(dom.summary.textContent).toContain('3 CUP unici da 4 righe');
    expect(dom.summary.textContent).toContain('1 trovati OpenCUP');
    expect(dom.summary.textContent).toContain('1 non trovati OpenCUP');
    expect(dom.summary.textContent).toContain('1 invalidi');
    expect(dom.resultsToggleMeta.textContent).toBe('3 CUP unici');
    expect(dom.resultsTable.querySelector('.multiple-rows-button')?.dataset.rows).toBe('2, 8');
    expect(dom.resultsTable.querySelector('a')?.href).toContain('/G17H03000130001');

    state.groupSameCups = false;
    renderResults(state, dom, 9.5);
    expect(dom.summary.textContent).toContain('4 righe verificate');
    expect(dom.resultsToggleMeta.textContent).toBe('4 righe');
  });

  it('filters result rows by outcome and query and marks truncated details', () => {
    const results = uniqueResultsByCup([
      validateCup('G17H03000130001', 2, { currentYear: 2026 }),
      validateCup('errato', 4, { currentYear: 2026 }),
    ]);
    const state = renderState({
      results,
      filter: 'INVALIDO_FORMATO',
      query: 'r1',
    });

    Object.defineProperties(HTMLElement.prototype, {
      scrollWidth: { configurable: true, get: () => 120 },
      clientWidth: { configurable: true, get: () => 50 },
    });
    renderResultsTable(state, dom);

    const rows = dom.resultsTable.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('INVALIDO_FORMATO');
    expect(dom.resultsTable.querySelector('.detail-cell')?.classList.contains('is-truncated')).toBe(
      true,
    );
  });

  it('shows a caption when filtered results exceed the render cap', () => {
    const results = Array.from({ length: 501 }, (_, index) =>
      validateCup(`A12B2300${String(index).padStart(7, '0')}`, index + 1, {
        currentYear: 2026,
      }),
    );
    const state = renderState({ results, sourceRowCount: results.length });

    renderResultsTable(state, dom);

    expect(dom.resultsTable.querySelector('caption')?.textContent).toBe(
      'Mostrate 500 di 501 righe filtrate',
    );
    expect(dom.resultsTable.querySelectorAll('tbody tr')).toHaveLength(500);
  });

  it('resets the view', () => {
    renderPreview(renderState(), dom, { name: 'input.csv' });
    renderResults(renderState({ results: [validateCup('errato', 1, { currentYear: 2026 })] }), dom, 1);
    dom.fileInput.value = '';
    dom.cupTextarea.value = 'A12B23000000001';
    dom.filterSelect.value = 'INVALIDO_FORMATO';
    dom.searchInput.value = 'x';

    resetView(dom);

    expect(dom.cupTextarea.value).toBe('');
    expect(dom.fileToggleMeta.textContent).toBe('Nessun file caricato');
    expect(dom.fileToggleMeta.hasAttribute('title')).toBe(false);
    expect(dom.previewPanel.classList.contains('hidden')).toBe(true);
    expect(dom.resultsPanel.classList.contains('hidden')).toBe(true);
    expect(dom.filterSelect.value).toBe('ALL');
    expect(dom.searchInput.value).toBe('');
    expect(dom.skipMissingCupInput.checked).toBe(true);
    expect(dom.groupSameCupsInput.checked).toBe(true);
    expect(dom.headerToggle.checked).toBe(false);
    expect(dom.previewTable.children).toHaveLength(0);
    expect(dom.resultsTable.children).toHaveLength(0);
  });
});
