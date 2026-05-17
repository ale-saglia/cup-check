<script lang="ts">
  import type { Entry, Cup } from '../lib/types.js';

  interface Props {
    entries: Entry[];
    onEdit: (entryId: number, cupId: string) => void;
    onRemove: (entryId: number, cupId: string) => void;
    onAddManual: (entryId: number) => void;
    onSaveEdit: (entryId: number, cupId: string, value: string) => void;
    onCancelEdit: (entryId: number, cupId: string) => void;
  }

  let { entries, onEdit, onRemove, onAddManual, onSaveEdit, onCancelEdit }: Props = $props();

  function truncateName(name: string, max = 40): string {
    return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
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

  // Re-focus the active editing input after each render.
  let tbodyEl: HTMLTableSectionElement;
  $effect(() => {
    void entries;
    const active = tbodyEl?.querySelector<HTMLInputElement>('input[data-editing]');
    if (active) {
      active.focus();
      if (active.value) active.select();
    }
  });
</script>

<div class="table-wrap">
  <table aria-label="Risultati estrazione CUP dai PDF">
    <thead>
      <tr>
        <th scope="col">File</th>
        <th scope="col" class="pdf-cup-col">CUP</th>
        <th scope="col">Formato</th>
        <th scope="col">Fonte</th>
        <th scope="col">Manuale</th>
        <th scope="col">Azioni</th>
      </tr>
    </thead>
    <tbody bind:this={tbodyEl}>
      {#each entries as entry (entry.id)}
        {#if entry.status === 'queued'}
          <tr>
            <td class="detail-cell" title={entry.name}>{truncateName(entry.name)}</td>
            <td colspan="5" class="pdf-status-cell"><span class="badge">In coda</span></td>
          </tr>
        {:else if entry.status === 'parsing'}
          <tr>
            <td class="detail-cell" title={entry.name}>{truncateName(entry.name)}</td>
            <td colspan="5" class="pdf-status-cell"><span class="badge">Lettura PDF…</span></td>
          </tr>
        {:else if entry.status === 'ocr'}
          {@const p = entry.ocrProgress}
          {@const label = p?.ocrLoading ? 'Caricamento OCR…' : `OCR pagina ${p?.page} / ${p?.totalPages}`}
          <tr>
            <td class="detail-cell" title={entry.name}>{truncateName(entry.name)}</td>
            <td colspan="5" class="pdf-status-cell"><span class="badge warn">{label}</span></td>
          </tr>
        {:else if entry.status === 'error'}
          <tr>
            <td class="detail-cell" title={entry.name}>{truncateName(entry.name)}</td>
            <td colspan="4" class="pdf-status-cell">
              <span class="badge bad">Errore</span> {entry.error ?? ''}
            </td>
            <td>
              {#if entry.cups.length === 0}
                <button class="link-button" type="button" onclick={() => onAddManual(entry.id)}>
                  + aggiungi CUP
                </button>
              {/if}
            </td>
          </tr>
          {#each entry.cups as cup (cup.id)}
            {@render cupRow(entry.id, entry.name, cup)}
          {/each}
        {:else}
          <!-- status === 'done' -->
          {#if entry.cups.length === 0}
            <tr>
              <td class="detail-cell" title={entry.name}>{truncateName(entry.name)}</td>
              <td colspan="4" class="pdf-status-cell pdf-no-cup">Nessun CUP rilevato.</td>
              <td>
                <button class="link-button" type="button" onclick={() => onAddManual(entry.id)}>
                  + aggiungi CUP
                </button>
              </td>
            </tr>
          {:else}
            {#each entry.cups as cup (cup.id)}
              {@render cupRow(entry.id, entry.name, cup)}
            {/each}
          {/if}
        {/if}
      {/each}
    </tbody>
  </table>
</div>

{#snippet cupRow(entryId: number, name: string, cup: Cup)}
  <tr>
    <td class="detail-cell" title={name}>{truncateName(name)}</td>
    {#if cup.editing}
      <td colspan="2">
        <input
          class="pdf-cup-input"
          type="text"
          value={cup.value}
          maxlength="15"
          data-editing
          aria-label="Valore CUP"
          onkeydown={(e) => handleInputKeydown(e, entryId, cup.id)}
          onblur={(e) => handleInputBlur(e, entryId, cup.id)}
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
            onSaveEdit(entryId, cup.id, input?.value ?? '');
          }}
        >salva</button>
        <button
          class="link-button"
          type="button"
          data-cancel-edit
          onclick={() => onCancelEdit(entryId, cup.id)}
        >annulla</button>
      </td>
    {:else}
      <td><code class="cup-cell">{cup.value}</code></td>
      <td>
        <span class="badge {cup.formalValid ? 'good' : 'bad'}">
          {cup.formalValid ? 'Valido' : 'Invalido'}
        </span>
      </td>
      <td>{cup.source ?? ''}</td>
      <td>{#if cup.manual}<span class="badge warn">manuale</span>{/if}</td>
      <td>
        <button class="link-button" type="button" onclick={() => onEdit(entryId, cup.id)}>
          modifica
        </button>
        <button class="link-button" type="button" onclick={() => onRemove(entryId, cup.id)}>
          rimuovi
        </button>
      </td>
    {/if}
  </tr>
{/snippet}
