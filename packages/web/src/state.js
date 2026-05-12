const INITIAL_STATE = {
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
};

export const state = createInitialState();

export function resetState() {
  Object.assign(state, createInitialState());
}

function createInitialState() {
  return {
    ...INITIAL_STATE,
    results: [],
  };
}
