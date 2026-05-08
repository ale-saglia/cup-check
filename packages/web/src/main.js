import { buildParsedRows, parseFile } from './parser.js';
import { buildCsvReport, opencupUrlForResult, PRODUCT_VERSION, resultDetail } from './report.js';
import { resultRowsLabel, uniqueResultsByCup } from './results.js';
import { textInputLines } from './text-input.js';
import { OUTCOMES, validateCup, summarizeResults } from './validator.js';
import './styles.css';

const state = {
  parsed: null,
  selectedColumnIndex: 0,
  results: [],
  sourceRowCount: 0,
  filter: 'ALL',
  query: '',
  fileName: 'report',
  displayFileName: 'report',
  skipMissingCup: true,
};

const MAX_RENDERED_RESULT_ROWS = 500;

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-shell">
    <nav class="site-nav" aria-label="Navigazione principale">
      <div class="nav-inner">
        <span class="brand">Verifica CUP</span>
        <div class="nav-links">
          <a class="project-link" href="https://github.com/ale-saglia/cup-check" target="_blank" rel="noreferrer">cup-check ${PRODUCT_VERSION}</a>
          <button id="open-limits" class="link-button nav-link-button" type="button">Limiti del controllo</button>
        </div>
      </div>
    </nav>

    <main class="shell" aria-labelledby="title">
      <section class="project-note" aria-labelledby="title">
        <p id="title">cup-check è uno strumento statico per controllare liste di Codici Unici di Progetto direttamente nel browser, senza caricare dati su server esterni.
        Il servizio aiuta a individuare codici non validi e a produrre un report esportabile per revisione, audit o successive verifiche manuali.</p>
        <p>Il controllo non sostituisce le fonti autoritative: consulta i <button id="open-limits-desc" class="link-button" type="button">Limiti del controllo</button> per capire cosa viene verificato e cosa resta escluso.</p>
      </section>

    <section id="file" class="control-panel" aria-labelledby="upload-title">
      <button id="file-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="file-controls">
        <span id="upload-title">File</span>
        <span id="file-toggle-meta">Nessun file caricato</span>
      </button>
      <div id="file-controls" class="panel-body file-controls">
        <p>Carica un CSV o XLSX, scegli la colonna dei codici e ottieni un report riga per riga. Fino a 25 MB consigliati.</p>
        <label class="dropzone" for="file-input">
          <input id="file-input" type="file" accept=".csv,.xlsx,text/csv" />
          <span>Carica file</span>
        </label>
      </div>
    </section>

    <section id="text" class="control-panel" aria-labelledby="text-title">
      <button id="text-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="text-controls">
        <span id="text-title">Testo</span>
        <span id="text-toggle-meta">Nessun testo inserito</span>
      </button>
      <div id="text-controls" class="panel-body text-controls">
        <p>Incolla i CUP da verificare, uno per riga. Le righe vuote vengono ignorate.</p>
        <textarea id="cup-textarea" rows="8" placeholder="Incolla qui i CUP, uno per riga&#x0a;Es: A58C15000390001&#x0a;    B11B15001360001"></textarea>
        <div class="actions-row text-actions-row">
          <button id="text-check-button" class="primary" type="button">Verifica</button>
        </div>
      </div>
    </section>

    <section class="workspace" aria-label="Verifica CUP">
      <section id="preview-panel" class="control-panel hidden" aria-labelledby="preview-title">
        <button id="preview-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="preview-controls">
          <span id="preview-title">Anteprima</span>
          <span id="preview-toggle-meta">Nessun file</span>
        </button>
        <div id="preview-controls" class="panel-body">
          <div class="section-head">
            <p id="file-meta"></p>
            <div class="preview-options">
              <label class="toggle">
                <input id="header-toggle" type="checkbox" />
                <span>La prima riga contiene intestazioni</span>
              </label>
              <label>
                Colonna CUP
                <select id="column-select"></select>
              </label>
            </div>
          </div>
          <div class="table-wrap">
            <table id="preview-table"></table>
          </div>
          <div class="actions-row">
            <label class="toggle">
              <input id="skip-missing-cup" type="checkbox" checked />
              <span>Ignora celle CUP assenti</span>
            </label>
            <button id="check-button" class="primary" type="button">Verifica</button>
          </div>
        </div>
      </section>

      <section id="results-panel" class="control-panel hidden" aria-labelledby="results-title">
        <button id="results-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="results-controls">
          <span id="results-title">Risultati</span>
          <span id="results-toggle-meta">Nessun risultato</span>
        </button>
        <div id="results-controls" class="panel-body">
          <div class="section-head">
            <p id="summary"></p>
          <div class="button-row">
            <button id="export-button" class="primary" type="button">Esporta CSV</button>
            <button id="clear-button" class="secondary" type="button">Pulisci</button>
          </div>
          </div>
          <div class="filters">
            <label>
              Esito
              <select id="filter-select">
                <option value="ALL">Tutti</option>
                <option value="${OUTCOMES.INVALID}">Invalidi</option>
                <option value="${OUTCOMES.CHECK}">Formato valido</option>
              </select>
            </label>
            <label>
              Cerca
              <input id="search-input" type="search" placeholder="CUP o dettaglio" />
            </label>
          </div>
          <div class="table-wrap">
            <table id="results-table"></table>
          </div>
        </div>
      </section>
    </section>

    <footer class="site-footer">
      <span>Sviluppato da <a href="https://ale-saglia.com" rel="noreferrer">Alessandro Saglia</a></span>
      <span><a href="https://opencup.gov.it" target="_blank" rel="noreferrer">OpenCUP</a> · <a href="https://github.com/ale-saglia/cup-check" target="_blank" rel="noreferrer">Codice sorgente e licenza</a></span>
    </footer>
    </main>

    <dialog id="detail-dialog" class="detail-dialog" aria-labelledby="detail-dialog-label">
      <p id="detail-dialog-label" class="detail-dialog-text"></p>
      <form method="dialog">
        <button class="secondary" type="submit">Chiudi</button>
      </form>
    </dialog>

    <dialog id="limits-dialog" class="limits-dialog" aria-labelledby="limits-title">
      <div>
        <h2 id="limits-title">Limiti del controllo</h2>
        <p>La versione 0.1.0 verifica solo la correttezza formale del CUP. Un codice con formato valido non viene dichiarato esistente.</p>
        <p>Per attestare l'esistenza del progetto serve una fonte autoritativa, come il Sistema CUP o il portale OpenCUP quando applicabile.</p>
      </div>
      <form method="dialog">
        <button class="secondary" type="submit">Chiudi</button>
      </form>
    </dialog>
  </div>
`;

const fileInput = document.querySelector('#file-input');
const filePanel = document.querySelector('#file');
const fileToggle = document.querySelector('#file-toggle');
const fileToggleMeta = document.querySelector('#file-toggle-meta');
const textPanel = document.querySelector('#text');
const textToggle = document.querySelector('#text-toggle');
const textToggleMeta = document.querySelector('#text-toggle-meta');
const cupTextarea = document.querySelector('#cup-textarea');
const textCheckButton = document.querySelector('#text-check-button');
const previewPanel = document.querySelector('#preview-panel');
const previewToggle = document.querySelector('#preview-toggle');
const previewToggleMeta = document.querySelector('#preview-toggle-meta');
const resultsPanel = document.querySelector('#results-panel');
const resultsToggle = document.querySelector('#results-toggle');
const resultsToggleMeta = document.querySelector('#results-toggle-meta');
const fileMeta = document.querySelector('#file-meta');
const headerToggle = document.querySelector('#header-toggle');
const columnSelect = document.querySelector('#column-select');
const previewTable = document.querySelector('#preview-table');
const checkButton = document.querySelector('#check-button');
const skipMissingCupInput = document.querySelector('#skip-missing-cup');
const clearButton = document.querySelector('#clear-button');
const exportButton = document.querySelector('#export-button');
const filterSelect = document.querySelector('#filter-select');
const searchInput = document.querySelector('#search-input');
const summary = document.querySelector('#summary');
const resultsTable = document.querySelector('#results-table');
const openLimitsButton = document.querySelector('#open-limits');
const openLimitsDescButton = document.querySelector('#open-limits-desc');
const limitsDialog = document.querySelector('#limits-dialog');
const detailDialog = document.querySelector('#detail-dialog');
const detailDialogText = document.querySelector('#detail-dialog-label');

openLimitsButton.addEventListener('click', () => {
  limitsDialog.showModal();
});

openLimitsDescButton.addEventListener('click', () => {
  limitsDialog.showModal();
});

limitsDialog.addEventListener('click', (event) => {
  if (event.target === limitsDialog) {
    limitsDialog.close();
  }
});

detailDialog.addEventListener('click', (event) => {
  if (event.target === detailDialog) {
    detailDialog.close();
  }
});

fileToggle.addEventListener('click', () => {
  togglePanel(filePanel, fileToggle);
});

textToggle.addEventListener('click', () => {
  togglePanel(textPanel, textToggle);
});

previewToggle.addEventListener('click', () => {
  togglePanel(previewPanel, previewToggle);
});

resultsToggle.addEventListener('click', () => {
  togglePanel(resultsPanel, resultsToggle);
});

textCheckButton.addEventListener('click', () => {
  const lines = textInputLines(cupTextarea.value);

  if (lines.length === 0) {
    alert('Nessun CUP trovato. Incolla almeno un codice, uno per riga.');
    return;
  }

  const startedAt = performance.now();
  const results = lines.map((line, index) => validateCup(line, index + 1));
  state.results = uniqueResultsByCup(results);
  state.sourceRowCount = results.length;
  state.fileName = 'cup-testo';
  state.filter = 'ALL';
  state.query = '';
  collapsePanel(textPanel, textToggle);
  textToggleMeta.textContent = `${lines.length} CUP`;
  previewPanel.classList.add('hidden');
  renderResults(performance.now() - startedAt);
});

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    state.parsed = await parseFile(file);
    state.fileName = file.name.replace(/\.[^.]+$/, '');
    state.displayFileName = file.name;
    state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
    renderPreview(file);
  } catch (error) {
    alert(error.message);
  }
});

columnSelect.addEventListener('change', () => {
  state.selectedColumnIndex = Number(columnSelect.value);
  renderPreviewTable();
});

headerToggle.addEventListener('change', () => {
  state.parsed = buildParsedRows(state.parsed.rawRows, headerToggle.checked);
  state.selectedColumnIndex = state.parsed.suggestedColumnIndex;
  renderPreviewData();
});

checkButton.addEventListener('click', () => {
  const startedAt = performance.now();
  const rowsToValidate = state.skipMissingCup
    ? state.parsed.rows.filter((row) => !isMissingCup(row))
    : state.parsed.rows;
  const results = rowsToValidate.map((row) =>
    validateCup(row.cells[state.selectedColumnIndex], row.originalRowNumber),
  );
  state.results = uniqueResultsByCup(results);
  state.sourceRowCount = results.length;
  collapsePanel(previewPanel, previewToggle);
  renderResults(performance.now() - startedAt);
});

skipMissingCupInput.addEventListener('change', () => {
  state.skipMissingCup = skipMissingCupInput.checked;
});

filterSelect.addEventListener('change', () => {
  state.filter = filterSelect.value;
  renderResultsTable();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value.trim().toLowerCase();
  renderResultsTable();
});

clearButton.addEventListener('click', () => {
  resetApp();
});

resultsTable.addEventListener('click', (event) => {
  const rowsButton = event.target.closest('.multiple-rows-button');
  if (rowsButton) {
    detailDialogText.textContent = `Righe originali: ${rowsButton.dataset.rows}`;
    detailDialog.showModal();
    return;
  }

  const cell = event.target.closest('.detail-cell');
  if (!cell || cell.scrollWidth <= cell.clientWidth) return;
  detailDialogText.textContent = cell.closest('td').title;
  detailDialog.showModal();
});

exportButton.addEventListener('click', () => {
  const blob = new Blob([buildCsvReport(state.results)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.fileName}_check.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

function renderPreview(file) {
  collapsePanel(filePanel, fileToggle);
  collapsePanel(textPanel, textToggle);
  fileToggleMeta.textContent = file.name;
  previewPanel.classList.remove('hidden');
  expandPanel(previewPanel, previewToggle);
  resultsPanel.classList.add('hidden');
  renderPreviewData(file.name);
}

function renderPreviewData(fileName = state.displayFileName) {
  const headerMeta = headerDetectionMeta();
  fileMeta.textContent = `${fileName} - ${state.parsed.rows.length} righe dati - ${headerMeta}`;
  previewToggleMeta.textContent = `${state.parsed.rows.length} righe`;
  headerToggle.checked = state.parsed.headerPresent;
  skipMissingCupInput.checked = state.skipMissingCup;
  columnSelect.innerHTML = state.parsed.headers
    .map(
      (header, index) =>
        `<option value="${index}">${escapeHtml(header || `Colonna ${index + 1}`)}</option>`,
    )
    .join('');
  columnSelect.value = String(state.selectedColumnIndex);
  renderPreviewTable();
}

function headerDetectionMeta() {
  if (state.parsed.headerDetectedAutomatically === state.parsed.headerPresent) {
    return state.parsed.headerPresent
      ? 'intestazione rilevata automaticamente'
      : 'intestazione non rilevata automaticamente';
  }

  return state.parsed.headerPresent
    ? 'intestazione impostata manualmente'
    : 'prima riga trattata manualmente come dati';
}

function renderPreviewTable() {
  const rows = state.parsed.rows.slice(0, 10);
  previewTable.innerHTML = `
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

function renderResults(durationMs) {
  resultsPanel.classList.remove('hidden');
  expandPanel(resultsPanel, resultsToggle);
  const data = summarizeResults(state.results, durationMs);
  const invalid = data.counts[OUTCOMES.INVALID];
  const valid = data.counts[OUTCOMES.CHECK];
  summary.textContent = `${data.total} CUP unici da ${state.sourceRowCount} righe - ${valid} da verificare - ${invalid} invalidi - ${Math.round(data.durationMs)} ms`;
  resultsToggleMeta.textContent = `${data.total} CUP unici`;
  renderResultsTable();
}

function togglePanel(panel, toggle) {
  const isCollapsed = panel.classList.toggle('collapsed');
  toggle.setAttribute('aria-expanded', String(!isCollapsed));
}

function collapsePanel(panel, toggle) {
  panel.classList.add('collapsed');
  toggle.setAttribute('aria-expanded', 'false');
}

function expandPanel(panel, toggle) {
  panel.classList.remove('collapsed');
  toggle.setAttribute('aria-expanded', 'true');
}

function renderResultsTable() {
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

  resultsTable.innerHTML = `
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
              <td><span class="badge ${result.outcome === OUTCOMES.INVALID ? 'bad' : 'warn'}">${result.outcome}</span></td>
              <td title="${escapeHtml(resultDetail(result))}"><div class="detail-cell">${escapeHtml(resultDetail(result))}</div></td>
              <td>${opencupCell(result)}</td>
            </tr>
          `,
        )
        .join('')}
    </tbody>
  `;

  resultsTable.querySelectorAll('.detail-cell').forEach((cell) => {
    if (cell.scrollWidth > cell.clientWidth) {
      cell.classList.add('is-truncated');
    }
  });
}

function renderRowsCell(result) {
  const rows = result.inputRows ?? [result.inputRow];

  if (rows.length <= 1) {
    return escapeHtml(rows[0]);
  }

  const rowsLabel = resultRowsLabel(result);
  return `<button class="link-button multiple-rows-button" type="button" data-rows="${escapeHtml(rowsLabel)}" aria-label="Mostra tutte le righe per il CUP">${escapeHtml(rows[0])}++</button>`;
}

function resetApp() {
  state.parsed = null;
  state.selectedColumnIndex = 0;
  state.results = [];
  state.sourceRowCount = 0;
  state.filter = 'ALL';
  state.query = '';
  state.fileName = 'report';
  state.displayFileName = 'report';
  state.skipMissingCup = true;

  fileInput.value = '';
  cupTextarea.value = '';
  expandPanel(filePanel, fileToggle);
  expandPanel(textPanel, textToggle);
  fileToggleMeta.textContent = 'Nessun file caricato';
  textToggleMeta.textContent = 'Nessun testo inserito';
  previewToggleMeta.textContent = 'Nessun file';
  resultsToggleMeta.textContent = 'Nessun risultato';
  columnSelect.innerHTML = '';
  previewTable.innerHTML = '';
  resultsTable.innerHTML = '';
  summary.textContent = '';
  filterSelect.value = 'ALL';
  searchInput.value = '';
  skipMissingCupInput.checked = true;
  headerToggle.checked = false;
  previewPanel.classList.add('hidden');
  resultsPanel.classList.add('hidden');
  sessionStorage.removeItem('cup-check:last-results');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isMissingCup(row) {
  return String(row.cells[state.selectedColumnIndex] ?? '').trim() === '';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

sessionStorage.removeItem('cup-check:last-results');
