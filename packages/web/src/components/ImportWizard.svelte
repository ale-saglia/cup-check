<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '../i18n/i18n.svelte.js';
  import type { ImportSource } from '../lib/core/import-plan.js';
  import {
    buildImportedCupRows,
    createSourceFromSheet,
    updateSourceColumn,
    updateSourceHeader,
    updateSourceIncluded,
    updateSourceSheet,
    updateSourceSkipMissingCup,
  } from '../lib/core/import-plan.js';
  import ImportSourcePreview from './ImportSourcePreview.svelte';

  interface Props {
    sources: ImportSource[];
    onSourcesChange: (sources: ImportSource[]) => void;
    onConfirm: (sources: ImportSource[]) => void;
    onCancel: () => void;
    onAnnounce?: (message: string) => void;
  }

  let {
    sources,
    onSourcesChange,
    onConfirm,
    onCancel,
    onAnnounce,
  }: Props = $props();

  let dialogEl: HTMLDialogElement;
  let currentFileIndex = $state(0);
  let loading = $state(false);
  let message = $state('');

  let fileGroups = $derived.by(() => groupSourcesByFile(sources));
  let currentFileGroup = $derived(fileGroups[currentFileIndex] ?? null);
  let baseSource = $derived(currentFileGroup?.sources[0] ?? null);
  let importedCount = $derived(buildImportedCupRows(sources).length);
  let includedCount = $derived(sources.filter((source) => source.included).length);
  let hasMultipleFiles = $derived(fileGroups.length > 1);
  let importCountLabel = $derived(
    hasMultipleFiles
      ? i18n.t('import.includedSources', { included: includedCount, total: sources.length, rows: importedCount })
      : i18n.t('import.rowsCup', { count: importedCount }),
  );
  let availableAdditionalSheets = $derived(baseSource?.parsed.sheetNames ?? []);
  let additionalSheetName = $state('');
  let selectedAdditionalSheetName = $derived(additionalSheetName || availableAdditionalSheets[0] || '');

  $effect(() => {
    if (currentFileIndex >= fileGroups.length) currentFileIndex = Math.max(0, fileGroups.length - 1);
  });

  onMount(() => {
    if (!dialogEl.open && typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
    } else if (!dialogEl.open) {
      dialogEl.setAttribute('open', '');
    }
    dialogEl.focus();
  });

  function replaceSource(source: ImportSource) {
    const sourceIndex = sources.findIndex((candidate) => candidate.id === source.id);
    if (sourceIndex === -1) return;
    const next = sources.slice();
    next[sourceIndex] = source;
    onSourcesChange(next);
    message = '';
  }

  function removeSource(source: ImportSource) {
    onSourcesChange(sources.filter((candidate) => candidate.id !== source.id));
    message = '';
  }

  async function handleSheetChange(source: ImportSource, sheetName: string) {
    loading = true;
    message = '';
    try {
      replaceSource(await updateSourceSheet(source, sheetName));
    } catch (error) {
      message = (error as Error).message;
    } finally {
      loading = false;
    }
  }

  async function handleAddSheet() {
    const sheetName = selectedAdditionalSheetName;
    if (!baseSource || !sheetName) return;
    loading = true;
    message = '';
    try {
      const source = await createSourceFromSheet(baseSource, sheetName, sources.length);
      onSourcesChange([...sources, source]);
      message = '';
    } catch (error) {
      message = (error as Error).message;
    } finally {
      loading = false;
    }
  }

  function groupSourcesByFile(sourceList: ImportSource[]): Array<{
    file: File;
    fileName: string;
    sources: ImportSource[];
  }> {
    const groups: Array<{ file: File; fileName: string; sources: ImportSource[] }> = [];

    for (const source of sourceList) {
      const existing = groups.find((group) => group.file === source.file);
      if (existing) {
        existing.sources.push(source);
        continue;
      }
      groups.push({ file: source.file, fileName: source.fileName, sources: [source] });
    }

    return groups;
  }

  function handleConfirm() {
    if (includedCount === 0) {
      message = i18n.t('import.messageIncludeOne');
      return;
    }
    if (importedCount === 0) {
      const rowsWithoutSkip = buildImportedCupRows(
        sources.map((s) => ({ ...s, skipMissingCup: false })),
      ).length;
      message =
        rowsWithoutSkip > 0
          ? i18n.t('import.messageNoValuedCup')
          : i18n.t('import.messageNoRows');
      return;
    }
    onAnnounce?.(i18n.t('import.announcedConfirmed', { count: importedCount }));
    onConfirm(sources);
  }
</script>

<dialog
  id="import-wizard"
  class="control-panel import-wizard"
  aria-labelledby="import-wizard-title"
  aria-modal="true"
  tabindex="-1"
  bind:this={dialogEl}
  oncancel={onCancel}
>
  <div class="panel-toggle import-wizard-title-bar">
    <h2 id="import-wizard-title">{i18n.t('import.title')}</h2>
    <span class="import-wizard-count">{importCountLabel}</span>
  </div>
  <div class="panel-body">
    {#if hasMultipleFiles}
      <p class="import-wizard-help">{i18n.t('import.help')}</p>
    {/if}

    {#if currentFileGroup}
      {#if hasMultipleFiles}
        <div class="import-source-nav" aria-label={i18n.t('import.fileNav')}>
          <label class="import-file-select">{i18n.t('import.file')}
            <select
              value={String(currentFileIndex)}
              disabled={loading}
              onchange={(event) => (currentFileIndex = Number((event.target as HTMLSelectElement).value))}
            >
              {#each fileGroups as group, index (`${group.fileName}-${index}`)}
                <option value={String(index)}>{group.fileName}</option>
              {/each}
            </select>
          </label>
        </div>
      {/if}

      <div class="import-file-sources">
        {#each currentFileGroup.sources as source, index (source.id)}
          <ImportSourcePreview
            {source}
            disabled={loading}
            onSheetChange={(sheetName) => handleSheetChange(source, sheetName)}
            onHeaderChange={(headerPresent) => replaceSource(updateSourceHeader(source, headerPresent))}
            onColumnChange={(columnIndex) => replaceSource(updateSourceColumn(source, columnIndex))}
            onIncludeChange={(included) => replaceSource(updateSourceIncluded(source, included))}
            onSkipMissingCupChange={(skip) => replaceSource(updateSourceSkipMissingCup(source, skip))}
            onRemove={() => removeSource(source)}
            showFileName={index === 0}
          />
        {/each}
      </div>

      {#if availableAdditionalSheets.length > 0}
        <div class="additional-sheet-controls">
          <label>{i18n.t('import.additionalSheet')}
            <select
              value={selectedAdditionalSheetName}
              disabled={loading}
              onchange={(event) => (additionalSheetName = (event.target as HTMLSelectElement).value)}
            >
              {#each availableAdditionalSheets as sheetName (sheetName)}
                <option value={sheetName}>{sheetName}</option>
              {/each}
            </select>
          </label>
          <button class="secondary" type="button" disabled={loading} onclick={handleAddSheet}>{i18n.t('import.loadSheetColumn')}
          </button>
        </div>
      {/if}
    {/if}

    <div class="actions-row import-actions">
      <div class="button-row import-button-row">
        <button class="primary" type="button" disabled={loading} onclick={handleConfirm}>{i18n.t('import.confirm')}
        </button>
        <button class="secondary" type="button" disabled={loading} onclick={onCancel}>{i18n.t('import.cancel')}</button>
      </div>
    </div>

    <p class="live-message" aria-live="polite">
      {#if loading}
        {i18n.t('import.loading')}
      {:else}
        {message}
      {/if}
    </p>
  </div>
</dialog>
