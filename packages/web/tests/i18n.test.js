// @vitest-environment jsdom

const englishMessages = {
  'language.label': 'Language',
  'language.it': 'Italian',
  'language.en': 'English',
  'validator.verify': 'Check',
  'error.unsupportedFile': 'Unsupported format. Load a CSV or XLSX file.',
};

vi.mock('../src/i18n/en.json', () => ({ default: englishMessages }));

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LanguageSwitcher from '../src/components/LanguageSwitcher.svelte';
import { i18n, setMessageLoaderForTest } from '../src/i18n/i18n.svelte.js';

describe('i18n', () => {
  beforeEach(async () => {
    cleanup();
    localStorage.clear();
    document.documentElement.lang = '';
    await i18n.setLocale('it');
  });

  it('usa italiano come lingua predefinita', async () => {
    expect(i18n.locale).toBe('it');
    expect(i18n.t('validator.verify')).toBe('Verifica');
    expect(i18n.messages['validator.verify']).toBe('Verifica');
    expect(document.documentElement.lang).toBe('it');
  });

  it('carica inglese dinamicamente e persiste la scelta', async () => {
    const listener = vi.fn();
    window.addEventListener('cup-check:languagechange', listener);

    await i18n.setLocale('en');

    expect(i18n.locale).toBe('en');
    expect(i18n.t('validator.verify')).toBe('Check');
    expect(localStorage.getItem('cup-check:language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { locale: 'en' } }));

    window.removeEventListener('cup-check:languagechange', listener);
  });

  it('ignora locale non supportate e usa fallback per chiavi mancanti', async () => {
    await i18n.setLocale('fr');

    expect(i18n.locale).toBe('it');
    expect(i18n.t('chiave.mancante')).toBe('chiave.mancante');
    expect(i18n.t('validator.completed', { count: 3 })).toBe('Verifica completata: 3 risultati');
  });

  it('traduce gli errori localizzabili al boundary UI', async () => {
    const { LocalizedError } = await import('../src/lib/core/errors.js');

    await i18n.setLocale('en');

    expect(i18n.errorMessage(new LocalizedError('error.unsupportedFile'))).toBe(
      'Unsupported format. Load a CSV or XLSX file.',
    );
  });

  it('gestisce errori non localizzabili e valori sconosciuti', async () => {
    expect(i18n.errorMessage(new Error('boom'))).toBe('boom');
    expect(i18n.errorMessage(null)).toBe('Errore sconosciuto');
  });

  it('lo switcher cambia lingua dal select nativo', async () => {
    render(LanguageSwitcher);
    const select = screen.getByLabelText('Lingua');

    await fireEvent.change(select, { target: { value: 'en' } });

    await waitFor(() => expect(i18n.locale).toBe('en'));
    await waitFor(() => expect(localStorage.getItem('cup-check:language')).toBe('en'));
  });

  it('mantiene locale e messaggi correnti finché la nuova lingua non è pronta', async () => {
    let resolveEnglishMessages = () => {};
    const restoreLoader = setMessageLoaderForTest((locale) => {
      if (locale === 'it') return Promise.resolve(i18n.messages);
      return new Promise((resolve) => {
        resolveEnglishMessages = () => resolve(englishMessages);
      });
    });

    const switchPromise = i18n.setLocale('en');

    expect(i18n.locale).toBe('it');
    expect(i18n.t('validator.verify')).toBe('Verifica');
    expect(i18n.loadingLocale).toBe('en');

    resolveEnglishMessages();
    await switchPromise;

    expect(i18n.locale).toBe('en');
    expect(i18n.t('validator.verify')).toBe('Check');
    expect(i18n.loadingLocale).toBeNull();
    restoreLoader();
  });

  it('disabilita lo switcher mentre carica una nuova lingua', async () => {
    const restoreLoader = setMessageLoaderForTest(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(englishMessages), 10);
        }),
    );

    render(LanguageSwitcher);
    const select = screen.getByLabelText('Lingua');

    i18n.setLocale('en');
    await Promise.resolve();

    expect(select.disabled).toBe(true);
    restoreLoader();
  });
});
