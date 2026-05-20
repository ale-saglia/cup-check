<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte.js';
  interface Props {
    hasCups: boolean;
    hasDone: boolean;
    exportNeedsCups?: boolean;
    onSend: () => void;
    onExport: () => void;
    onClear: () => void;
  }

  let { hasCups, hasDone, exportNeedsCups = true, onSend, onExport, onClear }: Props = $props();

  let sendDisabled = $derived(!hasDone || !hasCups);
  let exportDisabled = $derived(!hasDone || (exportNeedsCups && !hasCups));
</script>

<div class="button-row">
  <button id="pdf-send-btn" class="primary" type="button" disabled={sendDisabled} onclick={onSend}>
    {i18n.t('pdf.openValidator')}
  </button>
  <button id="pdf-export-btn" class="secondary" type="button" disabled={exportDisabled} onclick={onExport}>
    {i18n.t('pdf.exportCsv')}
  </button>
  <button id="pdf-clear-btn" class="secondary" type="button" onclick={onClear}>{i18n.t('pdf.clear')}</button>
</div>
