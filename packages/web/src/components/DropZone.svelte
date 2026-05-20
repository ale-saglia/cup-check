<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte.js';
  const SUPPORTED_EXTENSIONS = ['csv', 'xlsx'];
  const SUPPORTED_TYPES = ['text/csv', 'application/vnd.ms-excel'];
  const RECOMMENDED_MAX_SIZE_BYTES = 25 * 1024 * 1024;

  interface Props {
    disabled?: boolean;
    onFiles: (files: File[]) => void;
  }

  let { disabled = false, onFiles }: Props = $props();

  let inputEl: HTMLInputElement;
  let dragActive = $state(false);
  let error = $state('');

  function handleChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    submitFiles(files);
    input.value = '';
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
      error = i18n.t('dropzone.errorUnsupported');
      return;
    }
    if (supported.length !== files.length) {
      error = i18n.t('dropzone.errorSomeIgnored');
    } else {
      const oversized = supported.filter((f) => f.size > RECOMMENDED_MAX_SIZE_BYTES);
      if (oversized.length > 0) {
        error =
          oversized.length === 1
            ? i18n.t('dropzone.warnOneLarge')
            : i18n.t('dropzone.warnManyLarge', { count: oversized.length });
      }
    }
    onFiles(supported);
  }

  function isSupportedFile(file: File): boolean {
    const extension = file.name.split('.').pop()!.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(extension) || SUPPORTED_TYPES.includes(file.type);
  }
</script>

<div
  class="dropzone dropzone--wide"
  class:dropzone--active={dragActive}
  role="group"
  aria-label={i18n.t('dropzone.label')}
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
    <span>{i18n.t('dropzone.button')}</span>
  </label>
</div>
{#if error}
  <p class="form-error" role="alert">{error}</p>
{/if}
