import type { Cup, Entry } from './types.js';
import { normalizeCup } from './core/validator.js';

export function findEntry(entries: Entry[], entryId: number): Entry | null {
  return entries.find((entry) => entry.id === entryId) ?? null;
}

export function findCup(entries: Entry[], entryId: number, cupId: string): Cup | null {
  return findEntry(entries, entryId)?.cups.find((cup) => cup.id === cupId) ?? null;
}

export function clearAllEditing(entries: Entry[]): void {
  entries.forEach((entry) => entry.cups.forEach((cup) => { cup.editing = false; }));
}

export function editCup(entries: Entry[], entryId: number, cupId: string): void {
  clearAllEditing(entries);
  const cup = findCup(entries, entryId, cupId);
  if (cup) cup.editing = true;
}

export function removeCup(entries: Entry[], entryId: number, cupId: string): void {
  const entry = findEntry(entries, entryId);
  if (entry) entry.cups = entry.cups.filter((cup) => cup.id !== cupId);
}

export function addManualCup(entries: Entry[], entryId: number, cupId: string): void {
  const entry = findEntry(entries, entryId);
  if (!entry) return;
  clearAllEditing(entries);
  entry.cups.push({
    id: cupId,
    value: '',
    source: 'manuale',
    manual: true,
    editing: true,
  });
}

export function saveCupEdit(
  entries: Entry[],
  entryId: number,
  cupId: string,
  rawValue: string,
): void {
  const cup = findCup(entries, entryId, cupId);
  if (!cup || !cup.editing) return;
  const entry = findEntry(entries, entryId)!;
  const normalized = normalizeCup(rawValue);
  if (normalized === '' && cup.manual) {
    entry.cups = entry.cups.filter((candidate) => candidate.id !== cupId);
  } else if (normalized.length > 0) {
    cup.value = normalized;
    cup.manual = true;
    cup.editing = false;
  } else {
    cup.editing = false;
  }
}

export function cancelCupEdit(entries: Entry[], entryId: number, cupId: string): void {
  const cup = findCup(entries, entryId, cupId);
  if (!cup || !cup.editing) return;
  const entry = findEntry(entries, entryId)!;
  if (cup.value === '' && cup.manual) {
    entry.cups = entry.cups.filter((candidate) => candidate.id !== cupId);
  } else {
    cup.editing = false;
  }
}
