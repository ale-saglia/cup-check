<script lang="ts">
  import { onDestroy } from 'svelte';
  import { i18n } from '../i18n/i18n.svelte.js';
  import { navigate } from '../router.js';
  import { storeTransfer } from '../lib/data/transfer.js';
  import { validateCup, OUTCOMES } from '../lib/core/validator.js';
  import { extractPdfText } from '../lib/pdf/extract-text.js';
  import { ocrPdf, terminateOcrWorker } from '../lib/pdf/ocr.js';
  import { extractCupsFromPages } from '../lib/pdf/extract-cups.js';
  import { buildVerificatoreCsv, buildExportCsv } from '../lib/pdf/pdf-csv.js';
  import EntryList from '../components/EntryList.svelte';
  import QueueControls from '../components/QueueControls.svelte';
  import type { Entry, Cup } from '../lib/types.js';

  // ── State ──────────────────────────────────────────────────────────────────

  let entries = $state<Entry[]>([]);
  let nextId = $state(0);
  let processing = $state(false);
  let queue: number[] = [];
  let generation = $state(0);
  let liveAnnouncement = $state('');
  let lastQueueAnnouncement = '';

  // ── Derived ────────────────────────────────────────────────────────────────

  let hasCups = $derived(entries.some((e) => e.cups.length > 0));
  let hasDone = $derived(entries.some((e) => e.status === 'done' || e.status === 'error'));
  let hasEntries = $derived(entries.length > 0);
  let queueAnnouncement = $derived.by(() => {
    if (entries.length === 0) return '';
    const done = entries.filter((e) => e.status === 'done' || e.status === 'error').length;
    const active = entries.find((e) => e.status === 'parsing' || e.status === 'ocr');
    if (active?.status === 'ocr') {
      const progress = active.ocrProgress;
      if (progress?.ocrLoading) return i18n.t('pdf.ocrLoadingFor', { file: active.name });
      if (progress && progress.totalPages > 0) {
        return i18n.t('pdf.ocrPage', { file: active.name, page: progress.page, total: progress.totalPages });
      }
      return i18n.t('pdf.ocrRunningFor', { file: active.name });
    }
    if (active?.status === 'parsing') return i18n.t('pdf.reading', { file: active.name });
    return i18n.t('pdf.processed', { done, total: entries.length });
  });

  $effect(() => {
    if (queueAnnouncement && queueAnnouncement !== lastQueueAnnouncement) {
      liveAnnouncement = queueAnnouncement;
      lastQueueAnnouncement = queueAnnouncement;
    }
  });

  // ── File processing ────────────────────────────────────────────────────────

  function addFiles(files: File[]) {
    const startIdx = entries.length;
    files.forEach((file) => {
      entries.push({
        id: nextId++,
        file,
        name: file.name,
        status: 'queued',
        source: null,
        cups: [],
        ocrProgress: null,
        error: null,
      });
    });
    // entries.slice() returns the reactive proxies; mutations via these proxies update the template
    queue.push(...entries.slice(startIdx).map((entry) => entry.id));
    liveAnnouncement = i18n.t('pdf.addedToQueue', { count: files.length });
    drainQueue();
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;
    const gen = generation;
    try {
      while (queue.length > 0 && gen === generation) {
        const entryId = queue.shift()!;
        const entry = findEntry(entryId);
        if (entry) await processEntry(entry);
      }
    } finally {
      if (gen === generation) processing = false;
    }
  }

  async function processEntry(entry: Entry) {
    try {
      entry.status = 'parsing';

      const { pages, needsOcr } = await extractPdfText(entry.file!);

      let finalPages = pages;
      let source: 'text' | 'ocr' = 'text';

      if (needsOcr) {
        entry.status = 'ocr';
        entry.ocrProgress = { ocrLoading: true, page: 0, totalPages: 0 };

        const result = await ocrPdf(entry.file!, {
          onProgress: (progress: { ocrLoading: boolean; page: number; totalPages: number }) => {
            entry.ocrProgress = progress;
          },
        });
        finalPages = result.pages;
        source = 'ocr';
      }

      const extracted = extractCupsFromPages(entry.name, finalPages, source);

      entry.status = 'done';
      entry.source = source;
      entry.cups = extracted.cups.map(
        (cup: { value: string; formalValid: boolean }, i: number): Cup => ({
          id: `${entry.id}-${i}`,
          value: cup.value,
          formalValid: cup.formalValid,
          source,
          manual: false,
          editing: false,
        }),
      );
    } catch (err) {
      entry.status = 'error';
      entry.error = (err as Error).message ?? i18n.t('pdf.unknownError');
    } finally {
      entry.file = null;
    }
  }

  // ── Cup edit operations ────────────────────────────────────────────────────

  function findEntry(entryId: number): Entry | null {
    return entries.find((e) => e.id === entryId) ?? null;
  }

  function findCup(entryId: number, cupId: string): Cup | null {
    return findEntry(entryId)?.cups.find((c) => c.id === cupId) ?? null;
  }

  function handleEdit(entryId: number, cupId: string) {
    entries.forEach((e) => e.cups.forEach((c) => { c.editing = false; }));
    const cup = findCup(entryId, cupId);
    if (cup) cup.editing = true;
  }

  function handleRemove(entryId: number, cupId: string) {
    const entry = findEntry(entryId);
    if (entry) entry.cups = entry.cups.filter((c) => c.id !== cupId);
  }

  function handleAddManual(entryId: number) {
    const entry = findEntry(entryId);
    if (!entry) return;
    entries.forEach((e) => e.cups.forEach((c) => { c.editing = false; }));
    entry.cups.push({
      id: `${entryId}-m${nextId++}`,
      value: '',
      formalValid: false,
      source: 'manuale',
      manual: true,
      editing: true,
    });
  }

  function handleSaveEdit(entryId: number, cupId: string, rawValue: string) {
    const cup = findCup(entryId, cupId);
    if (!cup || !cup.editing) return;
    const entry = findEntry(entryId)!;
    const normalized = rawValue.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    if (normalized === '' && cup.manual) {
      entry.cups = entry.cups.filter((c) => c.id !== cupId);
    } else if (normalized.length > 0) {
      cup.value = normalized;
      cup.formalValid = validateCup(normalized).outcome !== OUTCOMES.INVALID;
      cup.manual = true;
      cup.editing = false;
    } else {
      cup.editing = false;
    }
  }

  function handleCancelEdit(entryId: number, cupId: string) {
    const cup = findCup(entryId, cupId);
    if (!cup || !cup.editing) return;
    const entry = findEntry(entryId)!;
    if (cup.value === '' && cup.manual) {
      entry.cups = entry.cups.filter((c) => c.id !== cupId);
    } else {
      cup.editing = false;
    }
  }

  // ── Global actions ─────────────────────────────────────────────────────────

  function handleSend() {
    const content = buildVerificatoreCsv(entries);
    const file = new File([content], 'estrazione-cup.csv', { type: 'text/csv;charset=utf-8' });
    navigate(`#/?transfer=${storeTransfer(file)}`);
  }

  function handleExport() {
    const content = buildExportCsv(entries);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = i18n.t('pdf.exportFileName');
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    generation++;
    void terminateOcrWorker();
    entries = [];
    queue.length = 0;
    processing = false;
    liveAnnouncement = i18n.t('pdf.cleared');
  }

  onDestroy(() => {
    generation++;
    void terminateOcrWorker();
  });

  // ── Dropzone handlers ──────────────────────────────────────────────────────

  let dropzoneActive = $state(false);
  let fileInputEl: HTMLInputElement;

  function handleFileChange(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    if (files.length) addFiles(files);
    fileInputEl.value = '';
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dropzoneActive = true;
  }

  function handleDragLeave(e: DragEvent) {
    if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) {
      dropzoneActive = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dropzoneActive = false;
    const files = Array.from(e.dataTransfer?.files ?? []).filter(
      (f) => f.type === 'application/pdf',
    );
    if (files.length) addFiles(files);
  }
</script>

<h1>{i18n.t('pdf.title')}</h1>
<p class="project-note">{i18n.t('pdf.intro')}</p>
<p class="project-note">
  {i18n.t('pdf.ocrNoteBefore')} <strong>ocr</strong> {i18n.t('pdf.ocrNoteAfter')}
</p>

<div
  id="pdf-dropzone"
  class="dropzone pdf-dropzone"
  class:pdf-dropzone--drag={dropzoneActive}
  role="region"
  aria-label={i18n.t('pdf.dropzone')}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <label class="pdf-dropzone-label">
    <input
      id="pdf-file-input"
      type="file"
      multiple
      accept="application/pdf"
      class="visually-hidden"
      bind:this={fileInputEl}
      onchange={handleFileChange}
    />
    <span>{i18n.t('pdf.dropzoneTextBefore')} <span class="link-button">{i18n.t('pdf.selectFiles')}</span></span>
  </label>
</div>

{#if hasEntries}
  <div id="pdf-results-area">
    <div class="section-head pdf-results-head">
      <h2 style="margin-bottom:0;">{i18n.t('pdf.results')}</h2>
      <QueueControls
        {hasCups}
        {hasDone}
        onSend={handleSend}
        onExport={handleExport}
        onClear={handleClear}
      />
    </div>

    <EntryList
      {entries}
      onEdit={handleEdit}
      onRemove={handleRemove}
      onAddManual={handleAddManual}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={handleCancelEdit}
    />
  </div>
{/if}


<div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{liveAnnouncement}</div>
