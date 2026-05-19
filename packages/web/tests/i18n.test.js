// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LanguageSwitcher from '../src/components/LanguageSwitcher.svelte';

describe('i18n', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('usa italiano come lingua predefinita', async () => {
    const { i18n } = await import('../src/i18n/i18n.svelte.js');

    expect(i18n.locale).toBe('it');
    expect(i18n.t('validator.verify')).toBe('Verifica');
    expect(i18n.messages['validator.verify']).toBe('Verifica');
    expect(document.documentElement.lang).toBe('it');
  });

  it('carica inglese dinamicamente e persiste la scelta', async () => {
    const { i18n } = await import('../src/i18n/i18n.svelte.js');
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
    const { i18n } = await import('../src/i18n/i18n.svelte.js');

    await i18n.setLocale('fr');

    expect(i18n.locale).toBe('it');
    expect(i18n.t('chiave.mancante')).toBe('chiave.mancante');
    expect(i18n.t('validator.completed', { count: 3 })).toBe('Verifica completata: 3 risultati');
  });

  it('lo switcher cambia lingua dal select nativo', async () => {
    render(LanguageSwitcher);
    const select = screen.getByLabelText('Lingua');

    await fireEvent.change(select, { target: { value: 'en' } });

    const { i18n } = await import('../src/i18n/i18n.svelte.js');
    expect(i18n.locale).toBe('en');
    expect(localStorage.getItem('cup-check:language')).toBe('en');
  });
});
