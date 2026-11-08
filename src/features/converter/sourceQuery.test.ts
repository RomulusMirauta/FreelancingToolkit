import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convert } from '../../lib/currency/convert';
import { BNR_RATES, effectiveRates } from '../../lib/currency/rates';
import { DEFAULT_WORK, rescale, type Period } from '../../lib/time/periods';
import { MAX_AMOUNT, roundMoney } from '../../lib/ui/numbers';
import { flushQuery } from '../../lib/ui/query';
import { droppedParams } from '../../lib/ui/urlQuery';
import { applySourceQuery, followedEurYear, incomeFollowsConverter, monthIncome } from './sourceQuery';

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

  it('the tax income that follows it is rounded the way the converter shows it', () => {
    // The converter shows 1.024,22 lei a month; Math.round(x * 100) / 100 made the income 1,024.21.
    url = new URL('https://x.test/app/?amount=1024.215&currency=RON&per=month');
    applySourceQuery(DEFAULT_SOURCE);
    expect(JSON.parse(store.get('ft.taxIncome')!)).toEqual({ amount: 1024.22, per: 'month', currency: 'RON' });
  });

  it('the tax income that follows it stops at the largest amount the tax page takes', () => {
    // 2,000,000 EUR an hour is about 1.85 billion lei a month: saved, it was refused on the next start.
    url = new URL('https://x.test/app/?amount=2000000&currency=EUR&per=hour');
    applySourceQuery(DEFAULT_SOURCE);
    expect(JSON.parse(store.get('ft.taxIncome')!)).toEqual({ amount: MAX_AMOUNT, per: 'month', currency: 'RON' });
  });
});

describe('the income the converter passes on to the tax page', () => {
  it('is its amount a month in lei, rounded the way it shows it, up to the largest amount the tax page takes', () => {
    expect(monthIncome(1024.215)).toEqual({ amount: 1024.22, per: 'month', currency: 'RON' });
    expect(monthIncome(MAX_AMOUNT)).toEqual({ amount: MAX_AMOUNT, per: 'month', currency: 'RON' });
    // Over it, the income was saved and put in the address, then refused on the next start as a broken link.
    expect(monthIncome(1_851_477_333.33)).toEqual({ amount: MAX_AMOUNT, per: 'month', currency: 'RON' });
  });
});

describe('whether the tax income only follows the converter, for "Reset tab" on the converter', () => {
  const EUR = BNR_RATES.rates.EUR!;
  /** 40 EUR an hour (or another amount) in lei a month at an EUR rate, as the converter sends it. */
  const sent = (amount: number, rate: number, work = DEFAULT_WORK) =>
    JSON.stringify({ amount: roundMoney(rescale(amount, 'hour', 'month', work) * rate), per: 'month', currency: 'RON' });
  const save = (saved: Record<string, unknown>) => {
    store = new Map(Object.entries(saved).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  };

  it('an income the converter sent on an earlier banking day still follows it, whatever today\'s rates', () => {
    // Worked out again with the rates of the next deploy, it no longer matched, and the reset kept it.
    for (const rate of [EUR, EUR - 0.0001, EUR + 0.001]) {
      save({ 'ft.source': { period: 'hour', currency: 'EUR', amount: 40 }, 'ft.taxIncome': sent(40, rate) });
      expect(incomeFollowsConverter(DEFAULT_SOURCE), String(rate)).toBe(true);
    }
  });

  it('so does one sent after a change of working time, with no amount of its own saved in the converter', () => {
    const work = { ...DEFAULT_WORK, hoursPerDay: 6 };
    save({ 'ft.work': work, 'ft.taxIncome': sent(30, EUR - 0.0001, work) });
    expect(incomeFollowsConverter(DEFAULT_SOURCE)).toBe(true);
  });

  it('an income typed on the tax page in another currency or period doesn\'t', () => {
    save({ 'ft.source': { period: 'month', currency: 'EUR', amount: 12000 }, 'ft.taxIncome': { amount: 12000, per: 'month', currency: 'EUR' } });
    expect(incomeFollowsConverter(DEFAULT_SOURCE)).toBe(false);
    save({ 'ft.source': { period: 'year', currency: 'RON', amount: 150000 }, 'ft.taxIncome': { amount: 150000, per: 'year', currency: 'RON' } });
    expect(incomeFollowsConverter(DEFAULT_SOURCE)).toBe(false);
  });

  it('lei a month, typed on either page, is the converter\'s amount and the income at once: the two go together', () => {
    save({ 'ft.source': { period: 'month', currency: 'RON', amount: 15000 }, 'ft.taxIncome': { amount: 15000, per: 'month', currency: 'RON' } });
    expect(incomeFollowsConverter(DEFAULT_SOURCE)).toBe(true);
  });

  it('with no income saved, there is nothing to reset', () => {
    save({ 'ft.source': { period: 'hour', currency: 'EUR', amount: 40 } });
    expect(incomeFollowsConverter(DEFAULT_SOURCE)).toBe(false);
  });
});

describe('the converter\'s amount a year in EUR, for the income norm\'s limit on a tax income that follows it', () => {
  const RATES = effectiveRates(BNR_RATES, {});
  /** The converter's amount, saved, and the tax income it sends: lei a month, at today's rates unless others are given. */
  const typed = (amount: number, currency: string, period: Period, rates = RATES) => {
    store = new Map([['ft.source', JSON.stringify({ period, currency, amount })]]);
    return monthIncome(convert(rescale(amount, period, 'month', DEFAULT_WORK), currency, 'RON', rates));
  };
  const eur = (income: { amount: number; per: Period; currency: string }) => followedEurYear(income, DEFAULT_WORK, DEFAULT_SOURCE);

  it('is the amount typed in the converter, not worked back from the lei the tax page gets', () => {
    expect(eur(typed(2000, 'EUR', 'month'))).toBe(24_000);
    // Worked back from the lei, rounded to the ban a month, 25,000 EUR a year would come back as 25,000.01: over the limit.
    expect(eur(typed(25_000, 'EUR', 'year'))).toBe(25_000);
    expect(eur(typed(25_001, 'EUR', 'year'))).toBe(25_001);
    expect(eur(typed(12, 'EUR', 'hour'))).toBe(24_960);
    expect(eur(typed(26_000, 'USD', 'year'))).toBeCloseTo((26_000 * RATES.USD!) / RATES.EUR!, 1);
  });

  it('also for an income sent on an earlier banking day, or at a custom EUR rate', () => {
    expect(eur(typed(2000, 'EUR', 'month', { ...RATES, EUR: RATES.EUR! - 0.001 }))).toBe(24_000);
    const custom = typed(2000, 'EUR', 'month', effectiveRates(BNR_RATES, { EUR: 5 }));
    store.set('ft.customRates', '{"EUR":5}');
    expect(custom.amount).toBe(10_000);
    expect(eur(custom)).toBe(24_000);
  });

  it('is undefined, so the limit stays in lei, for lei typed on the tax page, an income far off the converter\'s amount, or one in another currency or period', () => {
    // Lei a month typed on the tax page are the converter's amount too (saveSource).
    const sent = typed(2000, 'EUR', 'month');
    store = new Map([['ft.source', JSON.stringify({ period: 'month', currency: 'RON', amount: sent.amount })]]);
    expect(eur(sent)).toBeUndefined();
    // An address's income= alone, with nothing saved: the converter's default 30 EUR an hour is about 27,800 lei a month.
    store = new Map();
    expect(eur({ amount: 5000, per: 'month', currency: 'RON' })).toBeUndefined();
    // More than 10% over the converter's 2,000 EUR a month.
    typed(2000, 'EUR', 'month');
    expect(eur({ ...sent, amount: roundMoney(sent.amount * 1.11) })).toBeUndefined();
    expect(eur({ amount: 2000, per: 'month', currency: 'EUR' })).toBeUndefined();
    expect(eur({ amount: sent.amount * 12, per: 'year', currency: 'RON' })).toBeUndefined();
  });
});
