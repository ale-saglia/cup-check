let _workerPromise = null;

function tesseractPaths() {
  const base = new URL('tesseract/', document.baseURI).href;
  return {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    workerBlobURL: false,
  };
}

function getOcrWorker() {
  if (!_workerPromise) {
    _workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('ita+eng', 1, tesseractPaths(), { user_words_suffix: '' });
    })();
  }
  return _workerPromise;
}

export async function ocrPdf(file, { onProgress } = {}) {
  const { getDocument } = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const totalPages = doc.numPages;

  const needsLoad = !_workerPromise;
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
