// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../src/router.js';

describe('router', () => {
  it('navigate imposta location.hash sul percorso richiesto', () => {
    navigate('#/pdf-extract');
    expect(window.location.hash).toBe('#/pdf-extract');
  });
});

describe('router module (fresh import per test)', () => {
  beforeEach(() => {
    vi.resetModules();
    window.location.hash = '';
  });

  it('register with unmountFn stores the route', async () => {
    const { register, start } = await import('../src/router.js');
    const mountFn = vi.fn();
    const unmountFn = vi.fn();

    register('#/', mountFn, unmountFn);
    window.location.hash = '#/';
    start();

    expect(mountFn).toHaveBeenCalledTimes(1);
  });

  it('register without unmountFn stores null as unmountFn', async () => {
    const { register, start } = await import('../src/router.js');
    const mountFn = vi.fn();

    register('#/', mountFn);
    window.location.hash = '#/';
    start();

    expect(mountFn).toHaveBeenCalledTimes(1);
  });

  it('dispatch navigates to #/ when basePath is not registered', async () => {
    const { register, start } = await import('../src/router.js');
    const homeMountFn = vi.fn();
    register('#/', homeMountFn);

    window.location.hash = '#/unknown';
    start();

    expect(window.location.hash).toBe('#/');
  });

  it('dispatch does not remount when currentPath equals basePath', async () => {
    const { register, start } = await import('../src/router.js');
    const mountFn = vi.fn();
    register('#/', mountFn);

    window.location.hash = '#/';
    start();
    start();

    expect(mountFn).toHaveBeenCalledTimes(1);
  });

  it('calls unmountFn when navigating away from a mounted route', async () => {
    const { register, start } = await import('../src/router.js');
    const unmountFn = vi.fn();
    const mountA = vi.fn();
    const mountB = vi.fn();
    register('#/', mountA, unmountFn);
    register('#/other', mountB);

    window.location.hash = '#/';
    start();

    window.location.hash = '#/other';
    start();

    expect(unmountFn).toHaveBeenCalledTimes(1);
    expect(mountB).toHaveBeenCalledTimes(1);
  });

  it('dispatch uses #/ when location.hash is empty', async () => {
    const { register, start } = await import('../src/router.js');
    const mountFn = vi.fn();
    register('#/', mountFn);

    window.location.hash = '';
    start();

    expect(mountFn).toHaveBeenCalledTimes(1);
  });

  it('dispatch uses #/ as basePath when hash has only query string after split', async () => {
    const { register, navigate, start } = await import('../src/router.js');
    const mountFn = vi.fn();
    register('#/', mountFn);

    navigate('#/?foo=bar');
    start();

    expect(mountFn).toHaveBeenCalledTimes(1);
  });

  it('porta il focus al contenuto principale dopo il cambio rotta', async () => {
    const previousRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
    const main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    document.body.appendChild(main);

    const { register, start } = await import('../src/router.js');
    register('#/', vi.fn());
    window.location.hash = '#/';
    start();

    expect(document.activeElement).toBe(main);

    main.remove();
    window.requestAnimationFrame = previousRaf;
  });
});
