<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte.js';
  import { navigate } from '../router.js';
  import { storeTransfer } from '../lib/data/transfer.js';
  import { downloadBlob } from '../lib/core/download.js';
  import { validateCup, OUTCOMES } from '../lib/core/validator.js';
  import { extractCupsFromXmlFile } from '../lib/xml/extract-cups.js';
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
    const active = entries.find((e) => e.status === 'parsing');
    if (active) return i18n.t('xml.reading', { file: active.name });
    return i18n.t('xml.processed', { done, total: entries.length });
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
    queue.push(...entries.slice(startIdx).map((entry) => entry.id));
    liveAnnouncement = i18n.t('xml.addedToQueue', { count: files.length });
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
      const text = await entry.file!.text();
      const extracted = extractCupsFromXmlFile(entry.name, text);

      entry.status = 'done';
      entry.source = 'xml';
      entry.cups = extracted.cups.map(
        (cup, i): Cup => ({
          id: `${entry.id}-${i}`,
          value: cup.value,
          formalValid: cup.formalValid,
          source: 'xml',
          manual: false,
          editing: false,
        }),
      );
    } catch (err) {
      entry.status = 'error';
      entry.error = (err as Error).message ?? i18n.t('xml.unknownError');
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
    downloadBlob(blob, i18n.t('xml.exportFileName'));
  }

  function handleClear() {
    generation++;
    entries = [];
    queue.length = 0;
    processing = false;
    liveAnnouncement = i18n.t('xml.cleared');
  }

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
      (f) => f.type === 'text/xml' || f.name.toLowerCase().endsWith('.xml'),
    );
    if (files.length) addFiles(files);
  }
</script>

<h1>{i18n.t('xml.title')}</h1>
<p class="project-note">{i18n.t('xml.intro')}</p>

<div
  id="xml-dropzone"
  class="dropzone pdf-dropzone"
  class:pdf-dropzone--drag={dropzoneActive}
  role="region"
  aria-label={i18n.t('xml.dropzone')}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <label class="pdf-dropzone-label">
    <input
      id="xml-file-input"
      type="file"
      multiple
      accept=".xml,text/xml,application/xml"
      class="visually-hidden"
      bind:this={fileInputEl}
      onchange={handleFileChange}
    />
    <span>{i18n.t('xml.dropzoneTextBefore')} <span class="link-button">{i18n.t('xml.selectFiles')}</span></span>
  </label>
</div>

{#if hasEntries}
  <div id="xml-results-area">
    <div class="section-head pdf-results-head">
      <h2 style="margin-bottom:0;">{i18n.t('xml.results')}</h2>
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
