// @ts-nocheck
import { describe, expect, it } from 'vitest';
import enMessages from '../src/i18n/en.json';
import itMessages from '../src/i18n/it.json';
import { OUTCOMES, RULES, WARNINGS } from '../src/lib/core/validator.js';

const locales = [
  ['it', itMessages],
  ['en', enMessages],
];

describe('i18n message keys', () => {
  it('mantiene allineate le chiavi tra tutti i locale', () => {
    const expectedKeys = Object.keys(itMessages).sort();

    for (const [locale, messages] of locales) {
      expect(Object.keys(messages).sort(), locale).toEqual(expectedKeys);
    }
  });

  it('copre rule, outcome e warning derivati dai codici del validatore', () => {
    const requiredKeys = [
      ...Object.values(RULES).map((code) => `rules.${code}`),
      ...Object.values(OUTCOMES).map((code) => `outcomes.${code}`),
      ...Object.values(WARNINGS).flatMap((code) => [
        `warnings.${code}.title`,
        `warnings.${code}.description`,
      ]),
    ];

    for (const [locale, messages] of locales) {
      for (const key of requiredKeys) {
        expect(messages, `${locale} missing ${key}`).toHaveProperty(key);
        expect(messages[key], `${locale} ${key}`).toEqual(expect.any(String));
        expect(messages[key], `${locale} ${key}`).not.toHaveLength(0);
      }
    }
  });
});
