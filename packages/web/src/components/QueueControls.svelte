<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte.js';
  interface Props {
    hasCups: boolean;
    hasDone: boolean;
    onSend: () => void;
    onExport: () => void;
    onClear: () => void;
  }

  let { hasCups, hasDone, onSend, onExport, onClear }: Props = $props();

  let actionsDisabled = $derived(!hasDone || !hasCups);
</script>

<div class="button-row">
  <button id="pdf-send-btn" class="primary" type="button" disabled={actionsDisabled} onclick={onSend}>
    {i18n.t('pdf.openValidator')}
  </button>
  <button id="pdf-export-btn" class="secondary" type="button" disabled={actionsDisabled} onclick={onExport}>
    {i18n.t('pdf.exportCsv')}
  </button>
  <button id="pdf-clear-btn" class="secondary" type="button" onclick={onClear}>{i18n.t('pdf.clear')}</button>
</div>
