// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';

const mockGlobalWorkerOptions = { workerSrc: '' };

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: mockGlobalWorkerOptions }));
vi.mock('../src/lib/pdf/extract-text.js', () => ({ extractPdfText: vi.fn() }));
vi.mock('../src/lib/pdf/ocr.js', () => ({ ocrPdf: vi.fn(), terminateOcrWorker: vi.fn() }));
vi.mock('../src/lib/pdf/extract-cups.js', () => ({ extractCupsFromPages: vi.fn() }));
vi.mock('../src/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../src/lib/data/transfer.js', () => ({ storeTransfer: vi.fn() }));
vi.mock('../src/lib/core/validator.js', () => ({
  validateCup: vi.fn().mockReturnValue({ outcome: 'FORMATO_VALIDO_DA_VERIFICARE' }),
  OUTCOMES: { INVALID: 'INVALIDO_FORMATO' },
}));

import { extractPdfText } from '../src/lib/pdf/extract-text.js';
import { ocrPdf, terminateOcrWorker } from '../src/lib/pdf/ocr.js';
import { extractCupsFromPages } from '../src/lib/pdf/extract-cups.js';
import { navigate } from '../src/router.js';
import { storeTransfer } from '../src/lib/data/transfer.js';
import PdfExtract from '../src/routes/PdfExtract.svelte';

const CUP1 = 'G17H03000130001';
const CUP2 = 'J61B21007000007';

function makeFile(name = 'fattura.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function makeExtractResult(cups = [{ value: CUP1, formalValid: true }]) {
  return { fileName: 'fattura.pdf', status: cups.length ? 'ok' : 'no_cup', source: 'text', cups };
}

function uploadFiles(container, files) {
  const input = container.querySelector('#pdf-file-input');
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function makeDragEvent(type, extra = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if ('relatedTarget' in extra) {
    Object.defineProperty(event, 'relatedTarget', { value: extra.relatedTarget });
  }
  if ('dataTransfer' in extra) {
    Object.defineProperty(event, 'dataTransfer', { value: extra.dataTransfer });
  }
  return event;
}

function btn(container, text) {
  return Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent.trim() === text,
  );
}

// After an async state change, Svelte has queued DOM updates but not applied them.
// Pattern: waitFor(spy called) ensures microtasks ran; flushSync() forces DOM flush.
async function waitDone() {
  await waitFor(() => expect(vi.mocked(extractCupsFromPages)).toHaveBeenCalled());
  flushSync();
}

async function waitError() {
  // On error, extractCupsFromPages is never called; extractPdfText was called and rejected.
  // By the time waitFor resolves (macrotask), rejection has already propagated (microtask).
  await waitFor(() => expect(vi.mocked(extractPdfText)).toHaveBeenCalled());
  flushSync();
}

beforeEach(() => {
  vi.mocked(extractPdfText).mockResolvedValue({ pages: [CUP1], totalChars: 100, needsOcr: false });
  vi.mocked(ocrPdf).mockResolvedValue({ pages: [CUP1] });
  vi.mocked(terminateOcrWorker).mockResolvedValue(undefined);
  vi.mocked(extractCupsFromPages).mockReturnValue(makeExtractResult());
  vi.mocked(storeTransfer).mockReturnValue('test-transfer-id');
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.revokeObjectURL = vi.fn();
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'a') element.click = vi.fn();
    return element;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ── Render iniziale ───────────────────────────────────────────────────────────

describe('PdfExtract: render iniziale', () => {
  it('mostra h1, dropzone e input file; nessuna area risultati', () => {
    const { container } = render(PdfExtract);
    expect(container.querySelector('h1')?.textContent).toBe('Estrai CUP da fatture PDF');
    expect(container.querySelector('#pdf-dropzone')).not.toBeNull();
    expect(container.querySelector('#pdf-file-input')).not.toBeNull();
    expect(container.querySelector('#pdf-results-area')).toBeNull();
  });

  it('mount non lancia eccezione se pdfjs fallisce durante il caricamento', () => {
    Object.defineProperty(mockGlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      set() {
        throw new Error('rete non disponibile');
      },
    });
    expect(() => render(PdfExtract)).not.toThrow();
    Object.defineProperty(mockGlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      writable: true,
      value: '',
    });
  });
});

// ── Elaborazione file ─────────────────────────────────────────────────────────

describe('PdfExtract: elaborazione file', () => {
  it("selezionando file via input mostra l'area risultati", async () => {
    vi.mocked(extractPdfText).mockReturnValue(new Promise(() => {}));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    // entries.push() is synchronous → DOM update batched but detectable via waitFor
    await waitFor(() => expect(container.querySelector('#pdf-results-area')).not.toBeNull());
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/PDF|coda/);
  });

  it('input change senza file non aggiunge entry', () => {
    const { container } = render(PdfExtract);
    uploadFiles(container, []);
    flushSync();
    expect(container.querySelector('#pdf-results-area')).toBeNull();
  });

  it("resetta il valore dell'input dopo la selezione", () => {
    vi.mocked(extractPdfText).mockReturnValue(new Promise(() => {}));
    const { container } = render(PdfExtract);
    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'value', { configurable: true, writable: true, value: 'fake' });
    Object.defineProperty(input, 'files', { value: [makeFile()], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(input.value).toBe('');
  });

  it('elabora il file e mostra il CUP estratto', async () => {
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
    expect(container.innerHTML).toContain('Valido');
  });

  it('attiva il percorso OCR quando needsOcr è true', async () => {
    vi.mocked(extractPdfText).mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true });
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitFor(() => expect(vi.mocked(ocrPdf)).toHaveBeenCalledOnce());
  });

  it('mostra badge "Caricamento OCR…" durante il caricamento del worker OCR', async () => {
    vi.mocked(extractPdfText).mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true });
    vi.mocked(ocrPdf).mockImplementation(() => new Promise(() => {}));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    // ocrPdf called → entry.status='ocr', entry.ocrProgress={ocrLoading:true,...} already set
    await waitFor(() => expect(vi.mocked(ocrPdf)).toHaveBeenCalled());
    flushSync();
    expect(container.innerHTML).toContain('Caricamento OCR');
  });

  it('mostra badge "OCR pagina N/T" durante il processing', async () => {
    let progressCb;
    vi.mocked(extractPdfText).mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true });
    vi.mocked(ocrPdf).mockImplementation((_file, { onProgress }) => {
      progressCb = onProgress;
      return new Promise(() => {});
    });
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitFor(() => expect(vi.mocked(ocrPdf)).toHaveBeenCalled());
    flushSync();
    progressCb?.({ ocrLoading: false, page: 1, totalPages: 3 });
    flushSync();
    expect(container.innerHTML).toContain('OCR pagina');
  });

  it('annuncia OCR in corso quando il progresso non ha ancora pagine totali', async () => {
    let progressCb;
    vi.mocked(extractPdfText).mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true });
    vi.mocked(ocrPdf).mockImplementation((_file, { onProgress }) => {
      progressCb = onProgress;
      return new Promise(() => {});
    });
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile('scansione.pdf')]);
    await waitFor(() => expect(vi.mocked(ocrPdf)).toHaveBeenCalled());
    progressCb?.({ ocrLoading: false, page: 0, totalPages: 0 });
    flushSync();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('OCR in corso');
  });

  it('mostra badge errore se extractPdfText rigetta', async () => {
    vi.mocked(extractPdfText).mockRejectedValue(new Error('PDF corrotto'));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitError();
    expect(container.querySelector('.badge.bad')).not.toBeNull();
    expect(container.innerHTML).toContain('PDF corrotto');
  });

  it('XSS: messaggio di errore renderizzato come testo, non HTML', async () => {
    vi.mocked(extractPdfText).mockRejectedValue(new Error('<script>alert(1)</script>'));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitError();
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('completa il percorso OCR e marca la fonte come ocr', async () => {
    vi.mocked(extractPdfText).mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true });
    vi.mocked(ocrPdf).mockResolvedValue({ pages: [CUP1] });
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
    expect(container.textContent).toContain('ocr');
  });

  it('usa il messaggio fallback per errori non Error', async () => {
    vi.mocked(extractPdfText).mockRejectedValue({});
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitError();
    expect(container.textContent).toContain('Errore sconosciuto');
  });

  it('accoda nuovi file mentre una elaborazione è già in corso', async () => {
    let resolveFirst;
    vi.mocked(extractPdfText)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValue({ pages: [CUP2], totalChars: 100, needsOcr: false });

    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile('primo.pdf')]);
    await waitFor(() => expect(container.querySelector('#pdf-results-area')).not.toBeNull());

    uploadFiles(container, [makeFile('secondo.pdf')]);
    flushSync();
    expect(vi.mocked(extractPdfText)).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('secondo.pdf');

    resolveFirst({ pages: [CUP1], totalChars: 100, needsOcr: false });
    await waitFor(() => expect(vi.mocked(extractPdfText)).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(vi.mocked(extractCupsFromPages)).toHaveBeenCalledTimes(2));
    flushSync();
    expect(container.querySelectorAll('.cup-cell')).toHaveLength(2);
  });

  it('drop senza dataTransfer non aggiunge entry', () => {
    const { container } = render(PdfExtract);
    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(makeDragEvent('drop'));
    flushSync();
    expect(container.querySelector('#pdf-results-area')).toBeNull();
  });

  it('mostra "Nessun CUP rilevato" se il PDF non contiene CUP', async () => {
    vi.mocked(extractCupsFromPages).mockReturnValue(makeExtractResult([]));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.innerHTML).toContain('Nessun CUP rilevato');
  });

  it('un errore su un file non blocca il processing di quelli successivi', async () => {
    let callCount = 0;
    vi.mocked(extractCupsFromPages).mockImplementation(() => {
      if (++callCount === 1) throw new TypeError('crash simulato');
      return makeExtractResult();
    });
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile('primo.pdf'), makeFile('secondo.pdf')]);
    // Wait for extractCupsFromPages to be called twice (once throws, once succeeds)
    await waitFor(() => expect(vi.mocked(extractCupsFromPages)).toHaveBeenCalledTimes(2));
    flushSync();
    expect(container.querySelector('.badge.bad')).not.toBeNull();
    expect(container.querySelector('.cup-cell')).not.toBeNull();
  });
});

// ── Drag and drop ─────────────────────────────────────────────────────────────

describe('PdfExtract: drag and drop', () => {
  it('dragover aggiunge la classe pdf-dropzone--drag', async () => {
    const { container } = render(PdfExtract);
    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(makeDragEvent('dragover'));
    flushSync();
    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(true);
  });

  it('dragleave rimuove la classe se il cursore esce dalla zona', () => {
    const { container } = render(PdfExtract);
    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(makeDragEvent('dragover'));
    flushSync();
    dropzone.dispatchEvent(makeDragEvent('dragleave', { relatedTarget: document.body }));
    flushSync();
    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(false);
  });

  it('dragleave NON rimuove la classe se il cursore è ancora dentro la zona', () => {
    const { container } = render(PdfExtract);
    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(makeDragEvent('dragover'));
    flushSync();
    const child = document.createElement('span');
    dropzone.appendChild(child);
    dropzone.dispatchEvent(makeDragEvent('dragleave', { relatedTarget: child }));
    flushSync();
    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(true);
  });

  it('drop aggiunge i file PDF alla coda', async () => {
    vi.mocked(extractPdfText).mockReturnValue(new Promise(() => {}));
    const { container } = render(PdfExtract);
    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(
      makeDragEvent('drop', { dataTransfer: { files: [makeFile('dropped.pdf')] } }),
    );
    await waitFor(() => expect(container.querySelector('#pdf-results-area')).not.toBeNull());
  });

  it('drop ignora file non-PDF', () => {
    const { container } = render(PdfExtract);
    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(
      makeDragEvent('drop', {
        dataTransfer: { files: [new File(['text'], 'doc.txt', { type: 'text/plain' })] },
      }),
    );
    flushSync();
    expect(container.querySelector('#pdf-results-area')).toBeNull();
  });
});

// ── Edit e rimozione CUP ──────────────────────────────────────────────────────

describe('PdfExtract: edit e rimozione CUP', () => {
  async function renderWithCup(cup = CUP1) {
    vi.mocked(extractCupsFromPages).mockReturnValue(
      makeExtractResult([{ value: cup, formalValid: true }]),
    );
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    return container;
  }

  it('click su "modifica" apre l\'input inline con pulsanti salva/annulla', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
    expect(container.querySelector('[data-save-edit]')).not.toBeNull();
    expect(container.querySelector('[data-cancel-edit]')).not.toBeNull();
  });

  it('click su "annulla" chiude l\'edit senza modificare il valore', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    btn(container, 'annulla')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
  });

  it('click su "salva" aggiorna il valore e segna il CUP come manuale', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    container.querySelector('input[data-editing]').value = CUP2;
    btn(container, 'salva')?.click();
    flushSync();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP2);
    expect(container.querySelector('.badge.warn')?.textContent).toBe('manuale');
  });

  it('Invio nel campo di edit salva il valore', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    const input = container.querySelector('input[data-editing]');
    input.value = CUP2;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP2);
  });

  it('Escape nel campo di edit annulla senza salvare', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    const input = container.querySelector('input[data-editing]');
    input.value = 'XXXXX';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
  });

  it('blur sul campo di edit commita il valore', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    const input = container.querySelector('input[data-editing]');
    input.value = CUP2;
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    flushSync();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP2);
  });

  it('commit normalizza il valore (uppercase, alfanumerico, max 15 char)', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    container.querySelector('input[data-editing]').value = 'g17h03000130001extra';
    btn(container, 'salva')?.click();
    flushSync();
    expect(container.querySelector('.cup-cell')?.textContent).toBe('G17H03000130001');
  });

  it('commit con valore vuoto su CUP non-manuale lascia il CUP invariato', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    container.querySelector('input[data-editing]').value = '   ';
    btn(container, 'salva')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
  });

  it('apertura nuova edit chiude quella precedente su altro CUP', async () => {
    vi.mocked(extractCupsFromPages).mockReturnValue(
      makeExtractResult([
        { value: CUP1, formalValid: true },
        { value: CUP2, formalValid: true },
      ]),
    );
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();

    const editBtns = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent.trim() === 'modifica',
    );
    editBtns[0].click();
    flushSync();
    expect(container.querySelectorAll('input[data-editing]').length).toBe(1);
    editBtns[1].click();
    flushSync();
    expect(container.querySelectorAll('input[data-editing]').length).toBe(1);
  });

  it('click su "rimuovi" rimuove il CUP dalla tabella', async () => {
    const container = await renderWithCup();
    const before = container.querySelectorAll('.cup-cell').length;
    btn(container, 'rimuovi')?.click();
    flushSync();
    expect(container.querySelectorAll('.cup-cell').length).toBeLessThan(before);
  });
});

// ── Aggiunta manuale CUP ──────────────────────────────────────────────────────

describe('PdfExtract: aggiunta manuale CUP', () => {
  it('click su "+ aggiungi CUP" su riga errore apre input manuale', async () => {
    vi.mocked(extractPdfText).mockRejectedValue(new Error('corrotto'));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitError();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });

  it('click su "+ aggiungi CUP" su riga senza-cup apre input manuale', async () => {
    vi.mocked(extractCupsFromPages).mockReturnValue(makeExtractResult([]));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });

  it('annullare un CUP manuale vuoto lo rimuove dalla lista', async () => {
    vi.mocked(extractCupsFromPages).mockReturnValue(makeExtractResult([]));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    btn(container, 'annulla')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).toBeNull();
  });

  it('salvare un CUP manuale con valore vuoto lo rimuove', async () => {
    vi.mocked(extractCupsFromPages).mockReturnValue(makeExtractResult([]));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    container.querySelector('input[data-editing]').value = '';
    btn(container, 'salva')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelectorAll('.cup-cell').length).toBe(0);
  });
});

// ── Azioni globali ────────────────────────────────────────────────────────────

describe('PdfExtract: azioni globali', () => {
  async function renderWithProcessedCup() {
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile('fattura.pdf')]);
    await waitDone();
    return container;
  }

  it('"Apri nel verificatore" salva il file e naviga con token transfer', async () => {
    const container = await renderWithProcessedCup();
    const sendBtn = container.querySelector('#pdf-send-btn');
    expect(sendBtn.disabled).toBe(false);
    sendBtn.click();
    expect(vi.mocked(storeTransfer)).toHaveBeenCalledWith(expect.any(File));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith('#/?transfer=test-transfer-id');
  });

  it('"Esporta CSV" crea un blob e avvia il download', async () => {
    const container = await renderWithProcessedCup();
    container.querySelector('#pdf-export-btn')?.click();
    // createObjectURL è chiamata una volta per l'entry (objectUrl) e una per il blob export
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledOnce());
  });

  it('"Pulisci" azzera la tabella e nasconde l\'area risultati', async () => {
    const container = await renderWithProcessedCup();
    expect(container.querySelector('#pdf-results-area')).not.toBeNull();
    container.querySelector('#pdf-clear-btn')?.click();
    flushSync();
    expect(container.querySelector('#pdf-results-area')).toBeNull();
  });

  it('"Pulisci" termina il worker OCR se presente', async () => {
    const container = await renderWithProcessedCup();
    container.querySelector('#pdf-clear-btn')?.click();
    flushSync();
    expect(vi.mocked(terminateOcrWorker)).toHaveBeenCalledOnce();
  });

  it('i pulsanti Apri/Esporta sono disabilitati se non ci sono CUP completati', async () => {
    vi.mocked(extractPdfText).mockReturnValue(new Promise(() => {}));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitFor(() => expect(container.querySelector('#pdf-results-area')).not.toBeNull());
    expect(container.querySelector('#pdf-send-btn')?.disabled).toBe(true);
    expect(container.querySelector('#pdf-export-btn')?.disabled).toBe(true);
  });

  it('i pulsanti Apri/Esporta sono disabilitati se elaborazione completata ma senza CUP', async () => {
    vi.mocked(extractCupsFromPages).mockReturnValue(makeExtractResult([]));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone(); // entry.status='done', cups=[] → hasDone=true, hasCups=false
    expect(container.querySelector('#pdf-send-btn')?.disabled).toBe(true);
    expect(container.querySelector('#pdf-export-btn')?.disabled).toBe(true);
  });
});

// ── CSV builders ──────────────────────────────────────────────────────────────

describe('PdfExtract: CSV builders', () => {
  async function renderAndProcess(fileName, cups = [{ value: CUP1, formalValid: true }]) {
    vi.mocked(extractCupsFromPages).mockReturnValue({
      fileName,
      status: cups.length ? 'ok' : 'no_cup',
      source: 'text',
      cups,
    });
    const { container } = render(PdfExtract);
    uploadFiles(container, [new File(['%PDF'], fileName, { type: 'application/pdf' })]);
    await waitDone();
    return container;
  }

  it('buildVerificatoreCsv produce header cup,file_origine e una riga per CUP', async () => {
    const container = await renderAndProcess('fattura.pdf');
    container.querySelector('#pdf-send-btn')?.click();
    expect(vi.mocked(storeTransfer)).toHaveBeenCalledOnce();
    const csv = await vi.mocked(storeTransfer).mock.calls[0][0].text();
    expect(csv).toContain('cup,file_origine');
    expect(csv).toContain(CUP1);
    expect(csv).toContain('fattura.pdf');
  });

  it('buildExportCsv produce header semicolon con colonne formato/fonte/manuale', async () => {
    let capturedBlob;
    URL.createObjectURL = vi.fn().mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });
    const container = await renderAndProcess('fattura.pdf');
    container.querySelector('#pdf-export-btn')?.click();
    expect(capturedBlob).toBeDefined();
    const csv = await capturedBlob.text();
    expect(csv).toContain('cup;file_origine;formato_valido;fonte;manuale');
    expect(csv).toContain(CUP1);
    expect(csv).toContain('SI');
    expect(csv).toContain('NO');
  });

  it("csvComma fa l'escaping di nomi file con virgola", async () => {
    const container = await renderAndProcess('fattura,2024.pdf');
    container.querySelector('#pdf-send-btn')?.click();
    const csv = await vi.mocked(storeTransfer).mock.calls[0][0].text();
    expect(csv).toContain('"fattura,2024.pdf"');
  });

  it("csvSemi fa l'escaping di nomi file con punto-e-virgola", async () => {
    let capturedBlob;
    URL.createObjectURL = vi.fn().mockImplementation((b) => {
      capturedBlob = b;
      return 'blob:mock';
    });
    const container = await renderAndProcess('fattura;2024.pdf');
    container.querySelector('#pdf-export-btn')?.click();
    const csv = await capturedBlob.text();
    expect(csv).toContain('"fattura;2024.pdf"');
  });

  it('csvComma prefissa con apostrofo i filename formula', async () => {
    const container = await renderAndProcess('=formula.pdf');
    container.querySelector('#pdf-send-btn')?.click();
    const csv = await vi.mocked(storeTransfer).mock.calls[0][0].text();
    expect(csv).toContain("'=formula.pdf");
  });

  it('csvSemi prefissa con apostrofo i filename formula', async () => {
    let capturedBlob;
    URL.createObjectURL = vi.fn().mockImplementation((b) => {
      capturedBlob = b;
      return 'blob:mock';
    });
    const container = await renderAndProcess('+bonus.pdf');
    container.querySelector('#pdf-export-btn')?.click();
    const csv = await capturedBlob.text();
    expect(csv).toContain("'+bonus.pdf");
  });
});

// ── Robustezza drainQueue ─────────────────────────────────────────────────────

describe('PdfExtract: robustezza drainQueue', () => {
  it('due file che falliscono in successione non bloccano la coda', async () => {
    vi.mocked(extractPdfText).mockRejectedValue(new Error('corrotto'));
    const { container } = render(PdfExtract);
    uploadFiles(container, [makeFile('primo.pdf'), makeFile('secondo.pdf')]);
    await waitFor(() => expect(vi.mocked(extractPdfText)).toHaveBeenCalledTimes(2));
    flushSync();
    expect(container.querySelectorAll('.badge.bad')).toHaveLength(2);

    // la coda non deve essere bloccata: un terzo file deve essere elaborato correttamente
    vi.mocked(extractPdfText).mockResolvedValue({
      pages: [CUP1],
      totalChars: 100,
      needsOcr: false,
    });
    uploadFiles(container, [makeFile('terzo.pdf')]);
    await waitFor(() => expect(vi.mocked(extractCupsFromPages)).toHaveBeenCalled());
    flushSync();
    expect(container.querySelector('.cup-cell')).not.toBeNull();
  });
});

// ── clearAll durante elaborazione ─────────────────────────────────────────────

describe('PdfExtract: clearAll durante elaborazione', () => {
  it('clearAll non lascia processing bloccato quando si aggiungono nuovi file', async () => {
    let resolvePdf;
    vi.mocked(extractPdfText).mockReturnValueOnce(
      new Promise((r) => {
        resolvePdf = r;
      }),
    );
    const { container } = render(PdfExtract);

    uploadFiles(container, [makeFile('lento.pdf')]);
    await waitFor(() => expect(container.querySelector('#pdf-results-area')).not.toBeNull());

    container.querySelector('#pdf-clear-btn')?.click();
    flushSync();
    expect(container.querySelector('#pdf-results-area')).toBeNull();

    vi.mocked(extractPdfText).mockResolvedValue({
      pages: [CUP1],
      totalChars: 100,
      needsOcr: false,
    });
    uploadFiles(container, [makeFile('nuovo.pdf')]);
    resolvePdf({ pages: [CUP1], totalChars: 100, needsOcr: false });

    await waitFor(() => expect(vi.mocked(extractCupsFromPages)).toHaveBeenCalled());
    flushSync();

    expect(container.querySelector('#pdf-results-area')).not.toBeNull();
    expect(container.querySelector('.cup-cell')).not.toBeNull();
  });
});

// ── cleanup rotta ─────────────────────────────────────────────────────────────

describe('PdfExtract: cleanup rotta', () => {
  it('termina il worker OCR quando la rotta viene smontata', () => {
    const view = render(PdfExtract);
    view.unmount();
    expect(vi.mocked(terminateOcrWorker)).toHaveBeenCalledOnce();
  });
});
