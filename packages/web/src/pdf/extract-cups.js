import { validateCup, OUTCOMES } from '../validator.js';

// Year 9999 disables the time-dependent part of R4 (year ≤ current year)
// while still requiring positions 4-5 to be two digits, matching the full
// structural spec of the validator.
const SEARCH_YEAR = { currentYear: 9999 };

function isStructuralCandidate(value) {
  return validateCup(value, null, SEARCH_YEAR).failedRules.length === 0;
}

export function extractCupsFromText(text) {
  const normalized = text.toUpperCase();
  const counts = new Map();

  // Pass 1: scan for 15-char alphanumeric sequences, keep only structural candidates.
  const scanRegex = /[A-Z0-9]{15}/g;
  let m;
  while ((m = scanRegex.exec(normalized)) !== null) {
    if (isStructuralCandidate(m[0])) {
      counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
    }
  }

  // Pass 2: adjacent alphanumeric tokens whose concatenation forms a CUP.
  // PDFs produced by SDI sometimes break a code at a line boundary.
  const tokens = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    const joined = tokens[i] + tokens[i + 1];
    if (joined.length === 15 && isStructuralCandidate(joined)) {
      counts.set(joined, (counts.get(joined) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([value, occurrences]) => ({
    value,
    occurrences,
    formalValid: validateCup(value).outcome !== OUTCOMES.INVALID,
  }));
}

export function extractCupsFromPages(fileName, pages, source) {
  const cups = extractCupsFromText(pages.join('\n'));
  return {
    fileName,
    status: cups.length > 0 ? 'ok' : 'no_cup',
    source,
    cups,
  };
}
