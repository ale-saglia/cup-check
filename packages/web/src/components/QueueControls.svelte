<script lang="ts">
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
    Apri nel verificatore
  </button>
  <button id="pdf-export-btn" class="secondary" type="button" disabled={actionsDisabled} onclick={onExport}>
    Esporta CSV (file ↔ CUP)
  </button>
  <button id="pdf-clear-btn" class="secondary" type="button" onclick={onClear}>Pulisci</button>
</div>
