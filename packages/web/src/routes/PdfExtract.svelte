<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from '../router.js';
  import { storeTransfer } from '../lib/data/transfer.js';
  import { validateCup, OUTCOMES } from '../lib/core/validator.js';
  import { extractPdfText } from '../lib/pdf/extract-text.js';
  import { ocrPdf } from '../lib/pdf/ocr.js';
  import { extractCupsFromPages } from '../lib/pdf/extract-cups.js';
  import EntryList from '../components/EntryList.svelte';
  import QueueControls from '../components/QueueControls.svelte';
  import type { Entry, Cup } from '../lib/types.js';

  // ── State ──────────────────────────────────────────────────────────────────

  let entries = $state<Entry[]>([]);
  let nextId = $state(0);
  let processing = $state(false);
  let queue = $state<Entry[]>([]);
  let generation = $state(0);

  // ── Derived ────────────────────────────────────────────────────────────────

  let hasCups = $derived(entries.some((e) => e.cups.length > 0));
  let hasDone = $derived(entries.some((e) => e.status === 'done' || e.status === 'error'));
  let hasEntries = $derived(entries.length > 0);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onMount(async () => {
    try {
      const { GlobalWorkerOptions } = await import('pdfjs-dist');
      GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    } catch {
      // silently fail; will surface as per-file error during extraction
    }
  });

  // ── File processing ────────────────────────────────────────────────────────

  function addFiles(files: File[]) {
    const newEntries: Entry[] = files.map((file) => ({
      id: nextId++,
      file,
      name: file.name,
      status: 'queued',
      source: null,
      cups: [],
      ocrProgress: null,
      error: null,
    }));
    entries.push(...newEntries);
    queue.push(...newEntries);
    drainQueue();
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;
    const gen = generation;
    while (queue.length > 0 && gen === generation) {
      const entry = queue.shift()!;
      await processEntry(entry);
    }
    if (gen === generation) processing = false;
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
      entry.error = (err as Error).message ?? 'Errore sconosciuto';
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

  function completedEntries(): Entry[] {
    return entries.filter((e) => e.status === 'done' || e.status === 'error');
  }

  function handleSend() {
    const content = buildVerificatoreCsv();
    const file = new File([content], 'estrazione-cup.csv', { type: 'text/csv;charset=utf-8' });
    navigate(`#/?transfer=${storeTransfer(file)}`);
  }

  function handleExport() {
    const content = buildExportCsv();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'estrazione-cup.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    generation++;
    entries = [];
    queue = [];
    processing = false;
  }

  // ── CSV builders ───────────────────────────────────────────────────────────

  function safeCell(s: string): string {
    return /^[=+\-@]/.test(s) ? `'${s}` : s;
  }

  function csvComma(value: unknown): string {
    const s = String(value ?? '');
    if (/[,"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return safeCell(s);
  }

  function csvSemi(value: unknown): string {
    const s = String(value ?? '');
    if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return safeCell(s);
  }

  function buildVerificatoreCsv(): string {
    const rows = ['cup,file_origine'];
    for (const entry of completedEntries()) {
      for (const cup of entry.cups) {
        rows.push(`${csvComma(cup.value)},${csvComma(entry.name)}`);
      }
    }
    return `\ufeff${rows.join('\n')}`;
  }

  function buildExportCsv(): string {
    const rows = ['cup;file_origine;formato_valido;fonte;manuale'];
    for (const entry of completedEntries()) {
      for (const cup of entry.cups) {
        rows.push(
          [cup.value, entry.name, cup.formalValid ? 'SI' : 'NO', cup.source ?? '', cup.manual ? 'SI' : 'NO']
            .map(csvSemi)
            .join(';'),
        );
      }
    }
    return `\ufeff${rows.join('\n')}`;
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
      (f) => f.type === 'application/pdf',
    );
    if (files.length) addFiles(files);
  }
</script>

<h1>Estrai CUP da fatture PDF</h1>
<p class="project-note">
  Carica uno o più PDF per estrarre automaticamente i codici CUP. I file sono elaborati interamente
  in locale, nessun dato viene inviato a server esterni. Per batch grandi i risultati appariranno
  progressivamente man mano che i PDF vengono elaborati.
</p>
<p class="project-note">
  I CUP contrassegnati con <strong>ocr</strong> nella colonna Fonte sono stati estratti tramite
  riconoscimento ottico del testo: verificane sempre la correttezza prima di utilizzarli, poiché
  errori di lettura (es. confusione tra lettere e cifre) o frammentazioni del testo possono
  produrre codici inesatti.
</p>

<div
  class="dropzone pdf-dropzone"
  class:pdf-dropzone--drag={dropzoneActive}
  role="region"
  aria-label="Zona di rilascio file PDF"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <label>
    <input
      type="file"
      multiple
      accept="application/pdf"
      class="visually-hidden"
      bind:this={fileInputEl}
      onchange={handleFileChange}
    />
    <span>Trascina i PDF qui oppure <span class="link-button">seleziona file</span></span>
  </label>
</div>

{#if hasEntries}
  <div id="pdf-results-area">
    <div class="section-head pdf-results-head">
      <h2 style="margin-bottom:0;">Risultati</h2>
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
