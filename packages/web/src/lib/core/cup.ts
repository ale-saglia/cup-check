import type { Cup } from '../types.js';
import { OUTCOMES, validateCup } from './validator.js';

export function isFormallyValid(cup: Pick<Cup, 'value'>): boolean {
  return validateCup(cup.value).outcome !== OUTCOMES.INVALID;
}
