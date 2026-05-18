<script lang="ts">
  interface Props {
    label: string;
    percent: number;
  }

  let { label, percent }: Props = $props();
  let safePercent = $derived(Math.round(percent));
</script>

<div class="progress-block" aria-label={label}>
  <div class="progress-meta">
    <span>{label}</span>
    <strong>{safePercent}%</strong>
  </div>
  <progress value={safePercent} max="100">{safePercent}%</progress>
</div>
