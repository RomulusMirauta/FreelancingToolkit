import { CURRENCIES } from '../../lib/currency/currencies';
import { convert } from '../../lib/currency/convert';
import { BNR_RATES, effectiveRates } from '../../lib/currency/rates';
import { DEFAULT_WORK, PERIODS, readWork, rescale, type Period } from '../../lib/time/periods';
import { isSaneAmount } from '../../lib/ui/numbers';
import { readQuery, writeQuery } from '../../lib/ui/query';

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
  const amount = Number(params.get('amount'));
  const currency = (params.get('currency') ?? '').toUpperCase();
  const period = params.get('per') as Period;
  if (!params.has('amount') || !isSaneAmount(amount)) return null;
  if (!KNOWN.has(currency) || !PERIODS.includes(period)) return null;
  return { amount, currency, period };
}

const same = (a: Partial<Source> | null, b: Source) =>
  !!a && a.amount === b.amount && a.currency === b.currency && a.period === b.period;

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

/** The tax page's income as the converter sends it: the amount per month in lei, with the saved working time and custom rates. */
function followedIncome(source: Source): { amount: number; per: 'month'; currency: 'RON' } {
  const work = readWork(readJson('ft.work')) ?? DEFAULT_WORK;
  const overrides = readJson('ft.customRates');
  const rates = effectiveRates(BNR_RATES, typeof overrides === 'object' && overrides ? (overrides as Record<string, number>) : {});
  const month = convert(rescale(source.amount, source.period, 'month', work), source.currency, 'RON', rates);
  return { amount: Math.round(month * 100) / 100, per: 'month', currency: 'RON' };
}

/**
 * Whether the saved tax income is just the converter's amount passed on (not one typed on the tax page), so
 * "Reset tab" on the converter can reset it too. False when nothing is saved (it is the default already).
 */
export function incomeFollowsConverter(defaultSource: Source): boolean {
  const income = readJson('ft.taxIncome') as { amount?: unknown; per?: unknown; currency?: unknown } | null;
  if (!income) return false;
  const saved = readJson('ft.source') as Source | null;
  const followed = followedIncome(saved && typeof saved.amount === 'number' ? saved : defaultSource);
  return income.amount === followed.amount && income.per === 'month' && income.currency === 'RON';
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
  try {
    if (isDefault) localStorage.removeItem('ft.source');
    else localStorage.setItem('ft.source', JSON.stringify({ period: source.period, currency: source.currency, amount: source.amount }));
  } catch {
    // storage unavailable: the converter keeps its own amount
  }
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
 * income follows it (as it would after typing it in the converter), so a link opened on #taxes is right too.
 * Without one, a saved amount is written into the address. A broken amount is dropped from the address.
 */
export function applySourceQuery(defaultSource: Source): void {
  const params = readQuery();
  const fromUrl = fromQuery(params);
  try {
    if (fromUrl) {
      // Only a different amount touches the saved state, so a reload keeps an income set on the tax page.
      if (!same(readJson('ft.source') as Partial<Source> | null, fromUrl)) {
        localStorage.setItem('ft.source', JSON.stringify({ period: fromUrl.period, currency: fromUrl.currency, amount: fromUrl.amount }));
        localStorage.setItem('ft.taxIncome', JSON.stringify(followedIncome(fromUrl)));
      }
      return;
    }
  } catch {
    // storage unavailable: the address still shows the amount, the app opens on its defaults
    return;
  }
  if (SOURCE_PARAMS.some((k) => params.has(k))) writeQuery((p) => SOURCE_PARAMS.forEach((k) => p.delete(k)));
  const saved = readJson('ft.source') as Source | null;
  if (saved && typeof saved.amount === 'number' && KNOWN.has(saved.currency) && PERIODS.includes(saved.period)) {
    writeSourceQuery(saved, same(saved, defaultSource));
  }
}
