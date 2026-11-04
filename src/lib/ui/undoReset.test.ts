import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBeforeReset, undoPageReset } from './undoReset';

// A tiny browser: an address, the app's storage and the tab's session storage.
let url: URL;
let local: Map<string, string>;
let session: Map<string, string>;
const storage = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => m.set(k, v),
  removeItem: (k: string) => m.delete(k),
});
beforeEach(() => {
  url = new URL('https://x.test/app/?currencies=EUR,RON,PLN&fold=fees#x');
  local = new Map([['ft.columns', '["EUR","RON","PLN"]'], ['ft.lang', '"en"'], ['ft-version', '1.0.0']]);
  session = new Map();
  const ls = storage(local);
  vi.stubGlobal('localStorage', new Proxy(ls, { ownKeys: () => [...local.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }));
  vi.stubGlobal('sessionStorage', storage(session));
  vi.stubGlobal('location', {
    get search() { return url.search; },
    get pathname() { return url.pathname; },
    get hash() { return url.hash; },
    replace: (next: string) => { url = new URL(next, url); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('undoing "Reset tab"', () => {
  it('puts back the settings and the address as they were', () => {
    saveBeforeReset();
    // What "Reset tab" does: the page's settings and parameters go.
    local.delete('ft.columns');
    url = new URL('https://x.test/app/#x');
    undoPageReset();
    expect(local.get('ft.columns')).toBe('["EUR","RON","PLN"]');
    expect(local.get('ft.lang')).toBe('"en"');
    expect(url.search).toBe('?currencies=EUR,RON,PLN&fold=fees');
    expect(url.hash).toBe('#x');
  });

  it('leaves keys that are not settings alone, and works only once', () => {
    saveBeforeReset();
    local.set('ft-version', '1.1.0');
    undoPageReset();
    expect(local.get('ft-version')).toBe('1.1.0');
    url = new URL('https://x.test/app/');
    undoPageReset();
    expect(url.search).toBe('');
  });

  it('without a saved state it does nothing', () => {
    undoPageReset();
    expect(url.search).toBe('?currencies=EUR,RON,PLN&fold=fees');
  });
});
