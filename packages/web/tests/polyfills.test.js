import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAllPolyfills,
  applyMapPolyfills,
  applyPromisePolyfills,
  applyReadableStreamPolyfills,
  applyUint8ArrayPolyfills,
} from '../src/polyfills.js';

describe('Promise polyfills', () => {
  let originalWithResolvers;
  let originalTry;

  beforeEach(() => {
    originalWithResolvers = Promise.withResolvers;
    originalTry = Promise.try;
  });

  afterEach(() => {
    Promise.withResolvers = originalWithResolvers;
    Promise.try = originalTry;
  });

  describe('Promise.withResolvers', () => {
    it('non sostituisce se già presente', () => {
      const sentinel = () => {};
      Promise.withResolvers = sentinel;
      applyPromisePolyfills();
      expect(Promise.withResolvers).toBe(sentinel);
    });

    it('viene applicato se assente', () => {
      delete Promise.withResolvers;
      applyPromisePolyfills();
      expect(typeof Promise.withResolvers).toBe('function');
    });

    it('restituisce promise, resolve e reject', () => {
      delete Promise.withResolvers;
      applyPromisePolyfills();
      const { promise, resolve, reject } = Promise.withResolvers();
      expect(promise).toBeInstanceOf(Promise);
      expect(typeof resolve).toBe('function');
      expect(typeof reject).toBe('function');
    });

    it('resolve porta la promise a risoluzione', async () => {
      delete Promise.withResolvers;
      applyPromisePolyfills();
      const { promise, resolve } = Promise.withResolvers();
      resolve(42);
      await expect(promise).resolves.toBe(42);
    });

    it('reject porta la promise a rigetto', async () => {
      delete Promise.withResolvers;
      applyPromisePolyfills();
      const { promise, reject } = Promise.withResolvers();
      reject(new Error('errore'));
      await expect(promise).rejects.toThrow('errore');
    });
  });

  describe('Promise.try', () => {
    it('non sostituisce se già presente', () => {
      const sentinel = () => {};
      Promise.try = sentinel;
      applyPromisePolyfills();
      expect(Promise.try).toBe(sentinel);
    });

    it('viene applicato se assente', () => {
      delete Promise.try;
      applyPromisePolyfills();
      expect(typeof Promise.try).toBe('function');
    });

    it('risolve con il valore restituito dalla funzione', async () => {
      delete Promise.try;
      applyPromisePolyfills();
      await expect(Promise.try(() => 42)).resolves.toBe(42);
    });

    it('rigetta se la funzione lancia un errore', async () => {
      delete Promise.try;
      applyPromisePolyfills();
      await expect(
        Promise.try(() => {
          throw new Error('errore');
        }),
      ).rejects.toThrow('errore');
    });

    it('risolve con una promise restituita dalla funzione', async () => {
      delete Promise.try;
      applyPromisePolyfills();
      await expect(Promise.try(() => Promise.resolve(99))).resolves.toBe(99);
    });

    it('passa gli argomenti extra alla funzione', async () => {
      delete Promise.try;
      applyPromisePolyfills();
      await expect(Promise.try((a, b) => a + b, 3, 4)).resolves.toBe(7);
    });
  });
});

describe('Map polyfills', () => {
  let originalGetOrInsertComputed;

  beforeEach(() => {
    originalGetOrInsertComputed = Map.prototype.getOrInsertComputed;
  });

  afterEach(() => {
    Map.prototype.getOrInsertComputed = originalGetOrInsertComputed;
  });

  it('non sostituisce se già presente', () => {
    const sentinel = () => {};
    Map.prototype.getOrInsertComputed = sentinel;
    applyMapPolyfills();
    expect(Map.prototype.getOrInsertComputed).toBe(sentinel);
  });

  it('viene applicato se assente', () => {
    delete Map.prototype.getOrInsertComputed;
    applyMapPolyfills();
    expect(typeof Map.prototype.getOrInsertComputed).toBe('function');
  });

  it('restituisce il valore esistente senza chiamare la callback', () => {
    delete Map.prototype.getOrInsertComputed;
    applyMapPolyfills();
    const map = new Map([['a', 1]]);
    const cb = vi.fn(() => 99);
    expect(map.getOrInsertComputed('a', cb)).toBe(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('inserisce e restituisce il valore calcolato se la chiave è assente', () => {
    delete Map.prototype.getOrInsertComputed;
    applyMapPolyfills();
    const map = new Map();
    expect(map.getOrInsertComputed('b', (k) => k + '!')).toBe('b!');
    expect(map.get('b')).toBe('b!');
  });
});

describe('ReadableStream polyfills', () => {
  let originalAsyncIterator;

  beforeEach(() => {
    originalAsyncIterator =
      typeof ReadableStream !== 'undefined'
        ? ReadableStream.prototype[Symbol.asyncIterator]
        : undefined;
  });

  afterEach(() => {
    if (typeof ReadableStream !== 'undefined') {
      ReadableStream.prototype[Symbol.asyncIterator] = originalAsyncIterator;
    }
  });

  it('non fa nulla se ReadableStream non è disponibile', () => {
    const original = globalThis.ReadableStream;
    globalThis.ReadableStream = undefined;
    expect(() => applyReadableStreamPolyfills()).not.toThrow();
    globalThis.ReadableStream = original;
  });

  it('non sostituisce se Symbol.asyncIterator già presente', () => {
    if (typeof ReadableStream === 'undefined') return;
    const sentinel = () => {};
    ReadableStream.prototype[Symbol.asyncIterator] = sentinel;
    applyReadableStreamPolyfills();
    expect(ReadableStream.prototype[Symbol.asyncIterator]).toBe(sentinel);
  });

  it('viene applicato se assente', () => {
    if (typeof ReadableStream === 'undefined') return;
    delete ReadableStream.prototype[Symbol.asyncIterator];
    applyReadableStreamPolyfills();
    expect(typeof ReadableStream.prototype[Symbol.asyncIterator]).toBe('function');
  });

  it('itera tutti i chunk di uno stream', async () => {
    if (typeof ReadableStream === 'undefined') return;
    delete ReadableStream.prototype[Symbol.asyncIterator];
    applyReadableStreamPolyfills();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.close();
      },
    });
    const chunks = [];
    for await (const value of stream) {
      chunks.push(value);
    }
    expect(chunks).toEqual([1, 2, 3]);
  });

  it('rilascia il reader anche in caso di errore', async () => {
    if (typeof ReadableStream === 'undefined') return;
    delete ReadableStream.prototype[Symbol.asyncIterator];
    applyReadableStreamPolyfills();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('a');
        controller.close();
      },
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of stream) {
        throw new Error('stop');
      }
    } catch {
      // atteso
    }
    expect(() => stream.getReader()).not.toThrow();
  });
});

describe('Uint8Array polyfills', () => {
  let originalToHex;
  let originalToBase64;
  let originalFromBase64;

  beforeEach(() => {
    originalToHex = Uint8Array.prototype.toHex;
    originalToBase64 = Uint8Array.prototype.toBase64;
    originalFromBase64 = Uint8Array.fromBase64;
  });

  afterEach(() => {
    Uint8Array.prototype.toHex = originalToHex;
    Uint8Array.prototype.toBase64 = originalToBase64;
    Uint8Array.fromBase64 = originalFromBase64;
  });

  describe('Uint8Array.prototype.toHex', () => {
    it('non sostituisce se già presente', () => {
      const sentinel = () => {};
      Uint8Array.prototype.toHex = sentinel;
      applyUint8ArrayPolyfills();
      expect(Uint8Array.prototype.toHex).toBe(sentinel);
    });

    it('viene applicato se assente', () => {
      delete Uint8Array.prototype.toHex;
      applyUint8ArrayPolyfills();
      expect(typeof Uint8Array.prototype.toHex).toBe('function');
    });

    it('converte bytes in stringa esadecimale minuscola', () => {
      delete Uint8Array.prototype.toHex;
      applyUint8ArrayPolyfills();
      expect(new Uint8Array([0, 1, 15, 16, 255]).toHex()).toBe('00010f10ff');
    });

    it('restituisce stringa vuota per array vuoto', () => {
      delete Uint8Array.prototype.toHex;
      applyUint8ArrayPolyfills();
      expect(new Uint8Array([]).toHex()).toBe('');
    });
  });

  describe('Uint8Array.prototype.toBase64', () => {
    it('non sostituisce se già presente', () => {
      const sentinel = () => {};
      Uint8Array.prototype.toBase64 = sentinel;
      applyUint8ArrayPolyfills();
      expect(Uint8Array.prototype.toBase64).toBe(sentinel);
    });

    it('viene applicato se assente', () => {
      delete Uint8Array.prototype.toBase64;
      applyUint8ArrayPolyfills();
      expect(typeof Uint8Array.prototype.toBase64).toBe('function');
    });

    it('codifica in base64 standard', () => {
      delete Uint8Array.prototype.toBase64;
      applyUint8ArrayPolyfills();
      expect(new Uint8Array([72, 101, 108, 108, 111]).toBase64()).toBe('SGVsbG8=');
    });

    it('usa alfabeto base64url', () => {
      delete Uint8Array.prototype.toBase64;
      applyUint8ArrayPolyfills();
      const bytes = new Uint8Array([251, 255, 190]);
      expect(bytes.toBase64({ alphabet: 'base64url' })).toBe('-_--');
    });

    it('omette il padding se richiesto', () => {
      delete Uint8Array.prototype.toBase64;
      applyUint8ArrayPolyfills();
      expect(new Uint8Array([72, 101, 108, 108, 111]).toBase64({ omitPadding: true })).toBe(
        'SGVsbG8',
      );
    });
  });

  describe('Uint8Array.fromBase64', () => {
    it('non sostituisce se già presente', () => {
      const sentinel = () => {};
      Uint8Array.fromBase64 = sentinel;
      applyUint8ArrayPolyfills();
      expect(Uint8Array.fromBase64).toBe(sentinel);
    });

    it('viene applicato se assente', () => {
      delete Uint8Array.fromBase64;
      applyUint8ArrayPolyfills();
      expect(typeof Uint8Array.fromBase64).toBe('function');
    });

    it('decodifica stringa base64 standard', () => {
      delete Uint8Array.fromBase64;
      applyUint8ArrayPolyfills();
      expect(Uint8Array.fromBase64('SGVsbG8=')).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('decodifica stringa base64url', () => {
      delete Uint8Array.fromBase64;
      applyUint8ArrayPolyfills();
      expect(Uint8Array.fromBase64('-_--', { alphabet: 'base64url' })).toEqual(
        new Uint8Array([251, 255, 190]),
      );
    });

    it('decodifica stringa base64 senza padding', () => {
      delete Uint8Array.fromBase64;
      applyUint8ArrayPolyfills();
      expect(Uint8Array.fromBase64('SGVsbG8')).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('toBase64 e fromBase64 sono inversi', () => {
      delete Uint8Array.prototype.toBase64;
      delete Uint8Array.fromBase64;
      applyUint8ArrayPolyfills();
      const original = new Uint8Array([1, 2, 3, 100, 200, 255]);
      expect(Uint8Array.fromBase64(original.toBase64())).toEqual(original);
    });
  });
});

describe('polyfills build regression', () => {
  const webDir = resolve(fileURLToPath(import.meta.url), '../..');

  function buildPolyfillsScript() {
    const src = readFileSync(resolve(webDir, 'src/polyfills.js'), 'utf8');
    const bare = src.replace(/^export\s+/gm, '');
    return `(function(){\n${bare}\napplyAllPolyfills();\n})();`;
  }

  it('la trasformazione export→IIFE produce JS sintatticamente valido', () => {
    expect(() => new Function(buildPolyfillsScript())).not.toThrow();
  });

  it('applyAllPolyfills chiama tutti i gruppi apply* esportati', () => {
    const src = readFileSync(resolve(webDir, 'src/polyfills.js'), 'utf8');
    const groups = [...src.matchAll(/^export function (apply\w+)\(/gm)]
      .map((m) => m[1])
      .filter((n) => n !== 'applyAllPolyfills');
    const bodyMatch = src.match(/function applyAllPolyfills\(\)\s*\{([^}]*)\}/);
    const body = bodyMatch?.[1] ?? '';
    for (const fn of groups) {
      expect(body, `${fn} mancante da applyAllPolyfills()`).toContain(`${fn}()`);
    }
  });

  describe('IIFE generato su contesto legacy', () => {
    let saved;

    beforeEach(() => {
      saved = {
        withResolvers: Promise.withResolvers,
        try: Promise.try,
        getOrInsertComputed: Map.prototype.getOrInsertComputed,
        toHex: Uint8Array.prototype.toHex,
        toBase64: Uint8Array.prototype.toBase64,
        fromBase64: Uint8Array.fromBase64,
      };
      delete Promise.withResolvers;
      delete Promise.try;
      delete Map.prototype.getOrInsertComputed;
      delete Uint8Array.prototype.toHex;
      delete Uint8Array.prototype.toBase64;
      delete Uint8Array.fromBase64;
    });

    afterEach(() => {
      Promise.withResolvers = saved.withResolvers;
      Promise.try = saved.try;
      Map.prototype.getOrInsertComputed = saved.getOrInsertComputed;
      Uint8Array.prototype.toHex = saved.toHex;
      Uint8Array.prototype.toBase64 = saved.toBase64;
      Uint8Array.fromBase64 = saved.fromBase64;
    });

    it('si esegue senza errori', () => {
      expect(() => new Function(buildPolyfillsScript())()).not.toThrow();
    });

    it('applica gli stessi polyfill del modulo', () => {
      new Function(buildPolyfillsScript())();
      expect(typeof Promise.withResolvers).toBe('function');
      expect(typeof Promise.try).toBe('function');
      expect(typeof Map.prototype.getOrInsertComputed).toBe('function');
      expect(typeof Uint8Array.prototype.toHex).toBe('function');
      expect(typeof Uint8Array.prototype.toBase64).toBe('function');
      expect(typeof Uint8Array.fromBase64).toBe('function');
    });
  });
});

describe('applyAllPolyfills', () => {
  let saved;

  beforeEach(() => {
    saved = {
      withResolvers: Promise.withResolvers,
      try: Promise.try,
      getOrInsertComputed: Map.prototype.getOrInsertComputed,
      toHex: Uint8Array.prototype.toHex,
      toBase64: Uint8Array.prototype.toBase64,
      fromBase64: Uint8Array.fromBase64,
    };
    delete Promise.withResolvers;
    delete Promise.try;
    delete Map.prototype.getOrInsertComputed;
    delete Uint8Array.prototype.toHex;
    delete Uint8Array.prototype.toBase64;
    delete Uint8Array.fromBase64;
  });

  afterEach(() => {
    Promise.withResolvers = saved.withResolvers;
    Promise.try = saved.try;
    Map.prototype.getOrInsertComputed = saved.getOrInsertComputed;
    Uint8Array.prototype.toHex = saved.toHex;
    Uint8Array.prototype.toBase64 = saved.toBase64;
    Uint8Array.fromBase64 = saved.fromBase64;
  });

  it('applica tutti i polyfill in una sola chiamata', () => {
    applyAllPolyfills();
    expect(typeof Promise.withResolvers).toBe('function');
    expect(typeof Promise.try).toBe('function');
    expect(typeof Map.prototype.getOrInsertComputed).toBe('function');
    expect(typeof Uint8Array.prototype.toHex).toBe('function');
    expect(typeof Uint8Array.prototype.toBase64).toBe('function');
    expect(typeof Uint8Array.fromBase64).toBe('function');
  });
});
