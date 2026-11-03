import snapshot from '../../data/rates.json';
import market from '../../data/market-rates.json';

/** RON per 1 unit of each currency (BNR multipliers already applied). */
export interface RateTable {
  date: string;
  source: string;
  rates: Record<string, number>;
}

export const BNR_RATES: RateTable = snapshot;

/** One BNR fixing. */
export interface DayRates {
  date: string;
  rates: Record<string, number>;
}

/** The last banking days' fixings, newest first (the first is the current one). Empty in an old snapshot. */
export const BNR_HISTORY: DayRates[] = (snapshot as { history?: DayRates[] }).history ?? [];

export interface RateChange {
  /** The previous banking day (YYYY-MM-DD). */
  previousDate: string;
  /** RON per unit, today minus the previous banking day. */
  change: number;
  /** The same as a share of the previous rate (0.01 = 1%). */
  share: number;
}

/**
 * How a BNR rate moved since the previous banking day. Null when the history doesn't cover it
 * (a market-rate currency, an old snapshot, or a history that doesn't start at `table`'s date).
 */
export function rateChange(code: string, history: DayRates[] = BNR_HISTORY, table: RateTable = BNR_RATES): RateChange | null {
  const [today, previous] = history;
  const now = table.rates[code];
  const before = previous?.rates[code];
  if (!today || today.date !== table.date || now === undefined || before === undefined || before <= 0) return null;
  return { previousDate: previous!.date, change: now - before, share: (now - before) / before };
}

/** A currency's rates over the saved banking days, oldest first (for a small chart); days without it are skipped. */
export function rateSeries(code: string, history: DayRates[] = BNR_HISTORY): { date: string; rate: number }[] {
  return history
    .filter((d) => d.rates[code] !== undefined)
    .map((d) => ({ date: d.date, rate: d.rates[code]! }))
    .reverse();
}

/** Market rates (ExchangeRate-API) for the currencies BNR does not publish. BNR always wins where it has a rate. */
export const MARKET_RATES: RateTable & { provider: string } = market;

/** True for a currency whose rate comes from the market source, not from BNR. */
export const isMarketRate = (code: string): boolean => !(code in BNR_RATES.rates) && code in MARKET_RATES.rates;

/** The published rate for a currency: BNR's, else the market one. */
export const baseRate = (code: string): number | undefined => BNR_RATES.rates[code] ?? MARKET_RATES.rates[code];

/** Rates as used by the app: market rates, then BNR over them, RON itself, and any custom overrides on top. */
export function effectiveRates(table: RateTable, overrides: Record<string, number>, extra: RateTable = MARKET_RATES): Record<string, number> {
  const out: Record<string, number> = { ...extra.rates, ...table.rates, RON: 1 };
  for (const [code, value] of Object.entries(overrides)) {
    if (code !== 'RON' && Number.isFinite(value) && value > 0) out[code] = value;
  }
  return out;
}

/** Whole days between the rate date and `today` (both YYYY-MM-DD, calendar dates). */
export function ageInDays(rateDate: string, today: Date): number {
  const [y, m, d] = rateDate.split('-').map(Number) as [number, number, number];
  const rate = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - rate) / 86_400_000);
}

/**
 * BNR publishes on banking days around 13:00, so a Friday rate is still current on
 * Monday morning (3 days). Anything older than 4 days means the snapshot is stale.
 */
export function isStale(rateDate: string, today: Date): boolean {
  return ageInDays(rateDate, today) > 4;
}
