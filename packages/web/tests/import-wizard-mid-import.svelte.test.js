// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';

function parsed(overrides = {}) {
  return {
    rawRows: [
      ['CUP', 'Note'],
      ['G17H03000130001', 'ok'],
    ],
    headers: ['CUP', 'Note'],
    rows: [{ originalRowNumber: 2, cells: ['G17H03000130001', 'ok'] }],
    headerPresent: true,
    headerDetectedAutomatically: true,
    suggestedColumnIndex: 0,
    selectedSheetName: '',
    sheetNames: null,
    ...overrides,
  };
}

function source(overrides = {}) {
  const file =
    overrides.file ?? new File(['cup'], overrides.fileName ?? 'cups.csv', { type: 'text/csv' });
  const sourceParsed = overrides.parsed ?? parsed();
  return {
    id: overrides.id ?? `0:${file.name}`,
    file,
    fileName: file.name,
    ...(sourceParsed.selectedSheetName ? { sheetName: sourceParsed.selectedSheetName } : {}),
    parsed: sourceParsed,
    headerPresent: sourceParsed.headerPresent,
    selectedColumnIndexes: [sourceParsed.suggestedColumnIndex],
    included: true,
    skipMissingCup: true,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ImportWizard cambio scheda durante import asincrono', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
      this.setAttribute('open', '');
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('aggiorna la sorgente per id anche se l utente cambia file mentre la scheda carica', async () => {
    const sheetChange = deferred();
    const updatedFirstSource = source({
      id: '0:a.xlsx',
      fileName: 'a.xlsx',
      file: new File(['a'], 'a.xlsx'),
      parsed: parsed({ selectedSheetName: 'B', sheetNames: ['A', 'B'] }),
    });
    const updateSourceSheet = vi.fn((_source, _sheetName, options) => {
      expect(options.columnLabel(0)).toBe('Colonna 1');
      return sheetChange.promise;
    });

    vi.doMock('../src/lib/core/import-plan.js', async (importOriginal) => ({
      ...(await importOriginal()),
      updateSourceSheet,
    }));

    const { default: ImportWizard } = await import('../src/components/ImportWizard.svelte');
    const secondSource = source({
      id: '1:b.xlsx',
      fileName: 'b.xlsx',
      file: new File(['b'], 'b.xlsx'),
      parsed: parsed({ selectedSheetName: 'A', sheetNames: ['A', 'B'] }),
    });
    const onSourcesChange = vi.fn();
    const { container } = render(ImportWizard, {
      props: {
        sources: [updatedFirstSource, secondSource],
        onSourcesChange,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const sheetSelect = container.querySelector('[id^="sheet-select-"]');
    sheetSelect.value = 'B';
    sheetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    const fileSelect = container.querySelector('.import-file-select select');
    fileSelect.value = '1';
    fileSelect.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelector('.import-source-header h3')?.textContent).toBe('b.xlsx');

    sheetChange.resolve(updatedFirstSource);
    await vi.waitFor(() => expect(onSourcesChange).toHaveBeenCalled());

    expect(onSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: '0:a.xlsx', sheetName: 'B' }),
      expect.objectContaining({ id: '1:b.xlsx' }),
    ]);
  });
});
