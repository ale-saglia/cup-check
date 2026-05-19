<script lang="ts">
  import type { ImportSource } from '../lib/core/import-plan.js';

  interface Props {
    source: ImportSource;
    disabled?: boolean;
    onSheetChange: (sheetName: string) => void;
    onHeaderChange: (headerPresent: boolean) => void;
    onColumnChange: (columnIndex: number) => void;
    skipMissingCup: boolean;
    onSkipMissingCupChange: (skipMissingCup: boolean) => void;
    showFileName?: boolean;
  }

  let {
    source,
    disabled = false,
    onSheetChange,
    onHeaderChange,
    onColumnChange,
    skipMissingCup,
    onSkipMissingCupChange,
    showFileName = true,
  }: Props = $props();

  let selectedColumnIndex = $derived(source.selectedColumnIndexes[0] ?? 0);
  let hasMultipleSheets = $derived((source.parsed.sheetNames?.length ?? 0) > 1);
  let sheetLabel = $derived(source.sheetName ? ` - scheda "${source.sheetName}"` : '');
  let rowLabel = $derived(`${source.parsed.rows.length} righe dati`);
  let headerMeta = $derived(
    source.parsed.headerDetectedAutomatically === source.headerPresent
      ? source.headerPresent
        ? 'intestazione rilevata automaticamente'
        : 'intestazione non rilevata automaticamente'
      : source.headerPresent
        ? 'intestazione impostata manualmente'
        : 'prima riga trattata manualmente come dati',
  );
</script>

<div class="import-source-preview" aria-labelledby={`import-source-${source.id}`}>
  <div class="import-source-header">
    <div>
      <h3 id={`import-source-${source.id}`} class:visually-hidden={!showFileName}>{source.fileName}</h3>
      <p>{rowLabel}{sheetLabel} - {headerMeta}</p>
    </div>
    <label class="import-sheet-select" class:hidden={!hasMultipleSheets}>
      Scheda Excel
      <select
        id="sheet-select"
        disabled={disabled || !hasMultipleSheets}
        value={source.sheetName ?? ''}
        onchange={(event) => onSheetChange((event.target as HTMLSelectElement).value)}
      >
        {#each (source.parsed.sheetNames ?? []) as sheetName (sheetName)}
          <option value={sheetName}>{sheetName}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="import-controls">
    <label class="import-column-select">
      Colonna CUP
      <select
        id="column-select"
        disabled={disabled || !source.included}
        value={String(selectedColumnIndex)}
        onchange={(event) => onColumnChange(Number((event.target as HTMLSelectElement).value))}
      >
        {#each source.parsed.headers as header, index (index)}
          <option value={String(index)}>{header || `Colonna ${index + 1}`}</option>
        {/each}
      </select>
    </label>

    <label class="toggle import-header-toggle">
      <input
        id="header-toggle"
        type="checkbox"
        checked={source.headerPresent}
        disabled={disabled}
        onchange={(event) => onHeaderChange((event.target as HTMLInputElement).checked)}
      />
      <span>La prima riga contiene intestazioni</span>
    </label>

    <label class="toggle import-skip-toggle">
      <input
        id="skip-missing-cup"
        type="checkbox"
        checked={skipMissingCup}
        disabled={disabled}
        onchange={(event) => onSkipMissingCupChange((event.target as HTMLInputElement).checked)}
      />
      <span>Ignora celle CUP assenti</span>
    </label>
  </div>

  <div class="table-wrap import-preview-table">
    <table>
      <thead>
        <tr>
          <th>Riga</th>
          {#each source.parsed.headers as header, index (index)}
            <th>{header || `Colonna ${index + 1}`}</th>
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
</div>
