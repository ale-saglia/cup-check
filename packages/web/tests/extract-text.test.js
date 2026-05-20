// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractPdfText } from '../src/lib/pdf/extract-text.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) };

function makeDoc(pageTexts) {
  const toItems = (text) =>
    text
      .split(' ')
      .filter(Boolean)
      .map((str) => ({ str }));
  return {
    numPages: pageTexts.length,
    getPage: vi.fn().mockImplementation(async (n) => ({
      getTextContent: () => Promise.resolve({ items: toItems(pageTexts[n - 1]) }),
    })),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  GlobalWorkerOptions.workerSrc = '';
});

describe('extractPdfText', () => {
  it('configura il worker pdf.js prima di aprire il documento', async () => {
    const doc = makeDoc(['testo sufficiente per non attivare ocr nel documento']);
    getDocument.mockImplementation(() => {
      expect(GlobalWorkerOptions.workerSrc).toBe(
        new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href,
      );
      return { promise: Promise.resolve(doc) };
    });

    await extractPdfText(fakeFile);

    expect(GlobalWorkerOptions.workerSrc).toContain('pdfjs/pdf.worker.min.mjs');
  });

  it('estrae testo da un PDF nativo monopagina e segnala needsOcr=false', async () => {
    const text = 'CUP J91B21006430001 progetto infrastruttura comunale finanziato da fondi europei';
    const doc = makeDoc([text]);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });

    const result = await extractPdfText(fakeFile);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toContain('J91B21006430001');
    expect(result.totalChars).toBe(result.pages[0].length);
    expect(result.needsOcr).toBe(false);
    expect(doc.destroy).toHaveBeenCalledOnce();
  });

  it('segnala needsOcr=true quando il testo estratto è scarso (<40 caratteri/pagina)', async () => {
    const doc = makeDoc(['x']);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });

    const result = await extractPdfText(fakeFile);

    expect(result.totalChars).toBeLessThan(40);
    expect(result.needsOcr).toBe(true);
  });

  it('elabora PDF multi-pagina e raccoglie il testo di ogni pagina separatamente', async () => {
    const p1 = 'Pagina uno con CUP J91B21006430001 e testo aggiuntivo sufficiente verifica';
    const p2 = 'Pagina due con CUP H72B21000150007 e ulteriore contenuto testuale estratto';
    const doc = makeDoc([p1, p2]);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });

    const result = await extractPdfText(fakeFile);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain('J91B21006430001');
    expect(result.pages[1]).toContain('H72B21000150007');
    expect(result.totalChars).toBe(result.pages[0].length + result.pages[1].length);
    expect(result.needsOcr).toBe(false);
  });

  it('ignora gli item senza proprietà str (TextMarkedContent)', async () => {
    const doc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: () =>
          Promise.resolve({
            items: [
              { str: 'CUP J91B21006430001 progetto ' },
              { type: 'beginMarkedContent', tag: 'Artifact' },
              { str: 'fondo europeo' },
            ],
          }),
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    getDocument.mockReturnValue({ promise: Promise.resolve(doc) });

    const result = await extractPdfText(fakeFile);

    expect(result.pages[0]).toContain('J91B21006430001');
    expect(result.pages[0]).toContain('fondo europeo');
  });

  it('riutilizza il modulo pdfjs già caricato nelle chiamate successive (singleton)', async () => {
    const doc1 = makeDoc(['testo sufficiente per non attivare il percorso OCR nel documento uno']);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc1) });
    await extractPdfText(fakeFile);

    const doc2 = makeDoc([
      'secondo documento con abbondante testo sufficiente per il test cache singleton',
    ]);
    getDocument.mockReturnValue({ promise: Promise.resolve(doc2) });
    const result = await extractPdfText(fakeFile);

    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(result.pages).toHaveLength(1);
  });
});
