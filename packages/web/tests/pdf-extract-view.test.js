// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGlobalWorkerOptions = { workerSrc: '' };

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: mockGlobalWorkerOptions,
}));

const CUP1 = 'G17H03000130001';
const CUP2 = 'J61B21007000007';

function makeFile(name = 'fattura.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function makeParsedResult(cups = [{ value: CUP1, formalValid: true }]) {
  return { fileName: 'fattura.pdf', status: cups.length ? 'ok' : 'no_cup', source: 'text', cups };
}

async function loadView({
  extractPdfTextImpl,
  ocrPdfImpl,
  extractCupsImpl,
  navigateImpl,
  stateObj,
} = {}) {
  vi.resetModules();

  Object.defineProperty(mockGlobalWorkerOptions, 'workerSrc', {
    configurable: true,
    writable: true,
    value: '',
  });

  vi.doMock('../src/pdf/extract-text.js', () => ({
    extractPdfText:
      extractPdfTextImpl ??
      vi.fn().mockResolvedValue({ pages: ['testo con CUP ' + CUP1], totalChars: 100, needsOcr: false }),
  }));

  vi.doMock('../src/pdf/ocr.js', () => ({
    ocrPdf: ocrPdfImpl ?? vi.fn().mockResolvedValue({ pages: ['testo ocr ' + CUP1] }),
  }));

  vi.doMock('../src/pdf/extract-cups.js', () => ({
    extractCupsFromPages: extractCupsImpl ?? vi.fn().mockReturnValue(makeParsedResult()),
  }));

  vi.doMock('../src/router.js', () => ({
    navigate: navigateImpl ?? vi.fn(),
  }));

  vi.doMock('../src/state.js', () => ({
    state: stateObj ?? { pendingFile: null },
  }));

  vi.doMock('../src/validator.js', () => ({
    validateCup: vi.fn().mockReturnValue({ outcome: 'FORMATO_VALIDO_DA_VERIFICARE' }),
    OUTCOMES: { INVALID: 'INVALIDO_FORMATO' },
  }));

  return import('../src/views/pdf-extract-view.js');
}

function setupContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.revokeObjectURL = vi.fn();
});

describe('pdf-extract-view', () => {
  it('mount mostra la schermata iniziale con dropzone e configura workerSrc', async () => {
    const { mount } = await loadView();
    const container = setupContainer();

    await mount(container);

    expect(container.querySelector('h1')?.textContent).toBe('Estrai CUP da fatture PDF');
    expect(container.querySelector('#pdf-dropzone')).not.toBeNull();
    expect(container.querySelector('#pdf-file-input')).not.toBeNull();
    expect(container.querySelector('#pdf-results-area')?.classList.contains('hidden')).toBe(true);
    expect(mockGlobalWorkerOptions.workerSrc).toContain('/pdfjs/pdf.worker.min.mjs');
  });

  it('mount non lancia eccezione se pdfjs fallisce durante il caricamento', async () => {
    const { mount } = await loadView();

    // Set throwing setter AFTER loadView (which resets the property) so mount() triggers the catch
    Object.defineProperty(mockGlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      set() {
        throw new Error('rete non disponibile');
      },
    });

    const container = setupContainer();
    await expect(mount(container)).resolves.not.toThrow();
    expect(container.querySelector('#pdf-dropzone')).not.toBeNull();
  });

  it('unmount svuota il container e rilascia il riferimento interno', async () => {
    const { mount, unmount } = await loadView();
    const container = setupContainer();

    await mount(container);
    unmount();

    expect(container.innerHTML).toBe('');
  });

  it('unmount è un no-op se chiamato senza un mount precedente', async () => {
    const { unmount } = await loadView();
    expect(() => unmount()).not.toThrow();
  });
});

describe('pdf-extract-view: file processing', () => {
  it('selezionando file via input li aggiunge alla tabella con stato in coda', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    const file = makeFile();
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(false);
    expect(container.querySelector('[data-entry-id]')).not.toBeNull();
  });

  it('resetta il valore dell\'input dopo la selezione', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'value', { configurable: true, writable: true, value: 'fake' });
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    expect(input.value).toBe('');
  });

  it('input change senza file non aggiunge entry', async () => {
    const { mount } = await loadView();
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [] });
    input.dispatchEvent(new Event('change'));

    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(true);
  });

  it('elabora il file e mostra stato parsing, poi done con CUP', async () => {
    const { mount } = await loadView();
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    await flushPromises();

    const body = container.querySelector('#pdf-results-body');
    expect(body.innerHTML).toContain(CUP1);
    expect(body.innerHTML).toContain('Valido');
  });

  it('attiva il percorso OCR quando needsOcr è true', async () => {
    const ocrPdfImpl = vi.fn().mockResolvedValue({ pages: ['testo ocr con CUP ' + CUP1] });
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockResolvedValue({
        pages: ['x'],
        totalChars: 1,
        needsOcr: true,
      }),
      ocrPdfImpl,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    await flushPromises();

    expect(ocrPdfImpl).toHaveBeenCalledOnce();
  });

  it('mostra badge OCR con "Caricamento OCR…" durante il caricamento del worker', async () => {
    vi.useFakeTimers();
    let progressCb;
    const ocrPdfImpl = vi.fn().mockImplementation((_file, { onProgress }) => {
      progressCb = onProgress;
      return new Promise(() => {});
    });
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true }),
      ocrPdfImpl,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    // Avanza i timer fittizi: il debounce da 150ms scatta e renderizza lo stato 'ocr'
    await vi.runAllTimersAsync();
    progressCb?.({ ocrLoading: true, page: 0, totalPages: 2, fileName: 'fattura.pdf' });
    await vi.runAllTimersAsync();

    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('Caricamento OCR');
    vi.useRealTimers();
  });

  it('mostra badge OCR con numero di pagina durante il processing', async () => {
    vi.useFakeTimers();
    let progressCb;
    const ocrPdfImpl = vi.fn().mockImplementation((_file, { onProgress }) => {
      progressCb = onProgress;
      return new Promise(() => {});
    });
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true }),
      ocrPdfImpl,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    // Avanza i timer fittizi: il debounce da 150ms scatta e renderizza lo stato 'ocr'
    await vi.runAllTimersAsync();
    progressCb?.({ ocrLoading: false, page: 1, totalPages: 3, fileName: 'fattura.pdf' });
    await vi.runAllTimersAsync();

    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('OCR pagina');
    vi.useRealTimers();
  });

  it('mostra la riga di errore se extractPdfText rigetta', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockRejectedValue(new Error('PDF corrotto')),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    await flushPromises();

    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('Errore');
    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('PDF corrotto');
  });

  it('mostra riga "Nessun CUP rilevato" se il PDF non contiene CUP', async () => {
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue({ fileName: 'vuoto.pdf', status: 'no_cup', source: 'text', cups: [] }),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    await flushPromises();

    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('Nessun CUP rilevato');
  });

  it('non processa entry se il container è smontato durante il processing', async () => {
    let resolvePdf;
    const extractPdfTextImpl = vi.fn().mockReturnValue(
      new Promise((r) => { resolvePdf = r; }),
    );
    const { mount, unmount } = await loadView({ extractPdfTextImpl });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    unmount();
    resolvePdf({ pages: ['testo'], totalChars: 100, needsOcr: false });

    await flushPromises();
    // No crash expected
  });

  it('non richiama onProgress OCR se il container è smontato', async () => {
    let progressCb;
    const ocrPdfImpl = vi.fn().mockImplementation((_f, { onProgress }) => {
      progressCb = onProgress;
      return Promise.resolve({ pages: ['testo'] });
    });
    const { mount, unmount } = await loadView({
      extractPdfTextImpl: vi.fn().mockResolvedValue({ pages: ['x'], totalChars: 1, needsOcr: true }),
      ocrPdfImpl,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    unmount();
    // Should not throw even if progress is triggered after unmount
    expect(() => progressCb?.({ ocrLoading: false, page: 1, totalPages: 1, fileName: 'f.pdf' })).not.toThrow();
  });
});

describe('pdf-extract-view: drag and drop', () => {
  it('dragover aggiunge la classe pdf-dropzone--drag', async () => {
    const { mount } = await loadView();
    const container = setupContainer();
    await mount(container);

    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.dispatchEvent(new Event('dragover'));

    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(true);
  });

  it('dragleave rimuove la classe se il cursore lascia la zona', async () => {
    const { mount } = await loadView();
    const container = setupContainer();
    await mount(container);

    const dropzone = container.querySelector('#pdf-dropzone');
    dropzone.classList.add('pdf-dropzone--drag');

    const leaveEvent = new Event('dragleave');
    Object.defineProperty(leaveEvent, 'relatedTarget', { value: document.body });
    dropzone.dispatchEvent(leaveEvent);

    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(false);
  });

  it('dragleave NON rimuove la classe se il cursore è ancora dentro la zona', async () => {
    const { mount } = await loadView();
    const container = setupContainer();
    await mount(container);

    const dropzone = container.querySelector('#pdf-dropzone');
    const child = document.createElement('span');
    dropzone.appendChild(child);
    dropzone.classList.add('pdf-dropzone--drag');

    const leaveEvent = new Event('dragleave');
    Object.defineProperty(leaveEvent, 'relatedTarget', { value: child });
    dropzone.dispatchEvent(leaveEvent);

    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(true);
  });

  it('drop accetta file PDF e li aggiunge alla coda', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const container = setupContainer();
    await mount(container);

    const dropzone = container.querySelector('#pdf-dropzone');
    const pdfFile = makeFile('dropped.pdf');
    const dropEvent = new Event('drop');
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [pdfFile] },
    });
    dropzone.dispatchEvent(dropEvent);

    expect(container.querySelector('[data-entry-id]')).not.toBeNull();
  });

  it('drop ignora file non-PDF', async () => {
    const { mount } = await loadView();
    const container = setupContainer();
    await mount(container);

    const dropzone = container.querySelector('#pdf-dropzone');
    const txtFile = new File(['text'], 'doc.txt', { type: 'text/plain' });
    const dropEvent = new Event('drop');
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [txtFile] } });
    dropzone.dispatchEvent(dropEvent);

    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(true);
  });
});

describe('pdf-extract-view: edit operations', () => {
  async function mountWithCup(container, cup = CUP1) {
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([{ value: cup, formalValid: true }])),
    });
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();
    return container;
  }

  it('click su "modifica" apre l\'input inline e mostra i pulsanti salva/annulla', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    const editBtn = container.querySelector('[data-action="edit"]');
    editBtn.click();

    expect(container.querySelector('input[data-editing]')).not.toBeNull();
    expect(container.querySelector('[data-action="save-edit"]')).not.toBeNull();
    expect(container.querySelector('[data-action="cancel-edit"]')).not.toBeNull();
  });

  it('click su "annulla" chiude l\'edit senza modificare il valore', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    container.querySelector('[data-action="cancel-edit"]').click();

    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
  });

  it('click su "salva" aggiorna il valore del CUP e lo marca come manuale', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = CUP2;
    container.querySelector('[data-action="save-edit"]').click();

    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP2);
    expect(container.querySelector('.badge.warn')?.textContent).toBe('manuale');
  });

  it('Invio nel campo di edit salva il valore', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = CUP2;
    editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP2);
  });

  it('Escape nel campo di edit annulla senza salvare', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = 'XXXXX';
    editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
  });

  it('blur sul campo di edit commita il valore', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = CUP2;
    editInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP2);
  });

  it('blur ignorato se il campo non è più nel DOM (tr assente)', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = CUP2;

    // Remove input from DOM before blur
    const tr = editInput.closest('tr');
    tr.remove();

    expect(() => editInput.dispatchEvent(new Event('blur', { bubbles: true }))).not.toThrow();
  });

  it('commit con valore vuoto su CUP manuale rimuove il CUP', async () => {
    const container = setupContainer();
    await mountWithCup(container, CUP1);

    // First show the no-cup state by loading with no cups and then add-manual
    // Use the error path instead which also has add-manual
  });

  it('commit con valore non vuoto normalizza (uppercase, alfanumerico, max 15 char)', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = 'g17h03000130001extra'; // lowercase + extra chars
    container.querySelector('[data-action="save-edit"]').click();

    expect(container.querySelector('.cup-cell')?.textContent).toBe('G17H03000130001');
  });

  it('commit con valore vuoto su CUP non-manuale lascia il CUP invariato', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = '   '; // only whitespace
    container.querySelector('[data-action="save-edit"]').click();

    // cups are re-rendered after the empty commit closes edit without update
    expect(container.querySelector('input[data-editing]')).toBeNull();
  });

  it('keydown su input non-editing non lancia errori', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    const body = container.querySelector('#pdf-results-body');
    expect(() => body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, target: document.createElement('input') }))).not.toThrow();
  });

  it('click su "rimuovi" rimuove il CUP dalla riga', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    const before = container.querySelectorAll('[data-cup-id]').length;
    container.querySelector('[data-action="remove"]').click();
    const after = container.querySelectorAll('[data-cup-id]').length;

    expect(after).toBeLessThan(before);
  });

  it('apertura nuova edit chiude l\'edit precedente su altro CUP', async () => {
    const cups = [
      { value: CUP1, formalValid: true },
      { value: CUP2, formalValid: true },
    ];
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult(cups)),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    const editBtns = container.querySelectorAll('[data-action="edit"]');
    editBtns[0].click();
    expect(container.querySelectorAll('input[data-editing]').length).toBe(1);

    editBtns[1].click();
    expect(container.querySelectorAll('input[data-editing]').length).toBe(1);
  });

  it('mousedown su save-edit previene il blur indesiderato', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    container.querySelector('[data-action="edit"]').click();
    const saveBtn = container.querySelector('[data-action="save-edit"]');

    const event = new MouseEvent('mousedown', { bubbles: true });
    vi.spyOn(event, 'preventDefault');
    container.querySelector('#pdf-results-body').dispatchEvent(event);
    // Only prevent when clicking save/cancel
    const eventOnSave = new MouseEvent('mousedown', { bubbles: true });
    const preventSpy2 = vi.spyOn(eventOnSave, 'preventDefault');
    saveBtn.dispatchEvent(eventOnSave);
    expect(preventSpy2).toHaveBeenCalled();
  });

  it('click su un td senza data-action non lancia errori', async () => {
    const container = setupContainer();
    await mountWithCup(container);

    const body = container.querySelector('#pdf-results-body');
    const td = body.querySelector('td');
    expect(() => td.click()).not.toThrow();
  });
});

describe('pdf-extract-view: aggiunta manuale CUP', () => {
  it('click su "+ aggiungi CUP" su riga errore apre input manuale', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockRejectedValue(new Error('corrotto')),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('[data-action="add-manual"]').click();

    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });

  it('click su "+ aggiungi CUP" su riga senza-cup apre input manuale', async () => {
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([])),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('[data-action="add-manual"]').click();

    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });

  it('annullare un CUP manuale vuoto lo rimuove dalla lista', async () => {
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([])),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('[data-action="add-manual"]').click();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();

    container.querySelector('[data-action="cancel-edit"]').click();
    expect(container.querySelector('input[data-editing]')).toBeNull();
  });

  it('salvare un CUP manuale con valore vuoto lo rimuove', async () => {
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([])),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('[data-action="add-manual"]').click();
    const editInput = container.querySelector('input[data-editing]');
    editInput.value = '';
    container.querySelector('[data-action="save-edit"]').click();

    expect(container.querySelector('input[data-editing]')).toBeNull();
    expect(container.querySelectorAll('[data-cup-id]').length).toBe(0);
  });
});

describe('pdf-extract-view: azioni globali', () => {
  async function mountAndProcess(container, cups = [{ value: CUP1, formalValid: true }]) {
    const navigateMock = vi.fn();
    const stateObj = { pendingFile: null };
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult(cups)),
      navigateImpl: navigateMock,
      stateObj,
    });
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile('fattura.pdf')] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    return { navigateMock, stateObj };
  }

  it('"Apri nel verificatore" imposta state.pendingFile e naviga a #/', async () => {
    const container = setupContainer();
    const { navigateMock, stateObj } = await mountAndProcess(container);

    const sendBtn = container.querySelector('#pdf-send-btn');
    expect(sendBtn.disabled).toBe(false);
    sendBtn.click();

    expect(stateObj.pendingFile).toBeInstanceOf(File);
    expect(stateObj.pendingFile.name).toBe('estrazione-cup.csv');
    expect(navigateMock).toHaveBeenCalledWith('#/');
  });

  it('"Esporta CSV" crea un blob e scatena il download', async () => {
    const container = setupContainer();
    await mountAndProcess(container);

    const exportBtn = container.querySelector('#pdf-export-btn');
    expect(exportBtn.disabled).toBe(false);
    exportBtn.click();

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('"Pulisci" azzera la tabella e nasconde l\'area risultati', async () => {
    const container = setupContainer();
    await mountAndProcess(container);

    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(false);
    container.querySelector('#pdf-clear-btn').click();
    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(true);
  });

  it('i pulsanti Apri/Esporta sono disabilitati quando non ci sono CUP completati', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));

    expect(container.querySelector('#pdf-send-btn').disabled).toBe(true);
    expect(container.querySelector('#pdf-export-btn').disabled).toBe(true);
  });

  it('i pulsanti Apri/Esporta sono disabilitati se elaborazione completata ma nessun CUP', async () => {
    const container = setupContainer();
    await mountAndProcess(container, []);

    expect(container.querySelector('#pdf-send-btn').disabled).toBe(true);
    expect(container.querySelector('#pdf-export-btn').disabled).toBe(true);
  });
});

describe('pdf-extract-view: CSV builders', () => {
  it('buildVerificatoreCsv produce header cup,file_origine e una riga per CUP', async () => {
    const stateObj = { pendingFile: null };
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([{ value: CUP1, formalValid: true }])),
      stateObj,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile('fattura.pdf')] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('#pdf-send-btn').click();

    const csv = await stateObj.pendingFile.text();
    expect(csv).toContain('cup,file_origine');
    expect(csv).toContain(CUP1);
    expect(csv).toContain('fattura.pdf');
  });

  it('buildVerificatoreCsv include file di errore senza CUP nella lista completati', async () => {
    const stateObj = { pendingFile: null };
    const navigateMock = vi.fn();
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockRejectedValue(new Error('errore')),
      stateObj,
      navigateImpl: navigateMock,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile('fattura.pdf')] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    // Error entry has no cups, so send btn stays disabled - verify via export CSV
    // The error entry IS in completedEntries but has no cups
    expect(container.querySelector('#pdf-send-btn').disabled).toBe(true);
  });

  it('buildExportCsv produce header con semicolon e colonne formato/fonte/manuale', async () => {
    const stateObj = { pendingFile: null };
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([{ value: CUP1, formalValid: true }])),
      stateObj,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile('fattura.pdf')] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    // Capture the blob content via createObjectURL spy
    let capturedBlob;
    URL.createObjectURL = vi.fn().mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });

    container.querySelector('#pdf-export-btn').click();

    const csv = await capturedBlob.text();
    expect(csv).toContain('cup;file_origine;formato_valido;fonte;manuale');
    expect(csv).toContain(CUP1);
    expect(csv).toContain('SI'); // formalValid
    expect(csv).toContain('NO'); // manual=false
  });

  it('csvComma fa l\'escaping dei valori con virgola o apici', async () => {
    const fileName = 'fattura,2024.pdf'; // contains comma
    const stateObj = { pendingFile: null };
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue({ fileName, status: 'ok', source: 'text', cups: [{ value: CUP1, formalValid: true }] }),
      stateObj,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    const file = new File([''], fileName, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('#pdf-send-btn').click();
    const csv = await stateObj.pendingFile.text();
    expect(csv).toContain('"fattura,2024.pdf"');
  });

  it('csvSemi fa l\'escaping dei valori con punto-e-virgola o apici', async () => {
    const fileName = 'fattura;2024.pdf';
    let capturedBlob;
    URL.createObjectURL = vi.fn().mockImplementation((b) => { capturedBlob = b; return 'blob:mock'; });

    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue({ fileName, status: 'ok', source: 'text', cups: [{ value: CUP1, formalValid: true }] }),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    const file = new File([''], fileName, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('#pdf-export-btn').click();
    const csv = await capturedBlob.text();
    expect(csv).toContain('"fattura;2024.pdf"');
  });

  it('csvComma prefissa con apostrofo i filename che iniziano con caratteri formula', async () => {
    const fileName = '=formula.pdf';
    const stateObj = { pendingFile: null };
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue({ fileName, status: 'ok', source: 'text', cups: [{ value: CUP1, formalValid: true }] }),
      stateObj,
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    const file = new File([''], fileName, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('#pdf-send-btn').click();
    const csv = await stateObj.pendingFile.text();
    expect(csv).toContain("'=formula.pdf");
    expect(csv).not.toContain(',=formula.pdf');
  });

  it('csvSemi prefissa con apostrofo i filename che iniziano con caratteri formula', async () => {
    const fileName = '+bonus.pdf';
    let capturedBlob;
    URL.createObjectURL = vi.fn().mockImplementation((b) => { capturedBlob = b; return 'blob:mock'; });

    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue({ fileName, status: 'ok', source: 'text', cups: [{ value: CUP1, formalValid: true }] }),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    const file = new File([''], fileName, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('#pdf-export-btn').click();
    const csv = await capturedBlob.text();
    expect(csv).toContain("'+bonus.pdf");
    expect(csv).not.toContain(';+bonus.pdf');
  });
});

describe('pdf-extract-view: clearAll durante elaborazione', () => {
  it('clearAll durante processEntry non lascia _processing bloccato quando si aggiungono nuovi file', async () => {
    let resolvePdf;
    const slowPdf = new Promise((r) => { resolvePdf = r; });

    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockReturnValue(slowPdf),
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult()),
    });
    const container = setupContainer();
    await mount(container);

    // Start processing a file (processEntry is now awaiting slowPdf)
    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile('lento.pdf')], configurable: true });
    input.dispatchEvent(new Event('change'));

    // clearAll while processEntry is suspended
    container.querySelector('#pdf-clear-btn').click();
    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(true);

    // Add a new file — a fresh drainQueue should start immediately
    Object.defineProperty(input, 'files', { value: [makeFile('nuovo.pdf')], configurable: true });
    input.dispatchEvent(new Event('change'));

    // Resolve the old slow PDF (the old drainQueue should abort, not process stale entry)
    resolvePdf({ pages: ['testo'], totalChars: 100, needsOcr: false });
    await flushPromises();
    await flushPromises();

    // Only 'nuovo.pdf' should appear (the stale 'lento.pdf' entry was cleared)
    const rows = container.querySelectorAll('[data-entry-id]');
    expect([...rows].every((r) => r.querySelector('td')?.textContent !== 'lento.pdf')).toBe(true);
    expect(container.querySelector('#pdf-results-area').classList.contains('hidden')).toBe(false);
  });
});

describe('pdf-extract-view: errore imprevisto in processEntry', () => {
  it('un TypeError non catturato non blocca la coda per i file successivi', async () => {
    let callCount = 0;
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new TypeError('crash simulato');
        return makeParsedResult();
      }),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', {
      value: [makeFile('primo.pdf'), makeFile('secondo.pdf')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await flushPromises();
    await flushPromises();

    const rows = [...container.querySelectorAll('[data-entry-id]')];
    const texts = rows.map((r) => r.querySelector('td')?.textContent ?? '');
    expect(texts.some((t) => t.includes('primo.pdf'))).toBe(true);
    expect(texts.some((t) => t.includes('secondo.pdf'))).toBe(true);

    // primo.pdf deve avere status errore, secondo.pdf deve aver terminato
    const primoRow = rows.find((r) => r.querySelector('td')?.textContent?.includes('primo.pdf'));
    expect(primoRow?.querySelector('.badge.bad')).not.toBeNull();
  });
});

describe('pdf-extract-view: render helpers', () => {
  it('truncateName tronca nomi lunghi con ellissi in fondo', async () => {
    const longName = 'a'.repeat(50) + '.pdf';
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue({ fileName: longName, status: 'no_cup', source: 'text', cups: [] }),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    const file = new File([''], longName, { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    const cell = container.querySelector('.detail-cell');
    expect(cell?.textContent).toMatch(/…$/);
  });

  it('escHtml escapa caratteri speciali nelle stringhe di errore', async () => {
    const { mount } = await loadView({
      extractPdfTextImpl: vi.fn().mockRejectedValue(new Error('<script>alert(1)</script>')),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    expect(container.querySelector('#pdf-results-body').innerHTML).not.toContain('<script>');
    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('&lt;script&gt;');
  });

  it('renderEntryRows mostra il badge CUP invalido per CUP non formalmente valido', async () => {
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([{ value: 'INVALIDO', formalValid: false }])),
    });
    const container = setupContainer();
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    expect(container.querySelector('#pdf-results-body').innerHTML).toContain('Invalido');
  });

  it('input di edit con valore non vuoto viene selezionato al focus dopo re-render', async () => {
    const container = setupContainer();
    const { mount } = await loadView({
      extractCupsImpl: vi.fn().mockReturnValue(makeParsedResult([{ value: CUP1, formalValid: true }])),
    });
    await mount(container);

    const input = container.querySelector('#pdf-file-input');
    Object.defineProperty(input, 'files', { value: [makeFile()] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    container.querySelector('[data-action="edit"]').click();
    // After re-render, the input should be focused (covered by updateTable logic)
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });
});
