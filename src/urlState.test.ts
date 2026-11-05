import { describe, expect, it } from 'vitest';
import { URL_QUERIES } from './urlState';
import { SOURCE_PARAMS } from './features/converter/sourceQuery';
import { APP_KEYS, APP_QUERY, PAGE_KEYS, PAGE_QUERY } from './lib/ui/settingsKeys';
import { DEFAULT_TAX_OPTIONS } from './lib/tax/regimes';
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

describe('a broken address value is not used', () => {
  const bad = (key: string, values: string[]) => {
    const q = byKey(key);
    const v = q.fromParams(values, null);
    return v === null || !q.isValid(v);
  };

  it('unknown language, theme, currency, platform or reference card', () => {
    expect(bad('ft.lang', ['de'])).toBe(true);
    expect(bad('ft.theme', ['purple'])).toBe(true);
    expect(bad('ft.columns', ['EUR,XXX'])).toBe(true);
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
