import { validateCup, isStructurallyPlausible, OUTCOMES } from '../core/validator.js';
import type { CupSource } from '../types.js';

export interface CupCandidate {
  value: string;
  occurrences: number;
  formalValid: boolean;
}

// OCR engines often confuse '1' (one) with 'I' (capital i). Positions 0 and 3
// of a CUP must be letters, so we try the substitution there before giving up.
// Only applied when ocrFix is true (i.e. the text comes from Tesseract).
function ocrVariants(value: string): string[] {
  if (value.length !== 15) return [];
  const variants: string[] = [];
  for (const pos of [0, 3]) {
    if (value[pos] === '1') {
      variants.push(value.slice(0, pos) + 'I' + value.slice(pos + 1));
    }
  }
  return variants;
}

function addCandidate(counts: Map<string, number>, value: string, ocrFix: boolean): void {
  if (isStructurallyPlausible(value, { yearLookahead: 15 })) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return;
  }
  if (ocrFix) {
    for (const v of ocrVariants(value)) {
      if (isStructurallyPlausible(v, { yearLookahead: 15 })) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
  }
}

export function extractCupsFromText(text: string, { ocrFix = false } = {}): CupCandidate[] {
  const normalized = text.toUpperCase();
  const counts = new Map<string, number>();

  // Pass 1: scan for 15-char alphanumeric sequences, keep only structural candidates.
  const scanRegex = /[A-Z0-9]{15}/g;
  let m: RegExpExecArray | null;
  while ((m = scanRegex.exec(normalized)) !== null) {
    addCandidate(counts, m[0], ocrFix);
  }

  // Pass 2: sliding windows of 2-3 adjacent alphanumeric tokens whose
  // concatenation forms a CUP. Handles both line-boundary splits common in
  // SDI-generated PDFs and multi-fragment splits from OCR segmentation.
  const tokens = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    for (let w = 2; w <= 3 && i + w <= tokens.length; w++) {
      const joined = tokens.slice(i, i + w).join('');
      if (joined.length === 15) addCandidate(counts, joined, ocrFix);
    }
  }

  return Array.from(counts.entries()).map(([value, occurrences]) => ({
    value,
    occurrences,
    formalValid: validateCup(value).outcome !== OUTCOMES.INVALID,
  }));
}

export function extractCupsFromPages(
  fileName: string,
  pages: string[],
  source: CupSource,
): { fileName: string; status: 'ok' | 'no_cup'; source: CupSource; cups: CupCandidate[] } {
  const cups = extractCupsFromText(pages.join('\n'), { ocrFix: source === 'ocr' }).filter(
    (c) => c.formalValid,
  );
  return {
    fileName,
    status: cups.length > 0 ? 'ok' : 'no_cup',
    source,
    cups,
  };
}
