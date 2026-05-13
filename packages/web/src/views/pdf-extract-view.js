let _container = null;

export function mount(container) {
  _container = container;
  container.innerHTML = `
    <section class="view-placeholder" aria-labelledby="pdf-extract-title">
      <h1 id="pdf-extract-title">Estrai CUP da fatture PDF</h1>
      <p>Questo strumento permetterà di estrarre automaticamente i Codici Unici di Progetto da file PDF tramite analisi del testo e OCR.</p>
      <p><em>Funzionalità in arrivo.</em></p>
    </section>
  `;
}

export function unmount() {
  if (_container) {
    _container.innerHTML = '';
    _container = null;
  }
}
