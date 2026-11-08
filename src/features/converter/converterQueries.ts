import { CURRENCIES } from '../../lib/currency/currencies';
import { isSaneAmount } from '../../lib/ui/numbers';
import { numberParam, type UrlQuery } from '../../lib/ui/urlQuery';
import { PHONE_QUERY } from '../../lib/ui/useIsPhone';

/** The converter's settings and how each one reads in the address. */

const KNOWN = new Set(CURRENCIES.map((c) => c.code));

/** A phone shows two currencies without scrolling sideways, so it starts with EUR and RON; USD and GBP stay one tap away. */
const isPhone = typeof matchMedia === 'function' && matchMedia(PHONE_QUERY).matches;
export const DEFAULT_COLUMNS = isPhone ? ['EUR', 'RON'] : ['EUR', 'RON', 'USD', 'GBP'];

export const isCodes = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((c) => typeof c === 'string' && KNOWN.has(c));
export const isColumns = (v: unknown): v is string[] => isCodes(v) && v.length > 0 && new Set(v).size === v.length;
const isAdded = (v: unknown): v is string[] => isCodes(v) && new Set(v).size === v.length;
export const isOverrides = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) &&
  Object.entries(v).every(([code, x]) => KNOWN.has(code) && isSaneAmount(x) && x > 0);
export const isFlag = (v: unknown): v is boolean => typeof v === 'boolean';

/**
 * A saved or linked list that names a currency the rates no longer have (the market list is downloaded again with
 * every deploy) keeps the other currencies; null when none is left, or when the list is broken otherwise.
 */
const knownList = (isValid: (v: unknown) => v is string[]) => (v: unknown): string[] | null => {
  const kept = Array.isArray(v) ? v.filter((c) => KNOWN.has(c)) : [];
  return kept.length > 0 && isValid(kept) ? kept : null;
};
export const knownColumns = knownList(isColumns);
export const knownAdded = knownList(isAdded);
/** The same for custom rates: those of the other currencies stay. */
export const knownRates = (v: unknown): Record<string, number> | null => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const kept = Object.fromEntries(Object.entries(v).filter(([code]) => KNOWN.has(code)));
  return Object.keys(kept).length > 0 && isOverrides(kept) ? kept : null;
};

/** "eur, ron" → ['EUR', 'RON']; empty → []. */
const codes = (s: string) => (s.trim() === '' ? [] : s.split(',').map((c) => c.trim().toUpperCase()));

/** The currencies shown as columns, in order: ?currencies=EUR,RON,PLN. */
export const COLUMNS_QUERY: UrlQuery<string[]> = {
  key: 'ft.columns',
  names: ['currencies'],
  toParams: (v) => [v.join(',')],
  fromParams: ([s]) => codes(s!),
  isValid: isColumns,
  upgrade: knownColumns,
  defaults: DEFAULT_COLUMNS,
};

/** Currencies added from the list (they get a chip): ?added=TRY,HUF. */
export const ADDED_QUERY: UrlQuery<string[]> = {
  key: 'ft.addedCurrencies',
  names: ['added'],
  toParams: (v) => [v.join(',')],
  fromParams: ([s]) => codes(s!),
  isValid: isAdded,
  upgrade: knownAdded,
  defaults: [],
};

/** Custom rates, RON per unit: ?rates=EUR:5.1,USD:4.7. */
export const RATES_QUERY: UrlQuery<Record<string, number>> = {
  key: 'ft.customRates',
  names: ['rates'],
  toParams: (v) => [Object.entries(v).map(([code, rate]) => `${code}:${rate}`).join(',')],
  fromParams: ([s]) => {
    const out: Record<string, number> = {};
    for (const part of s!.split(',').filter(Boolean)) {
      const [code, rate] = part.split(':');
      const n = numberParam(rate ?? '');
      if (!code || n === null || n <= 0) return null;
      out[code.trim().toUpperCase()] = n;
    }
    return out;
  },
  isValid: isOverrides,
  upgrade: knownRates,
  defaults: {},
};

/** The "Or work backwards" note beside the grid, once closed: ?goal_note=0. */
export const GOAL_QUERY: UrlQuery<boolean> = {
  key: 'ft.goalNote',
  names: ['goal_note'],
  toParams: (v) => [v ? '1' : '0'],
  fromParams: ([s]) => (s === '1' ? true : s === '0' ? false : null),
  isValid: isFlag,
  defaults: true,
};
