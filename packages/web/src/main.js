import { initDialogs, showDetailDialog } from './dialogs.js';
import { createLookup } from './dataset-loader.js';
import { mountApp } from './dom.js';
import { buildParsedRows, parseFile } from './parser.js';
import { buildCsvReport } from './report.js';
import {
  collapsePanel,
  renderDatasetError,
  renderDatasetProgress,
  renderDatasetReady,
  renderPreview,
  renderPreviewData,
  renderPreviewTable,
  renderResults,
  renderResultsTable,
  resetView,
  togglePanel,
} from './render.js';
import { applyDbLookup, uniqueResultsByCup } from './results.js';
import { state, resetState } from './state.js';
import { textInputLines } from './text-input.js';
import { OUTCOMES, validateCup } from './validator.js';
import './styles.css';

const dom = mountApp();

initDialogs(dom);

let datasetLookup = null;

if (!import.meta.env.VITE_DISABLE_DATASET) {
  createLookup((loaded, total) => {
    renderDatasetProgress(dom, loaded, total);
  })
    .then((lookup) => {
      datasetLookup = lookup;
      renderDatasetReady(dom, lookup.nRecords);
      if (state.results.some((r) => r.outcome === OUTCOMES.CHECK)) {
        const started = performance.now();
        state.results = applyDbLookup(state.results, (cup) => lookup.lookup(cup));
        renderResults(state, dom, performance.now() - started);
      }
    })
    .catch(() => {
      renderDatasetError(dom);
    });
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

dom.textCheckButton.addEventListener('click', () => {
  const lines = textInputLines(dom.cupTextarea.value);

  if (lines.length === 0) {
    alert('Nessun CUP trovato. Incolla almeno un codice, uno per riga.');
    return;
  }

  const startedAt = performance.now();
  const results = lines.map((line, index) => validateCup(line, index + 1));
  state.results = uniqueResultsByCup(results);
  if (datasetLookup) {
    state.results = applyDbLookup(state.results, (cup) => datasetLookup.lookup(cup));
  }
  state.sourceRowCount = results.length;
  state.fileName = 'cup-testo';
  state.filter = 'ALL';
  state.query = '';
  collapsePanel(dom.textPanel, dom.textToggle);
  dom.textToggleMeta.textContent = `${lines.length} CUP`;
  dom.previewPanel.classList.add('hidden');
  renderResults(state, dom, performance.now() - startedAt);
});

dom.fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    state.parsed = await parseFile(file);
    state.fileName = file.name.replace(/\.[^.]+$/, '');
    state.displayFileName = file.name;
    state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
    renderPreview(state, dom, file);
  } catch (error) {
    alert(error.message);
  }
});

dom.columnSelect.addEventListener('change', () => {
  state.selectedColumnIndex = Number(dom.columnSelect.value);
  renderPreviewTable(state, dom);
});

dom.headerToggle.addEventListener('change', () => {
  state.parsed = buildParsedRows(state.parsed.rawRows, dom.headerToggle.checked);
  state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
  renderPreviewData(state, dom);
});

dom.checkButton.addEventListener('click', () => {
  const startedAt = performance.now();
  const rowsToValidate = state.skipMissingCup
    ? state.parsed.rows.filter((row) => !isMissingCup(row))
    : state.parsed.rows;
  const results = rowsToValidate.map((row) =>
    validateCup(row.cells[state.selectedColumnIndex], row.originalRowNumber),
  );
  state.results = uniqueResultsByCup(results);
  if (datasetLookup) {
    state.results = applyDbLookup(state.results, (cup) => datasetLookup.lookup(cup));
  }
  state.sourceRowCount = results.length;
  collapsePanel(dom.previewPanel, dom.previewToggle);
  renderResults(state, dom, performance.now() - startedAt);
});

dom.skipMissingCupInput.addEventListener('change', () => {
  state.skipMissingCup = dom.skipMissingCupInput.checked;
});

dom.filterSelect.addEventListener('change', () => {
  state.filter = dom.filterSelect.value;
  renderResultsTable(state, dom);
});

dom.searchInput.addEventListener('input', () => {
  state.query = dom.searchInput.value.trim().toLowerCase();
  renderResultsTable(state, dom);
});

dom.clearButton.addEventListener('click', () => {
  resetApp();
});

dom.resultsTable.addEventListener('click', (event) => {
  const rowsButton = event.target.closest('.multiple-rows-button');
  if (rowsButton) {
    showDetailDialog(dom, `Righe originali: ${rowsButton.dataset.rows}`);
    return;
  }

  const cell = event.target.closest('.detail-cell');
  if (!cell || cell.scrollWidth <= cell.clientWidth) return;
  showDetailDialog(dom, cell.closest('td').title);
});

dom.exportButton.addEventListener('click', () => {
  const blob = new Blob([buildCsvReport(state.results)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.fileName}_check.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

function resetApp() {
  resetState();
  resetView(dom);
  sessionStorage.removeItem('cup-check:last-results');
}

function isMissingCup(row) {
  return String(row.cells[state.selectedColumnIndex] ?? '').trim() === '';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

sessionStorage.removeItem('cup-check:last-results');
