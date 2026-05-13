let _pdfjs = null;

async function loadPdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('pdfjs-dist');
  }
  return _pdfjs;
}

export async function extractPdfText(file) {
  const { getDocument } = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const doc = await getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  await doc.destroy();
  const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
  const needsOcr = totalChars / Math.max(pages.length, 1) < 40;
  return { pages, totalChars, needsOcr };
}
