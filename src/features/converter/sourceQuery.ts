import { CURRENCIES } from '../../lib/currency/currencies';
import { convert } from '../../lib/currency/convert';
import { BNR_RATES, effectiveRates } from '../../lib/currency/rates';
import { DEFAULT_WORK, PERIODS, readWork, rescale, type Period } from '../../lib/time/periods';
import { MAX_AMOUNT, roundMoney } from '../../lib/ui/numbers';
import { readQuery, writeQuery } from '../../lib/ui/query';
import { linkOpenedNow } from '../../lib/ui/share';
import { storage } from '../../lib/ui/storage';
import { noteDropped, numberParam } from '../../lib/ui/urlQuery';

/**
 * The converter cell the user typed into, in the address: ?amount=40&currency=EUR&per=hour. Names and values
 * are in English, so a link works in both languages. Only a changed amount is written; the default has none.
 */
export const SOURCE_PARAMS = ['amount', 'currency', 'per'] as const;

interface Source {
  amount: number;
  currency: string;
  period: Period;
}

const KNOWN = new Set(CURRENCIES.map((c) => c.code));

function fromQuery(params: URLSearchParams): Source | null {
  // As every number in the address: an empty ?amount= is no amount, not 0.
  const amount = numberParam(params.get('amount') ?? '');
  const currency = (params.get('currency') ?? '').toUpperCase();
  const period = params.get('per') as Period;
  if (amount === null) return null;
  if (!KNOWN.has(currency) || !PERIODS.includes(period)) return null;
  return { amount, currency, period };
}

const same = (a: Partial<Source> | null, b: Source) =>
  !!a && a.amount === b.amount && a.currency === b.currency && a.period === b.period;

const readJson = (key: string): unknown => {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * The tax page's income for the converter's amount per month in lei: rounded the way the converter shows it, and
 * no more than the largest amount the tax page takes. A larger one was saved and put in the address, then refused
 * on the next start as a broken link.
 */
export function monthIncome(monthRon: number): { amount: number; per: 'month'; currency: 'RON' } {
  return { amount: Math.min(roundMoney(monthRon), MAX_AMOUNT), per: 'month', currency: 'RON' };
}

/** The tax page's income as the converter sends it: the amount per month in lei, with the saved working time and custom rates. */
function followedIncome(source: Source): { amount: number; per: 'month'; currency: 'RON' } {
  const work = readWork(readJson('ft.work')) ?? DEFAULT_WORK;
  const overrides = readJson('ft.customRates');
  const rates = effectiveRates(BNR_RATES, typeof overrides === 'object' && overrides ? (overrides as Record<string, number>) : {});
  return monthIncome(convert(rescale(source.amount, source.period, 'month', work), source.currency, 'RON', rates));
}

/** The converter's saved amount, or the default one when none (or one it can't use) is saved. */
function savedSource(defaultSource: Source): Source {
  const saved = readJson('ft.source') as Source | null;
  return saved && typeof saved.amount === 'number' && KNOWN.has(saved.currency) && PERIODS.includes(saved.period) ? saved : defaultSource;
}

/**
 * Whether the saved tax income is just the converter's amount passed on (not one typed on the tax page), so
 * "Reset tab" on the converter can reset it too. False when nothing is saved (it is the default already).
 */
export function incomeFollowsConverter(defaultSource: Source): boolean {
  const income = readJson('ft.taxIncome') as { amount?: unknown; per?: unknown; currency?: unknown } | null;
  if (!income || income.per !== 'month' || income.currency !== 'RON') return false;
  // An income typed on the tax page becomes the converter's amount (saveSource), so one in lei a month that isn't
  // the converter's amount came from the converter, at the rates of the day it was sent. Not worked out again: the
  // site gets new rates every banking day, and from the next one on it no longer matched.
  if (!sourceFollowsIncome()) return true;
  // The converter's amount is this very income: it follows when the converter gives it back as it is.
  return income.amount === followedIncome(savedSource(defaultSource)).amount;
}

/**
 * The converter's amount per month in lei that the tax income goes with, before the address's working time and
 * custom rates are read: null when the saved income doesn't follow the converter (with none saved, the default
 * income does). For refollowIncome.
 */
export function followedMonth(defaultSource: Source): number | null {
  if (readJson('ft.taxIncome') !== null && !incomeFollowsConverter(defaultSource)) return null;
  return followedIncome(savedSource(defaultSource)).amount;
}

/**
 * Runs once before the first render, after the address's working time and custom rates are read: when they
 * changed the converter's amount per month (`before`, from followedMonth), the tax income that went with it
 * follows, as it does when they are changed in the converter. A reload with the same ones leaves it as it was
 * sent. An income in the address is read later and still wins; a shared link has its own (see applySourceQuery).
 */
export function refollowIncome(defaultSource: Source, before: number | null): void {
  if (before === null || linkOpenedNow()) return;
  const income = followedIncome(savedSource(defaultSource));
  if (income.amount === before) return;
  storage.setItem('ft.taxIncome', JSON.stringify(income));
}

/**
 * Whether the converter's saved amount is just the tax page's income passed on (same amount, currency and
 * period), so "Reset tab" on the tax page can reset it too. False when nothing is saved.
 */
export function sourceFollowsIncome(): boolean {
  const source = readJson('ft.source') as Partial<Source> | null;
  const income = readJson('ft.taxIncome') as { amount?: unknown; per?: unknown; currency?: unknown } | null;
  return !!source && !!income && source.amount === income.amount && source.currency === income.currency && source.period === income.per;
}

/**
 * The converter starts from an amount set elsewhere (the tax page's gross income, typed there): saved and put
 * in the address, so the converter shows it when it opens. The default source is not stored, as everywhere.
 */
export function saveSource(source: Source, defaultSource: Source): void {
  const isDefault = same(source, defaultSource);
  if (isDefault) storage.removeItem('ft.source');
  else storage.setItem('ft.source', JSON.stringify({ period: source.period, currency: source.currency, amount: source.amount }));
  writeSourceQuery(source, isDefault);
}

/** Writes the amount into the address, or removes it when it is the default. */
export function writeSourceQuery(source: Source, isDefault: boolean): void {
  writeQuery((params) => {
    if (isDefault) {
      for (const k of SOURCE_PARAMS) params.delete(k);
      return;
    }
    params.set('amount', String(source.amount));
    params.set('currency', source.currency);
    params.set('per', source.period);
  });
}

/**
 * Runs once before the first render. An amount in the address wins over the saved one, and the tax page's
 * income follows it (as it would after typing it in the converter), so an address opened on #taxes is right too.
 * Not in a shared link: it has the sender's income whenever that isn't the default, so without one the income
 * stays on the default, as the sender's was. Without an amount, a saved one is written into the address. A broken
 * amount is dropped from the address.
 */
export function applySourceQuery(defaultSource: Source): void {
  const params = readQuery();
  const fromUrl = fromQuery(params);
  if (fromUrl) {
    // Only a different amount touches the saved state, so a reload keeps an income set on the tax page.
    if (!same(readJson('ft.source') as Partial<Source> | null, fromUrl)) {
      storage.setItem('ft.source', JSON.stringify({ period: fromUrl.period, currency: fromUrl.currency, amount: fromUrl.amount }));
      if (!linkOpenedNow()) storage.setItem('ft.taxIncome', JSON.stringify(followedIncome(fromUrl)));
    }
    return;
  }
  if (SOURCE_PARAMS.some((k) => params.has(k))) {
    noteDropped(SOURCE_PARAMS.filter((k) => params.has(k)));
    writeQuery((p) => SOURCE_PARAMS.forEach((k) => p.delete(k)));
  }
  const saved = readJson('ft.source') as Source | null;
  if (saved && typeof saved.amount === 'number' && KNOWN.has(saved.currency) && PERIODS.includes(saved.period)) {
    writeSourceQuery(saved, same(saved, defaultSource));
  }
}
