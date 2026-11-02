import snapshot from '../../data/rates.json';
import market from '../../data/market-rates.json';

/** RON per 1 unit of each currency (BNR multipliers already applied). */
export interface RateTable {
  date: string;
  source: string;
  rates: Record<string, number>;
}

export const BNR_RATES: RateTable = snapshot;

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
