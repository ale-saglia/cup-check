// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    skipMissingCup: true,
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

  it('mostra avviso per file che superano i 25 MB consigliati', () => {
    const onFiles = vi.fn();
    const { container } = render(DropZone, { props: { onFiles } });
    const input = container.querySelector('#file-input');

    const bigFile = new File(['cup'], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(bigFile, 'size', { value: 26 * 1024 * 1024, configurable: true });
    setFiles(input, [bigFile]);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onFiles).toHaveBeenCalledWith([bigFile]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('25 MB');
  });

  it('mostra avviso aggregato per piu file grandi', () => {
    const onFiles = vi.fn();
    const { container } = render(DropZone, { props: { onFiles } });
    const input = container.querySelector('#file-input');

    const bigA = new File(['a'], 'a.csv', { type: 'text/csv' });
    const bigB = new File(['b'], 'b.csv', { type: 'text/csv' });
    Object.defineProperty(bigA, 'size', { value: 26 * 1024 * 1024, configurable: true });
    Object.defineProperty(bigB, 'size', { value: 30 * 1024 * 1024, configurable: true });
    setFiles(input, [bigA, bigB]);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onFiles).toHaveBeenCalledWith([bigA, bigB]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('2 file');
  });

  it('gestisce change e drop senza FileList disponibile', () => {
    const onFiles = vi.fn();
    const { container } = render(DropZone, { props: { onFiles } });
    const input = container.querySelector('#file-input');
    const zone = container.querySelector('.dropzone');

    Object.defineProperty(input, 'files', { configurable: true, value: undefined });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    zone.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    flushSync();

    expect(onFiles).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Carica almeno');
  });
});

describe('ImportSourcePreview', () => {
  afterEach(() => cleanup());

  it('propaga le modifiche dei controlli visibili', () => {
    const callbacks = {
      onSheetChange: vi.fn(),
      onHeaderChange: vi.fn(),
      onColumnChange: vi.fn(),
      onIncludeChange: vi.fn(),
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

    container.querySelector('[id^="sheet-select-"]').value = 'Foglio 2';
    container
      .querySelector('[id^="sheet-select-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector('[id^="header-toggle-"]').click();
    container.querySelector('[id^="column-select-"]').value = '1';
    container
      .querySelector('[id^="column-select-"]')
      .dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector('[id^="skip-missing-cup-"]').click();

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
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.textContent).toContain('intestazione non rilevata automaticamente');
  });

  it('disabilita la colonna quando la sorgente non e inclusa', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({ included: false }),
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('[id^="column-select-"]')?.disabled).toBe(true);
  });

  it('descrive intestazioni impostate manualmente e nasconde il nome file duplicato', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headerPresent: false, headerDetectedAutomatically: true }),
          headerPresent: false,
        }),
        showFileName: false,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
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
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('[id^="column-select-"]')?.value).toBe('0');
  });

  it('mostra Colonna N quando la intestazione della colonna e vuota', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headers: ['', 'Note'] }),
        }),
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('thead')?.textContent).toContain('Colonna 1');
    expect(container.querySelector('[id^="column-select-"] option')?.textContent).toContain(
      'Colonna 1',
    );
  });

  it('disabilita tutti i controlli quando disabled e true', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({ parsed: parsed({ sheetNames: ['A', 'B'] }) }),
        disabled: true,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('[id^="column-select-"]')?.disabled).toBe(true);
    expect(container.querySelector('[id^="sheet-select-"]')?.disabled).toBe(true);
    expect(container.querySelector('[id^="header-toggle-"]')?.disabled).toBe(true);
    expect(container.querySelector('[id^="include-toggle-"]')?.disabled).toBe(true);
    expect(container.querySelector('[id^="skip-missing-cup-"]')?.disabled).toBe(true);
  });

  it('descrive intestazione impostata manualmente quando rilevazione automatica e falsa ma intestazione e presente', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ headerPresent: true, headerDetectedAutomatically: false }),
          headerPresent: true,
        }),
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.textContent).toContain('intestazione impostata manualmente');
  });

  it('propaga onIncludeChange quando il toggle includi viene cliccato', () => {
    const onIncludeChange = vi.fn();
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source(),
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange,
        onSkipMissingCupChange: vi.fn(),
      },
    });

    container.querySelector('[id^="include-toggle-"]').click();
    expect(onIncludeChange).toHaveBeenCalledWith(false);
  });

  it('mostra warning e azione rimuovi per una sorgente senza colonne', () => {
    const onRemove = vi.fn();
    const emptySource = source({
      parsed: parsed({
        rawRows: [],
        headers: [],
        rows: [],
        headerPresent: false,
        headerDetectedAutomatically: false,
        suggestedColumnIndex: 0,
        selectedSheetName: 'Vuota',
        sheetNames: ['Vuota', 'CUP'],
      }),
      included: false,
      selectedColumnIndexes: [],
    });
    const { container } = render(ImportSourcePreview, {
      props: {
        source: emptySource,
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
        onRemove,
      },
    });

    expect(container.textContent).toContain('Foglio vuoto');
    expect(container.querySelector('[id^="include-toggle-"]')?.disabled).toBe(true);
    expect(container.querySelector('[id^="column-select-"]')).toBeNull();
    container.querySelector('.import-remove-source')?.click();
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('usa il gestore rimuovi di default senza lanciare eccezioni', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source(),
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(() => container.querySelector('.import-remove-source')?.click()).not.toThrow();
  });

  it('nasconde il selettore scheda quando esiste una sola scheda Excel', () => {
    const { container } = render(ImportSourcePreview, {
      props: {
        source: source({
          parsed: parsed({ selectedSheetName: 'Unica', sheetNames: ['Unica'] }),
        }),
        onSheetChange: vi.fn(),
        onHeaderChange: vi.fn(),
        onColumnChange: vi.fn(),
        onIncludeChange: vi.fn(),
        onSkipMissingCupChange: vi.fn(),
      },
    });

    expect(container.querySelector('.import-sheet-select')?.classList.contains('hidden')).toBe(
      true,
    );
    expect(container.querySelector('[id^="sheet-select-"]')?.disabled).toBe(true);
  });
});

describe('ImportWizard', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
      this.setAttribute('open', '');
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renderizza uno stato vuoto senza sorgenti importabili', () => {
    const { container } = render(ImportWizard, {
      props: {
        sources: [],
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(container.querySelector('.import-source-preview')).toBeNull();
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();
    expect(container.querySelector('.live-message')?.textContent).toContain('Includi almeno');
  });

  it('mostra solo il dropdown file e conferma il batch multi-file', () => {
    const onConfirm = vi.fn();
    const sources = [
      source({ id: '0:a.csv', fileName: 'a.csv', file: new File(['a'], 'a.csv') }),
      source({ id: '1:b.csv', fileName: 'b.csv', file: new File(['b'], 'b.csv') }),
    ];
    const { container } = render(ImportWizard, {
      props: {
        sources,
        onSourcesChange: vi.fn(),
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
        onSourcesChange: vi.fn(),
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
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel,
      },
    });

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();
    expect(container.querySelector('.live-message')?.textContent).toContain(
      'Nessuna riga disponibile',
    );

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
        onSourcesChange: vi.fn(),
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
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const sheetSelect = container.querySelector('[id^="sheet-select-"]');
    sheetSelect.value = 'B';
    sheetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() =>
      expect(container.querySelector('.live-message')?.textContent?.trim()).not.toBe(''),
    );
  });

  it('mostra errore celle CUP assenti quando tutte le celle sono vuote e skip e attivo', () => {
    const emptyCupSource = source({
      parsed: parsed({ rows: [{ originalRowNumber: 2, cells: ['', 'ok'] }] }),
      skipMissingCup: true,
    });
    const { container } = render(ImportWizard, {
      props: {
        sources: [emptyCupSource],
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();
    flushSync();
    expect(container.querySelector('.live-message')?.textContent).toContain(
      'Nessuna cella CUP valorizzata',
    );
  });

  it('usa il messaggio per righe non disponibili quando skip missing e disattivato', () => {
    const { container } = render(ImportWizard, {
      props: {
        sources: [source({ parsed: parsed({ rows: [] }) })],
        onSourcesChange: vi.fn(),
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

  it('aggiorna included quando il toggle includi viene cliccato nella source preview', () => {
    const onSourcesChange = vi.fn();
    const testSource = source({ id: '0:test.csv' });
    const { container } = render(ImportWizard, {
      props: {
        sources: [testSource],
        skipMissingCup: true,
        onSourcesChange,
        onSkipMissingCupChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    container.querySelector('[id^="include-toggle-"]').click();
    expect(onSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: '0:test.csv', included: false }),
    ]);
  });

  it('rimuove una sorgente dal wizard quando si usa Rimuovi sorgente', () => {
    const onSourcesChange = vi.fn();
    const removableSource = source({ id: '0:test.csv' });
    const { container } = render(ImportWizard, {
      props: {
        sources: [removableSource],
        onSourcesChange,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    container.querySelector('.import-remove-source')?.click();
    expect(onSourcesChange).toHaveBeenCalledWith([]);
  });

  // D2.6 — accessibilità preparatoria
  it('usa un dialog nativo modale con nome accessibile', () => {
    const { container } = render(ImportWizard, {
      props: {
        sources: [source()],
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const panel = container.querySelector('#import-wizard');
    expect(panel?.tagName).toBe('DIALOG');
    expect(panel?.getAttribute('aria-labelledby')).toBe('import-wizard-title');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  });

  it('apre il dialog con attributo open quando showModal non è disponibile', () => {
    HTMLDialogElement.prototype.showModal = undefined;
    const { container } = render(ImportWizard, {
      props: {
        sources: [source()],
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(container.querySelector('#import-wizard')?.hasAttribute('open')).toBe(true);
  });

  it('chiama onCancel quando il dialog riceve cancel', () => {
    const onCancel = vi.fn();
    const { container } = render(ImportWizard, {
      props: {
        sources: [source()],
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel,
      },
    });

    const panel = container.querySelector('#import-wizard');
    panel.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('chiama onAnnounce con il conteggio righe prima di confermare', () => {
    const onConfirm = vi.fn();
    const onAnnounce = vi.fn();
    const { container } = render(ImportWizard, {
      props: {
        sources: [source()],
        onSourcesChange: vi.fn(),
        onConfirm,
        onCancel: vi.fn(),
        onAnnounce,
      },
    });

    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Conferma importazione'))
      ?.click();

    expect(onAnnounce).toHaveBeenCalledWith(expect.stringContaining('Importazione confermata'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('gli ID dei controlli sono unici quando due sorgenti sono visibili insieme', () => {
    const fileA = new File(['a'], 'a.csv', { type: 'text/csv' });
    const sourcesForSameFile = [
      source({ id: '0:a.csv', file: fileA, fileName: 'a.csv' }),
      source({ id: '1:a.csv', file: fileA, fileName: 'a.csv' }),
    ];
    const { container } = render(ImportWizard, {
      props: {
        sources: sourcesForSameFile,
        onSourcesChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const includeToggles = container.querySelectorAll('[id^="include-toggle-"]');
    const ids = Array.from(includeToggles).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
