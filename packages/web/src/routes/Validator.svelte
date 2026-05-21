<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { i18n } from '../i18n/i18n.svelte.js';
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
  import { downloadBlob } from '../lib/core/download.js';
  import { displayResults, resultRowsLabel } from '../lib/core/results.js';
  import {
    batchProgressLabel as buildBatchProgressLabel,
    sourceButtonLabel as buildSourceButtonLabel,
    sourceDetailTable as buildSourceDetailTable,
    sourceSummary as buildSourceSummary,
  } from '../lib/core/validator-view-model.js';
  import { textInputLines } from '../text-input.js';
  import { OUTCOMES, summarizeResults } from '../lib/core/validator.js';
  import { validateRows, type BatchInputRow, type BatchProgress } from '../lib/core/validation-worker.js';
  import { consumeTransfer } from '../lib/data/transfer.js';
  import type { Dataset, UniqueResult, Outcome, DownloadProgress } from '../lib/types.js';

  const MAX_RENDERED_RESULT_ROWS = 500;
  const importPlanI18nOptions = () => ({
    columnLabel: (index: number) => i18n.t('source.column', { number: index + 1 }),
  });

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
  let groupSameCups = $state(false);

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
  let previewToggleEl: HTMLButtonElement;

  let liveAnnouncement = $state('');
  let lastFocusedBeforeWizard: HTMLElement | null = null;
  let lastBatchAnnouncement = '';

  // --- Derived values ---

  let fileToggleMeta = $derived(
    displayFileName ??
      (importSources.length > 1
        ? i18n.t('validator.sourcesCount', { count: importSources.length })
        : i18n.t('validator.noFile')),
  );
  let textToggleMeta = $derived(
    textCupCount !== null ? i18n.t('validator.textCount', { count: textCupCount }) : i18n.t('validator.noText'),
  );
  let previewToggleMeta = $derived(
    importedRows.length > 0 ? i18n.t('validator.cupRows', { count: importedRows.length }) : i18n.t('validator.noBatch'),
  );

  let visibleResults = $derived(displayResults(results, groupSameCups) as UniqueResult[]);
  let importedRowsByRow = $derived(new Map(importedRows.map((r) => [r.row, r])));

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
        ? i18n.t('validator.summaryUnique', { total: summaryData.total, rows: sourceRowCount })
        : i18n.t('validator.summaryRowsChecked', { total: summaryData.total }),
    ];
    if (found > 0) parts.push(i18n.t('validator.summaryFound', { count: found }));
    if (notFound > 0) parts.push(i18n.t('validator.summaryNotFound', { count: notFound }));
    if (check > 0) parts.push(i18n.t('validator.summaryCheck', { count: check }));
    parts.push(i18n.t('validator.summaryInvalid', { count: invalid }), `${Math.round(durationMs)} ms`);
    return parts.join(' · ');
  });

  let resultsToggleMeta = $derived(
    !summaryData
      ? i18n.t('validator.noResults')
      : groupSameCups
        ? i18n.t('validator.uniqueCups', { count: summaryData.total })
        : i18n.t('validator.rows', { count: summaryData.total }),
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
    return buildBatchProgressLabel(batchProgress, batchUsedWorker, i18n.t.bind(i18n));
  });

  $effect(() => {
    if (!batchProgress || !batchProgressLabel) return;
    const message = `${batchProgressLabel}: ${batchProgress.percent}%`;
    if (message !== lastBatchAnnouncement) {
      liveAnnouncement = message;
      lastBatchAnnouncement = message;
    }
  });

  // --- Lifecycle ---

  let datasetPromise: Promise<Dataset | null> = Promise.resolve(null);

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
        loaded.manifest ? loaded.manifest.dataset_tag : i18n.t('validator.datasetFormatOnly'),
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
    lastFocusedBeforeWizard = document.activeElement as HTMLElement;
    try {
      const sources = await createImportSources(files, importPlanI18nOptions());
      importSources = sources;
      importedRows = [];
      fileName = sources.length === 1 ? sources[0].fileName.replace(/\.[^.]+$/, '') : 'cup-import';
      displayFileName = sources.length === 1 ? sources[0].fileName : null;
      filePanelCollapsed = true;
      textPanelCollapsed = true;
      importWizardVisible = true;
      previewPanelVisible = false;
      previewPanelCollapsed = false;
      resultsPanelVisible = false;
    } catch (error) {
      alert(i18n.errorMessage(error));
    }
  }

  async function handleImportConfirm(sources: ImportSource[]) {
    const nextImportedRows = buildImportedCupRows(sources, importPlanI18nOptions());
    importSources = sources;
    importedRows = nextImportedRows;
    importWizardVisible = false;
    previewPanelVisible = true;
    previewPanelCollapsed = true;
    resultsPanelVisible = false;
    await tick();
    previewToggleEl?.focus();
    await validateImportedRows(nextImportedRows);
  }

  async function handleImportCancel() {
    importWizardVisible = false;
    if (importedRows.length === 0) {
      importSources = [];
      displayFileName = null;
      fileName = 'report';
    }
    await tick();
    lastFocusedBeforeWizard?.focus();
    lastFocusedBeforeWizard = null;
  }

  // --- Event handlers ---

  async function handleTextCheck() {
    const lines = textInputLines(cupTextareaEl.value);
    if (lines.length === 0) {
      alert(i18n.t('validator.alertNoCup'));
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
      const loadedDataset = dataset ?? (await datasetPromise);
      const batch = await validateRows(rows, {
        dataset: loadedDataset,
        signal: batchController.signal,
        onProgress: (progress) => {
          batchProgress = progress;
        },
      });
      batchUsedWorker = batch.usedWorker;
      batchProgress = null;
      liveAnnouncement = i18n.t('validator.completed', { count: batch.results.length });
      return batch;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        alert(i18n.errorMessage(error));
      }
      return null;
    } finally {
      batchRunning = false;
      batchController = null;
    }
  }

  function handleCancelBatch() {
    batchController?.abort();
    liveAnnouncement = i18n.t('validator.cancelled');
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
    groupSameCups = false;
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
    const blob = new Blob([buildCsvReport(displayResults(results, groupSameCups), importedRows)], {
      type: 'text/csv;charset=utf-8',
    });
    downloadBlob(blob, `${fileName}_check.csv`);
  }

  function openResultDetailDialog(cellDetail: string) {
    detailDialogTable = null;
    detailDialogContent = cellDetail;
    detailDialogEl.showModal();
  }

  function sourceButtonLabel(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): string {
    return buildSourceButtonLabel(result, importedRowsByRow, importedRows.length > 0);
  }

  function sourceSummary(result: Pick<UniqueResult, 'inputRows' | 'inputRow'>): string {
    return buildSourceSummary(result, importedRowsByRow, importedRows.length > 0, i18n.t.bind(i18n));
  }

  function sourceDetailTable(
    result: Pick<UniqueResult, 'inputRows' | 'inputRow'>,
  ): { columns: string[]; rows: { label: string; values: string[] }[] } {
    return buildSourceDetailTable(result, importedRowsByRow, importedRows.length > 0, i18n.t.bind(i18n));
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
        textContent: i18n.t('validator.loading', { percent }),
      }),
    );
  }

  function setDatasetBarError() {
    setDatasetBar(i18n.t('validator.datasetUnavailable'), { emphasis: true });
  }

  function badgeClass(outcome: string): string {
    if (outcome === OUTCOMES.FOUND_OPENCUP) return 'good';
    if (outcome === OUTCOMES.INVALID) return 'bad';
    return 'warn';
  }
</script>

<section class="project-note" aria-labelledby="title">
  <h1 id="title" class="visually-hidden">{i18n.t('validator.title')}</h1>
  <p>{i18n.t('validator.intro')}</p>
  <p>{i18n.t('validator.limitsLead')}
    <button id="open-limits-desc" class="link-button" type="button"
      onclick={() => limitsDialogEl.showModal()}>{i18n.t('validator.limitsLink')}</button>
    {i18n.t('validator.limitsTail')}</p>
</section>

<section id="file" class="control-panel" class:collapsed={filePanelCollapsed} aria-labelledby="upload-title">
  <button id="file-toggle" class="panel-toggle" type="button"
    aria-expanded={filePanelCollapsed ? 'false' : 'true'}
    aria-controls="file-controls"
    onclick={() => (filePanelCollapsed = !filePanelCollapsed)}>
    <span id="upload-title">{i18n.t('validator.file')}</span>
    <span id="file-toggle-meta" title={displayFileName ?? ''}>{fileToggleMeta}</span>
  </button>
  <div id="file-controls" class="panel-body file-controls">
    <p>{i18n.t('validator.fileHelp')}</p>
    <DropZone disabled={batchRunning} onFiles={handleFiles} />
  </div>
</section>

<section id="text" class="control-panel" class:collapsed={textPanelCollapsed} aria-labelledby="text-title">
  <button id="text-toggle" class="panel-toggle" type="button"
    aria-expanded={textPanelCollapsed ? 'false' : 'true'}
    aria-controls="text-controls"
    onclick={() => (textPanelCollapsed = !textPanelCollapsed)}>
    <span id="text-title">{i18n.t('validator.text')}</span>
    <span id="text-toggle-meta">{textToggleMeta}</span>
  </button>
  <div id="text-controls" class="panel-body text-controls">
    <p>{i18n.t('validator.textHelp')}</p>
    <textarea id="cup-textarea" rows="8"
      placeholder={i18n.t('validator.textPlaceholder')}
      bind:this={cupTextareaEl}></textarea>
    <div class="actions-row text-actions-row">
      <button id="text-check-button" class="primary" type="button"
        disabled={batchRunning}
        onclick={handleTextCheck}>{i18n.t('validator.verify')}</button>
    </div>
  </div>
</section>

<section class="workspace" aria-label={i18n.t('validator.workspace')}>
  {#if batchProgress && batchProgress.percent < 100}
    <div id="batch-progress" class:batch-progress--running={batchRunning}>
      <ProgressBar label={batchProgressLabel} percent={batchProgress.percent} />
      {#if batchRunning}
        <button id="cancel-batch-button" class="secondary" type="button" onclick={handleCancelBatch}>{i18n.t('validator.cancel')}</button>
      {/if}
    </div>
  {/if}
  {#if importWizardVisible}
    <ImportWizard
      sources={importSources}
      onSourcesChange={(sources) => (importSources = sources)}
      onConfirm={handleImportConfirm}
      onCancel={handleImportCancel}
      onAnnounce={(msg) => (liveAnnouncement = msg)}
    />
  {/if}

  <section id="preview-panel" class="control-panel"
    class:hidden={!previewPanelVisible}
    class:collapsed={previewPanelCollapsed}
    aria-labelledby="preview-title">
    <button id="preview-toggle" class="panel-toggle" type="button"
      aria-expanded={previewPanelCollapsed ? 'false' : 'true'}
      aria-controls="preview-controls"
      bind:this={previewToggleEl}
      onclick={() => (previewPanelCollapsed = !previewPanelCollapsed)}>
      <span id="preview-title">{i18n.t('validator.preview')}</span>
      <span id="preview-toggle-meta">{previewToggleMeta}</span>
    </button>
    <div id="preview-controls" class="panel-body">
      <div class="section-head preview-head">
        <div>
          <p id="file-meta">
            <span class="file-meta-name" title={displayFileName ?? ''}>{displayFileName ?? ''}</span>
            <span class="file-meta-detail"> - {i18n.t('validator.sourcesIncluded', { count: importSources.filter((source) => source.included).length })}</span>
          </p>
          <p>{i18n.t('validator.previewHelp')}</p>
        </div>
        <button class="secondary" type="button" disabled={batchRunning} onclick={() => { lastFocusedBeforeWizard = document.activeElement as HTMLElement; importWizardVisible = true; }}>
          {i18n.t('validator.editImport')}
        </button>
      </div>
      <div class="table-wrap">
        <table id="preview-table">
          {#if importedRows.length > 0}
            <thead>
              <tr>
                <th>{i18n.t('validator.batchRow')}</th>
                <th>{i18n.t('validator.cup')}</th>
                <th>{i18n.t('validator.fileOrigine')}</th>
                <th>{i18n.t('validator.sheet')}</th>
                <th>{i18n.t('validator.sourceRow')}</th>
                <th>{i18n.t('validator.sourceColumn')}</th>
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
        <p>{importedRows.length > 10 ? i18n.t('validator.importedRowsShown', { count: importedRows.length }) : i18n.t('validator.importedRows', { count: importedRows.length })}</p>
        <button id="check-button" class="primary" type="button"
          disabled={batchRunning || importedRows.length === 0}
          onclick={handleCheck}>{i18n.t('validator.verify')}</button>
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
      <span id="results-title">{i18n.t('validator.results')}</span>
      <span id="results-toggle-meta">{resultsToggleMeta}</span>
    </button>
    <div id="results-controls" class="panel-body">
      <div class="section-head">
        <p id="summary">{summaryText}</p>
        <div class="button-row">
          <button id="export-button" class="primary" type="button"
            disabled={batchRunning}
            onclick={handleExport}>{i18n.t('validator.exportCsv')}</button>
          <button id="clear-button" class="secondary" type="button"
            onclick={handleClear}>{i18n.t('validator.clear')}</button>
        </div>
      </div>
      <div class="filters">
        <label class="toggle result-group-toggle">
          <input id="group-same-cups" type="checkbox"
            bind:checked={groupSameCups} />
          <span>{i18n.t('validator.groupSameCups')}</span>
        </label>
        <label class="result-outcome-filter">
          {i18n.t('validator.outcome')}
          <select id="filter-select" bind:value={filter}>
            <option value="ALL">{i18n.t('validator.all')}</option>
            <option value={OUTCOMES.FOUND_OPENCUP}>{i18n.t('validator.foundOpenCup')}</option>
            <option value={OUTCOMES.NOT_FOUND_OPENCUP}>{i18n.t('validator.notFoundOpenCup')}</option>
            <option value={OUTCOMES.CHECK}>{i18n.t('validator.toCheck')}</option>
            <option value={OUTCOMES.INVALID}>{i18n.t('validator.invalid')}</option>
          </select>
        </label>
        <label class="result-search-filter">
          {i18n.t('validator.search')}
          <input id="search-input" type="search" placeholder={i18n.t('validator.searchPlaceholder')}
            bind:value={query} />
        </label>
      </div>
      <div class="table-wrap">
        <table id="results-table" bind:this={resultsTableEl}>
          {#if filteredResults.length > renderedResults.length}
            <caption>{i18n.t('validator.filteredRowsShown', { shown: renderedResults.length, total: filteredResults.length })}</caption>
          {/if}
          {#if renderedResults.length > 0}
            <thead>
              <tr>
                <th>{i18n.t('validator.source')}</th>
                <th>CUP</th>
                <th>{i18n.t('validator.outcome')}</th>
                <th>{i18n.t('validator.openCup')}</th>
              </tr>
            </thead>
            <tbody>
              {#each renderedResults as result (result.inputRow ?? result.normalizedValue)}
                {@const detail = resultDetail(result)}
                {@const opencupUrl = opencupUrlForResult(result)}
                <tr>
                  <td>
                    <button class="link-button source-button" type="button"
                      aria-label={i18n.t('validator.showCupSource')}
                      onclick={() => openSourceDialog(result)}>
                      {sourceButtonLabel(result)}
                    </button>
                  </td>
                  <td title={result.normalizedValue}>
                    <code class="cup-cell">{result.normalizedValue}</code>
                  </td>
                  <td>
                    <button type="button" class="outcome-detail-button" title={detail}
                      aria-label={i18n.t('validator.showOutcomeDetail', { outcome: result.outcome })}
                      onclick={() => openResultDetailDialog(detail)}>
                      <span class="badge {badgeClass(result.outcome)}">{result.outcome}</span>
                    </button>
                  </td>
                  <td>
                    {#if opencupUrl}
                      <a href={opencupUrl} target="_blank" rel="noopener noreferrer">{i18n.t('validator.open')}</a>
                    {:else}
                      <span aria-label={i18n.t('validator.openCupUnavailable')}>-</span>
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

<div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{liveAnnouncement}</div>

<dialog id="detail-dialog" class="detail-dialog" aria-labelledby="detail-dialog-label"
  bind:this={detailDialogEl}
  onclick={(e) => { if (e.target === detailDialogEl) detailDialogEl.close(); }}>
  {#if detailDialogTable}
    <div class="detail-source-scroll">
      <table id="detail-dialog-label" class="detail-source-table" aria-label={i18n.t('validator.detailSourceTable')}>
        <thead>
          <tr>
            <th scope="col">{i18n.t('validator.source')}</th>
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
    <button class="secondary" type="submit">{i18n.t('validator.close')}</button>
  </form>
</dialog>

<dialog id="limits-dialog" class="limits-dialog" aria-labelledby="limits-title"
  bind:this={limitsDialogEl}
  onclick={(e) => { if (e.target === limitsDialogEl) limitsDialogEl.close(); }}>
  <div>
    <h2 id="limits-title">{i18n.t('validator.limitsTitle')}</h2>
    <p>{i18n.t('validator.limitsP1')}</p>
    <p>{i18n.t('validator.limitsP2')}</p>
    <p>{i18n.t('validator.limitsP3')}</p>
    <p>{i18n.t('validator.limitsP4')}</p>
    <p>{i18n.t('validator.limitsP5')}</p>
  </div>
  <form method="dialog">
    <button class="secondary" type="submit">{i18n.t('validator.close')}</button>
  </form>
</dialog>
