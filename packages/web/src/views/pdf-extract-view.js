import { extractPdfText } from '../lib/pdf/extract-text.js';
import { ocrPdf } from '../lib/pdf/ocr.js';
import { extractCupsFromPages } from '../lib/pdf/extract-cups.js';
import { validateCup, OUTCOMES } from '../lib/core/validator.js';
import { navigate } from '../router.js';
import { storeTransfer } from '../lib/data/transfer.js';

let _container = null;
let _entries = [];
let _nextId = 0;
let _processing = false;
let _queue = [];
let _generation = 0;
let _renderPending = false;
let _debounceTimer = null;

export async function mount(container) {
  _container = container;
  _entries = [];
  _nextId = 0;
  _processing = false;
  _queue = [];
  _generation++;

  try {
    const { GlobalWorkerOptions } = await import('pdfjs-dist');
    GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
  } catch {
    // silently fail; will surface as per-file error during extraction
  }

  _container.innerHTML = `
    <h1>Estrai CUP da fatture PDF</h1>
    <p class="project-note">Carica uno o più PDF per estrarre automaticamente i codici CUP. I file sono elaborati interamente in locale, nessun dato viene inviato a server esterni. Per batch grandi i risultati appariranno progressivamente man mano che i PDF vengono elaborati.</p>
    <p class="project-note">I CUP contrassegnati con <strong>ocr</strong> nella colonna Fonte sono stati estratti tramite riconoscimento ottico del testo: verificane sempre la correttezza prima di utilizzarli, poiché errori di lettura (es. confusione tra lettere e cifre) o frammentazioni del testo possono produrre codici inesatti.</p>

    <label class="dropzone pdf-dropzone" id="pdf-dropzone" tabindex="0" role="button" aria-label="Zona di rilascio file PDF. Premi Invio o Spazio per selezionare file.">
      <input type="file" id="pdf-file-input" multiple accept="application/pdf" class="visually-hidden">
      <span>Trascina i PDF qui oppure <span class="link-button">seleziona file</span></span>
    </label>

    <div id="pdf-results-area" class="hidden">
      <div class="section-head pdf-results-head">
        <h2 style="margin-bottom:0;">Risultati</h2>
        <div class="button-row">
          <button id="pdf-send-btn" class="primary" type="button" disabled>Apri nel verificatore</button>
          <button id="pdf-export-btn" class="secondary" type="button" disabled>Esporta CSV (file ↔ CUP)</button>
          <button id="pdf-clear-btn" class="secondary" type="button">Pulisci</button>
        </div>
      </div>

      <div class="table-wrap">
        <table aria-label="Risultati estrazione CUP dai PDF">
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col" class="pdf-cup-col">CUP</th>
              <th scope="col">Formato</th>
              <th scope="col">Fonte</th>
              <th scope="col">Manuale</th>
              <th scope="col">Azioni</th>
            </tr>
          </thead>
          <tbody id="pdf-results-body"></tbody>
        </table>
      </div>
    </div>
  `;

  bindEvents();
}

export function unmount() {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  _renderPending = false;
  if (_container) {
    _container.innerHTML = '';
    _container = null;
  }
  _entries = [];
  _queue = [];
  _processing = false;
}

function scheduleUpdate() {
  if (_renderPending) return;
  _renderPending = true;
  _debounceTimer = setTimeout(() => {
    _renderPending = false;
    _debounceTimer = null;
    updateTable();
  }, 150);
}

// ── Event binding ──────────────────────────────────────────────────────────────

function bindEvents() {
  if (!_container) return;

  const fileInput = _container.querySelector('#pdf-file-input');
  const dropzone = _container.querySelector('#pdf-dropzone');
  const body = _container.querySelector('#pdf-results-body');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) addFiles(Array.from(e.target.files));
    fileInput.value = '';
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('pdf-dropzone--drag');
  });
  dropzone.addEventListener('dragleave', (e) => {
    if (!dropzone.contains(e.relatedTarget)) {
      dropzone.classList.remove('pdf-dropzone--drag');
    }
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('pdf-dropzone--drag');
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
    if (files.length) addFiles(files);
  });

  _container.querySelector('#pdf-send-btn').addEventListener('click', sendToVerificatore);
  _container.querySelector('#pdf-export-btn').addEventListener('click', exportCsv);
  _container.querySelector('#pdf-clear-btn').addEventListener('click', clearAll);

  // Prevent blur from firing when the user clicks save/cancel inside a table cell
  body.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-action="save-edit"],[data-action="cancel-edit"]')) {
      e.preventDefault();
    }
  });

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const entryId = Number(tr.dataset.entryId);
    const cupId = tr.dataset.cupId;
    const action = btn.dataset.action;

    if (action === 'edit') startEdit(entryId, cupId);
    else if (action === 'remove') removeCup(entryId, cupId);
    else if (action === 'add-manual') startAddManual(entryId);
    else if (action === 'save-edit') {
      const input = tr.querySelector('input[data-editing]');
      if (input) commitEdit(entryId, cupId, input.value);
    } else if (action === 'cancel-edit') cancelEdit(entryId, cupId);
  });

  body.addEventListener('keydown', (e) => {
    if (!e.target.matches('input[data-editing]')) return;
    const tr = e.target.closest('tr');
    const entryId = Number(tr.dataset.entryId);
    const cupId = tr.dataset.cupId;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(entryId, cupId, e.target.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit(entryId, cupId);
    }
  });

  body.addEventListener(
    'blur',
    (e) => {
      if (!e.target.matches('input[data-editing]')) return;
      const tr = e.target.closest('tr');
      if (!tr) return;
      commitEdit(Number(tr.dataset.entryId), tr.dataset.cupId, e.target.value);
    },
    true,
  );
}

// ── File processing ────────────────────────────────────────────────────────────

function addFiles(files) {
  const newEntries = files.map((file) => ({
    id: _nextId++,
    file,
    name: file.name,
    status: 'queued',
    source: null,
    cups: [],
    ocrProgress: null,
    error: null,
  }));
  _entries.push(...newEntries);
  _queue.push(...newEntries);
  updateTable();
  drainQueue();
}

async function drainQueue() {
  if (_processing) return;
  _processing = true;
  const gen = _generation;
  while (_queue.length > 0 && gen === _generation) {
    const entry = _queue.shift();
    await processEntry(entry);
  }
  if (gen === _generation) _processing = false;
}

async function processEntry(entry) {
  if (!_container) return;

  try {
    entry.status = 'parsing';
    scheduleUpdate();

    const { pages, needsOcr } = await extractPdfText(entry.file);

    let finalPages = pages;
    let source = 'text';

    if (needsOcr) {
      entry.status = 'ocr';
      entry.ocrProgress = { ocrLoading: true, page: 0, totalPages: 0 };
      scheduleUpdate();

      const result = await ocrPdf(entry.file, {
        onProgress: (progress) => {
          if (!_container) return;
          entry.ocrProgress = progress;
          scheduleUpdate();
        },
      });
      finalPages = result.pages;
      source = 'ocr';
    }

    const extracted = extractCupsFromPages(entry.name, finalPages, source);

    entry.status = 'done';
    entry.source = source;
    entry.cups = extracted.cups.map((cup, i) => ({
      id: `${entry.id}-${i}`,
      value: cup.value,
      formalValid: cup.formalValid,
      source,
      manual: false,
      editing: false,
    }));
  } catch (err) {
    entry.status = 'error';
    entry.error = err.message ?? 'Errore sconosciuto';
  } finally {
    entry.file = null;
    updateTable();
  }
}

// ── Cup edit operations ────────────────────────────────────────────────────────

function startEdit(entryId, cupId) {
  const cup = findCup(entryId, cupId);
  if (!cup) return;
  // Close any other active edit
  _entries.forEach((e) =>
    e.cups.forEach((c) => {
      c.editing = false;
    }),
  );
  cup.editing = true;
  updateTable();
}

function cancelEdit(entryId, cupId) {
  const cup = findCup(entryId, cupId);
  if (!cup || !cup.editing) return;
  // Remove placeholder cups with no value that were never committed
  const entry = findEntry(entryId);
  if (cup.value === '' && cup.manual) {
    entry.cups = entry.cups.filter((c) => c.id !== cupId);
  } else {
    cup.editing = false;
  }
  updateTable();
}

function commitEdit(entryId, cupId, rawValue) {
  const cup = findCup(entryId, cupId);
  if (!cup || !cup.editing) return;
  const entry = findEntry(entryId);
  const normalized = rawValue
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);
  if (normalized === '' && cup.manual) {
    // discard empty new manual entry
    entry.cups = entry.cups.filter((c) => c.id !== cupId);
  } else if (normalized.length > 0) {
    cup.value = normalized;
    cup.formalValid = validateCup(normalized).outcome !== OUTCOMES.INVALID;
    cup.manual = true;
    cup.editing = false;
  } else {
    cup.editing = false;
  }
  updateTable();
}

function removeCup(entryId, cupId) {
  const entry = findEntry(entryId);
  if (!entry) return;
  entry.cups = entry.cups.filter((c) => c.id !== cupId);
  updateTable();
}

function startAddManual(entryId) {
  const entry = findEntry(entryId);
  if (!entry) return;
  _entries.forEach((e) =>
    e.cups.forEach((c) => {
      c.editing = false;
    }),
  );
  entry.cups.push({
    id: `${entryId}-m${_nextId++}`,
    value: '',
    formalValid: false,
    source: 'manuale',
    manual: true,
    editing: true,
  });
  updateTable();
}

// ── Global actions ─────────────────────────────────────────────────────────────

function sendToVerificatore() {
  const content = buildVerificatoreCsv();
  const file = new File([content], 'estrazione-cup.csv', { type: 'text/csv;charset=utf-8' });
  navigate(`#/?transfer=${storeTransfer(file)}`);
}

function exportCsv() {
  const content = buildExportCsv();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'estrazione-cup.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function clearAll() {
  _generation++;
  _entries = [];
  _queue = [];
  _processing = false;
  updateTable();
}

// ── CSV builders ───────────────────────────────────────────────────────────────

function buildVerificatoreCsv() {
  const rows = ['cup,file_origine'];
  for (const entry of completedEntries()) {
    for (const cup of entry.cups) {
      rows.push(`${csvComma(cup.value)},${csvComma(entry.name)}`);
    }
  }
  return `\ufeff${rows.join('\n')}`;
}

function buildExportCsv() {
  const rows = ['cup;file_origine;formato_valido;fonte;manuale'];
  for (const entry of completedEntries()) {
    for (const cup of entry.cups) {
      rows.push(
        [
          cup.value,
          entry.name,
          cup.formalValid ? 'SI' : 'NO',
          cup.source ?? '',
          cup.manual ? 'SI' : 'NO',
        ]
          .map(csvSemi)
          .join(';'),
      );
    }
  }
  return `\ufeff${rows.join('\n')}`;
}

function safeCell(s) {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function csvComma(value) {
  const s = String(value ?? '');
  if (/[,"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return safeCell(s);
}

function csvSemi(value) {
  const s = String(value ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return safeCell(s);
}

// ── Render ─────────────────────────────────────────────────────────────────────

function updateTable() {
  if (!_container) return;

  const area = _container.querySelector('#pdf-results-area');
  const body = _container.querySelector('#pdf-results-body');
  const sendBtn = _container.querySelector('#pdf-send-btn');
  const exportBtn = _container.querySelector('#pdf-export-btn');

  if (_entries.length === 0) {
    area.classList.add('hidden');
    return;
  }

  area.classList.remove('hidden');

  const hasCups = _entries.some((e) => e.cups.length > 0);
  const hasDone = _entries.some((e) => e.status === 'done' || e.status === 'error');
  sendBtn.disabled = !hasDone || !hasCups;
  exportBtn.disabled = !hasDone || !hasCups;

  body.replaceChildren(..._entries.flatMap(renderEntryRows));

  // Re-focus active edit input after re-render
  const activeInput = body.querySelector('input[data-editing]');
  if (activeInput) {
    activeInput.focus();
    if (activeInput.value) activeInput.select();
  }
}

function renderEntryRows(entry) {
  const name = entry.name;

  if (entry.status === 'queued') {
    return [makeSimpleStatusRow(entry.id, name, null, 'In coda', 5)];
  }

  if (entry.status === 'parsing') {
    return [makeSimpleStatusRow(entry.id, name, null, 'Lettura PDF…', 5)];
  }

  if (entry.status === 'ocr') {
    const { ocrLoading, page, totalPages } = entry.ocrProgress ?? {};
    const label = ocrLoading ? 'Caricamento OCR…' : `OCR pagina ${page}\u202F/\u202F${totalPages}`;
    return [makeSimpleStatusRow(entry.id, name, 'warn', label, 5)];
  }

  if (entry.status === 'error') {
    const badge = document.createElement('span');
    badge.className = 'badge bad';
    badge.textContent = 'Errore';
    const statusTd = document.createElement('td');
    statusTd.colSpan = 4;
    statusTd.className = 'pdf-status-cell';
    statusTd.append(badge, ` ${entry.error ?? ''}`);

    const actionTd = document.createElement('td');
    if (entry.cups.length === 0) {
      actionTd.replaceChildren(makeButton('+ aggiungi CUP', 'add-manual'));
    }

    const errorTr = makeTr(entry.id);
    errorTr.append(makeNameCell(name), statusTd, actionTd);

    if (entry.cups.length === 0) return [errorTr];
    return [errorTr, ...renderCupRows(entry)];
  }

  // status === 'done'
  if (entry.cups.length === 0) {
    const noCupTd = document.createElement('td');
    noCupTd.colSpan = 4;
    noCupTd.className = 'pdf-status-cell pdf-no-cup';
    noCupTd.textContent = 'Nessun CUP rilevato.';

    const actionTd = document.createElement('td');
    actionTd.replaceChildren(makeButton('+ aggiungi CUP', 'add-manual'));

    const tr = makeTr(entry.id);
    tr.append(makeNameCell(name), noCupTd, actionTd);
    return [tr];
  }

  return renderCupRows(entry);
}

function renderCupRows(entry) {
  const name = entry.name;
  return entry.cups.map((cup) => {
    const tr = makeTr(entry.id, cup.id);

    if (cup.editing) {
      const input = document.createElement('input');
      input.className = 'pdf-cup-input';
      input.type = 'text';
      input.value = cup.value;
      input.maxLength = 15;
      input.dataset.editing = '';
      input.dataset.entryId = String(entry.id);
      input.dataset.cupId = String(cup.id);
      input.setAttribute('aria-label', 'Valore CUP');

      const inputTd = document.createElement('td');
      inputTd.colSpan = 2;
      inputTd.replaceChildren(input);

      const sourceTd = document.createElement('td');
      sourceTd.textContent = cup.source ?? '';

      const actionTd = document.createElement('td');
      actionTd.append(makeButton('salva', 'save-edit'), ' ', makeButton('annulla', 'cancel-edit'));

      tr.append(makeNameCell(name), inputTd, sourceTd, document.createElement('td'), actionTd);
      return tr;
    }

    const cupCode = document.createElement('code');
    cupCode.className = 'cup-cell';
    cupCode.textContent = cup.value;
    const cupTd = document.createElement('td');
    cupTd.replaceChildren(cupCode);

    const formatBadge = document.createElement('span');
    formatBadge.className = `badge ${cup.formalValid ? 'good' : 'bad'}`;
    formatBadge.textContent = cup.formalValid ? 'Valido' : 'Invalido';
    const formatTd = document.createElement('td');
    formatTd.replaceChildren(formatBadge);

    const sourceTd = document.createElement('td');
    sourceTd.textContent = cup.source ?? '';

    const manualTd = document.createElement('td');
    if (cup.manual) {
      const manualBadge = document.createElement('span');
      manualBadge.className = 'badge warn';
      manualBadge.textContent = 'manuale';
      manualTd.replaceChildren(manualBadge);
    }

    const actionTd = document.createElement('td');
    actionTd.append(makeButton('modifica', 'edit'), ' ', makeButton('rimuovi', 'remove'));

    tr.append(makeNameCell(name), cupTd, formatTd, sourceTd, manualTd, actionTd);
    return tr;
  });
}

// ── DOM helpers ────────────────────────────────────────────────────────────────

function makeTr(entryId, cupId = null) {
  const tr = document.createElement('tr');
  tr.dataset.entryId = String(entryId);
  if (cupId !== null) tr.dataset.cupId = String(cupId);
  return tr;
}

function makeNameCell(name) {
  const td = document.createElement('td');
  td.className = 'detail-cell';
  td.title = name;
  td.textContent = truncateName(name);
  return td;
}

function makeButton(text, action) {
  const btn = document.createElement('button');
  btn.className = 'link-button';
  btn.type = 'button';
  btn.dataset.action = action;
  btn.textContent = text;
  return btn;
}

function makeSimpleStatusRow(entryId, name, badgeClass, badgeText, colSpan) {
  const badge = document.createElement('span');
  badge.className = badgeClass ? `badge ${badgeClass}` : 'badge';
  badge.textContent = badgeText;

  const statusTd = document.createElement('td');
  statusTd.colSpan = colSpan;
  statusTd.className = 'pdf-status-cell';
  statusTd.replaceChildren(badge);

  const tr = makeTr(entryId);
  tr.append(makeNameCell(name), statusTd);
  return tr;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function findEntry(entryId) {
  return _entries.find((e) => e.id === entryId) ?? null;
}

function findCup(entryId, cupId) {
  return findEntry(entryId)?.cups.find((c) => c.id === cupId) ?? null;
}

function completedEntries() {
  return _entries.filter((e) => e.status === 'done' || e.status === 'error');
}

function truncateName(name, max = 40) {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}
