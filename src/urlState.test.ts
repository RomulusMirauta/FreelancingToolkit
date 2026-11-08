import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_QUERIES, applyUrlState } from './urlState';
import { SOURCE_PARAMS } from './features/converter/sourceQuery';
import { APP_KEYS, APP_QUERY, PAGE_KEYS, PAGE_QUERY } from './lib/ui/settingsKeys';
import { DEFAULT_TAX_OPTIONS, mergeTaxOptions } from './lib/tax/regimes';
import { BNR_RATES } from './lib/currency/rates';
import { DEFAULT_WORK, rescale } from './lib/time/periods';
import { roundMoney } from './lib/ui/numbers';
import { flushQuery } from './lib/ui/query';
import type { UrlQuery } from './lib/ui/urlQuery';

// The app's source files, as text.
const SOURCES = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const keysInSource = () => {
  const found = new Set<string>();
  for (const text of Object.values(SOURCES)) for (const m of text.matchAll(/'(ft\.[A-Za-z]+)'/g)) found.add(m[1]!);
  return found;
};

const byKey = (key: string) => URL_QUERIES.find((q) => q.key === key)!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roundTrip = (q: UrlQuery<any>, value: unknown) => q.fromParams(q.toParams(value), null);

describe('every setting is in the address', () => {
  it('each saved setting has address parameters (the converter amount has its own: amount, currency, per)', () => {
    const covered = new Set([...URL_QUERIES.map((q) => q.key), 'ft.source']);
    expect([...keysInSource()].filter((k) => !covered.has(k))).toEqual([]);
  });

  it('a page reset clears exactly the parameters of that page; language and theme are the app\'s', () => {
    for (const page of ['converter', 'taxes'] as const) {
      const expected = URL_QUERIES.filter((q) => PAGE_KEYS[page].includes(q.key)).flatMap((q) => q.names);
      if (page === 'converter') expected.unshift(...SOURCE_PARAMS);
      expect([...PAGE_QUERY[page]].sort()).toEqual([...expected].sort());
    }
    expect(URL_QUERIES.filter((q) => APP_KEYS.includes(q.key)).flatMap((q) => q.names).sort()).toEqual([...APP_QUERY].sort());
  });

  it('no parameter name is used twice', () => {
    const names = [...URL_QUERIES.flatMap((q) => q.names), ...SOURCE_PARAMS, 'fold', 'share'];
    expect(new Set(names).size).toBe(names.length);
  });

  it('the defaults write nothing', () => {
    for (const q of URL_QUERIES) {
      const back = roundTrip(q, q.defaults);
      expect(q.isValid(back), q.key).toBe(true);
      expect(JSON.stringify(back), q.key).toBe(JSON.stringify(q.defaults));
    }
  });
});

describe('a changed setting reads back the same', () => {
  const samples: Record<string, unknown> = {
    'ft.lang': 'en',
    'ft.theme': 'dark',
    'ft.work': { hoursPerDay: 6.5, daysPerWeek: 4, daysOff: 20, holidays: true, billablePct: 70 },
    'ft.customRates': { USD: 4.81, GBP: 6.4 },
    'ft.columns': ['RON', 'EUR', 'PLN'],
    'ft.addedCurrencies': ['TRY', 'HUF'],
    'ft.goalNote': false,
    'ft.fees': { platform: 'fiverr', platformPct: 20, transfer: 'custom', transferPct: 1.5 },
    'ft.taxIncome': { amount: 12000.5, per: 'hour', currency: 'EUR' },
    'ft.solverTarget': { amount: 9000, per: 'year', currency: 'USD' },
    'ft.sideJob': { salaryMonthly: 7000, sideMonthly: 2500 },
    'ft.taxRef': 'srlMicro',
    'ft.vatRomania': 20,
    'ft.taxOptions': {
      ...DEFAULT_TAX_OPTIONS,
      employee: { dependants: 2, under26: true, schoolChildren: 3 },
      pfaReal: { ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly: 1500, pensioner: true },
      srlMicro: { ...DEFAULT_TAX_OPTIONS.srlMicro, ownerPay: 'mandate', singleMicro: false },
      copyright: { insured: true },
    },
  };

  it('has a sample for every setting', () => {
    expect(URL_QUERIES.map((q) => q.key).filter((k) => !(k in samples))).toEqual([]);
  });

  for (const [key, value] of Object.entries(samples)) {
    it(key, () => {
      const q = byKey(key);
      expect(q.isValid(value)).toBe(true);
      const back = roundTrip(q, value);
      expect(q.isValid(back)).toBe(true);
      expect(back).toEqual(value);
    });
  }

  it('cards: only the changed options are written', () => {
    const q = byKey('ft.taxOptions');
    const o = samples['ft.taxOptions'];
    const base = q.toParams(q.defaults);
    const changed = q.names.filter((_, i) => q.toParams(o)[i] !== base[i]);
    expect(changed.sort()).toEqual(['children', 'copyright_insured', 'dependants', 'expenses_pfa', 'micro_pay', 'micro_single', 'pfa_pensioner', 'under26']);
  });
});

/** What applyUrlQuery keeps of a value read from the address or saved: all of it, the part `upgrade` keeps, or null. */
const kept = (key: string, value: unknown) => {
  const q = byKey(key);
  return q.isValid(value) ? value : (q.upgrade?.(value) ?? null);
};

describe('a broken address value is not used', () => {
  const bad = (key: string, values: string[]) => {
    const v = byKey(key).fromParams(values, null);
    return v === null || kept(key, v) === null;
  };

  it('unknown language, theme, currency, platform or reference card', () => {
    expect(bad('ft.lang', ['de'])).toBe(true);
    expect(bad('ft.theme', ['purple'])).toBe(true);
    expect(bad('ft.columns', ['XXX'])).toBe(true);
    expect(bad('ft.columns', [''])).toBe(true);
    expect(bad('ft.columns', ['EUR,EUR'])).toBe(true);
    expect(bad('ft.addedCurrencies', ['ZZZ'])).toBe(true);
    expect(bad('ft.fees', ['myspace', '10', 'bank', '2'])).toBe(true);
    expect(bad('ft.taxRef', ['copyright'])).toBe(true);
  });

  it('numbers out of range: negative, too big, a fee of 100%, an impossible working week', () => {
    expect(bad('ft.customRates', ['USD:-4'])).toBe(true);
    expect(bad('ft.vatRomania', ['101'])).toBe(true);
    expect(bad('ft.vatRomania', ['-1'])).toBe(true);
    expect(bad('ft.customRates', ['USD:0'])).toBe(true);
    expect(bad('ft.customRates', ['USD:1e40'])).toBe(true);
    expect(bad('ft.fees', ['upwork', '100', 'bank', '2'])).toBe(true);
    expect(bad('ft.work', ['25', '5', '0', '0', '100'])).toBe(true);
    expect(bad('ft.work', ['8', '5', '0', 'yes', '100'])).toBe(true);
    expect(bad('ft.taxIncome', ['1e12', 'RON', 'month'])).toBe(true);
    expect(bad('ft.goalNote', ['maybe'])).toBe(true);
  });

  it('a card option out of range falls back to its default, the others are kept', () => {
    const q = byKey('ft.taxOptions');
    const values = q.toParams(q.defaults);
    values[q.names.indexOf('dependants')] = '7';
    values[q.names.indexOf('children')] = '2';
    values[q.names.indexOf('micro_pay')] = 'cash';
    values[q.names.indexOf('pfa_sick')] = 'x';
    const o = q.fromParams(values, null) as typeof DEFAULT_TAX_OPTIONS;
    expect(q.isValid(o)).toBe(true);
    expect(o.employee.dependants).toBe(0);
    expect(o.employee.schoolChildren).toBe(2);
    expect(o.srlMicro.ownerPay).toBe('cim');
    expect(o.pfaReal.sickLeave).toBe(false);
  });
});

describe('a currency the rates no longer have', () => {
  // XYZ stands for a code the market list stopped listing after it was saved or put in a link.
  it('leaves a saved list on its own: the other columns, added currencies and custom rates stay', () => {
    expect(kept('ft.columns', ['EUR', 'RON', 'TRY', 'XYZ'])).toEqual(['EUR', 'RON', 'TRY']);
    expect(kept('ft.addedCurrencies', ['TRY', 'XYZ', 'PLN'])).toEqual(['TRY', 'PLN']);
    expect(kept('ft.customRates', { EUR: 5.1, XYZ: 1.2, USD: 4.7 })).toEqual({ EUR: 5.1, USD: 4.7 });
  });

  it('leaves a link on its own too', () => {
    const fromLink = (key: string, value: string) => kept(key, byKey(key).fromParams([value], null));
    expect(fromLink('ft.columns', 'EUR,RON,TRY,XYZ')).toEqual(['EUR', 'RON', 'TRY']);
    expect(fromLink('ft.addedCurrencies', 'TRY,XYZ')).toEqual(['TRY']);
    expect(fromLink('ft.customRates', 'EUR:5.1,XYZ:1.2')).toEqual({ EUR: 5.1 });
  });

  it('with nothing else in it, the setting goes back to the saved value or the default', () => {
    expect(kept('ft.columns', ['XYZ'])).toBeNull();
    expect(kept('ft.addedCurrencies', ['XYZ'])).toBeNull();
    expect(kept('ft.customRates', { XYZ: 1.2 })).toBeNull();
  });

  it('only the unknown code goes: a list that is broken otherwise is still not used', () => {
    expect(kept('ft.columns', ['EUR', 'EUR', 'XYZ'])).toBeNull();
    expect(kept('ft.addedCurrencies', ['TRY', 'TRY', 'XYZ'])).toBeNull();
    expect(kept('ft.customRates', { EUR: -1, XYZ: 1.2 })).toBeNull();
    expect(kept('ft.columns', 'EUR')).toBeNull();
  });
});

describe('saved card options', () => {
  const q = () => byKey('ft.taxOptions');

  it('a number of people that isn\'t whole or is past the picker\'s range is refused, as in the address', () => {
    // Stored by an old link (?share=1&taxOptions={…}) or edited by hand: it was valid, went into the address, and
    // 2.5 dependants made the CIM card NaN.
    for (const employee of [
      { dependants: 2.5, under26: false, schoolChildren: 0 },
      { dependants: 0, under26: false, schoolChildren: 11 },
      { dependants: 0, under26: false, schoolChildren: 1e8 },
    ]) expect(q().isValid({ ...DEFAULT_TAX_OPTIONS, employee }), JSON.stringify(employee)).toBe(false);
  });

  it('an older shape is not valid as it is, and merges into a valid value with every option it had', () => {
    // Saved before an option existed (`schoolChildren` here), with one since dropped (`bonus`).
    const older = {
      ...DEFAULT_TAX_OPTIONS,
      employee: { dependants: 2, under26: true },
      pfaReal: { ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly: 1500, bonus: 1 },
    };
    expect(q().isValid(older)).toBe(false);
    const merged = mergeTaxOptions(older);
    expect(q().isValid(merged)).toBe(true);
    expect(merged.employee).toEqual({ dependants: 2, under26: true, schoolChildren: 0 });
    expect(merged.pfaReal).toEqual({ ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly: 1500 });
  });
});

describe('the tax income at start follows the working time and custom rates in the address', () => {
  // A tiny browser: an address that history.replaceState changes, and the app's storage.
  let url: URL;
  let store: Map<string, string>;
  beforeEach(() => {
    vi.stubGlobal('location', {
      get href() { return url.href; },
      get search() { return url.search; },
      get hash() { return url.hash; },
    });
    vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { url = new URL(next, url); } });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    flushQuery();
    vi.unstubAllGlobals();
  });

  /** A start on `address` with `saved` in storage (what main.tsx runs before the first render): the income saved then. */
  const start = (address: string, saved: Record<string, unknown> = {}) => {
    url = new URL(address, 'https://x.test/app/');
    store = new Map(Object.entries(saved).map(([k, v]) => [k, JSON.stringify(v)]));
    applyUrlState();
    flushQuery();
    const raw = store.get('ft.taxIncome');
    return raw === undefined ? null : JSON.parse(raw);
  };
  const EUR = BNR_RATES.rates.EUR!;
  const AT_4H = { ...DEFAULT_WORK, hoursPerDay: 4 };
  /** An amount an hour in EUR as the converter sends it to the tax page: lei a month, at an EUR rate. */
  const sent = (amount: number, rate: number, work = DEFAULT_WORK) =>
    ({ amount: roundMoney(rescale(amount, 'hour', 'month', work) * rate), per: 'month', currency: 'RON' });
  const SOURCE = { period: 'hour', currency: 'EUR', amount: 40 };

  it('an income that followed the converter follows them too, as after changing them in the converter', () => {
    const saved = { 'ft.source': SOURCE, 'ft.taxIncome': sent(40, EUR) };
    expect(start('?hours=4', saved)).toEqual(sent(40, EUR, AT_4H));
    expect(url.searchParams.get('income')).toBe(String(sent(40, EUR, AT_4H).amount));
    expect(start('?hours=4&rates=EUR:6', saved)).toEqual(sent(40, 6, AT_4H));
  });

  it('also one sent on an earlier banking day, at that day\'s rate', () => {
    expect(start('?hours=4', { 'ft.source': SOURCE, 'ft.taxIncome': sent(40, EUR - 0.0001) })).toEqual(sent(40, EUR, AT_4H));
  });

  it('with nothing saved, the default income follows them as well', () => {
    expect(start('?hours=4')).toEqual(sent(30, EUR, AT_4H));
  });

  it('an income typed on the tax page stays, and an income in the address still wins', () => {
    const typed = { amount: 12000, per: 'month', currency: 'EUR' };
    expect(start('?hours=4&rates=EUR:6', { 'ft.source': { period: 'month', currency: 'EUR', amount: 12000 }, 'ft.taxIncome': typed })).toEqual(typed);
    expect(start('?hours=4&income=5000&income_currency=RON&income_per=month', { 'ft.source': SOURCE, 'ft.taxIncome': sent(40, EUR) }))
      .toEqual({ amount: 5000, per: 'month', currency: 'RON' });
  });

  it('a reload, with the working time it already had, leaves the income as it was sent, on any day\'s rates', () => {
    // Worked out again on every start, an income that follows the converter would move with each day's rates.
    const income = sent(40, EUR - 0.0001, AT_4H);
    expect(start('?amount=40&currency=EUR&per=hour&hours=4', { 'ft.source': SOURCE, 'ft.work': AT_4H, 'ft.taxIncome': income })).toEqual(income);
  });
});
