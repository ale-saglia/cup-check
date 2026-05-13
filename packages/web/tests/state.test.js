import { describe, expect, it } from 'vitest';
import { resetState, state } from '../src/state.js';

describe('state', () => {
  it('resets mutable state to fresh defaults', () => {
    state.results.push({ normalizedValue: 'A12B23000000001' });
    state.fileName = 'custom';
    state.groupSameCups = false;

    resetState();

    expect(state).toMatchObject({
      parsed: null,
      selectedColumnIndex: 0,
      results: [],
      sourceRowCount: 0,
      durationMs: 0,
      filter: 'ALL',
      query: '',
      fileName: 'report',
      displayFileName: 'report',
      selectedSheetName: '',
      skipMissingCup: true,
      groupSameCups: true,
    });
    expect(state.results).not.toBe(resetState.results);
  });
});
