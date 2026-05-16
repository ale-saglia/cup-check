import { opencupUrlForResult, resultDetail } from './lib/core/report.js';
import { displayResults, resultRowsLabel } from './lib/core/results.js';
import { OUTCOMES, summarizeResults } from './lib/core/validator.js';

const MAX_RENDERED_RESULT_ROWS = 500;

export function renderDatasetSearching(dom) {
  setDatasetStatus(dom, '');
}

export function renderDatasetReady(dom, manifest = null) {
  setDatasetStatus(dom, manifest ? manifest.dataset_tag : 'non caricato - solo verifica formato');
}

export function renderDatasetProgress(dom, progress) {
  if (!progress.datasetTag) {
    setDatasetStatus(dom, '');
    return;
  }

  setDatasetLoading(dom, progress.datasetTag, progress.percent);
}

export function renderDatasetChecking() {
  // Keep the loaded dataset tag visible while local lookup runs.
}

export function renderDatasetError(dom) {
  setDatasetStatus(dom, 'non disponibile - solo verifica formato', { emphasis: true });
}

export function renderPreview(state, dom, file) {
  collapsePanel(dom.filePanel, dom.fileToggle);
  collapsePanel(dom.textPanel, dom.textToggle);
  dom.fileToggleMeta.textContent = file.name;
  dom.fileToggleMeta.title = file.name;
  dom.previewPanel.classList.remove('hidden');
  expandPanel(dom.previewPanel, dom.previewToggle);
  dom.resultsPanel.classList.add('hidden');
  renderPreviewData(state, dom, file.name);
}

export function renderPreviewData(state, dom, fileName = state.displayFileName) {
  const headerMeta = headerDetectionMeta(state.parsed);
  const fileNameLabel = document.createElement('span');
  fileNameLabel.className = 'file-meta-name';
  fileNameLabel.title = String(fileName ?? '');
  fileNameLabel.textContent = String(fileName ?? '');
  const fileDetail = document.createElement('span');
  fileDetail.className = 'file-meta-detail';
  fileDetail.textContent = ` - ${state.parsed.rows.length} righe dati - ${headerMeta}`;
  dom.fileMeta.replaceChildren(fileNameLabel, fileDetail);
  dom.previewToggleMeta.textContent = `${state.parsed.rows.length} righe`;
  dom.headerToggle.checked = state.parsed.headerPresent;
  dom.skipMissingCupInput.checked = state.skipMissingCup;
  renderSheetSelect(state, dom);
  dom.columnSelect.replaceChildren(
    ...state.parsed.headers.map((header, index) =>
      selectOption(String(index), header || `Colonna ${index + 1}`),
    ),
  );
  dom.columnSelect.value = String(state.selectedColumnIndex);
  renderPreviewTable(state, dom);
}

export function renderPreviewTable(state, dom) {
  const rows = state.parsed.rows.slice(0, 10);
  const headerRow = document.createElement('tr');
  headerRow.replaceChildren(...state.parsed.headers.map((header) => tableCell('th', header)));

  const thead = document.createElement('thead');
  thead.replaceChildren(headerRow);

  const tbody = document.createElement('tbody');
  tbody.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement('tr');
      tr.replaceChildren(
        ...row.cells.map((cell, index) => {
          const td = tableCell('td', cell);
          td.classList.toggle('selected', index === state.selectedColumnIndex);
          return td;
        }),
      );
      return tr;
    }),
  );

  dom.previewTable.replaceChildren(thead, tbody);
}

export function renderResults(state, dom, durationMs) {
  dom.resultsPanel.classList.remove('hidden');
  expandPanel(dom.resultsPanel, dom.resultsToggle);
  const visibleResults = displayResults(state.results, state.groupSameCups);
  const data = summarizeResults(visibleResults, durationMs);
  const {
    [OUTCOMES.INVALID]: invalid,
    [OUTCOMES.CHECK]: check,
    [OUTCOMES.FOUND_OPENCUP]: found,
    [OUTCOMES.NOT_FOUND_OPENCUP]: notFound,
  } = data.counts;
  const parts = [
    state.groupSameCups
      ? `${data.total} CUP unici da ${state.sourceRowCount} righe`
      : `${data.total} righe verificate`,
  ];
  if (found > 0) parts.push(`${found} trovati OpenCUP`);
  if (notFound > 0) parts.push(`${notFound} non trovati OpenCUP`);
  if (check > 0) parts.push(`${check} da verificare`);
  parts.push(`${invalid} invalidi`, `${Math.round(data.durationMs)} ms`);
  dom.summary.textContent = parts.join(' · ');
  dom.resultsToggleMeta.textContent = state.groupSameCups
    ? `${data.total} CUP unici`
    : `${data.total} righe`;
  dom.groupSameCupsInput.checked = state.groupSameCups;
  renderResultsTable(state, dom);
}

export function renderResultsTable(state, dom) {
  const rows = displayResults(state.results, state.groupSameCups).filter((result) => {
    const matchesOutcome = state.filter === 'ALL' || result.outcome === state.filter;
    const haystack =
      `${resultRowsLabel(result)} ${result.normalizedValue} ${result.outcome} ${resultDetail(result)}`.toLowerCase();
    const matchesQuery = state.query === '' || haystack.includes(state.query);
    return matchesOutcome && matchesQuery;
  });
  const renderedRows = rows.slice(0, MAX_RENDERED_RESULT_ROWS);
  const tableParts = [];

  if (rows.length > renderedRows.length) {
    tableParts.push(
      tableCell('caption', `Mostrate ${renderedRows.length} di ${rows.length} righe filtrate`),
    );
  }

  tableParts.push(resultsTableHeader(), resultsTableBody(renderedRows));
  dom.resultsTable.replaceChildren(...tableParts);

  dom.resultsTable.querySelectorAll('.detail-cell').forEach((cell) => {
    if (cell.scrollWidth > cell.clientWidth) {
      cell.classList.add('is-truncated');
    }
  });
}

export function resetView(dom) {
  dom.fileInput.value = '';
  dom.cupTextarea.value = '';
  expandPanel(dom.filePanel, dom.fileToggle);
  expandPanel(dom.textPanel, dom.textToggle);
  dom.fileToggleMeta.textContent = 'Nessun file caricato';
  dom.fileToggleMeta.removeAttribute('title');
  dom.textToggleMeta.textContent = 'Nessun testo inserito';
  dom.previewToggleMeta.textContent = 'Nessun file';
  dom.resultsToggleMeta.textContent = 'Nessun risultato';
  dom.fileMeta.replaceChildren();
  dom.columnSelect.replaceChildren();
  dom.sheetSelect.replaceChildren();
  dom.sheetSelectLabel.classList.add('hidden');
  dom.previewTable.replaceChildren();
  dom.resultsTable.replaceChildren();
  dom.summary.textContent = '';
  dom.filterSelect.value = 'ALL';
  dom.searchInput.value = '';
  dom.skipMissingCupInput.checked = true;
  dom.groupSameCupsInput.checked = true;
  dom.headerToggle.checked = false;
  dom.previewPanel.classList.add('hidden');
  dom.resultsPanel.classList.add('hidden');
}

export function togglePanel(panel, toggle) {
  const isCollapsed = panel.classList.toggle('collapsed');
  toggle.setAttribute('aria-expanded', String(!isCollapsed));
}

export function collapsePanel(panel, toggle) {
  panel.classList.add('collapsed');
  toggle.setAttribute('aria-expanded', 'false');
}

export function expandPanel(panel, toggle) {
  panel.classList.remove('collapsed');
  toggle.setAttribute('aria-expanded', 'true');
}

function headerDetectionMeta(parsed) {
  if (parsed.headerDetectedAutomatically === parsed.headerPresent) {
    return parsed.headerPresent
      ? 'intestazione rilevata automaticamente'
      : 'intestazione non rilevata automaticamente';
  }

  return parsed.headerPresent
    ? 'intestazione impostata manualmente'
    : 'prima riga trattata manualmente come dati';
}

function renderSheetSelect(state, dom) {
  const sheetNames = state.parsed.sheetNames ?? [];
  const hasMultipleSheets = sheetNames.length > 1;
  dom.sheetSelectLabel.classList.toggle('hidden', !hasMultipleSheets);
  dom.sheetSelect.disabled = !hasMultipleSheets;

  if (!hasMultipleSheets) {
    dom.sheetSelect.replaceChildren();
    return;
  }

  dom.sheetSelect.replaceChildren(
    ...sheetNames.map((sheetName) => selectOption(sheetName, sheetName)),
  );
  dom.sheetSelect.value =
    state.selectedSheetName || state.parsed.selectedSheetName || sheetNames[0];
}

function resultsTableHeader() {
  const headerRow = document.createElement('tr');
  headerRow.replaceChildren(
    tableCell('th', 'Riga'),
    tableCell('th', 'CUP'),
    tableCell('th', 'Esito'),
    tableCell('th', 'Dettaglio'),
    tableCell('th', 'OpenCUP'),
  );

  const thead = document.createElement('thead');
  thead.replaceChildren(headerRow);
  return thead;
}

function resultsTableBody(results) {
  const tbody = document.createElement('tbody');
  tbody.replaceChildren(...results.map(resultRow));
  return tbody;
}

function resultRow(result) {
  const tr = document.createElement('tr');

  const rowsCell = document.createElement('td');
  rowsCell.replaceChildren(renderRowsCell(result));

  const cupCell = document.createElement('td');
  cupCell.title = String(result.normalizedValue ?? '');
  const cupCode = document.createElement('code');
  cupCode.className = 'cup-cell';
  cupCode.textContent = String(result.normalizedValue ?? '');
  cupCell.replaceChildren(cupCode);

  const outcomeCell = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `badge ${badgeClass(result.outcome)}`;
  badge.textContent = result.outcome;
  outcomeCell.replaceChildren(badge);

  const detailCell = document.createElement('td');
  const detail = resultDetail(result);
  detailCell.title = detail;
  const detailContent = document.createElement('div');
  detailContent.className = 'detail-cell';
  detailContent.textContent = detail;
  detailCell.replaceChildren(detailContent);

  const opencupCell = document.createElement('td');
  opencupCell.replaceChildren(renderOpencupCell(result));

  tr.replaceChildren(rowsCell, cupCell, outcomeCell, detailCell, opencupCell);
  return tr;
}

function renderRowsCell(result) {
  const rows = result.inputRows ?? [result.inputRow];

  if (rows.length <= 1) {
    return document.createTextNode(String(rows[0] ?? ''));
  }

  const rowsLabel = resultRowsLabel(result);
  const button = document.createElement('button');
  button.className = 'link-button multiple-rows-button';
  button.type = 'button';
  button.dataset.rows = rowsLabel;
  button.setAttribute('aria-label', 'Mostra tutte le righe per il CUP');
  button.textContent = `${String(rows[0] ?? '')}++`;
  return button;
}

function renderOpencupCell(result) {
  const url = opencupUrlForResult(result);

  if (!url) {
    const unavailable = document.createElement('span');
    unavailable.setAttribute('aria-label', 'Link OpenCUP non disponibile');
    unavailable.textContent = '-';
    return unavailable;
  }

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Apri';
  return link;
}

function selectOption(value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = String(text ?? '');
  return option;
}

function tableCell(tagName, text) {
  const cell = document.createElement(tagName);
  cell.textContent = String(text ?? '');
  return cell;
}

function badgeClass(outcome) {
  if (outcome === OUTCOMES.FOUND_OPENCUP) return 'good';
  if (outcome === OUTCOMES.INVALID) return 'bad';
  return 'warn';
}

function setDatasetStatus(dom, text, { emphasis = false } = {}) {
  dom.datasetStatusBar.classList.remove('is-loading');
  dom.datasetStatusBar.classList.toggle('is-emphasis', emphasis);
  dom.datasetStatusBar.replaceChildren();

  if (!text) {
    return;
  }

  dom.datasetStatusBar.replaceChildren(
    Object.assign(document.createElement('span'), {
      className: 'dataset-status-separator',
      textContent: ' · ',
    }),
    Object.assign(document.createElement('span'), {
      className: 'dataset-status-label',
      textContent: text,
    }),
  );
}

function setDatasetLoading(dom, datasetTag, percent) {
  dom.datasetStatusBar.classList.remove('is-emphasis');
  dom.datasetStatusBar.classList.add('is-loading');
  dom.datasetStatusBar.replaceChildren(
    Object.assign(document.createElement('span'), {
      className: 'dataset-status-separator',
      textContent: ' · ',
    }),
    Object.assign(document.createElement('span'), {
      className: 'dataset-status-label',
      textContent: datasetTag,
    }),
    Object.assign(document.createElement('strong'), {
      className: 'dataset-loading-label',
      textContent: `Loading ${percent}%`,
    }),
  );
}
