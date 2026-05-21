import { describe, expect, it } from 'vitest';
import {
  addManualCup,
  clearAllEditing,
  cancelCupEdit,
  editCup,
  findCup,
  findEntry,
  removeCup,
  saveCupEdit,
} from '../src/lib/tool-entry-actions.js';

const VALID_CUP = 'G17H03000130001';

function entries() {
  return [
    {
      id: 1,
      name: 'uno.pdf',
      status: 'done',
      cups: [
        {
          id: '1-0',
          value: VALID_CUP,
          source: 'text',
          manual: false,
          editing: true,
        },
      ],
    },
    {
      id: 2,
      name: 'due.pdf',
      status: 'done',
      cups: [
        {
          id: '2-0',
          value: '123',
          source: 'manuale',
          manual: true,
          editing: false,
        },
      ],
    },
  ];
}

describe('tool entry actions', () => {
  it('trova entry e cup o restituisce null per id assenti', () => {
    const list = entries();
    expect(findEntry(list, 1)?.name).toBe('uno.pdf');
    expect(findEntry(list, 99)).toBeNull();
    expect(findCup(list, 1, '1-0')?.value).toBe(VALID_CUP);
    expect(findCup(list, 1, 'missing')).toBeNull();
    expect(findCup(list, 99, '1-0')).toBeNull();
  });

  it('azzera tutte le edit attive', () => {
    const list = entries();
    list[1].cups[0].editing = true;

    clearAllEditing(list);

    expect(list.flatMap((entry) => entry.cups).every((cup) => !cup.editing)).toBe(true);
  });

  it('attiva una sola edit e ignora cup assenti', () => {
    const list = entries();
    editCup(list, 2, '2-0');
    expect(list[0].cups[0].editing).toBe(false);
    expect(list[1].cups[0].editing).toBe(true);

    editCup(list, 2, 'missing');
    expect(list[1].cups[0].editing).toBe(false);
  });

  it('rimuove cup e ignora entry assenti', () => {
    const list = entries();
    removeCup(list, 99, '1-0');
    expect(list[0].cups).toHaveLength(1);
    removeCup(list, 1, '1-0');
    expect(list[0].cups).toEqual([]);
  });

  it('aggiunge cup manuale e ignora entry assenti', () => {
    const list = entries();
    addManualCup(list, 99, '99-m');
    expect(list.flatMap((entry) => entry.cups)).toHaveLength(2);

    addManualCup(list, 1, '1-m');
    expect(list[0].cups.at(-1)).toMatchObject({
      id: '1-m',
      value: '',
      manual: true,
      editing: true,
    });
    expect(list[1].cups[0].editing).toBe(false);
  });

  it('salva edit normalizzando, validando e rimuovendo manuali vuoti', () => {
    const list = entries();
    saveCupEdit(list, 99, 'missing', VALID_CUP);
    saveCupEdit(list, 2, '2-0', VALID_CUP);
    expect(list[1].cups[0].value).toBe('123');

    saveCupEdit(list, 1, '1-0', ' g17h03000130001 ');
    expect(list[0].cups[0]).toMatchObject({
      value: 'G17H03000130001',
      manual: true,
      editing: false,
    });

    list[0].cups[0].editing = true;
    saveCupEdit(list, 1, '1-0', ' g17h03000130001 extra ');
    expect(list[0].cups[0]).toMatchObject({
      value: 'G17H03000130001 EXTRA',
      manual: true,
      editing: false,
    });

    list[1].cups[0].editing = true;
    saveCupEdit(list, 2, '2-0', '   ');
    expect(list[1].cups).toEqual([]);
  });

  it('chiude edit non manuale vuota e annulla edit manuale vuota rimuovendola', () => {
    const list = entries();
    saveCupEdit(list, 1, '1-0', '   ');
    expect(list[0].cups[0].editing).toBe(false);

    cancelCupEdit(list, 99, 'missing');
    cancelCupEdit(list, 2, '2-0');
    expect(list[1].cups[0].editing).toBe(false);

    list[1].cups[0].editing = true;
    list[1].cups[0].value = '';
    cancelCupEdit(list, 2, '2-0');
    expect(list[1].cups).toEqual([]);

    list[0].cups[0].editing = true;
    cancelCupEdit(list, 1, '1-0');
    expect(list[0].cups[0].editing).toBe(false);
  });
});
