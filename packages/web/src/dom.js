import { OUTCOMES } from './validator.js';
import { PRODUCT_VERSION } from './version.js';

export function mountApp(root = document.querySelector('#app')) {
  root.innerHTML = `
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
          <p id="title">cup-check è uno strumento statico per controllare il formato di liste di Codici Unici di Progetto direttamente nel browser, senza caricare dati su server esterni.
          Il servizio verifica il formato dei Codici Unici di Progetto e produce un report esportabile per revisione, audit o rendicontazione.</p>
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

      <div id="dataset-status-bar" class="dataset-status-bar" role="status" aria-live="polite"></div>

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
                  <option value="${OUTCOMES.FOUND_OPENCUP}">Trovati OpenCUP</option>
                  <option value="${OUTCOMES.NOT_FOUND_OPENCUP}">Non trovati OpenCUP</option>
                  <option value="${OUTCOMES.CHECK}">Da verificare</option>
                  <option value="${OUTCOMES.INVALID}">Invalidi</option>
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
          <p>Questa versione controlla il formato dei CUP e, quando il dataset OpenCUP statico e disponibile, verifica la presenza nel mirror pubblicato.</p>
          <p>Un CUP marcato <code>NON_TROVATO_OPENCUP_DA_VERIFICARE</code> potrebbe comunque esistere in progetti non pubblicati o non aggiornati nel dataset.</p>
          <p>Per attestare l'esistenza del progetto resta necessaria una fonte autoritativa, come il Sistema CUP o il portale OpenCUP.</p>
        </div>
        <form method="dialog">
          <button class="secondary" type="submit">Chiudi</button>
        </form>
      </dialog>
    </div>
  `;

  return {
    fileInput: root.querySelector('#file-input'),
    filePanel: root.querySelector('#file'),
    fileToggle: root.querySelector('#file-toggle'),
    fileToggleMeta: root.querySelector('#file-toggle-meta'),
    textPanel: root.querySelector('#text'),
    textToggle: root.querySelector('#text-toggle'),
    textToggleMeta: root.querySelector('#text-toggle-meta'),
    cupTextarea: root.querySelector('#cup-textarea'),
    textCheckButton: root.querySelector('#text-check-button'),
    previewPanel: root.querySelector('#preview-panel'),
    previewToggle: root.querySelector('#preview-toggle'),
    previewToggleMeta: root.querySelector('#preview-toggle-meta'),
    resultsPanel: root.querySelector('#results-panel'),
    resultsToggle: root.querySelector('#results-toggle'),
    resultsToggleMeta: root.querySelector('#results-toggle-meta'),
    fileMeta: root.querySelector('#file-meta'),
    headerToggle: root.querySelector('#header-toggle'),
    columnSelect: root.querySelector('#column-select'),
    previewTable: root.querySelector('#preview-table'),
    checkButton: root.querySelector('#check-button'),
    skipMissingCupInput: root.querySelector('#skip-missing-cup'),
    clearButton: root.querySelector('#clear-button'),
    exportButton: root.querySelector('#export-button'),
    filterSelect: root.querySelector('#filter-select'),
    searchInput: root.querySelector('#search-input'),
    summary: root.querySelector('#summary'),
    resultsTable: root.querySelector('#results-table'),
    openLimitsButton: root.querySelector('#open-limits'),
    openLimitsDescButton: root.querySelector('#open-limits-desc'),
    limitsDialog: root.querySelector('#limits-dialog'),
    detailDialog: root.querySelector('#detail-dialog'),
    detailDialogText: root.querySelector('#detail-dialog-label'),
    datasetStatusBar: root.querySelector('#dataset-status-bar'),
  };
}
