<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import { loadLatestDataset } from '../lib/data/dataset-loader.js';
  import { buildParsedRows, parseFile } from '../lib/core/parser.js';
  import { buildCsvReport, opencupUrlForResult, resultDetail } from '../lib/core/report.js';
  import { displayResults, resultRowsLabel } from '../lib/core/results.js';
  import { textInputLines } from '../text-input.js';
  import { OUTCOMES, summarizeResults } from '../lib/core/validator.js';
  import { validateRows, type BatchInputRow, type BatchProgress } from '../lib/core/validation-worker.js';
  import { consumeTransfer } from '../lib/data/transfer.js';
  import type { Dataset, ParsedFile, UniqueResult, Outcome, DownloadProgress } from '../lib/types.js';

  const MAX_RENDERED_RESULT_ROWS = 500;

  // Core state (replaces state.js)
  let dataset = $state<Dataset | null>(null);
  let selectedFile = $state<File | null>(null);
  let parsed = $state<ParsedFile | null>(null);
  let selectedColumnIndex = $state(0);
  let results = $state<UniqueResult[]>([]);
  let sourceRowCount = $state(0);
  let durationMs = $state(0);
  let filter = $state<Outcome | 'ALL'>('ALL');
  let query = $state('');
  let fileName = $state('report');
  let displayFileName = $state<string | null>(null);
  let selectedSheetName = $state('');
  let skipMissingCup = $state(true);
  let groupSameCups = $state(true);

  // Panel visibility / collapse state
  let filePanelCollapsed = $state(false);
  let textPanelCollapsed = $state(false);
  let previewPanelVisible = $state(false);
  let previewPanelCollapsed = $state(false);
  let resultsPanelVisible = $state(false);
  let resultsPanelCollapsed = $state(false);

  // UI state
  let textCupCount = $state<number | null>(null);
  let detailDialogContent = $state('');
  let batchRunning = $state(false);
  let batchProgress = $state<BatchProgress | null>(null);
  let batchUsedWorker = $state(false);
  let batchController: AbortController | null = null;

  // Element refs (bind:this — not reactive, just pointers to DOM nodes)
  let fileInputEl: HTMLInputElement;
  let cupTextareaEl: HTMLTextAreaElement;
  let detailDialogEl: HTMLDialogElement;
  let limitsDialogEl: HTMLDialogElement;
  let resultsTableEl: HTMLTableElement;

  // --- Derived values ---

  let fileToggleMeta = $derived(displayFileName ?? 'Nessun file caricato');
  let textToggleMeta = $derived(
    textCupCount !== null ? `${textCupCount} CUP` : 'Nessun testo inserito',
  );
  let previewToggleMeta = $derived(parsed ? `${parsed.rows.length} righe` : 'Nessun file');
  let hasMultipleSheets = $derived((parsed?.sheetNames?.length ?? 0) > 1);

  let visibleResults = $derived(displayResults(results, groupSameCups) as UniqueResult[]);

  let summaryData = $derived.by(() => {
    if (results.length === 0) return null;
    return summarizeResults(visibleResults, durationMs);
  });

  let summaryText = $derived.by(() => {
    if (!summaryData) return '';
    const {
      [OUTCOMES.INVALID]: invalid,
      [OUTCOMES.CHECK]: check,
      [OUTCOMES.FOUND_OPENCUP]: found,
      [OUTCOMES.NOT_FOUND_OPENCUP]: notFound,
    } = summaryData.counts;
    const parts = [
      groupSameCups
        ? `${summaryData.total} CUP unici da ${sourceRowCount} righe`
        : `${summaryData.total} righe verificate`,
    ];
    if (found > 0) parts.push(`${found} trovati OpenCUP`);
    if (notFound > 0) parts.push(`${notFound} non trovati OpenCUP`);
    if (check > 0) parts.push(`${check} da verificare`);
    parts.push(`${invalid} invalidi`, `${Math.round(durationMs)} ms`);
    return parts.join(' · ');
  });

  let resultsToggleMeta = $derived(
    !summaryData
      ? 'Nessun risultato'
      : groupSameCups
        ? `${summaryData.total} CUP unici`
        : `${summaryData.total} righe`,
  );

  let filteredResults = $derived.by(() =>
    visibleResults.filter((result) => {
      const matchesOutcome = filter === 'ALL' || result.outcome === filter;
      const haystack =
        `${resultRowsLabel(result)} ${result.normalizedValue} ${result.outcome} ${resultDetail(result)}`.toLowerCase();
      return matchesOutcome && (query === '' || haystack.includes(query));
    }),
  );

  let renderedResults = $derived(filteredResults.slice(0, MAX_RENDERED_RESULT_ROWS));

  let batchProgressLabel = $derived.by(() => {
    if (!batchProgress) return '';
    if (batchProgress.phase === 'lookup') return 'Verifica OpenCUP';
    if (batchProgress.phase === 'complete') return 'Completamento';
    return batchUsedWorker ? 'Validazione nel worker' : 'Validazione';
  });

  let headerDetectionMeta = $derived.by(() => {
    if (!parsed) return '';
    if (parsed.headerDetectedAutomatically === parsed.headerPresent) {
      return parsed.headerPresent
        ? 'intestazione rilevata automaticamente'
        : 'intestazione non rilevata automaticamente';
    }
    return parsed.headerPresent
      ? 'intestazione impostata manualmente'
      : 'prima riga trattata manualmente come dati';
  });

  // Apply is-truncated class to detail cells after DOM updates
  $effect(() => {
    void renderedResults;
    resultsTableEl?.querySelectorAll('.detail-cell').forEach((cell) => {
      const el = cell as HTMLElement;
      if (el.scrollWidth > el.clientWidth) el.classList.add('is-truncated');
    });
  });

  // --- Lifecycle ---

  let datasetPromise: Promise<Dataset | null>;

  onMount(async () => {
    datasetPromise = initializeDataset();
    sessionStorage.removeItem('cup-check:last-results');

    const transferMatch = /^#\/\?transfer=([A-Za-z0-9]+)$/.exec(location.hash);
    if (transferMatch) {
      history.replaceState(null, '', '#/');
      const file = consumeTransfer(transferMatch[1]);
      if (file) {
        try {
          await loadFileParsed(file);
          filePanelCollapsed = true;
          textPanelCollapsed = true;
          previewPanelVisible = true;
          previewPanelCollapsed = false;
        } catch (error) {
          alert((error as Error).message);
        }
      }
    }
  });

  onDestroy(() => {
    batchController?.abort();
  });

  // --- Dataset ---

  async function initializeDataset(): Promise<Dataset | null> {
    setDatasetBar('');
    try {
      const loaded = await loadLatestDataset({
        onProgress: (progress: DownloadProgress) => {
          if (progress.datasetTag) {
            setDatasetBarLoading(progress.datasetTag, progress.percent);
          } else {
            setDatasetBar('');
          }
        },
      });
      dataset = loaded;
      setDatasetBar(
        loaded.manifest ? loaded.manifest.dataset_tag : 'non caricato - solo verifica formato',
      );
      return loaded;
    } catch {
      setDatasetBarError();
      return null;
    }
  }

  // --- File helpers ---

  async function loadFileParsed(file: File, options: { sheetName?: string } = {}) {
    selectedFile = file;
    parsed = await parseFile(file, options);
    fileName = file.name.replace(/\.[^.]+$/, '');
    displayFileName = file.name;
    selectedSheetName = parsed.selectedSheetName ?? '';
    selectedColumnIndex = parsed.suggestedColumnIndex;
  }

  function rebuildRows(rawRows: string[][], headerPresent: boolean): ParsedFile {
    const base = buildParsedRows(rawRows, headerPresent) as ParsedFile;
    const { sheetNames, selectedSheetName: sn } = parsed!;
    return { ...base, ...(sheetNames ? { sheetNames, selectedSheetName: sn } : {}) };
  }

  function isMissingCup(row: { cells: string[] }): boolean {
    return String(row.cells[selectedColumnIndex] ?? '').trim() === '';
  }

  // --- Event handlers ---

  async function handleTextCheck() {
    const lines = textInputLines(cupTextareaEl.value);
    if (lines.length === 0) {
      alert('Nessun CUP trovato. Incolla almeno un codice, uno per riga.');
      return;
    }
    const batchRows = (lines as string[]).map((line: string, i: number) => ({
      value: line,
      row: i + 1,
    }));
    const batch = await runValidationRows(batchRows);
    if (!batch) return;
    results = batch.results;
    sourceRowCount = batch.sourceRowCount;
    fileName = 'cup-testo';
    filter = 'ALL';
    query = '';
    durationMs = batch.durationMs;
    textCupCount = lines.length;
    textPanelCollapsed = true;
    previewPanelVisible = false;
    resultsPanelVisible = true;
    resultsPanelCollapsed = false;
  }

  async function handleFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await loadFileParsed(file);
      filePanelCollapsed = true;
      textPanelCollapsed = true;
      previewPanelVisible = true;
      previewPanelCollapsed = false;
      resultsPanelVisible = false;
    } catch (error) {
      alert((error as Error).message);
    }
  }

  async function handleSheetChange(event: Event) {
    if (!selectedFile) return;
    try {
      const sheetName = (event.target as HTMLSelectElement).value;
      parsed = await parseFile(selectedFile, { sheetName });
      selectedSheetName = parsed.selectedSheetName ?? '';
      selectedColumnIndex = parsed.suggestedColumnIndex;
    } catch (error) {
      alert((error as Error).message);
    }
  }

  function handleColumnChange(event: Event) {
    selectedColumnIndex = Number((event.target as HTMLSelectElement).value);
  }

  function handleHeaderToggle(event: Event) {
    parsed = rebuildRows(parsed!.rawRows, (event.target as HTMLInputElement).checked);
    selectedColumnIndex = parsed.suggestedColumnIndex;
  }

  async function handleCheck() {
    const rowsToValidate = skipMissingCup
      ? parsed!.rows.filter((row) => !isMissingCup(row))
      : parsed!.rows;
    const batchRows = rowsToValidate.map((row) => ({
      value: row.cells[selectedColumnIndex] ?? '',
      row: row.originalRowNumber,
    }));
    const batch = await runValidationRows(batchRows);
    if (!batch) return;
    results = batch.results;
    sourceRowCount = batch.sourceRowCount;
    durationMs = batch.durationMs;
    previewPanelCollapsed = true;
    resultsPanelVisible = true;
    resultsPanelCollapsed = false;
  }

  async function runValidationRows(rows: BatchInputRow[]) {
    batchController?.abort();
    batchController = new AbortController();
    batchRunning = true;
    batchUsedWorker = rows.length > 100_000;
    batchProgress = {
      phase: 'validate',
      processed: 0,
      total: rows.length,
      percent: rows.length === 0 ? 100 : 0,
    };

    try {
      const loadedDataset = dataset ?? (await datasetPromise.catch(() => null));
      const batch = await validateRows(rows, {
        dataset: loadedDataset,
        signal: batchController.signal,
        onProgress: (progress) => {
          batchProgress = progress;
        },
      });
      batchUsedWorker = batch.usedWorker;
      batchProgress = { phase: 'complete', processed: rows.length, total: rows.length, percent: 100 };
      return batch;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        alert((error as Error).message);
      }
      return null;
    } finally {
      batchRunning = false;
      batchController = null;
    }
  }

  function handleCancelBatch() {
    batchController?.abort();
  }

  function handleClear() {
    batchController?.abort();
    selectedFile = null;
    parsed = null;
    selectedColumnIndex = 0;
    results = [];
    sourceRowCount = 0;
    durationMs = 0;
    filter = 'ALL';
    query = '';
    fileName = 'report';
    displayFileName = null;
    selectedSheetName = '';
    skipMissingCup = true;
    groupSameCups = true;
    textCupCount = null;
    filePanelCollapsed = false;
    textPanelCollapsed = false;
    previewPanelVisible = false;
    previewPanelCollapsed = false;
    resultsPanelVisible = false;
    resultsPanelCollapsed = false;
    batchRunning = false;
    batchProgress = null;
    batchUsedWorker = false;
    fileInputEl.value = '';
    cupTextareaEl.value = '';
    sessionStorage.removeItem('cup-check:last-results');
  }

  function handleExport() {
    const blob = new Blob([buildCsvReport(displayResults(results, groupSameCups))], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}_check.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openRowsDialog(rowsLabel: string) {
    detailDialogContent = `Righe originali: ${rowsLabel}`;
    detailDialogEl.showModal();
  }

  function openDetailCellDialog(event: MouseEvent, cellDetail: string) {
    const el = (event.target as Element).closest('.detail-cell') as HTMLElement | null;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    detailDialogContent = cellDetail;
    detailDialogEl.showModal();
  }

  // --- Dataset status bar (in the layout, outside this component) ---

  function setDatasetBar(text: string, { emphasis = false } = {}) {
    const bar = document.querySelector('#dataset-status-bar');
    if (!bar) return;
    bar.classList.remove('is-loading');
    bar.classList.toggle('is-emphasis', emphasis);
    bar.replaceChildren();
    if (!text) return;
    bar.replaceChildren(
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

  function setDatasetBarLoading(tag: string, percent: number) {
    const bar = document.querySelector('#dataset-status-bar');
    if (!bar) return;
    bar.classList.remove('is-emphasis');
    bar.classList.add('is-loading');
    bar.replaceChildren(
      Object.assign(document.createElement('span'), {
        className: 'dataset-status-separator',
        textContent: ' · ',
      }),
      Object.assign(document.createElement('span'), {
        className: 'dataset-status-label',
        textContent: tag,
      }),
      Object.assign(document.createElement('strong'), {
        className: 'dataset-loading-label',
        textContent: `Loading ${percent}%`,
      }),
    );
  }

  function setDatasetBarError() {
    setDatasetBar('non disponibile - solo verifica formato', { emphasis: true });
  }

  function badgeClass(outcome: string): string {
    if (outcome === OUTCOMES.FOUND_OPENCUP) return 'good';
    if (outcome === OUTCOMES.INVALID) return 'bad';
    return 'warn';
  }
</script>

<section class="project-note" aria-labelledby="title">
  <h1 id="title" class="visually-hidden">Verifica CUP</h1>
  <p>cup-check è uno strumento statico per controllare il formato di liste di Codici Unici di Progetto direttamente nel browser, senza caricare dati su server esterni.
  Il servizio verifica il formato dei Codici Unici di Progetto e produce un report esportabile per revisione, audit o rendicontazione.</p>
  <p>Il controllo non sostituisce le fonti autoritative: consulta i
    <button id="open-limits-desc" class="link-button" type="button"
      onclick={() => limitsDialogEl.showModal()}>Limiti del controllo</button>
    per capire cosa viene verificato e cosa resta escluso.</p>
</section>

<section id="file" class="control-panel" class:collapsed={filePanelCollapsed} aria-labelledby="upload-title">
  <button id="file-toggle" class="panel-toggle" type="button"
    aria-expanded={filePanelCollapsed ? 'false' : 'true'}
    aria-controls="file-controls"
    onclick={() => (filePanelCollapsed = !filePanelCollapsed)}>
    <span id="upload-title">File</span>
    <span id="file-toggle-meta" title={displayFileName ?? ''}>{fileToggleMeta}</span>
  </button>
  <div id="file-controls" class="panel-body file-controls">
    <p>Carica un CSV o XLSX, scegli la colonna dei codici e ottieni un report riga per riga. Fino a 25 MB consigliati.</p>
    <label class="dropzone" for="file-input">
      <input id="file-input" type="file" accept=".csv,.xlsx,text/csv"
        bind:this={fileInputEl}
        onchange={handleFileChange} />
      <span>Carica file</span>
    </label>
  </div>
</section>

<section id="text" class="control-panel" class:collapsed={textPanelCollapsed} aria-labelledby="text-title">
  <button id="text-toggle" class="panel-toggle" type="button"
    aria-expanded={textPanelCollapsed ? 'false' : 'true'}
    aria-controls="text-controls"
    onclick={() => (textPanelCollapsed = !textPanelCollapsed)}>
    <span id="text-title">Testo</span>
    <span id="text-toggle-meta">{textToggleMeta}</span>
  </button>
  <div id="text-controls" class="panel-body text-controls">
    <p>Incolla i CUP da verificare, uno per riga. Le righe vuote vengono ignorate.</p>
    <textarea id="cup-textarea" rows="8"
      placeholder="Incolla qui i CUP, uno per riga&#x0a;Es: A58C15000390001&#x0a;    B11B15001360001"
      bind:this={cupTextareaEl}></textarea>
    <div class="actions-row text-actions-row">
      <button id="text-check-button" class="primary" type="button"
        disabled={batchRunning}
        onclick={handleTextCheck}>Verifica</button>
    </div>
  </div>
</section>

<section class="workspace" aria-label="Area operativa verifica CUP">
  {#if batchProgress}
    <div id="batch-progress" class:batch-progress--running={batchRunning}>
      <ProgressBar label={batchProgressLabel} percent={batchProgress.percent} />
      {#if batchRunning}
        <button id="cancel-batch-button" class="secondary" type="button" onclick={handleCancelBatch}>Annulla</button>
      {/if}
    </div>
  {/if}
  <section id="preview-panel" class="control-panel"
    class:hidden={!previewPanelVisible}
    class:collapsed={previewPanelCollapsed}
    aria-labelledby="preview-title">
    <button id="preview-toggle" class="panel-toggle" type="button"
      aria-expanded={previewPanelCollapsed ? 'false' : 'true'}
      aria-controls="preview-controls"
      onclick={() => (previewPanelCollapsed = !previewPanelCollapsed)}>
      <span id="preview-title">Anteprima</span>
      <span id="preview-toggle-meta">{previewToggleMeta}</span>
    </button>
    <div id="preview-controls" class="panel-body">
      <div class="section-head preview-head">
        <div class="preview-row">
          <p id="file-meta">
            {#if parsed}
              <span class="file-meta-name" title={displayFileName ?? ''}>{displayFileName ?? ''}</span
              ><span class="file-meta-detail"> - {parsed.rows.length} righe dati - {headerDetectionMeta}</span>
            {/if}
          </p>
          <label id="sheet-select-label" class="preview-select" class:hidden={!hasMultipleSheets}>
            Scheda Excel
            <select id="sheet-select" disabled={!hasMultipleSheets}
              value={selectedSheetName}
              onchange={handleSheetChange}>
              {#each (parsed?.sheetNames ?? []) as sheetName (sheetName)}
                <option value={sheetName}>{sheetName}</option>
              {/each}
            </select>
          </label>
        </div>
        <div class="preview-row">
          <label class="toggle">
            <input id="header-toggle" type="checkbox"
              checked={parsed?.headerPresent ?? false}
              onchange={handleHeaderToggle} />
            <span>La prima riga contiene intestazioni</span>
          </label>
          <label class="preview-select">
            Colonna CUP
            <select id="column-select"
              value={String(selectedColumnIndex)}
              onchange={handleColumnChange}>
              {#each (parsed?.headers ?? []) as header, index (index)}
                <option value={String(index)}>{header || `Colonna ${index + 1}`}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>
      <div class="table-wrap">
        <table id="preview-table">
          {#if parsed}
            <thead>
              <tr>
                {#each parsed.headers as header, i (i)}
                  <th>{header}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each parsed.rows.slice(0, 10) as row, i (i)}
                <tr>
                  {#each row.cells as cell, index (index)}
                    <td class:selected={index === selectedColumnIndex}>{cell}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          {/if}
        </table>
      </div>
      <div class="actions-row">
        <label class="toggle">
          <input id="skip-missing-cup" type="checkbox"
            bind:checked={skipMissingCup} />
          <span>Ignora celle CUP assenti</span>
        </label>
        <button id="check-button" class="primary" type="button"
          disabled={batchRunning}
          onclick={handleCheck}>Verifica</button>
      </div>
    </div>
  </section>

  <section id="results-panel" class="control-panel"
    class:hidden={!resultsPanelVisible}
    class:collapsed={resultsPanelCollapsed}
    aria-labelledby="results-title">
    <button id="results-toggle" class="panel-toggle" type="button"
      aria-expanded={resultsPanelCollapsed ? 'false' : 'true'}
      aria-controls="results-controls"
      onclick={() => (resultsPanelCollapsed = !resultsPanelCollapsed)}>
      <span id="results-title">Risultati</span>
      <span id="results-toggle-meta">{resultsToggleMeta}</span>
    </button>
    <div id="results-controls" class="panel-body">
      <div class="section-head">
        <p id="summary">{summaryText}</p>
        <div class="button-row">
          <button id="export-button" class="primary" type="button"
            disabled={batchRunning}
            onclick={handleExport}>Esporta CSV</button>
          <button id="clear-button" class="secondary" type="button"
            onclick={handleClear}>Pulisci</button>
        </div>
      </div>
      <div class="filters">
        <label class="toggle result-group-toggle">
          <input id="group-same-cups" type="checkbox"
            bind:checked={groupSameCups} />
          <span>Raggruppa CUP uguali</span>
        </label>
        <label class="result-outcome-filter">
          Esito
          <select id="filter-select" bind:value={filter}>
            <option value="ALL">Tutti</option>
            <option value={OUTCOMES.FOUND_OPENCUP}>Trovati OpenCUP</option>
            <option value={OUTCOMES.NOT_FOUND_OPENCUP}>Non trovati OpenCUP</option>
            <option value={OUTCOMES.CHECK}>Da verificare</option>
            <option value={OUTCOMES.INVALID}>Invalidi</option>
          </select>
        </label>
        <label class="result-search-filter">
          Cerca
          <input id="search-input" type="search" placeholder="CUP o dettaglio"
            bind:value={query} />
        </label>
      </div>
      <div class="table-wrap">
        <table id="results-table" bind:this={resultsTableEl}>
          {#if filteredResults.length > renderedResults.length}
            <caption>Mostrate {renderedResults.length} di {filteredResults.length} righe filtrate</caption>
          {/if}
          {#if renderedResults.length > 0}
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
              {#each renderedResults as result (result.inputRow ?? result.normalizedValue)}
                {@const rows = result.inputRows ?? [result.inputRow]}
                {@const detail = resultDetail(result)}
                {@const opencupUrl = opencupUrlForResult(result)}
                <tr>
                  <td>
                    {#if rows.length <= 1}
                      {rows[0] ?? ''}
                    {:else}
                      <button class="link-button multiple-rows-button" type="button"
                        aria-label="Mostra tutte le righe per il CUP"
                        onclick={() => openRowsDialog(resultRowsLabel(result))}>
                        {rows[0] ?? ''}++
                      </button>
                    {/if}
                  </td>
                  <td title={result.normalizedValue}>
                    <code class="cup-cell">{result.normalizedValue}</code>
                  </td>
                  <td>
                    <span class="badge {badgeClass(result.outcome)}">{result.outcome}</span>
                  </td>
                  <td>
                    <button type="button" class="detail-cell" title={detail}
                      onclick={(e) => openDetailCellDialog(e, detail)}>
                      {detail}
                    </button>
                  </td>
                  <td>
                    {#if opencupUrl}
                      <a href={opencupUrl} target="_blank" rel="noopener noreferrer">Apri</a>
                    {:else}
                      <span aria-label="Link OpenCUP non disponibile">-</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          {/if}
        </table>
      </div>
    </div>
  </section>
</section>

<dialog id="detail-dialog" class="detail-dialog" aria-labelledby="detail-dialog-label"
  bind:this={detailDialogEl}
  onclick={(e) => { if (e.target === detailDialogEl) detailDialogEl.close(); }}>
  <p id="detail-dialog-label" class="detail-dialog-text">{detailDialogContent}</p>
  <form method="dialog">
    <button class="secondary" type="submit">Chiudi</button>
  </form>
</dialog>

<dialog id="limits-dialog" class="limits-dialog" aria-labelledby="limits-title"
  bind:this={limitsDialogEl}
  onclick={(e) => { if (e.target === limitsDialogEl) limitsDialogEl.close(); }}>
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
