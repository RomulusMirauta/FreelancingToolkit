import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUrlQuery, numberParam, writeUrlQuery, type UrlQuery } from './urlQuery';

// A tiny browser: an address that history.replaceState changes, and a storage map.
let url: URL;
let store: Map<string, string>;
beforeEach(() => {
  url = new URL('https://x.test/app/');
  store = new Map();
  vi.stubGlobal('location', {
    get search() { return url.search; },
    get pathname() { return url.pathname; },
    get hash() { return url.hash; },
  });
  vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { url = new URL(next, url); } });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

interface Pay { amount: number; per: string }
const PAY: UrlQuery<Pay> = {
  key: 'ft.pay',
  names: ['pay', 'pay_per'],
  toParams: (v) => [String(v.amount), v.per],
  fromParams: ([a, per]) => { const n = numberParam(a!); return n === null ? null : { amount: n, per }; },
  isValid: (v): v is Pay => typeof v === 'object' && v !== null && typeof (v as Pay).amount === 'number' && ['month', 'year'].includes((v as Pay).per),
  defaults: { amount: 100, per: 'month' },
};

interface Two { a: number; b: number; note: string }
const TWO: UrlQuery<Two> = {
  key: 'ft.two',
  names: ['a', 'b'],
  toParams: (v) => [String(v.a), String(v.b)],
  fromParams: ([a, b], saved) => ({ note: (saved as Two | null)?.note ?? '', a: numberParam(a!), b: numberParam(b!) }),
  isValid: (v): v is Two => typeof (v as Two).a === 'number' && typeof (v as Two).b === 'number',
  defaults: { a: 0, b: 0, note: '' },
  sparse: true,
};

describe('amounts in the address', () => {
  it('writes a changed value and removes the default', () => {
    writeUrlQuery(PAY, { amount: 250.5, per: 'year' });
    expect(url.search).toBe('?pay=250.5&pay_per=year');
    writeUrlQuery(PAY, { amount: 100, per: 'month' });
    expect(url.search).toBe('');
  });

  it('keeps other parameters and the hash', () => {
    url = new URL('https://x.test/app/?fold=fees#taxes');
    writeUrlQuery(PAY, { amount: 5, per: 'month' });
    expect(url.search).toBe('?fold=fees&pay=5&pay_per=month');
    expect(url.hash).toBe('#taxes');
  });

  it('an address value wins over the saved one and is saved', () => {
    store.set('ft.pay', JSON.stringify({ amount: 7, per: 'month' }));
    url = new URL('https://x.test/app/?pay=300&pay_per=year');
    applyUrlQuery(PAY);
    expect(JSON.parse(store.get('ft.pay')!)).toEqual({ amount: 300, per: 'year' });
  });

  it('a default value in the address clears the saved one', () => {
    store.set('ft.pay', JSON.stringify({ amount: 7, per: 'month' }));
    url = new URL('https://x.test/app/?pay=100&pay_per=month');
    applyUrlQuery(PAY);
    expect(store.has('ft.pay')).toBe(false);
  });

  it('a broken value is dropped from the address, and the saved one shown instead', () => {
    store.set('ft.pay', JSON.stringify({ amount: 7, per: 'month' }));
    url = new URL('https://x.test/app/?pay=abc&pay_per=year&fold=x');
    applyUrlQuery(PAY);
    expect(url.search).toBe('?fold=x&pay=7&pay_per=month');
    expect(JSON.parse(store.get('ft.pay')!)).toEqual({ amount: 7, per: 'month' });
  });

  it('half a value (one parameter missing) is not used', () => {
    url = new URL('https://x.test/app/?pay=300');
    applyUrlQuery(PAY);
    expect(store.has('ft.pay')).toBe(false);
    expect(url.search).toBe('');
  });

  it('without an address value, a saved one is written into the address', () => {
    store.set('ft.pay', JSON.stringify({ amount: 42, per: 'year' }));
    applyUrlQuery(PAY);
    expect(url.search).toBe('?pay=42&pay_per=year');
  });

  it('sparse: only changed parameters are written, a missing one is its default, the rest of the saved value stays', () => {
    writeUrlQuery(TWO, { a: 0, b: 5, note: 'x' });
    expect(url.search).toBe('?b=5');
    store.set('ft.two', JSON.stringify({ note: 'kept', a: 9, b: 9 }));
    url = new URL('https://x.test/app/?a=3');
    applyUrlQuery(TWO);
    expect(JSON.parse(store.get('ft.two')!)).toEqual({ note: 'kept', a: 3, b: 0 });
  });

  it('reads numbers with a dot, and refuses negatives and words', () => {
    expect(numberParam('1234.5')).toBe(1234.5);
    expect(numberParam('-1')).toBeNull();
    expect(numberParam('abc')).toBeNull();
    expect(numberParam('')).toBeNull();
  });
});
