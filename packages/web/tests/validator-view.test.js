// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('validator-view', () => {
  function setupDom() {
    document.body.innerHTML = '';
    const container = document.createElement('div');
    document.body.appendChild(container);
    const bar = document.createElement('span');
    bar.id = 'dataset-status-bar';
    document.body.appendChild(bar);
    return container;
  }

  async function loadView() {
    vi.doMock('../src/dataset-loader.js', () => ({
      loadLatestDataset: vi.fn().mockResolvedValue({
        manifest: { dataset_tag: 'test' },
        hasCup: () => false,
      }),
    }));
    vi.doMock('../src/parser.js', () => ({
      parseFile: vi.fn(),
      buildParsedRows: vi.fn(),
    }));
    return import('../src/views/validator-view.js');
  }

  it('unmount svuota il container e azzera il riferimento interno', async () => {
    const container = setupDom();
    const { mount, unmount } = await loadView();

    mount(container);
    expect(container.innerHTML).not.toBe('');

    unmount();

    expect(container.innerHTML).toBe('');
  });

  it('unmount è un no-op se chiamato senza un mount precedente', async () => {
    const { unmount } = await loadView();
    expect(() => unmount()).not.toThrow();
  });

  it('consuma il file dal registry transfer al mount e mostra l\'anteprima', async () => {
    const container = setupDom();
    const pendingFile = new File(['cup,file_origine\n'], 'estrazione.csv', { type: 'text/csv' });
    const consumeTransferMock = vi.fn().mockImplementation((id) => id === 'testid123' ? pendingFile : null);

    window.history.replaceState({}, '', '#/?transfer=testid123');
    vi.doMock('../src/transfer.js', () => ({ consumeTransfer: consumeTransferMock }));
    vi.doMock('../src/dataset-loader.js', () => ({
      loadLatestDataset: vi.fn().mockResolvedValue({
        manifest: { dataset_tag: 'test' },
        hasCup: () => false,
      }),
    }));
    const parseFileMock = vi.fn().mockResolvedValue({
      rows: [],
      rawRows: [],
      suggestedColumnIndex: 0,
      selectedSheetName: '',
      sheetNames: null,
    });
    vi.doMock('../src/parser.js', () => ({
      parseFile: parseFileMock,
      buildParsedRows: vi.fn().mockReturnValue({ rows: [], rawRows: [], suggestedColumnIndex: 0 }),
    }));

    const { mount } = await import('../src/views/validator-view.js');

    await mount(container);

    expect(consumeTransferMock).toHaveBeenCalledWith('testid123');
    expect(parseFileMock).toHaveBeenCalledWith(pendingFile);
    window.history.replaceState({}, '', '#/');
  });

  it('gestisce l\'errore di parseFile quando il registry transfer ha un file', async () => {
    const container = setupDom();
    const pendingFile = new File(['invalid'], 'estrazione.csv', { type: 'text/csv' });
    const consumeTransferMock = vi.fn().mockReturnValue(pendingFile);

    window.history.replaceState({}, '', '#/?transfer=testid123');
    vi.doMock('../src/transfer.js', () => ({ consumeTransfer: consumeTransferMock }));
    vi.doMock('../src/dataset-loader.js', () => ({
      loadLatestDataset: vi.fn().mockResolvedValue({
        manifest: { dataset_tag: 'test' },
        hasCup: () => false,
      }),
    }));
    vi.doMock('../src/parser.js', () => ({
      parseFile: vi.fn().mockRejectedValue(new Error('parse error')),
      buildParsedRows: vi.fn(),
    }));

    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    const { mount } = await import('../src/views/validator-view.js');

    await mount(container);

    expect(alertMock).toHaveBeenCalledWith('parse error');
    window.history.replaceState({}, '', '#/');
  });
});
