// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import DropZone from '../src/components/DropZone.svelte';
import ImportSourcePreview from '../src/components/ImportSourcePreview.svelte';
import ImportWizard from '../src/components/ImportWizard.svelte';

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
    ...overrides,
  };
}

function setFiles(input, files) {
  Object.defineProperty(input, 'files', { configurable: true, value: files });
}

function dragEvent(type, files = [], relatedTarget = null) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  return event;
}

describe('DropZone', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('filtra file non supportati e segnala gli scarti', () => {
    const onFiles = vi.fn();
    const { container } = render(DropZone, { props: { onFiles } });
    const input = container.querySelector('#file-input');

    setFiles(input, [
      new File(['ok'], 'cup.csv', { type: 'text/csv' }),
      new File(['bad'], 'note.txt', { type: 'text/plain' }),
    ]);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'cup.csv' })]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Alcuni file');
  });

  it('mostra errore se non ci sono file supportati', () => {
    const { container } = render(DropZone, { props: { onFiles: vi.fn() } });
    const input = container.querySelector('#file-input');

    setFiles(input, [new File(['bad'], 'note.txt', { type: 'text/plain' })]);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Carica almeno');
  });

  it('gestisce una selezione vuota senza inviare file', () => {
    const onFiles = vi.fn();
    const { container } = render(DropZone, { props: { onFiles } });
    const input = container.querySelector('#file-input');

    setFiles(input, []);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onFiles).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Carica almeno');
  });

  it('accetta file supportati per MIME type anche senza estensione nota', () => {
    const onFiles = vi.fn();
    const { container } = render(DropZone, { props: { onFiles } });
    const input = container.querySelector('#file-input');

    setFiles(input, [new File(['ok'], 'senza-estensione', { type: 'text/csv' })]);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'senza-estensione' })]);
  });

  it('gestisce drag, leave e drop rispettando disabled', () => {
    const onFiles = vi.fn();
    const { container, rerender } = render(DropZone, { props: { onFiles } });
    const zone = container.querySelector('.dropzone');

    const inside = document.createElement('span');
    zone.appendChild(inside);
    zone.dispatchEvent(dragEvent('dragover'));
    flushSync();
    expect(zone.classList.contains('dropzone--active')).toBe(true);
    zone.dispatchEvent(dragEvent('dragleave', [], inside));
    flushSync();
    expect(zone.classList.contains('dropzone--active')).toBe(true);
    zone.dispatchEvent(dragEvent('dragleave'));
    flushSync();
    expect(zone.classList.contains('dropzone--active')).toBe(false);

    zone.dispatchEvent(dragEvent('drop', [new File(['ok'], 'data.xlsx', { type: '' })]));
    zone.dispatchEvent(dragEvent('drop'));
    flushSync();
    expect(onFiles).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Carica almeno');

    rerender({ disabled: true, onFiles });
    zone.dispatchEvent(dragEvent('dragover'));
    flushSync();
    expect(zone.classList.contains('dropzone--active')).toBe(false);
    zone.dispatchEvent(dragEvent('drop', [new File(['ok'], 'altro.csv', { type: 'text/csv' })]));
    zone.dispatchEvent(dragEvent('drop'));
    expect(onFiles).toHaveBeenCalledOnce();
  });
});

describe('ImportSourcePreview', () => {
  afterEach(() => cleanup());

  it('propaga le modifiche dei controlli visibili', () => {
    const callbacks = {
      onSheetChange: vi.fn(),
      onHeaderChange: vi.fn(),
      onColumnChange: vi.fn(),
      onSkipMissingCupChange: vi.fn(),
    };
    const previewSource = source({
      parsed: parsed({ selectedSheetName: 'Foglio 1', sheetNames: ['Foglio 1', 'Foglio 2'] }),
    });
    const { container } = render(ImportSourcePreview, {
      props: {
        source: previewSource,
        skipMissingCup: true,
        ...callbacks,
      },
    });

    container.querySelector('#sheet-select').value = 'Foglio 2';
    container.querySelector('#sheet-select').dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector('#header-toggle').click();
    container.querySelector('#column-select').value = '1';
    container.querySelector('#column-select').dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector('#skip-missing-cup').click();

    expect(callbacks.onSheetChange).toHaveBeenCalledWith('Foglio 2');
    expect(callbacks.onHeaderChange).toHaveBeenCalledWith(false);
    expect(callbacks.onColumnChange).toHaveBeenCalledWith(1);
    expect(callbacks.onSkipMissingCupChange).toHaveBeenCalledWith(false);
  });

  it('mostra intestazione non rilevata automaticamente', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headerPresent: false, headerDetectedAutomatically: false }),
          headerPresent: false,
        }),
        skipMissingCup: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.textContent).toContain('intestazione non rilevata automaticamente');
  });

  it('disabilita la colonna quando la sorgente non e inclusa', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({ included: false }),
        skipMissingCup: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('#column-select')?.disabled).toBe(true);
  });

  it('descrive intestazioni impostate manualmente e nasconde il nome file duplicato', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headerPresent: false, headerDetectedAutomatically: true }),
          headerPresent: false,
        }),
        skipMissingCup: false,
        showFileName: false,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.textContent).toContain('prima riga trattata manualmente come dati');
    expect(container.querySelector('h3')?.classList.contains('visually-hidden')).toBe(true);
  });

  it('usa 0 come indice colonna di default quando selectedColumnIndexes e vuoto', () => {
    const emptyIndexSource = { ...source(), selectedColumnIndexes: [] };
    const { container } = render(ImportSourcePreview, {
      props: {
        source: emptyIndexSource,
        skipMissingCup: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('#column-select')?.value).toBe('0');
  });

  it('mostra Colonna N quando la intestazione della colonna e vuota', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headers: ['', 'Note'] }),
        }),
        skipMissingCup: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('thead')?.textContent).toContain('Colonna 1');
    expect(container.querySelector('#column-select option')?.textContent).toContain('Colonna 1');
  });

  it('disabilita tutti i controlli quando disabled e true', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({ parsed: parsed({ sheetNames: ['A', 'B'] }) }),
        disabled: true,
        skipMissingCup: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('#column-select')?.disabled).toBe(true);
    expect(container.querySelector('#sheet-select')?.disabled).toBe(true);
    expect(container.querySelector('#header-toggle')?.disabled).toBe(true);
  });

  it('descrive intestazione impostata manualmente quando rilevazione automatica e falsa ma intestazione e presente', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headerPresent: true, headerDetectedAutomatically: false }),
          headerPresent: true,
        }),
        skipMissingCup: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.textContent).toContain('intestazione impostata manualmente');
  });
});

describe('ImportWizard', () => {
  afterEach(() => cleanup());

  it('mostra solo il dropdown file e conferma il batch multi-file', () => {
    const onConfirm = vi.fn();
    const sources = [
      source({ id: '0:a.csv', fileName: 'a.csv', file: new File(['a'], 'a.csv') }),
      source({ id: '1:b.csv', fileName: 'b.csv', file: new File(['b'], 'b.csv') }),
    ];
    const { container } = render(ImportWizard, {
      props: {
        sources,
        skipMissingCup: true,
        onSourcesChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onConfirm,
        onCancel: vi.fn(),
      },
    });

    expect(container.textContent).not.toContain('Precedente');
    expect(container.textContent).not.toContain('Successivo');
    const fileSelect = container.querySelector('.import-file-select select');
    expect(fileSelect).toBeTruthy();
    fileSelect.value = '1';
    fileSelect.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(container.querySelector('.import-source-header h3')?.textContent).toBe('b.csv');
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    expect(onConfirm).toHaveBeenCalledWith(sources);
  });

  it('mostra messaggio quando nessuna sorgente e inclusa', () => {
    const { container } = render(ImportWizard, {
      props: {
        sources: [source({ included: false })],
        skipMissingCup: true,
        onSourcesChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();
    expect(container.querySelector('.live-message')?.textContent).toContain('Includi almeno');
  });

  it('mostra messaggi quando non ci sono righe importabili e annulla import vuoto', () => {
    const onCancel = vi.fn();
    const emptySource = source({ parsed: parsed({ rows: [] }) });
    const { container } = render(ImportWizard, {
      props: {
        sources: [emptySource],
        skipMissingCup: true,
        onSourcesChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel,
      },
    });

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();
    expect(container.querySelector('.live-message')?.textContent).toContain('Nessuna cella CUP');

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Annulla'))
      ?.click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('mostra errore se aggiungere una scheda fallisce', async () => {
    const brokenFile = new File(['not xlsx'], 'rotto.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const brokenSource = source({
      file: brokenFile,
      fileName: 'rotto.xlsx',
      parsed: parsed({ selectedSheetName: 'A', sheetNames: ['A', 'B'] }),
    });
    const { container } = render(ImportWizard, {
      props: {
        sources: [brokenSource],
        skipMissingCup: true,
        onSourcesChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const sheetSelect = container.querySelector('.additional-sheet-controls select');
    sheetSelect.value = 'B';
    sheetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Carica colonna da scheda'))
      ?.click();
    await vi.waitFor(() =>
      expect(container.querySelector('.live-message')?.textContent).not.toBe(''),
    );
  });

  it('mostra errore se il cambio scheda corrente fallisce', async () => {
    const brokenFile = new File(['not xlsx'], 'rotto.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const brokenSource = source({
      file: brokenFile,
      fileName: 'rotto.xlsx',
      parsed: parsed({ selectedSheetName: 'A', sheetNames: ['A', 'B'] }),
    });
    const { container } = render(ImportWizard, {
      props: {
        sources: [brokenSource],
        skipMissingCup: true,
        onSourcesChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const sheetSelect = container.querySelector('#sheet-select');
    sheetSelect.value = 'B';
    sheetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() =>
      expect(container.querySelector('.live-message')?.textContent?.trim()).not.toBe(''),
    );
  });

  it('usa il messaggio per righe non disponibili quando skip missing e disattivato', () => {
    const { container } = render(ImportWizard, {
      props: {
        sources: [source({ parsed: parsed({ rows: [] }) })],
        skipMissingCup: false,
        onSourcesChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();
    expect(container.querySelector('.live-message')?.textContent).toContain(
      'Nessuna riga disponibile',
    );
  });
});
