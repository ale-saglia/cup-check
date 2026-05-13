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
});
