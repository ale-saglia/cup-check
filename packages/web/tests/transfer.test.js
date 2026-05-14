import { describe, expect, it } from 'vitest';
import { consumeTransfer, storeTransfer } from '../src/transfer.js';

describe('transfer registry', () => {
  it('restituisce un id e recupera il file con consume', () => {
    const file = new File([''], 'test.csv');
    const id = storeTransfer(file);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(consumeTransfer(id)).toBe(file);
  });

  it('consume rimuove il file dal registry (non recuperabile due volte)', () => {
    const id = storeTransfer(new File([''], 'a.csv'));
    consumeTransfer(id);
    expect(consumeTransfer(id)).toBeNull();
  });

  it('restituisce null per un id inesistente', () => {
    expect(consumeTransfer('id-inesistente')).toBeNull();
  });

  it('gestisce più file indipendenti con id distinti', () => {
    const f1 = new File([''], '1.csv');
    const f2 = new File([''], '2.csv');
    const id1 = storeTransfer(f1);
    const id2 = storeTransfer(f2);
    expect(id1).not.toBe(id2);
    expect(consumeTransfer(id2)).toBe(f2);
    expect(consumeTransfer(id1)).toBe(f1);
  });
});
