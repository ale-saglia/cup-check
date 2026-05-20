<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte.js';
  import type { ImportSource } from '../lib/core/import-plan.js';

  interface Props {
    source: ImportSource;
    disabled?: boolean;
    onSheetChange: (sheetName: string) => void;
    onHeaderChange: (headerPresent: boolean) => void;
    onColumnChange: (columnIndex: number) => void;
    onIncludeChange: (included: boolean) => void;
    onSkipMissingCupChange: (skipMissingCup: boolean) => void;
    onRemove?: () => void;
    showFileName?: boolean;
  }

  let {
    source,
    disabled = false,
    onSheetChange,
    onHeaderChange,
    onColumnChange,
    onIncludeChange,
    onSkipMissingCupChange,
    onRemove = () => undefined,
    showFileName = true,
  }: Props = $props();

  let htmlId = $derived(source.id.replace(/[^a-zA-Z0-9_-]/g, '-'));
  let selectedColumnIndex = $derived(source.selectedColumnIndexes[0] ?? 0);
  let hasMultipleSheets = $derived((source.parsed.sheetNames?.length ?? 0) > 1);
  let isEmptySource = $derived(source.parsed.headers.length === 0);
  let sheetLabel = $derived(source.sheetName ? ` - ${i18n.t('source.sheetMeta', { sheet: source.sheetName })}` : '');
  let rowLabel = $derived(i18n.t('source.rowsData', { count: source.parsed.rows.length }));
  let headerMeta = $derived(
    source.parsed.headerDetectedAutomatically === source.headerPresent
      ? source.headerPresent
        ? i18n.t('source.headerAutoYes')
        : i18n.t('source.headerAutoNo')
      : source.headerPresent
        ? i18n.t('source.headerManualYes')
        : i18n.t('source.headerManualNo'),
  );
</script>

<div class="import-source-preview" aria-labelledby={`import-source-${source.id}`}>

  <!-- Row 1: filename (truncated) + include toggle -->
  <div class="import-source-header">
    <div class="import-source-title">
      <h3
        id={`import-source-${source.id}`}
        class="import-source-filename"
        class:visually-hidden={!showFileName}
        title={source.fileName}
      >{source.fileName}</h3>
      <p class="import-source-meta">{rowLabel}{sheetLabel} - {headerMeta}</p>
    </div>
    <div class="import-source-actions">
      <label class="toggle import-include-toggle">
        <input
          id={`include-toggle-${htmlId}`}
          type="checkbox"
          checked={source.included}
          disabled={disabled || isEmptySource}
          onchange={(event) => onIncludeChange((event.target as HTMLInputElement).checked)}
        />
        <span>{i18n.t('source.include')}</span>
      </label>
      <button class="secondary import-remove-source" type="button" disabled={disabled} onclick={onRemove}>
        {i18n.t('source.remove')}
      </button>
    </div>
  </div>

  <!-- Row 2: sheet selector (left) + header toggle (right) -->
  <div class="import-source-row">
    <label class="import-sheet-select" class:hidden={!hasMultipleSheets}>{i18n.t('source.excelSheet')}
      <select
        id={`sheet-select-${htmlId}`}
        disabled={disabled || !hasMultipleSheets}
        value={source.sheetName ?? ''}
        onchange={(event) => onSheetChange((event.target as HTMLSelectElement).value)}
      >
        {#each (source.parsed.sheetNames ?? []) as sheetName (sheetName)}
          <option value={sheetName}>{sheetName}</option>
        {/each}
      </select>
    </label>

    <label class="toggle import-header-toggle">
      <input
        id={`header-toggle-${htmlId}`}
        type="checkbox"
        checked={source.headerPresent}
        disabled={disabled}
        onchange={(event) => onHeaderChange((event.target as HTMLInputElement).checked)}
      />
      <span>{i18n.t('source.headerToggle')}</span>
    </label>
  </div>

  {#if isEmptySource}
    <p class="import-source-warning" role="status">{i18n.t('source.emptySheetWarning')}</p>
  {:else}
    <!-- Column CUP selector -->
    <label class="import-column-select">{i18n.t('source.cupColumn')}
      <select
        id={`column-select-${htmlId}`}
        disabled={disabled || !source.included}
        value={String(selectedColumnIndex)}
        onchange={(event) => onColumnChange(Number((event.target as HTMLSelectElement).value))}
      >
        {#each source.parsed.headers as header, index (index)}
          <option value={String(index)}>{header || i18n.t('source.column', { number: index + 1 })}</option>
        {/each}
      </select>
    </label>

    <!-- Preview table -->
    <div class="table-wrap import-preview-table">
      <table aria-label={i18n.t('source.preview', { file: source.fileName })}>
        <thead>
          <tr>
            <th>{i18n.t('source.row')}</th>
            {#each source.parsed.headers as header, index (index)}
              <th>{header || i18n.t('source.column', { number: index + 1 })}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each source.parsed.rows.slice(0, 10) as row (row.originalRowNumber)}
            <tr>
              <td>{row.originalRowNumber}</td>
              {#each row.cells as cell, index (index)}
                <td class:selected={source.included && index === selectedColumnIndex}>{cell}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Skip missing cup toggle (per source, below table) -->
  <label class="toggle import-skip-toggle">
    <input
      id={`skip-missing-cup-${htmlId}`}
      type="checkbox"
      checked={source.skipMissingCup}
      disabled={disabled}
      onchange={(event) => onSkipMissingCupChange((event.target as HTMLInputElement).checked)}
    />
    <span>{i18n.t('source.skipMissing')}</span>
  </label>

</div>
