import { loadPdfjs } from './pdfjs-loader.js';

export async function extractPdfText(
  file: File,
): Promise<{ pages: string[]; totalChars: number; needsOcr: boolean }> {
  const { getDocument } = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const loadingTask = getDocument({ data });
  try {
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
    const needsOcr = totalChars / Math.max(pages.length, 1) < 40;
    return { pages, totalChars, needsOcr };
  } finally {
    await loadingTask.destroy();
  }
}
