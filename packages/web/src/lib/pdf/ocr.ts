import type { Worker } from 'tesseract.js';
import { loadPdfjs } from './pdfjs-loader.js';

interface OcrProgressEvent {
  fileName: string;
  page: number;
  totalPages: number;
  ocrLoading: boolean;
}

let _workerPromise: Promise<Worker> | null = null;

function tesseractPaths() {
  const base = new URL('tesseract/', document.baseURI).href;
  return {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    workerBlobURL: false,
  };
}

function getOcrWorker(): Promise<Worker> {
  if (!_workerPromise) {
    _workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('ita+eng', 1, tesseractPaths(), { user_words_suffix: '' } as Record<string, string>);
    })();
  }
  return _workerPromise;
}

export async function terminateOcrWorker(): Promise<void> {
  const workerPromise = _workerPromise;
  _workerPromise = null;
  if (!workerPromise) return;

  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    // Cleanup is best-effort: callers use it while leaving or clearing the view.
  }
}

export async function ocrPdf(
  file: File,
  { onProgress }: { onProgress?: (progress: OcrProgressEvent) => void } = {},
): Promise<{ pages: string[] }> {
  const { getDocument } = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const totalPages = doc.numPages;

  const needsLoad = !_workerPromise;
  onProgress?.({ fileName: file.name, page: 0, totalPages, ocrLoading: needsLoad });

  const worker = await getOcrWorker();

  if (needsLoad) {
    onProgress?.({ fileName: file.name, page: 0, totalPages, ocrLoading: false });
  }

  const pages: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;

    const {
      data: { text },
    } = await worker.recognize(canvas);
    pages.push(text);

    onProgress?.({ fileName: file.name, page: i, totalPages, ocrLoading: false });
  }

  await doc.destroy();
  return { pages };
}
