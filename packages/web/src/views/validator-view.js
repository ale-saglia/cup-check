import { initDialogs, showDetailDialog } from '../dialogs.js';
import { loadLatestDataset } from '../dataset-loader.js';
import { mountValidatorContent } from '../dom.js';
import { buildParsedRows, parseFile } from '../parser.js';
import { buildCsvReport } from '../report.js';
import {
  collapsePanel,
  renderDatasetChecking,
  renderDatasetError,
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
} from '../render.js';
import { applyDatasetLookup, displayResults, uniqueResultsByCup } from '../results.js';
import { state, resetState } from '../state.js';
import { textInputLines } from '../text-input.js';
import { OUTCOMES, validateCup } from '../validator.js';

let _container = null;

export async function mount(container) {
  _container = container;
  const dom = mountValidatorContent(container);
  const datasetStatusBar = document.querySelector('#dataset-status-bar');
  const domWithBar = { ...dom, datasetStatusBar };

  initDialogs(domWithBar);

  let dataset = null;
  let selectedFile = null;

  async function initializeDataset() {
    renderDatasetSearching(domWithBar);
    try {
      const loadedDataset = await loadLatestDataset({
        onProgress: (progress) => renderDatasetProgress(domWithBar, progress),
      });
      dataset = loadedDataset;
      renderDatasetReady(domWithBar, loadedDataset.manifest);
      return loadedDataset;
    } catch {
      renderDatasetError(domWithBar);
      return null;
    }
  }

  const datasetPromise = initializeDataset();

  async function applyLookup(results) {
    const loadedDataset = dataset ?? (await datasetPromise);
    if (!loadedDataset) return results;
    const hasCheckableCups = results.some((result) => result.outcome === OUTCOMES.CHECK);
    if (!hasCheckableCups) return results;
    renderDatasetChecking(domWithBar);
    const updatedResults = applyDatasetLookup(results, (cup) => loadedDataset.hasCup(cup));
    renderDatasetReady(domWithBar, loadedDataset.manifest);
    return updatedResults;
  }

  dom.fileToggle.addEventListener('click', () => {
    togglePanel(dom.filePanel, dom.fileToggle);
  });

  dom.textToggle.addEventListener('click', () => {
    togglePanel(dom.textPanel, dom.textToggle);
  });

  dom.previewToggle.addEventListener('click', () => {
    togglePanel(dom.previewPanel, dom.previewToggle);
  });

  dom.resultsToggle.addEventListener('click', () => {
    togglePanel(dom.resultsPanel, dom.resultsToggle);
  });

  dom.textCheckButton.addEventListener('click', async () => {
    const lines = textInputLines(dom.cupTextarea.value);

    if (lines.length === 0) {
      alert('Nessun CUP trovato. Incolla almeno un codice, uno per riga.');
      return;
    }

    const startedAt = performance.now();
    const results = lines.map((line, index) => validateCup(line, index + 1));
    const unique = uniqueResultsByCup(results);
    state.results = await applyLookup(unique);
    state.sourceRowCount = results.length;
    state.fileName = 'cup-testo';
    state.filter = 'ALL';
    state.query = '';
    state.durationMs = performance.now() - startedAt;
    collapsePanel(dom.textPanel, dom.textToggle);
    dom.textToggleMeta.textContent = `${lines.length} CUP`;
    dom.previewPanel.classList.add('hidden');
    renderResults(state, domWithBar, state.durationMs);
  });

  dom.fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      selectedFile = file;
      state.parsed = await parseFile(file);
      state.fileName = file.name.replace(/\.[^.]+$/, '');
      state.displayFileName = file.name;
      state.selectedSheetName = state.parsed.selectedSheetName ?? '';
      state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
      renderPreview(state, domWithBar, file);
    } catch (error) {
      alert(error.message);
    }
  });

  dom.sheetSelect.addEventListener('change', async () => {
    if (!selectedFile) return;

    try {
      state.parsed = await parseFile(selectedFile, { sheetName: dom.sheetSelect.value });
      state.selectedSheetName = state.parsed.selectedSheetName ?? '';
      state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
      renderPreviewData(state, domWithBar);
    } catch (error) {
      alert(error.message);
    }
  });

  dom.columnSelect.addEventListener('change', () => {
    state.selectedColumnIndex = Number(dom.columnSelect.value);
    renderPreviewTable(state, domWithBar);
  });

  dom.headerToggle.addEventListener('change', () => {
    state.parsed = rebuildParsedRows(state.parsed.rawRows, dom.headerToggle.checked);
    state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
    renderPreviewData(state, domWithBar);
  });

  dom.checkButton.addEventListener('click', async () => {
    const startedAt = performance.now();
    const rowsToValidate = state.skipMissingCup
      ? state.parsed.rows.filter((row) => !isMissingCup(row))
      : state.parsed.rows;
    const results = rowsToValidate.map((row) =>
      validateCup(row.cells[state.selectedColumnIndex], row.originalRowNumber),
    );
    const unique = uniqueResultsByCup(results);
    state.results = await applyLookup(unique);
    state.sourceRowCount = results.length;
    state.durationMs = performance.now() - startedAt;
    collapsePanel(dom.previewPanel, dom.previewToggle);
    renderResults(state, domWithBar, state.durationMs);
  });

  dom.skipMissingCupInput.addEventListener('change', () => {
    state.skipMissingCup = dom.skipMissingCupInput.checked;
  });

  dom.groupSameCupsInput.addEventListener('change', () => {
    state.groupSameCups = dom.groupSameCupsInput.checked;
    renderResults(state, domWithBar, state.durationMs);
  });

  dom.filterSelect.addEventListener('change', () => {
    state.filter = dom.filterSelect.value;
    renderResultsTable(state, domWithBar);
  });

  dom.searchInput.addEventListener('input', () => {
    state.query = dom.searchInput.value.trim().toLowerCase();
    renderResultsTable(state, domWithBar);
  });

  dom.clearButton.addEventListener('click', () => {
    selectedFile = null;
    resetState();
    resetView(domWithBar);
    sessionStorage.removeItem('cup-check:last-results');
  });

  dom.resultsTable.addEventListener('click', (event) => {
    const rowsButton = event.target.closest('.multiple-rows-button');
    if (rowsButton) {
      showDetailDialog(domWithBar, `Righe originali: ${rowsButton.dataset.rows}`);
      return;
    }

    const cell = event.target.closest('.detail-cell');
    if (!cell || cell.scrollWidth <= cell.clientWidth) return;
    showDetailDialog(domWithBar, cell.closest('td').title);
  });

  dom.exportButton.addEventListener('click', () => {
    const blob = new Blob([buildCsvReport(displayResults(state.results, state.groupSameCups))], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.fileName}_check.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });

  sessionStorage.removeItem('cup-check:last-results');

  if (state.pendingFile) {
    const file = state.pendingFile;
    state.pendingFile = null;
    try {
      selectedFile = file;
      state.parsed = await parseFile(file);
      state.fileName = file.name.replace(/\.[^.]+$/, '');
      state.displayFileName = file.name;
      state.selectedSheetName = state.parsed.selectedSheetName ?? '';
      state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
      renderPreview(state, domWithBar, file);
    } catch (error) {
      alert(error.message);
    }
  }

  function rebuildParsedRows(rawRows, headerPresent) {
    const { sheetNames, selectedSheetName } = state.parsed;
    return {
      ...buildParsedRows(rawRows, headerPresent),
      ...(sheetNames ? { sheetNames, selectedSheetName } : {}),
    };
  }

  function isMissingCup(row) {
    return String(row.cells[state.selectedColumnIndex] ?? '').trim() === '';
  }
}

export function unmount() {
  if (_container) {
    _container.innerHTML = '';
    _container = null;
  }
  resetState();
}
