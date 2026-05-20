<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte.js';
  import type { Entry, Cup, InvoiceData } from '../lib/types.js';

  interface Props {
    entries: Entry[];
    showInvoiceData?: boolean;
    onEdit: (entryId: number, cupId: string) => void;
    onRemove: (entryId: number, cupId: string) => void;
    onAddManual: (entryId: number) => void;
    onSaveEdit: (entryId: number, cupId: string, value: string) => void;
    onCancelEdit: (entryId: number, cupId: string) => void;
  }

  let { entries, showInvoiceData = false, onEdit, onRemove, onAddManual, onSaveEdit, onCancelEdit }: Props = $props();

  // colspan for rows that span all non-File columns (queued/parsing/ocr)
  let statusFullColspan = $derived(showInvoiceData ? 12 : 5);

  function truncateName(name: string, max = 40): string {
    return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
  }

  function formatImporto(s: string): string {
    return s.replace('.', ',');
  }

  function handleInputKeydown(e: KeyboardEvent, entryId: number, cupId: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveEdit(entryId, cupId, (e.target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit(entryId, cupId);
    }
  }

  function handleInputBlur(e: FocusEvent, entryId: number, cupId: string) {
    onSaveEdit(entryId, cupId, (e.target as HTMLInputElement).value);
  }

  // Focus the editing input only when a new cup enters editing mode, not on every entries mutation.
  let tbodyEl: HTMLTableSectionElement;
  let lastActivatedId: string | null = null;
  $effect(() => {
    void entries;
    const active = tbodyEl?.querySelector<HTMLInputElement>('input[data-editing]');
    if (active) {
      const id = active.dataset.cupId ?? null;
      if (id !== lastActivatedId) {
        lastActivatedId = id;
        active.focus();
        if (active.value) active.select();
      }
    } else {
      lastActivatedId = null;
    }
  });
</script>

<div class="table-wrap">
  <table aria-label={i18n.t('pdf.tableLabel')}>
    <thead>
      <tr>
        <th scope="col">{i18n.t('pdf.file')}</th>
        <th scope="col" class="pdf-cup-col">CUP</th>
        <th scope="col">{i18n.t('pdf.format')}</th>
        <th scope="col">{i18n.t('pdf.source')}</th>
        <th scope="col">{i18n.t('pdf.manual')}</th>
        <th scope="col">{i18n.t('pdf.actions')}</th>
        {#if showInvoiceData}
          <th scope="col">{i18n.t('xml.colData')}</th>
          <th scope="col">{i18n.t('xml.colNumero')}</th>
          <th scope="col">{i18n.t('xml.colImporto')}</th>
          <th scope="col">{i18n.t('xml.colCausale')}</th>
          <th scope="col">{i18n.t('xml.colPiva')}</th>
          <th scope="col">{i18n.t('xml.colFornitore')}</th>
          <th scope="col">{i18n.t('xml.colCig')}</th>
        {/if}
      </tr>
    </thead>
    <tbody bind:this={tbodyEl}>
      {#each entries as entry (entry.id)}
        {#if entry.status === 'queued'}
          <tr>
            {@render fileCell(entry)}
            <td colspan={statusFullColspan} class="pdf-status-cell"><span class="badge">{i18n.t('pdf.queued')}</span></td>
          </tr>
        {:else if entry.status === 'parsing'}
          <tr>
            {@render fileCell(entry)}
            <td colspan={statusFullColspan} class="pdf-status-cell"><span class="badge">{i18n.t('pdf.readingPdf')}</span></td>
          </tr>
        {:else if entry.status === 'ocr'}
          {@const p = entry.ocrProgress}
          {@const label = p?.ocrLoading ? i18n.t('pdf.ocrLoading') : i18n.t('pdf.ocrPageShort', { page: p?.page ?? 0, total: p?.totalPages ?? 0 })}
          <tr>
            {@render fileCell(entry)}
            <td colspan={statusFullColspan} class="pdf-status-cell"><span class="badge warn">{label}</span></td>
          </tr>
        {:else if entry.status === 'error'}
          <tr>
            {@render fileCell(entry)}
            <td colspan="4" class="pdf-status-cell">
              <span class="badge bad">{i18n.t('pdf.error')}</span> {entry.error ?? ''}
            </td>
            <td>
              {#if entry.cups.length === 0}
                <button class="link-button" type="button" onclick={() => onAddManual(entry.id)}>
                  {i18n.t('pdf.addCup')}
                </button>
              {/if}
            </td>
            {#if showInvoiceData}
              {@render invoiceCells(entry.invoiceData)}
            {/if}
          </tr>
          {#each entry.cups as cup (cup.id)}
            {@render cupRow(entry, cup)}
          {/each}
        {:else}
          <!-- status === 'done' -->
          {#if entry.cups.length === 0}
            <tr>
              {@render fileCell(entry)}
              <td colspan="4" class="pdf-status-cell pdf-no-cup">{i18n.t('pdf.noCup')}</td>
              <td>
                <button class="link-button" type="button" onclick={() => onAddManual(entry.id)}>
                  {i18n.t('pdf.addCup')}
                </button>
              </td>
              {#if showInvoiceData}
                {@render invoiceCells(entry.invoiceData)}
              {/if}
            </tr>
          {:else}
            {#each entry.cups as cup (cup.id)}
              {@render cupRow(entry, cup)}
            {/each}
          {/if}
        {/if}
      {/each}
    </tbody>
  </table>
</div>

{#snippet fileCell(entry: Entry)}
  <td>
    {#if entry.objectUrl}
      <a class="detail-cell" href={entry.objectUrl} target="_blank" rel="noopener" title={entry.name}>{truncateName(entry.name)}</a>
    {:else}
      <span class="detail-cell" title={entry.name}>{truncateName(entry.name)}</span>
    {/if}
  </td>
{/snippet}

{#snippet invoiceCells(inv: InvoiceData | null | undefined)}
  <td>{inv?.data ?? ''}</td>
  <td>{inv?.numero ?? ''}</td>
  <td>{inv ? formatImporto(inv.importoTotale) : ''}</td>
  <td title={inv?.causale ?? ''}>{inv ? truncateName(inv.causale, 30) : ''}</td>
  <td>{inv?.pivaFornitore ?? ''}</td>
  <td title={inv?.nomeFornitore ?? ''}>{inv ? truncateName(inv.nomeFornitore, 30) : ''}</td>
  <td>{inv?.cig ?? ''}</td>
{/snippet}

{#snippet cupRow(entry: Entry, cup: Cup)}
  <tr>
    {@render fileCell(entry)}
    {#if cup.editing}
      <td colspan="2">
        <input
          class="pdf-cup-input"
          type="text"
          value={cup.value}
          maxlength="15"
          data-editing
          data-cup-id={cup.id}
          aria-label={i18n.t('pdf.cupValue')}
          onkeydown={(e) => handleInputKeydown(e, entry.id, cup.id)}
          onblur={(e) => handleInputBlur(e, entry.id, cup.id)}
          onmousedown={(e) => {
            const target = e.relatedTarget as Element | null;
            if (target?.matches('[data-save-edit],[data-cancel-edit]')) e.preventDefault();
          }}
        />
      </td>
      <td>{cup.source ?? ''}</td>
      <td></td>
      <td>
        <button
          class="link-button"
          type="button"
          data-save-edit
          onclick={(e) => {
            const input = (e.currentTarget as Element)
              .closest('tr')
              ?.querySelector<HTMLInputElement>('input[data-editing]');
            onSaveEdit(entry.id, cup.id, input?.value ?? '');
          }}
        >{i18n.t('pdf.save')}</button>
        <button
          class="link-button"
          type="button"
          data-cancel-edit
          onclick={() => onCancelEdit(entry.id, cup.id)}
        >{i18n.t('pdf.cancelEdit')}</button>
      </td>
      {#if showInvoiceData}
        {@render invoiceCells(entry.invoiceData)}
      {/if}
    {:else}
      <td><code class="cup-cell">{cup.value}</code></td>
      <td>
        <span class="badge {cup.formalValid ? 'good' : 'bad'}">
          {cup.formalValid ? i18n.t('pdf.valid') : i18n.t('pdf.invalid')}
        </span>
      </td>
      <td>{cup.source ?? ''}</td>
      <td>{#if cup.manual}<span class="badge warn">{i18n.t('pdf.manualBadge')}</span>{/if}</td>
      <td>
        <button class="link-button" type="button" onclick={() => onEdit(entry.id, cup.id)}>{i18n.t('pdf.edit')}
        </button>
        <button class="link-button" type="button" onclick={() => onRemove(entry.id, cup.id)}>{i18n.t('pdf.remove')}
        </button>
      </td>
      {#if showInvoiceData}
        {@render invoiceCells(entry.invoiceData)}
      {/if}
    {/if}
  </tr>
{/snippet}
