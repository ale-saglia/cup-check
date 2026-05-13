// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

const fakeFile = { name: 'fattura.pdf', arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) };

function makeDoc(pageCount) {
  return {
    numPages: pageCount,
    getPage: vi.fn().mockImplementation(async () => ({
      getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    })),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

function makeWorker(textPerPage = 'testo ocr') {
  return {
    recognize: vi.fn().mockResolvedValue({ data: { text: textPerPage } }),
  };
}

async function loadOcr() {
  vi.resetModules();
  return import('../src/pdf/ocr.js');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ocrPdf', () => {
  it('crea il worker al primo utilizzo e restituisce il testo delle pagine', async () => {
    const doc = makeDoc(2);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    const worker = makeWorker('testo estratto');
    createWorker.mockResolvedValue(worker);

    const { ocrPdf } = await loadOcr();
    const result = await ocrPdf(fakeFile);

    expect(createWorker).toHaveBeenCalledOnce();
    expect(createWorker).toHaveBeenCalledWith(
      'ita',
      1,
      expect.objectContaining({ workerPath: expect.stringContaining('/tesseract/') }),
    );
    expect(worker.recognize).toHaveBeenCalledTimes(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toBe('testo estratto');
    expect(doc.destroy).toHaveBeenCalledOnce();
  });

  it('riutilizza il worker esistente nelle chiamate successive (singleton)', async () => {
    const doc = makeDoc(1);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    const worker = makeWorker();
    createWorker.mockResolvedValue(worker);

    const { ocrPdf } = await loadOcr();
    await ocrPdf(fakeFile);
    await ocrPdf(fakeFile);

    expect(createWorker).toHaveBeenCalledOnce();
    expect(worker.recognize).toHaveBeenCalledTimes(2);
  });

  it('chiama onProgress con ocrLoading=true prima del caricamento worker, poi false', async () => {
    const doc = makeDoc(1);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    const calls = [];
    await ocrPdf(fakeFile, { onProgress: (p) => calls.push({ ...p }) });

    expect(calls[0]).toMatchObject({ ocrLoading: true, page: 0 });
    expect(calls[1]).toMatchObject({ ocrLoading: false, page: 0 });
    expect(calls[2]).toMatchObject({ ocrLoading: false, page: 1 });
  });

  it('non chiama onProgress con ocrLoading=true se il worker è già caricato', async () => {
    const doc = makeDoc(1);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    await ocrPdf(fakeFile);

    const calls = [];
    await ocrPdf(fakeFile, { onProgress: (p) => calls.push({ ...p }) });

    expect(calls.every((c) => !c.ocrLoading)).toBe(true);
  });

  it('funziona senza callback onProgress (nessuna eccezione)', async () => {
    const doc = makeDoc(1);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    await expect(ocrPdf(fakeFile)).resolves.toMatchObject({ pages: [expect.any(String)] });
  });

  it('include fileName e totalPages in ogni callback onProgress', async () => {
    const doc = makeDoc(2);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    const calls = [];
    await ocrPdf(fakeFile, { onProgress: (p) => calls.push({ ...p }) });

    expect(calls.every((c) => c.fileName === 'fattura.pdf' && c.totalPages === 2)).toBe(true);
  });

  it('chiama getViewport con scale 2.0', async () => {
    const getViewport = vi.fn().mockReturnValue({ width: 200, height: 300 });
    const render = vi.fn().mockReturnValue({ promise: Promise.resolve() });
    const doc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({ getViewport, render }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    await ocrPdf(fakeFile);

    expect(getViewport).toHaveBeenCalledWith({ scale: 2.0 });
  });

  it('passa un HTMLCanvasElement a worker.recognize', async () => {
    const doc = makeDoc(1);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    const worker = makeWorker();
    createWorker.mockResolvedValue(worker);

    const { ocrPdf } = await loadOcr();
    await ocrPdf(fakeFile);

    expect(worker.recognize.mock.calls[0][0]).toBeInstanceOf(HTMLCanvasElement);
  });

  it('restituisce le pagine nell\'ordine corretto per documenti multi-pagina', async () => {
    const doc = makeDoc(3);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    const worker = {
      recognize: vi.fn()
        .mockResolvedValueOnce({ data: { text: 'pagina uno' } })
        .mockResolvedValueOnce({ data: { text: 'pagina due' } })
        .mockResolvedValueOnce({ data: { text: 'pagina tre' } }),
    };
    createWorker.mockResolvedValue(worker);

    const { ocrPdf } = await loadOcr();
    const result = await ocrPdf(fakeFile);

    expect(result.pages).toEqual(['pagina uno', 'pagina due', 'pagina tre']);
  });

  it('onProgress riporta numeri di pagina sequenziali (worker già caricato)', async () => {
    const doc = makeDoc(3);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    await ocrPdf(fakeFile); // carica il singleton

    const calls = [];
    await ocrPdf(fakeFile, { onProgress: (p) => calls.push({ ...p }) });

    expect(calls.map((c) => c.page)).toEqual([0, 1, 2, 3]);
  });

  it('propaga l\'errore se getDocument rigetta', async () => {
    getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('PDF corrotto')) }));
    createWorker.mockResolvedValue(makeWorker());

    const { ocrPdf } = await loadOcr();
    await expect(ocrPdf(fakeFile)).rejects.toThrow('PDF corrotto');
  });

  it('propaga l\'errore se worker.recognize rigetta', async () => {
    const doc = makeDoc(1);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });
    const worker = { recognize: vi.fn().mockRejectedValue(new Error('OCR fallito')) };
    createWorker.mockResolvedValue(worker);

    const { ocrPdf } = await loadOcr();
    await expect(ocrPdf(fakeFile)).rejects.toThrow('OCR fallito');
  });
});
