let _worker = null;

function tesseractPaths() {
  const base = new URL('/tesseract/', location.origin).href;
  return {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    workerBlobURL: false,
  };
}

async function getOcrWorker() {
  if (!_worker) {
    const { createWorker } = await import('tesseract.js');
    _worker = await createWorker('ita+eng', 1, tesseractPaths());
  }
  return _worker;
}

export async function ocrPdf(file, { onProgress } = {}) {
  const { getDocument } = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const totalPages = doc.numPages;

  const needsLoad = !_worker;
  onProgress?.({ fileName: file.name, page: 0, totalPages, ocrLoading: needsLoad });

  const worker = await getOcrWorker();

  if (needsLoad) {
    onProgress?.({ fileName: file.name, page: 0, totalPages, ocrLoading: false });
  }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const {
      data: { text },
    } = await worker.recognize(canvas);
    pages.push(text);

    onProgress?.({ fileName: file.name, page: i, totalPages, ocrLoading: false });
  }

  await doc.destroy();
  return { pages };
}
