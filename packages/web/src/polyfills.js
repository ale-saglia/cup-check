export function applyPromisePolyfills() {
  if (typeof Promise.withResolvers === 'undefined') {
    Promise.withResolvers = function () {
      var resolve, reject;
      var promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject };
    };
  }
  if (typeof Promise.try === 'undefined') {
    Promise.try = function (fn) {
      var args = Array.prototype.slice.call(arguments, 1);
      return new Promise(function (resolve) {
        resolve(fn.apply(undefined, args));
      });
    };
  }
}

export function applyMapPolyfills() {
  if (typeof Map.prototype.getOrInsertComputed === 'undefined') {
    Map.prototype.getOrInsertComputed = function (key, callbackFn) {
      if (this.has(key)) {
        return this.get(key);
      }
      var value = callbackFn(key);
      this.set(key, value);
      return value;
    };
  }
}

export function applyReadableStreamPolyfills() {
  if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
    ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
      const reader = this.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    };
  }
}

export function applyAllPolyfills() {
  applyPromisePolyfills();
  applyMapPolyfills();
  applyReadableStreamPolyfills();
  applyUint8ArrayPolyfills();
}

export function applyUint8ArrayPolyfills() {
  if (typeof Uint8Array.prototype.toHex === 'undefined') {
    Uint8Array.prototype.toHex = function () {
      var result = '';
      for (var i = 0; i < this.length; i++) {
        result += this[i].toString(16).padStart(2, '0');
      }
      return result;
    };
  }
  if (typeof Uint8Array.prototype.toBase64 === 'undefined') {
    Uint8Array.prototype.toBase64 = function (options) {
      var omitPadding = options && options.omitPadding === true;
      var useUrlAlphabet = options && options.alphabet === 'base64url';
      var binaryStr = '';
      for (var i = 0; i < this.length; i++) {
        binaryStr += String.fromCharCode(this[i]);
      }
      var result = btoa(binaryStr);
      if (useUrlAlphabet) {
        result = result.replace(/\+/g, '-').replace(/\//g, '_');
      }
      if (omitPadding) {
        result = result.replace(/=+$/, '');
      }
      return result;
    };
  }
  if (typeof Uint8Array.fromBase64 === 'undefined') {
    Uint8Array.fromBase64 = function (string, options) {
      var useUrlAlphabet = options && options.alphabet === 'base64url';
      var s = useUrlAlphabet ? string.replace(/-/g, '+').replace(/_/g, '/') : string;
      while (s.length % 4 !== 0) {
        s += '=';
      }
      var binaryStr = atob(s);
      var bytes = new Uint8Array(binaryStr.length);
      for (var i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return bytes;
    };
  }
}
