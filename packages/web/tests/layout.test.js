// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { i18n } from '../src/i18n/i18n.svelte.js';
import { mountLayout } from '../src/layout.js';

describe('layout', () => {
  let root;
  let menu;
  let menuList;

  beforeAll(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    mountLayout(root);
    menu = root.querySelector('.nav-menu');
    menuList = root.querySelector('.nav-menu-list');
  });

  afterAll(() => {
    document.body.removeChild(root);
  });

  it('monta skip link e main focusabile per la navigazione da tastiera', () => {
    const skipLink = root.querySelector('.skip-link');
    const main = root.querySelector('#main-content');

    expect(skipLink?.textContent).toBe('Salta al contenuto');
    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });

  it('chiude il menu e rimette il focus sul toggle alla pressione di Escape', () => {
    menu.open = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.open).toBe(false);
  });

  it('non fa nulla con Escape se il menu è già chiuso', () => {
    menu.open = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.open).toBe(false);
  });

  it('chiude il menu quando si fa click su una voce della lista', () => {
    menu.open = true;
    menuList.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.open).toBe(false);
  });

  it('sposta il focus alla voce successiva con ArrowDown', () => {
    const items = [...menuList.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    items[0]?.focus();
    menuList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1 % items.length]);
  });

  it('sposta il focus alla voce precedente con ArrowUp', () => {
    const items = [...menuList.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    items[0]?.focus();
    menuList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items[(items.length - 1) % items.length]);
  });

  it('chiude il menu al click fuori dal menu quando è aperto', () => {
    menu.open = true;
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.open).toBe(false);
  });

  it('non chiude il menu al click fuori se era già chiuso', () => {
    menu.open = false;
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.open).toBe(false);
  });

  it('aggiorna header, footer e menu al cambio lingua', async () => {
    await i18n.setLocale('en');

    expect(root.querySelector('.brand')?.textContent).toBe('CUP Check');
    expect(root.querySelector('.nav-menu-toggle')?.textContent).toBe('Tools');
    expect(root.querySelector('.nav-menu-list')?.textContent).toContain(
      'Fetch CUP from PDF invoices',
    );
    expect(root.querySelector('.site-footer')?.textContent).toContain('Built by');
    expect(root.querySelector('.site-footer')?.textContent).toContain('Source code and license');

    await i18n.setLocale('it');
  });

  it('ignora keydown con altri tasti sulla lista', () => {
    const items = [...menuList.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    items[0]?.focus();
    const before = document.activeElement;
    menuList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.activeElement).toBe(before);
  });
});

describe('layout: escaping voci menu', () => {
  it("label e path delle voci vengono escaped prima di essere inseriti nell'HTML", async () => {
    vi.resetModules();
    vi.doMock('../src/tools-registry.js', () => ({
      tools: [
        { id: 'xss', label: '<script>alert(1)</script>', path: '"><img src=x>', enabled: true },
      ],
    }));
    vi.doMock('../src/version.js', () => ({ PRODUCT_VERSION: 'test' }));

    const { mountLayout: mountFresh } = await import('../src/layout.js');
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountFresh(root);

    const html = root.querySelector('.nav-menu-list').innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('"><img');

    document.body.removeChild(root);
    vi.resetModules();
  });
});
