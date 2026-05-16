import { mountLayout } from './layout.js';
import { OUTCOMES } from './lib/core/validator.js';

export function mountValidatorContent(container) {
  container.innerHTML = `
    <section class="project-note" aria-labelledby="title">
      <h1 id="title" class="visually-hidden">Verifica CUP</h1>
      <p>cup-check è uno strumento statico per controllare il formato di liste di Codici Unici di Progetto direttamente nel browser, senza caricare dati su server esterni.
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

    <section class="workspace" aria-label="Area operativa verifica CUP">
      <section id="preview-panel" class="control-panel hidden" aria-labelledby="preview-title">
        <button id="preview-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="preview-controls">
          <span id="preview-title">Anteprima</span>
          <span id="preview-toggle-meta">Nessun file</span>
        </button>
        <div id="preview-controls" class="panel-body">
          <div class="section-head preview-head">
            <div class="preview-row">
              <p id="file-meta"></p>
              <label id="sheet-select-label" class="preview-select hidden">
                Scheda Excel
                <select id="sheet-select"></select>
              </label>
            </div>
            <div class="preview-row">
              <label class="toggle">
                <input id="header-toggle" type="checkbox" />
                <span>La prima riga contiene intestazioni</span>
              </label>
              <label class="preview-select">
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
            <label class="toggle result-group-toggle">
              <input id="group-same-cups" type="checkbox" checked />
              <span>Raggruppa CUP uguali</span>
            </label>
            <label class="result-outcome-filter">
              Esito
              <select id="filter-select">
                <option value="ALL">Tutti</option>
                <option value="${OUTCOMES.FOUND_OPENCUP}">Trovati OpenCUP</option>
                <option value="${OUTCOMES.NOT_FOUND_OPENCUP}">Non trovati OpenCUP</option>
                <option value="${OUTCOMES.CHECK}">Da verificare</option>
                <option value="${OUTCOMES.INVALID}">Invalidi</option>
              </select>
            </label>
            <label class="result-search-filter">
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

    <dialog id="detail-dialog" class="detail-dialog" aria-labelledby="detail-dialog-label">
      <p id="detail-dialog-label" class="detail-dialog-text"></p>
      <form method="dialog">
        <button class="secondary" type="submit">Chiudi</button>
      </form>
    </dialog>

    <dialog id="limits-dialog" class="limits-dialog" aria-labelledby="limits-title">
      <div>
        <h2 id="limits-title">Limiti del controllo</h2>
        <p>Questa versione controlla il formato dei CUP e, quando il dataset OpenCUP statico è disponibile, verifica la presenza nel mirror pubblicato.</p>
        <p>Lo strumento è in fase di sviluppo: può contenere errori, bug o interpretazioni incomplete delle regole. I risultati sono un supporto operativo, non una certificazione.</p>
        <p>La verifica OpenCUP usa una banca dati generata mensilmente: potrebbe non includere gli ultimi CUP emessi, CUP non ancora pubblicati o record aggiornati dopo l'ultimo snapshot.</p>
        <p>Un CUP marcato <code>NON_TROVATO_OPENCUP_DA_VERIFICARE</code> potrebbe comunque esistere in progetti non pubblicati o non ancora presenti nel dataset mensile.</p>
        <p>Per attestare l'esistenza del progetto resta necessaria una fonte autoritativa, come il Sistema CUP o il portale OpenCUP.</p>
      </div>
      <form method="dialog">
        <button class="secondary" type="submit">Chiudi</button>
      </form>
    </dialog>
  `;

  return {
    fileInput: container.querySelector('#file-input'),
    filePanel: container.querySelector('#file'),
    fileToggle: container.querySelector('#file-toggle'),
    fileToggleMeta: container.querySelector('#file-toggle-meta'),
    textPanel: container.querySelector('#text'),
    textToggle: container.querySelector('#text-toggle'),
    textToggleMeta: container.querySelector('#text-toggle-meta'),
    cupTextarea: container.querySelector('#cup-textarea'),
    textCheckButton: container.querySelector('#text-check-button'),
    previewPanel: container.querySelector('#preview-panel'),
    previewToggle: container.querySelector('#preview-toggle'),
    previewToggleMeta: container.querySelector('#preview-toggle-meta'),
    resultsPanel: container.querySelector('#results-panel'),
    resultsToggle: container.querySelector('#results-toggle'),
    resultsToggleMeta: container.querySelector('#results-toggle-meta'),
    fileMeta: container.querySelector('#file-meta'),
    sheetSelectLabel: container.querySelector('#sheet-select-label'),
    sheetSelect: container.querySelector('#sheet-select'),
    headerToggle: container.querySelector('#header-toggle'),
    columnSelect: container.querySelector('#column-select'),
    previewTable: container.querySelector('#preview-table'),
    checkButton: container.querySelector('#check-button'),
    skipMissingCupInput: container.querySelector('#skip-missing-cup'),
    groupSameCupsInput: container.querySelector('#group-same-cups'),
    clearButton: container.querySelector('#clear-button'),
    exportButton: container.querySelector('#export-button'),
    filterSelect: container.querySelector('#filter-select'),
    searchInput: container.querySelector('#search-input'),
    summary: container.querySelector('#summary'),
    resultsTable: container.querySelector('#results-table'),
    openLimitsDescButton: container.querySelector('#open-limits-desc'),
    limitsDialog: container.querySelector('#limits-dialog'),
    detailDialog: container.querySelector('#detail-dialog'),
    detailDialogText: container.querySelector('#detail-dialog-label'),
  };
}

export function mountApp(root = document.querySelector('#app')) {
  const mainSlot = mountLayout(root);
  const dom = mountValidatorContent(mainSlot);
  return {
    ...dom,
    datasetStatusBar: root.querySelector('#dataset-status-bar'),
  };
}
