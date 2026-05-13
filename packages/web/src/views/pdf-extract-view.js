let _container = null;

export async function mount(container) {
  _container = container;
  container.innerHTML = `
    <section class="view-placeholder" aria-labelledby="pdf-extract-title">
      <h1 id="pdf-extract-title">Estrai CUP da fatture PDF</h1>
      <p id="pdf-lib-status">Caricamento libreria PDF…</p>
    </section>
  `;

  try {
    const { GlobalWorkerOptions } = await import('pdfjs-dist');
    GlobalWorkerOptions.workerSrc = new URL('/pdfjs/pdf.worker.min.mjs', location.origin).href;
    container.querySelector('#pdf-lib-status').textContent =
      'Carica uno o più file PDF per estrarre i CUP.';
  } catch (error) {
    container.querySelector('#pdf-lib-status').textContent =
      `Errore caricamento libreria PDF: ${error.message}`;
  }
}

export function unmount() {
  if (_container) {
    _container.innerHTML = '';
    _container = null;
  }
}
