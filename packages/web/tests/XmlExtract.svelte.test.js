// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';

vi.mock('../src/lib/xml/extract-cups.js', () => ({ extractCupsFromXmlFile: vi.fn() }));
vi.mock('../src/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../src/lib/data/transfer.js', () => ({ storeTransfer: vi.fn() }));
vi.mock('../src/lib/core/validator.js', () => ({
  validateCup: vi.fn().mockReturnValue({ outcome: 'FORMATO_VALIDO_DA_VERIFICARE' }),
  OUTCOMES: { INVALID: 'INVALIDO_FORMATO' },
}));

import { extractCupsFromXmlFile } from '../src/lib/xml/extract-cups.js';
import { navigate } from '../src/router.js';
import { storeTransfer } from '../src/lib/data/transfer.js';
import XmlExtract from '../src/routes/XmlExtract.svelte';

const CUP1 = 'G17H03000130001';
const CUP2 = 'J61B21007000007';

function makeFile(name = 'fattura.xml') {
  return new File(['<?xml version="1.0"?><F/>'], name, { type: 'text/xml' });
}

function makeExtractResult(cups = [{ value: CUP1, formalValid: true }]) {
  return { fileName: 'fattura.xml', status: cups.length ? 'ok' : 'no_cup', cups };
}

function uploadFiles(container, files) {
  const input = container.querySelector('#xml-file-input');
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function makeDragEvent(type, extra = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if ('relatedTarget' in extra)
    Object.defineProperty(event, 'relatedTarget', { value: extra.relatedTarget });
  if ('dataTransfer' in extra)
    Object.defineProperty(event, 'dataTransfer', { value: extra.dataTransfer });
  return event;
}

function btn(container, text) {
  return Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent.trim() === text,
  );
}

async function waitDone() {
  await waitFor(() => expect(vi.mocked(extractCupsFromXmlFile)).toHaveBeenCalled());
  flushSync();
}

beforeEach(() => {
  vi.mocked(extractCupsFromXmlFile).mockReturnValue(makeExtractResult());
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

// ── Render iniziale ────────────────────────────────────────────────────────────

describe('XmlExtract: render iniziale', () => {
  it('mostra h1, dropzone e input file; nessuna area risultati', () => {
    const { container } = render(XmlExtract);
    expect(container.querySelector('h1')?.textContent).toBe('Estrai CUP da fatture XML');
    expect(container.querySelector('#xml-dropzone')).not.toBeNull();
    expect(container.querySelector('#xml-file-input')).not.toBeNull();
    expect(container.querySelector('#xml-results-area')).toBeNull();
  });
});

// ── Elaborazione file ──────────────────────────────────────────────────────────

describe('XmlExtract: elaborazione file', () => {
  it("selezionando file via input mostra l'area risultati", async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(new Promise(() => {}));
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitFor(() => expect(container.querySelector('#xml-results-area')).not.toBeNull());
  });

  it('input change senza file non aggiunge entry', () => {
    const { container } = render(XmlExtract);
    uploadFiles(container, []);
    flushSync();
    expect(container.querySelector('#xml-results-area')).toBeNull();
  });

  it("resetta il valore dell'input dopo la selezione", () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(new Promise(() => {}));
    const { container } = render(XmlExtract);
    const input = container.querySelector('#xml-file-input');
    Object.defineProperty(input, 'value', { configurable: true, writable: true, value: 'fake' });
    Object.defineProperty(input, 'files', { value: [makeFile()], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(input.value).toBe('');
  });

  it('elabora il file e mostra il CUP estratto', async () => {
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.querySelector('.cup-cell')?.textContent).toBe(CUP1);
    expect(container.innerHTML).toContain('Valido');
  });

  it('mostra "Nessun CUP rilevato" se il file non contiene CUP', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(makeExtractResult([]));
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.innerHTML).toContain('Nessun CUP rilevato');
  });

  it('mostra badge errore se extractCupsFromXmlFile lancia', async () => {
    vi.mocked(extractCupsFromXmlFile).mockImplementation(() => {
      throw new Error('XML non valido');
    });
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.querySelector('.badge.bad')).not.toBeNull();
    expect(container.innerHTML).toContain('XML non valido');
  });

  it('usa il messaggio fallback per errori non Error', async () => {
    vi.mocked(extractCupsFromXmlFile).mockImplementation(() => {
      throw {};
    });
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.textContent).toContain('Errore sconosciuto');
  });

  it('più file vengono tutti elaborati e mostrano i rispettivi CUP', async () => {
    vi.mocked(extractCupsFromXmlFile)
      .mockReturnValueOnce(makeExtractResult([{ value: CUP1, formalValid: true }]))
      .mockReturnValue(makeExtractResult([{ value: CUP2, formalValid: true }]));

    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile('primo.xml'), makeFile('secondo.xml')]);
    await waitFor(() => expect(vi.mocked(extractCupsFromXmlFile)).toHaveBeenCalledTimes(2));
    flushSync();
    expect(container.querySelectorAll('.cup-cell')).toHaveLength(2);
  });

  it('un errore su un file non blocca il processing dei successivi', async () => {
    let callCount = 0;
    vi.mocked(extractCupsFromXmlFile).mockImplementation(() => {
      if (++callCount === 1) throw new TypeError('crash');
      return makeExtractResult();
    });
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile('primo.xml'), makeFile('secondo.xml')]);
    await waitFor(() => expect(vi.mocked(extractCupsFromXmlFile)).toHaveBeenCalledTimes(2));
    flushSync();
    expect(container.querySelector('.badge.bad')).not.toBeNull();
    expect(container.querySelector('.cup-cell')).not.toBeNull();
  });

  it('drop senza dataTransfer non aggiunge entry', () => {
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    dropzone.dispatchEvent(makeDragEvent('drop'));
    flushSync();
    expect(container.querySelector('#xml-results-area')).toBeNull();
  });
});

// ── Drag and drop ──────────────────────────────────────────────────────────────

describe('XmlExtract: drag and drop', () => {
  it('dragover aggiunge la classe pdf-dropzone--drag', () => {
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    dropzone.dispatchEvent(makeDragEvent('dragover'));
    flushSync();
    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(true);
  });

  it('dragleave rimuove la classe se il cursore esce dalla zona', () => {
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    dropzone.dispatchEvent(makeDragEvent('dragover'));
    flushSync();
    dropzone.dispatchEvent(makeDragEvent('dragleave', { relatedTarget: document.body }));
    flushSync();
    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(false);
  });

  it('dragleave NON rimuove la classe se il cursore è ancora dentro la zona', () => {
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    dropzone.dispatchEvent(makeDragEvent('dragover'));
    flushSync();
    const child = document.createElement('span');
    dropzone.appendChild(child);
    dropzone.dispatchEvent(makeDragEvent('dragleave', { relatedTarget: child }));
    flushSync();
    expect(dropzone.classList.contains('pdf-dropzone--drag')).toBe(true);
  });

  it('drop aggiunge i file XML alla coda', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(new Promise(() => {}));
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    dropzone.dispatchEvent(
      makeDragEvent('drop', { dataTransfer: { files: [makeFile('dropped.xml')] } }),
    );
    await waitFor(() => expect(container.querySelector('#xml-results-area')).not.toBeNull());
  });

  it('drop accetta file .xml senza MIME type esplicito', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(new Promise(() => {}));
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    const noMimeFile = new File(['<F/>'], 'fattura.xml', { type: '' });
    dropzone.dispatchEvent(makeDragEvent('drop', { dataTransfer: { files: [noMimeFile] } }));
    await waitFor(() => expect(container.querySelector('#xml-results-area')).not.toBeNull());
  });

  it('drop ignora file non-XML', () => {
    const { container } = render(XmlExtract);
    const dropzone = container.querySelector('#xml-dropzone');
    dropzone.dispatchEvent(
      makeDragEvent('drop', {
        dataTransfer: { files: [new File(['text'], 'doc.txt', { type: 'text/plain' })] },
      }),
    );
    flushSync();
    expect(container.querySelector('#xml-results-area')).toBeNull();
  });
});

// ── Edit e rimozione CUP ───────────────────────────────────────────────────────

describe('XmlExtract: edit e rimozione CUP', () => {
  async function renderWithCup(cup = CUP1) {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(
      makeExtractResult([{ value: cup, formalValid: true }]),
    );
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    return container;
  }

  it('click su "modifica" apre l\'input inline', async () => {
    const container = await renderWithCup();
    btn(container, 'modifica')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
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

  it('click su "rimuovi" rimuove il CUP dalla tabella', async () => {
    const container = await renderWithCup();
    const before = container.querySelectorAll('.cup-cell').length;
    btn(container, 'rimuovi')?.click();
    flushSync();
    expect(container.querySelectorAll('.cup-cell').length).toBeLessThan(before);
  });
});

// ── Aggiunta manuale CUP ───────────────────────────────────────────────────────

describe('XmlExtract: aggiunta manuale CUP', () => {
  it('click su "+ aggiungi CUP" su riga errore apre input manuale', async () => {
    vi.mocked(extractCupsFromXmlFile).mockImplementation(() => {
      throw new Error('corrotto');
    });
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });

  it('click su "+ aggiungi CUP" su riga senza-cup apre input manuale', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(makeExtractResult([]));
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).not.toBeNull();
  });

  it('annullare un CUP manuale vuoto lo rimuove', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(makeExtractResult([]));
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    btn(container, '+ aggiungi CUP')?.click();
    flushSync();
    btn(container, 'annulla')?.click();
    flushSync();
    expect(container.querySelector('input[data-editing]')).toBeNull();
  });

  it('salvare un CUP manuale con valore vuoto lo rimuove', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(makeExtractResult([]));
    const { container } = render(XmlExtract);
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

// ── Azioni globali ─────────────────────────────────────────────────────────────

describe('XmlExtract: azioni globali', () => {
  async function renderWithProcessedCup() {
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile('fattura.xml')]);
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
    expect(container.querySelector('#xml-results-area')).not.toBeNull();
    container.querySelector('#pdf-clear-btn')?.click();
    flushSync();
    expect(container.querySelector('#xml-results-area')).toBeNull();
  });

  it('i pulsanti Apri/Esporta sono disabilitati se non ci sono CUP completati', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(new Promise(() => {}));
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitFor(() => expect(container.querySelector('#xml-results-area')).not.toBeNull());
    expect(container.querySelector('#pdf-send-btn')?.disabled).toBe(true);
    expect(container.querySelector('#pdf-export-btn')?.disabled).toBe(true);
  });

  it('Apri è disabilitato se completato senza CUP, Esporta è abilitato', async () => {
    vi.mocked(extractCupsFromXmlFile).mockReturnValue(makeExtractResult([]));
    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile()]);
    await waitDone();
    expect(container.querySelector('#pdf-send-btn')?.disabled).toBe(true);
    expect(container.querySelector('#pdf-export-btn')?.disabled).toBe(false);
  });

  it('"Pulisci" non lascia processing bloccato per i file successivi', async () => {
    let resolve;
    vi.mocked(extractCupsFromXmlFile)
      .mockReturnValueOnce(
        new Promise((r) => {
          resolve = r;
        }),
      )
      .mockReturnValue(makeExtractResult());

    const { container } = render(XmlExtract);
    uploadFiles(container, [makeFile('lento.xml')]);
    await waitFor(() => expect(container.querySelector('#xml-results-area')).not.toBeNull());

    container.querySelector('#pdf-clear-btn')?.click();
    flushSync();
    expect(container.querySelector('#xml-results-area')).toBeNull();

    uploadFiles(container, [makeFile('nuovo.xml')]);
    resolve(makeExtractResult());
    await waitFor(() => expect(vi.mocked(extractCupsFromXmlFile)).toHaveBeenCalledTimes(2));
    flushSync();
    expect(container.querySelector('#xml-results-area')).not.toBeNull();
    expect(container.querySelector('.cup-cell')).not.toBeNull();
  });
});
