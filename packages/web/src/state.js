const INITIAL_STATE = {
  parsed: null,
  selectedColumnIndex: 0,
  results: [],
  sourceRowCount: 0,
  filter: 'ALL',
  query: '',
  fileName: 'report',
  displayFileName: 'report',
  skipMissingCup: true,
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
