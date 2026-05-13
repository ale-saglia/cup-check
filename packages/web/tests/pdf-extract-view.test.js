// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGlobalWorkerOptions = { workerSrc: '' };

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: mockGlobalWorkerOptions,
}));

async function loadView() {
  vi.resetModules();
  return import('../src/views/pdf-extract-view.js');
}

describe('pdf-extract-view', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    // reset workerSrc to a plain writable property before each test
    Object.defineProperty(mockGlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      writable: true,
      value: '',
    });
  });

  it('mount mostra la schermata iniziale con dropzone e configura workerSrc', async () => {
    const { mount } = await loadView();

    await mount(container);

    expect(container.querySelector('h1')?.textContent).toBe('Estrai CUP da fatture PDF');
    expect(container.querySelector('#pdf-dropzone')).not.toBeNull();
    expect(container.querySelector('#pdf-file-input')).not.toBeNull();
    expect(container.querySelector('#pdf-results-area')?.classList.contains('hidden')).toBe(true);
    expect(mockGlobalWorkerOptions.workerSrc).toContain('/pdfjs/pdf.worker.min.mjs');
  });

  it('mount non lancia eccezione se pdfjs fallisce durante il caricamento', async () => {
    Object.defineProperty(mockGlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      set() {
        throw new Error('rete non disponibile');
      },
    });

    const { mount } = await loadView();

    await expect(mount(container)).resolves.not.toThrow();
    expect(container.querySelector('#pdf-dropzone')).not.toBeNull();
  });

  it('unmount svuota il container e rilascia il riferimento interno', async () => {
    const { mount, unmount } = await loadView();

    await mount(container);
    unmount();

    expect(container.innerHTML).toBe('');
  });

  it('unmount è un no-op se chiamato senza un mount precedente', async () => {
    const { unmount } = await loadView();

    expect(() => unmount()).not.toThrow();
  });
});
