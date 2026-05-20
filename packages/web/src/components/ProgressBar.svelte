<script lang="ts">
  interface Props {
    label: string;
    percent: number;
  }

  let { label, percent }: Props = $props();
  let safePercent = $derived(Math.round(percent));
  let percentLabel = $derived(`${safePercent}%`);
</script>

<div class="progress-block" aria-label={label}>
  <div class="progress-meta">
    <span>{label}</span>
    <strong>{percentLabel}</strong>
  </div>
  <progress value={safePercent} max="100">{percentLabel}</progress>
</div>
