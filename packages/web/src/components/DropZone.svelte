<script lang="ts">
  const SUPPORTED_EXTENSIONS = ['csv', 'xlsx'];
  const SUPPORTED_TYPES = ['text/csv', 'application/vnd.ms-excel'];

  interface Props {
    disabled?: boolean;
    onFiles: (files: File[]) => void;
  }

  let { disabled = false, onFiles }: Props = $props();

  let inputEl: HTMLInputElement;
  let dragActive = $state(false);
  let error = $state('');

  function handleChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    submitFiles(files);
    if (inputEl) inputEl.value = '';
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled) dragActive = true;
  }

  function handleDragLeave(event: DragEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      dragActive = false;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
    if (disabled) return;
    submitFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  function submitFiles(files: File[]) {
    error = '';
    const supported = files.filter(isSupportedFile);
    if (supported.length === 0) {
      error = 'Carica almeno un file CSV o XLSX.';
      return;
    }
    if (supported.length !== files.length) {
      error = 'Alcuni file sono stati ignorati: sono supportati solo CSV e XLSX.';
    }
    onFiles(supported);
  }

  function isSupportedFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return SUPPORTED_EXTENSIONS.includes(extension) || SUPPORTED_TYPES.includes(file.type);
  }
</script>

<div
  class="dropzone dropzone--wide"
  class:dropzone--active={dragActive}
  role="group"
  aria-label="Caricamento file CSV o XLSX"
  aria-disabled={disabled}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <label for="file-input">
    <input
      id="file-input"
      type="file"
      accept=".csv,.xlsx,text/csv"
      multiple
      disabled={disabled}
      bind:this={inputEl}
      onchange={handleChange}
    />
    <span>Carica o trascina file</span>
  </label>
</div>
{#if error}
  <p class="form-error" role="alert">{error}</p>
{/if}
