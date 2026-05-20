// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import EntryList from '../src/components/EntryList.svelte';

const CUP1 = 'G17H03000130001';
const CUP2 = 'J61B21007000007';

function callbacks() {
  return {
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onAddManual: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
  };
}

describe('EntryList', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renderizza gli stati non completati e le varianti OCR', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [
          { id: 1, name: 'queued.pdf', status: 'queued', cups: [] },
          { id: 2, name: 'parsing.pdf', status: 'parsing', cups: [] },
          {
            id: 3,
            name: 'ocr-loading.pdf',
            status: 'ocr',
            cups: [],
            ocrProgress: { ocrLoading: true, page: 0, totalPages: 0 },
          },
          {
            id: 4,
            name: 'ocr-page.pdf',
            status: 'ocr',
            cups: [],
            ocrProgress: { ocrLoading: false, page: 2, totalPages: 5 },
          },
          {
            id: 5,
            name: 'ocr-senza-progress.pdf',
            status: 'ocr',
            cups: [],
            ocrProgress: null,
          },
        ],
        ...props,
      },
    });

    expect(container.textContent).toContain('In coda');
    expect(container.textContent).toContain('Lettura PDF');
    expect(container.textContent).toContain('Caricamento OCR');
    expect(container.textContent).toContain('OCR pagina 2 / 5');
    expect(container.textContent).toContain('OCR pagina 0 / 0');
  });

  it('renderizza errore con CUP esistente e azioni riga', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [
          {
            id: 7,
            name: 'errore.pdf',
            status: 'error',
            error: null,
            cups: [
              {
                id: '7-0',
                value: CUP1,
                formalValid: true,
                source: null,
                manual: false,
                editing: false,
              },
            ],
          },
        ],
        ...props,
      },
    });

    expect(container.textContent).toContain('Errore');
    expect(container.textContent).toContain(CUP1);
    container.querySelector('button')?.click();
    expect(props.onEdit).toHaveBeenCalledWith(7, '7-0');
    const removeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'rimuovi',
    );
    removeButton?.click();
    expect(props.onRemove).toHaveBeenCalledWith(7, '7-0');
  });

  it('renderizza CUP invalido manuale e nome file troncato', () => {
    const props = callbacks();
    const longName = 'fattura-con-un-nome-molto-lungo-che-supera-il-limite.pdf';
    const { container } = render(EntryList, {
      props: {
        entries: [
          {
            id: 8,
            name: longName,
            status: 'done',
            cups: [
              {
                id: '8-0',
                value: '123',
                formalValid: false,
                source: 'manuale',
                manual: true,
                editing: false,
              },
            ],
          },
        ],
        ...props,
      },
    });

    expect(container.textContent).toContain('Invalido');
    expect(container.textContent).toContain('manuale');
    expect(container.querySelector('.detail-cell')?.textContent).toContain('…');
    expect(container.querySelector('.detail-cell')?.getAttribute('title')).toBe(longName);
  });

  it('gestisce input edit con invio, escape, blur e click sui controlli', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [
          {
            id: 9,
            name: 'edit.pdf',
            status: 'done',
            cups: [
              {
                id: '9-0',
                value: CUP2,
                formalValid: true,
                source: null,
                manual: true,
                editing: true,
              },
            ],
          },
        ],
        ...props,
      },
    });
    flushSync();

    const input = container.querySelector('input[data-editing]');
    input.value = CUP1;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(props.onSaveEdit).toHaveBeenCalledWith(9, '9-0', CUP1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(props.onCancelEdit).toHaveBeenCalledWith(9, '9-0');

    input.value = 'A58C15000390001';
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(props.onSaveEdit).toHaveBeenLastCalledWith(9, '9-0', 'A58C15000390001');

    const save = container.querySelector('[data-save-edit]');
    save.click();
    expect(props.onSaveEdit).toHaveBeenLastCalledWith(9, '9-0', 'A58C15000390001');

    container.querySelector('[data-cancel-edit]').click();
    expect(props.onCancelEdit).toHaveBeenLastCalledWith(9, '9-0');
  });

  it('non rifocalizza se resta attivo lo stesso CUP in edit', () => {
    const props = callbacks();
    const cup = {
      id: '9-0',
      value: CUP2,
      formalValid: true,
      source: null,
      manual: true,
      editing: true,
    };
    const { container, rerender } = render(EntryList, {
      props: {
        entries: [{ id: 9, name: 'edit.pdf', status: 'done', cups: [cup] }],
        ...props,
      },
    });
    flushSync();
    const input = container.querySelector('input[data-editing]');
    const focusSpy = vi.spyOn(input, 'focus');

    rerender({
      entries: [{ id: 9, name: 'edit.pdf', status: 'done', cups: [{ ...cup, value: CUP1 }] }],
      ...props,
    });
    flushSync();

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('non salva su mousedown dei controlli edit', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [
          {
            id: 10,
            name: 'edit.pdf',
            status: 'done',
            cups: [
              {
                id: '10-0',
                value: '',
                formalValid: false,
                source: 'manuale',
                manual: true,
                editing: true,
              },
            ],
          },
        ],
        ...props,
      },
    });

    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'relatedTarget', {
      value: container.querySelector('[data-save-edit]'),
    });
    container.querySelector('input[data-editing]').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignora tasti non gestiti e mousedown fuori dai controlli edit', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [
          {
            id: 11,
            name: 'edit.pdf',
            status: 'done',
            cups: [
              {
                id: '11-0',
                value: CUP1,
                formalValid: true,
                source: 'text',
                manual: false,
                editing: true,
              },
            ],
          },
        ],
        ...props,
      },
    });

    const input = container.querySelector('input[data-editing]');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(props.onSaveEdit).not.toHaveBeenCalled();
    expect(props.onCancelEdit).not.toHaveBeenCalled();

    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'relatedTarget', { value: document.body });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('mostra il messaggio errore e permette aggiunta manuale quando non ci sono CUP', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [{ id: 12, name: 'errore.pdf', status: 'error', error: 'PDF corrotto', cups: [] }],
        ...props,
      },
    });

    expect(container.textContent).toContain('PDF corrotto');
    container.querySelector('button')?.click();
    expect(props.onAddManual).toHaveBeenCalledWith(12);
  });

  it('renderizza errore senza messaggio come stringa vuota', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [{ id: 16, name: 'errore.pdf', status: 'error', cups: [] }],
        ...props,
      },
    });

    expect(container.querySelector('.badge.bad')?.textContent).toBe('Errore');
  });

  it('salva stringa vuota se il controllo salva non trova piu input edit', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        entries: [
          {
            id: 13,
            name: 'edit.pdf',
            status: 'done',
            cups: [
              {
                id: '13-0',
                value: CUP1,
                formalValid: true,
                source: 'text',
                manual: false,
                editing: true,
              },
            ],
          },
        ],
        ...props,
      },
    });

    container.querySelector('input[data-editing]').remove();
    container.querySelector('[data-save-edit]').click();
    expect(props.onSaveEdit).toHaveBeenCalledWith(13, '13-0', '');
  });

  it('renderizza i dati fattura e le celle vuote quando richiesto', () => {
    const props = callbacks();
    const { container } = render(EntryList, {
      props: {
        showInvoiceData: true,
        entries: [
          {
            id: 14,
            name: 'fattura.pdf',
            objectUrl: 'blob:fattura',
            status: 'done',
            invoiceData: {
              data: '2026-05-20',
              numero: '42',
              importoTotale: '1234.50',
              causale: 'Pagamento progetto con descrizione lunga da troncare nella tabella',
              pivaFornitore: '12345678901',
              nomeFornitore: 'Fornitore con denominazione lunga da troncare nella tabella',
              cig: 'A012345678',
            },
            cups: [],
          },
          {
            id: 15,
            name: 'senza-dati.xml',
            status: 'error',
            error: '',
            invoiceData: null,
            cups: [],
          },
        ],
        ...props,
      },
    });

    expect(container.textContent).toContain('2026-05-20');
    expect(container.textContent).toContain('1234,50');
    expect(container.querySelector('a.detail-cell')?.getAttribute('href')).toBe('blob:fattura');
    expect(container.textContent).toContain('Nessun CUP rilevato');
    expect(container.textContent).toContain('Errore');
  });
});
