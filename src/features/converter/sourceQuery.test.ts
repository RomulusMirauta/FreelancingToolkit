import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushQuery } from '../../lib/ui/query';
import { droppedParams } from '../../lib/ui/urlQuery';
import { applySourceQuery } from './sourceQuery';

// A tiny browser: an address that history.replaceState changes, and the app's storage with an amount and an
// income of its own.
const SOURCE = '{"period":"hour","currency":"EUR","amount":45}';
const INCOME = '{"amount":12000,"per":"month","currency":"EUR"}';
const DEFAULT_SOURCE = { amount: 30, currency: 'EUR', period: 'hour' } as const;
let url: URL;
let store: Map<string, string>;
beforeEach(() => {
  store = new Map([['ft.source', SOURCE], ['ft.taxIncome', INCOME]]);
  vi.stubGlobal('location', {
    get href() { return url.href; },
    get search() { return url.search; },
    get hash() { return url.hash; },
  });
  vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { url = new URL(next, url); } });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});
afterEach(() => {
  flushQuery();
  vi.unstubAllGlobals();
});

describe('the converter\'s amount in the address', () => {
  for (const amount of ['', '%20']) {
    it(`an empty amount (?amount=${amount}) is dropped, not read as 0`, () => {
      url = new URL(`https://x.test/app/?amount=${amount}&currency=EUR&per=hour`);
      const before = droppedParams().length;
      applySourceQuery(DEFAULT_SOURCE);
      expect(droppedParams().slice(before)).toEqual(['amount', 'currency', 'per']);
      expect(store.get('ft.source')).toBe(SOURCE);
      expect(store.get('ft.taxIncome')).toBe(INCOME);
      flushQuery();
      expect(url.search).toBe('?amount=45&currency=EUR&per=hour');
    });
  }

  it('an amount is read as before, and the tax income follows it', () => {
    url = new URL('https://x.test/app/?amount=40&currency=eur&per=hour');
    const before = droppedParams().length;
    applySourceQuery(DEFAULT_SOURCE);
    expect(droppedParams().length).toBe(before);
    expect(JSON.parse(store.get('ft.source')!)).toEqual({ period: 'hour', currency: 'EUR', amount: 40 });
    expect(store.get('ft.taxIncome')).not.toBe(INCOME);
  });
});
