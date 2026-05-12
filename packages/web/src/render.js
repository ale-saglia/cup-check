import { opencupUrlForResult, resultDetail } from './report.js';
import { resultRowsLabel } from './results.js';
import { OUTCOMES, summarizeResults } from './validator.js';

const MAX_RENDERED_RESULT_ROWS = 500;

export function renderDatasetSearching(dom) {
  setDatasetStatus(dom, 'Loading 0%', { emphasis: true });
}

export function renderDatasetReady(dom, manifest = null) {
  setDatasetStatus(dom, manifest ? manifest.dataset_tag : 'non caricato - solo verifica formato');
}

export function renderDatasetProgress(dom, progress) {
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
  dom.previewPanel.classList.remove('hidden');
  expandPanel(dom.previewPanel, dom.previewToggle);
  dom.resultsPanel.classList.add('hidden');
  renderPreviewData(state, dom, file.name);
}

export function renderPreviewData(state, dom, fileName = state.displayFileName) {
  const headerMeta = headerDetectionMeta(state.parsed);
  dom.fileMeta.textContent = `${fileName} - ${state.parsed.rows.length} righe dati - ${headerMeta}`;
  dom.previewToggleMeta.textContent = `${state.parsed.rows.length} righe`;
  dom.headerToggle.checked = state.parsed.headerPresent;
  dom.skipMissingCupInput.checked = state.skipMissingCup;
  dom.columnSelect.innerHTML = state.parsed.headers
    .map(
      (header, index) =>
        `<option value="${index}">${escapeHtml(header || `Colonna ${index + 1}`)}</option>`,
    )
    .join('');
  dom.columnSelect.value = String(state.selectedColumnIndex);
  renderPreviewTable(state, dom);
}

export function renderPreviewTable(state, dom) {
  const rows = state.parsed.rows.slice(0, 10);
  dom.previewTable.innerHTML = `
    <thead>
      <tr>${state.parsed.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${row.cells
              .map(
                (cell, index) =>
                  `<td class="${index === state.selectedColumnIndex ? 'selected' : ''}">${escapeHtml(cell)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')}
    </tbody>
  `;
}

export function renderResults(state, dom, durationMs) {
  dom.resultsPanel.classList.remove('hidden');
  expandPanel(dom.resultsPanel, dom.resultsToggle);
  const data = summarizeResults(state.results, durationMs);
  const {
    [OUTCOMES.INVALID]: invalid,
    [OUTCOMES.CHECK]: check,
    [OUTCOMES.FOUND_OPENCUP]: found,
    [OUTCOMES.NOT_FOUND_OPENCUP]: notFound,
  } = data.counts;
  const parts = [`${data.total} CUP unici da ${state.sourceRowCount} righe`];
  if (found > 0) parts.push(`${found} trovati OpenCUP`);
  if (notFound > 0) parts.push(`${notFound} non trovati OpenCUP`);
  if (check > 0) parts.push(`${check} da verificare`);
  parts.push(`${invalid} invalidi`, `${Math.round(data.durationMs)} ms`);
  dom.summary.textContent = parts.join(' · ');
  dom.resultsToggleMeta.textContent = `${data.total} CUP unici`;
  renderResultsTable(state, dom);
}

export function renderResultsTable(state, dom) {
  const rows = state.results.filter((result) => {
    const matchesOutcome = state.filter === 'ALL' || result.outcome === state.filter;
    const haystack =
      `${resultRowsLabel(result)} ${result.normalizedValue} ${result.outcome} ${resultDetail(result)}`.toLowerCase();
    const matchesQuery = state.query === '' || haystack.includes(state.query);
    return matchesOutcome && matchesQuery;
  });
  const renderedRows = rows.slice(0, MAX_RENDERED_RESULT_ROWS);
  const resultLimitNote =
    rows.length > renderedRows.length
      ? `<caption>Mostrate ${renderedRows.length} di ${rows.length} righe filtrate</caption>`
      : '';
  const opencupCell = (result) => {
    const url = opencupUrlForResult(result);
    return url
      ? `<a href="${url}" target="_blank" rel="noreferrer">Apri</a>`
      : '<span aria-label="Link OpenCUP non disponibile">-</span>';
  };

  dom.resultsTable.innerHTML = `
    ${resultLimitNote}
    <thead>
      <tr>
        <th>Riga</th>
        <th>CUP</th>
        <th>Esito</th>
        <th>Dettaglio</th>
        <th>OpenCUP</th>
      </tr>
    </thead>
    <tbody>
      ${renderedRows
        .map(
          (result) => `
            <tr>
              <td>${renderRowsCell(result)}</td>
              <td><code>${escapeHtml(result.normalizedValue)}</code></td>
              <td><span class="badge ${badgeClass(result.outcome)}">${result.outcome}</span></td>
              <td title="${escapeHtml(resultDetail(result))}"><div class="detail-cell">${escapeHtml(resultDetail(result))}</div></td>
              <td>${opencupCell(result)}</td>
            </tr>
          `,
        )
        .join('')}
    </tbody>
  `;

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
  dom.textToggleMeta.textContent = 'Nessun testo inserito';
  dom.previewToggleMeta.textContent = 'Nessun file';
  dom.resultsToggleMeta.textContent = 'Nessun risultato';
  dom.columnSelect.innerHTML = '';
  dom.previewTable.innerHTML = '';
  dom.resultsTable.innerHTML = '';
  dom.summary.textContent = '';
  dom.filterSelect.value = 'ALL';
  dom.searchInput.value = '';
  dom.skipMissingCupInput.checked = true;
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

function renderRowsCell(result) {
  const rows = result.inputRows ?? [result.inputRow];

  if (rows.length <= 1) {
    return escapeHtml(rows[0]);
  }

  const rowsLabel = resultRowsLabel(result);
  return `<button class="link-button multiple-rows-button" type="button" data-rows="${escapeHtml(rowsLabel)}" aria-label="Mostra tutte le righe per il CUP">${escapeHtml(rows[0])}++</button>`;
}

function badgeClass(outcome) {
  if (outcome === OUTCOMES.FOUND_OPENCUP) return 'good';
  if (outcome === OUTCOMES.INVALID) return 'bad';
  return 'warn';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setDatasetStatus(dom, text, { emphasis = false } = {}) {
  dom.datasetStatusBar.textContent = text ? ` · ${text}` : '';
  dom.datasetStatusBar.classList.toggle('is-emphasis', emphasis);
}

function setDatasetLoading(dom, datasetTag, percent) {
  dom.datasetStatusBar.classList.remove('is-emphasis');
  dom.datasetStatusBar.replaceChildren(
    document.createTextNode(datasetTag ? ` · ${datasetTag} · ` : ' · '),
    Object.assign(document.createElement('strong'), {
      textContent: `Loading ${percent}%`,
    }),
  );
}
