<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import DropZone from '../components/DropZone.svelte';
  import ImportWizard from '../components/ImportWizard.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import { loadLatestDataset } from '../lib/data/dataset-loader.js';
  import {
    buildBatchRows,
    buildImportedCupRows,
    createImportSources,
    type ImportedCupRow,
    type ImportSource,
  } from '../lib/core/import-plan.js';
  import { buildCsvReport, opencupUrlForResult, resultDetail } from '../lib/core/report.js';
  import { displayResults, resultRowsLabel } from '../lib/core/results.js';
  import { textInputLines } from '../text-input.js';
  import { OUTCOMES, summarizeResults } from '../lib/core/validator.js';
  import { validateRows, type BatchInputRow, type BatchProgress } from '../lib/core/validation-worker.js';
  import { consumeTransfer } from '../lib/data/transfer.js';
  import type { Dataset, UniqueResult, Outcome, DownloadProgress } from '../lib/types.js';

  const MAX_RENDERED_RESULT_ROWS = 500;

  // Core state (replaces state.js)
  let dataset = $state<Dataset | null>(null);
  let importSources = $state<ImportSource[]>([]);
  let importedRows = $state<ImportedCupRow[]>([]);
  let importWizardVisible = $state(false);
  let results = $state<UniqueResult[]>([]);
  let sourceRowCount = $state(0);
  let durationMs = $state(0);
  let filter = $state<Outcome | 'ALL'>('ALL');
  let query = $state('');
  let fileName = $state('report');
  let displayFileName = $state<string | null>(null);
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
  let detailDialogTable = $state<{ columns: string[]; rows: { label: string; values: string[] }[] } | null>(null);
  let batchRunning = $state(false);
  let batchProgress = $state<BatchProgress | null>(null);
  let batchUsedWorker = $state(false);
  let batchController: AbortController | null = null;
  let datasetController: AbortController | null = null;

  // Element refs (bind:this — not reactive, just pointers to DOM nodes)
  let cupTextareaEl: HTMLTextAreaElement;
  let detailDialogEl: HTMLDialogElement;
  let limitsDialogEl: HTMLDialogElement;
  let resultsTableEl: HTMLTableElement;

  // --- Derived values ---

  let fileToggleMeta = $derived(displayFileName ?? 'Nessun file caricato');
  let textToggleMeta = $derived(
    textCupCount !== null ? `${textCupCount} CUP` : 'Nessun testo inserito',
  );
  let previewToggleMeta = $derived(
    importedRows.length > 0 ? `${importedRows.length} righe CUP` : 'Nessun batch',
  );

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
        `${resultRowsLabel(result)} ${sourceSummary(result)} ${result.normalizedValue} ${result.outcome} ${resultDetail(result)}`.toLowerCase();
      return matchesOutcome && (query === '' || haystack.includes(query));
    }),
  );

  let renderedResults = $derived(filteredResults.slice(0, MAX_RENDERED_RESULT_ROWS));

  let batchProgressLabel = $derived.by(() => {
    if (!batchProgress) return '';
    if (batchProgress.phase === 'lookup') return 'Verifica presenza nel dataset OpenCUP';
    if (batchProgress.phase === 'complete') return '';
    return batchUsedWorker ? 'Validazione formato CUP in background' : 'Validazione formato CUP';
  });

  // --- Lifecycle ---

  let datasetPromise: Promise<Dataset | null>;

  onMount(async () => {
    datasetController = new AbortController();
    datasetPromise = initializeDataset(datasetController.signal);
    sessionStorage.removeItem('cup-check:last-results');

    const transferMatch = /^#\/\?transfer=([A-Za-z0-9]+)$/.exec(location.hash);
    if (transferMatch) {
      history.replaceState(null, '', '#/');
      const file = consumeTransfer(transferMatch[1]);
      if (file) {
        await beginImport([file]);
      }
    }
  });

  onDestroy(() => {
    batchController?.abort();
    datasetController?.abort();
  });

  // --- Dataset ---

  async function initializeDataset(signal?: AbortSignal): Promise<Dataset | null> {
    setDatasetBar('');
    try {
      const loaded = await loadLatestDataset({
        signal,
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
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setDatasetBarError();
      }
      return null;
    }
  }

  // --- Import helpers ---

  async function beginImport(files: File[]) {
    if (files.length === 0) return;
    try {
      const sources = await createImportSources(files);
      importSources = sources;
      importedRows = [];
      fileName = sources.length === 1 ? sources[0].fileName.replace(/\.[^.]+$/, '') : 'cup-import';
      displayFileName = sources.length === 1 ? sources[0].fileName : `${sources.length} sorgenti`;
      filePanelCollapsed = true;
      textPanelCollapsed = true;
      importWizardVisible = true;
      previewPanelVisible = false;
      previewPanelCollapsed = false;
      resultsPanelVisible = false;
    } catch (error) {
      alert((error as Error).message);
    }
  }

  async function handleImportConfirm(sources: ImportSource[]) {
    const nextImportedRows = buildImportedCupRows(sources, { skipMissingCup });
    importSources = sources;
    importedRows = nextImportedRows;
    importWizardVisible = false;
    previewPanelVisible = true;
    previewPanelCollapsed = true;
    resultsPanelVisible = false;
    await validateImportedRows(nextImportedRows);
  }

  function handleImportCancel() {
    importWizardVisible = false;
    if (importedRows.length === 0) {
      importSources = [];
      displayFileName = null;
      fileName = 'report';
    }
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

  async function handleFiles(files: File[]) {
    await beginImport(files);
  }

  async function handleCheck() {
    await validateImportedRows(importedRows);
  }

  async function validateImportedRows(rows: ImportedCupRow[]) {
    const batchRows = buildBatchRows(rows);
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
      batchProgress = null;
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
    importSources = [];
    importedRows = [];
    importWizardVisible = false;
    results = [];
    sourceRowCount = 0;
    durationMs = 0;
    filter = 'ALL';
    query = '';
    fileName = 'report';
    displayFileName = null;
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

  function openResultDetailDialog(cellDetail: string) {
    detailDialogTable = null;
    detailDialogContent = cellDetail;
    detailDialogEl.showModal();
  }

  function originRowsForResult(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): ImportedCupRow[] {
    if (importedRows.length === 0) return [];
    const rows = new Set(result.inputRows ?? [result.inputRow]);
    return importedRows.filter((row) => rows.has(row.row));
  }

  function sourceRowsForResult(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): string[] {
    const originRows = originRowsForResult(result);
    if (originRows.length === 0) {
      return (result.inputRows ?? [result.inputRow]).map((row) => String(row ?? ''));
    }

    return originRows.map((row) => String(row.sourceRowNumber));
  }

  function sourceButtonLabel(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): string {
    const rows = sourceRowsForResult(result);
    if (rows.length <= 1) return rows[0] ?? '-';
    return `${rows[0]}++`;
  }

  function sourceSummary(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): string {
    const originRows = originRowsForResult(result);
    if (originRows.length === 0) return resultRowsLabel(result);

    return originRows
      .map((row) => {
        const sheet = row.schedaOrigine ? ` scheda ${row.schedaOrigine}` : '';
        return `riga ${row.sourceRowNumber} ${row.fileOrigine}${sheet} ${row.colonnaOrigine}`;
      })
      .join(' ');
  }

  function sourceDetailTable(
    result: Pick<UniqueResult, 'inputRows' | 'inputRow'>,
  ): { columns: string[]; rows: { label: string; values: string[] }[] } {
    const originRows = originRowsForResult(result);

    if (originRows.length === 0) {
      return {
        columns: ['-'],
        rows: [
          { label: 'Scheda', values: ['-'] },
          { label: 'Colonna', values: ['-'] },
          { label: sourceRowsForResult(result).length === 1 ? 'Riga' : 'Righe', values: [sourceRowsForResult(result).join(', ')] },
        ],
      };
    }

    const groups = sourceGroups(originRows);

    return {
      columns: groups.map((group) => group.fileName),
      rows: [
        { label: 'Scheda', values: groups.map((group) => group.sheetName ?? '-') },
        {
          label: 'Colonna',
          values: groups.map((group) =>
            uniqueSourceValues(group.rows.map((row) => row.colonnaOrigine)),
          ),
        },
        {
          label: sourceRowsForResult(result).length === 1 ? 'Riga' : 'Righe',
          values: groups.map((group) =>
            uniqueSourceValues(group.rows.map((row) => String(row.sourceRowNumber))),
          ),
        },
      ],
    };
  }

  function sourceGroups(originRows: ImportedCupRow[]): Array<{
    key: string;
    fileName: string;
    sheetName?: string;
    rows: ImportedCupRow[];
  }> {
    const groups: Array<{ key: string; fileName: string; sheetName?: string; rows: ImportedCupRow[] }> = [];

    for (const row of originRows) {
      const key = `${row.fileOrigine}\u0000${row.schedaOrigine ?? ''}`;
      const existing = groups.find((group) => group.key === key);
      if (existing) {
        existing.rows.push(row);
        continue;
      }
      groups.push({
        key,
        fileName: row.fileOrigine,
        ...(row.schedaOrigine ? { sheetName: row.schedaOrigine } : {}),
        rows: [row],
      });
    }

    return groups;
  }

  function uniqueSourceValues(values: Array<string | undefined>): string {
    const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];
    return unique.length > 0 ? unique.join(', ') : '-';
  }

  function openSourceDialog(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>) {
    detailDialogContent = '';
    detailDialogTable = sourceDetailTable(result);
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
    <p>Carica uno o più CSV/XLSX, configura le colonne CUP per ogni sorgente e ottieni un batch unico. Fino a 25 MB consigliati per file.</p>
    <DropZone disabled={batchRunning} onFiles={handleFiles} />
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
  {#if batchProgress && batchProgress.percent < 100}
    <div id="batch-progress" class:batch-progress--running={batchRunning}>
      <ProgressBar label={batchProgressLabel} percent={batchProgress.percent} />
      {#if batchRunning}
        <button id="cancel-batch-button" class="secondary" type="button" onclick={handleCancelBatch}>Annulla</button>
      {/if}
    </div>
  {/if}
  {#if importWizardVisible}
    <ImportWizard
      sources={importSources}
      {skipMissingCup}
      onSourcesChange={(sources) => (importSources = sources)}
      onSkipMissingCupChange={(value) => (skipMissingCup = value)}
      onConfirm={handleImportConfirm}
      onCancel={handleImportCancel}
    />
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
        <div>
          <p id="file-meta">
            <span class="file-meta-name" title={displayFileName ?? ''}>{displayFileName ?? ''}</span>
            <span class="file-meta-detail"> - {importSources.filter((source) => source.included).length} sorgenti incluse</span>
          </p>
          <p>Batch normalizzato con origine file, scheda, riga e colonna conservate per ogni CUP.</p>
        </div>
        <button class="secondary" type="button" disabled={batchRunning} onclick={() => (importWizardVisible = true)}>
          Modifica importazione
        </button>
      </div>
      <div class="table-wrap">
        <table id="preview-table">
          {#if importedRows.length > 0}
            <thead>
              <tr>
                <th>Riga batch</th>
                <th>CUP</th>
                <th>File origine</th>
                <th>Scheda</th>
                <th>Riga origine</th>
                <th>Colonna origine</th>
              </tr>
            </thead>
            <tbody>
              {#each importedRows.slice(0, 10) as row (row.row)}
                <tr>
                  <td>{row.row}</td>
                  <td>{row.value}</td>
                  <td>{row.fileOrigine}</td>
                  <td>{row.schedaOrigine ?? '-'}</td>
                  <td>{row.sourceRowNumber}</td>
                  <td>{row.colonnaOrigine}</td>
                </tr>
              {/each}
            </tbody>
          {/if}
        </table>
      </div>
      <div class="actions-row">
        <p>{importedRows.length > 10 ? `Mostrate 10 di ${importedRows.length} righe importate.` : `${importedRows.length} righe importate.`}</p>
        <button id="check-button" class="primary" type="button"
          disabled={batchRunning || importedRows.length === 0}
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
                <th>Fonte</th>
                <th>CUP</th>
                <th>Esito</th>
                <th>OpenCUP</th>
              </tr>
            </thead>
            <tbody>
              {#each renderedResults as result (result.inputRow ?? result.normalizedValue)}
                {@const detail = resultDetail(result)}
                {@const opencupUrl = opencupUrlForResult(result)}
                <tr>
                  <td>
                    <button class="link-button source-button" type="button"
                      aria-label="Mostra fonte del CUP"
                      onclick={() => openSourceDialog(result)}>
                      {sourceButtonLabel(result)}
                    </button>
                  </td>
                  <td title={result.normalizedValue}>
                    <code class="cup-cell">{result.normalizedValue}</code>
                  </td>
                  <td>
                    <button type="button" class="outcome-detail-button" title={detail}
                      aria-label={`Mostra dettaglio esito ${result.outcome}`}
                      onclick={() => openResultDetailDialog(detail)}>
                      <span class="badge {badgeClass(result.outcome)}">{result.outcome}</span>
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
  {#if detailDialogTable}
    <div class="detail-source-scroll">
      <table id="detail-dialog-label" class="detail-source-table" aria-label="Fonte del CUP">
        <thead>
          <tr>
            <th scope="col">Fonte</th>
            {#each detailDialogTable.columns as column, index (`${column}-${index}`)}
              <th scope="col" class="detail-source-file" title={column}>{column}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each detailDialogTable.rows as row (row.label)}
            <tr>
              <th scope="row">{row.label}</th>
              {#each row.values as value, index (`${row.label}-${index}`)}
                <td>{value}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p id="detail-dialog-label" class="detail-dialog-text">{detailDialogContent}</p>
  {/if}
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
