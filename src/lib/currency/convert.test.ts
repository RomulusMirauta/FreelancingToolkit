import { describe, expect, it } from 'vitest';
import { convert, crossRate } from './convert';
import { CURRENCIES } from './currencies';
import { formatNumber } from '../ui/numbers';
import {
  BNR_HISTORY, BNR_RATES, MARKET_RATES, effectiveRates, isMarketRate, isStale, rateChange, rateDirection, rateSeries,
  type DayRates, type RateTable,
} from './rates';

const table: RateTable = {
  date: '2026-10-30',
  source: 'test',
  rates: { EUR: 5.3426, USD: 4.7698, HUF: 0.014602 },
};
const rates = effectiveRates(table, {});

describe('convert', () => {
  it('EUR → RON uses the BNR rate', () => {
    expect(convert(30, 'EUR', 'RON', rates)).toBeCloseTo(160.278, 6);
  });
  it('applies BNR multipliers (HUF is quoted per 100)', () => {
    expect(convert(100, 'HUF', 'RON', rates)).toBeCloseTo(1.4602, 9);
  });
  it('crosses through RON', () => {
    expect(crossRate('EUR', 'USD', rates)).toBeCloseTo(5.3426 / 4.7698, 9);
    expect(convert(convert(30, 'EUR', 'USD', rates), 'USD', 'EUR', rates)).toBeCloseTo(30, 9);
  });
  it('custom rates override BNR but never RON', () => {
    const r = effectiveRates(table, { EUR: 5, RON: 2, USD: -1 });
    expect(r.EUR).toBe(5);
    expect(r.RON).toBe(1);
    expect(r.USD).toBe(4.7698);
  });
});

describe('staleness', () => {
  it('a Friday rate is still current on Monday', () => {
    expect(isStale('2026-10-30', new Date(2026, 10, 2))).toBe(false);
  });
  it('a week-old rate is stale', () => {
    expect(isStale('2026-10-23', new Date(2026, 10, 2))).toBe(true);
  });
});

describe('market rates for the currencies BNR does not publish', () => {
  const market: RateTable = { date: '2026-11-01', source: 'test', rates: { EUR: 9, ARS: 0.0031 } };
  it('fill in the gaps, but BNR always wins', () => {
    const r = effectiveRates(table, {}, market);
    expect(r.ARS).toBe(0.0031);
    expect(r.EUR).toBe(5.3426);
  });
  it('every listed currency has a rate, and none is listed twice', () => {
    const all = effectiveRates(BNR_RATES, {});
    expect(CURRENCIES.filter((c) => !(all[c.code]! > 0)).map((c) => c.code)).toEqual([]);
    expect(new Set(CURRENCIES.map((c) => c.code)).size).toBe(CURRENCIES.length);
  });
  it('only currencies missing from BNR are marked as market rates, and all of them are', () => {
    expect(isMarketRate('EUR')).toBe(false);
    expect(isMarketRate('RON')).toBe(false);
    expect(isMarketRate('ARS')).toBe(true);
    expect(CURRENCIES.filter((c) => c.market).every((c) => isMarketRate(c.code))).toBe(true);
    expect(CURRENCIES.filter((c) => !c.market && isMarketRate(c.code)).map((c) => c.code)).toEqual([]);
  });
  it('the market snapshot agrees with BNR on EUR within 1%', () => {
    expect(Math.abs(MARKET_RATES.rates.EUR! / BNR_RATES.rates.EUR! - 1)).toBeLessThan(0.01);
  });
});

describe('change against the previous banking day', () => {
  const history: DayRates[] = [
    { date: '2026-11-02', rates: { EUR: 5.3403, USD: 4.7658 } },
    { date: '2026-10-30', rates: { EUR: 5.3426, USD: 4.7698 } },
    { date: '2026-10-29', rates: { EUR: 5.3449 } },
  ];
  const today: RateTable = { date: '2026-11-02', source: 'test', rates: { EUR: 5.3403, USD: 4.7658, GBP: 6.3879 } };
  it('is today minus the previous banking day (Monday against Friday)', () => {
    const c = rateChange('EUR', history, today)!;
    expect(c.previousDate).toBe('2026-10-30');
    expect(c.change).toBeCloseTo(-0.0023, 9);
    expect(c.share).toBeCloseTo(-0.0023 / 5.3426, 9);
  });
  it('is unknown without a previous day, or when the history is from another day', () => {
    expect(rateChange('GBP', history, today)).toBeNull();
    expect(rateChange('EUR', history, { ...today, date: '2026-11-03' })).toBeNull();
    expect(rateChange('EUR', [], today)).toBeNull();
  });
  it('the series runs oldest first and skips days without the currency', () => {
    expect(rateSeries('EUR', history).map((d) => d.date)).toEqual(['2026-10-29', '2026-10-30', '2026-11-02']);
    expect(rateSeries('USD', history).map((d) => d.rate)).toEqual([4.7698, 4.7658]);
  });
  it('the bundled snapshot starts its history at its own date', () => {
    expect(BNR_HISTORY[0]?.date).toBe(BNR_RATES.date);
    expect(BNR_HISTORY[0]?.rates.EUR).toBe(BNR_RATES.rates.EUR);
  });
});

describe('which way a rate moved', () => {
  /** The change from one fixing to the next. */
  const move = (code: string, before: number, now: number) => {
    const history: DayRates[] = [{ date: '2026-11-06', rates: { [code]: now } }, { date: '2026-11-05', rates: { [code]: before } }];
    return rateChange(code, history, { date: '2026-11-06', source: 'test', rates: { [code]: now } })!;
  };

  it('the currencies quoted per 100 go up and down too (BNR, 5 → 6 Nov 2026)', () => {
    // Per unit each moved by less than 0.00005 lei, so the cards said "unchanged" beside 0.31%, 0.76% and 0.4%.
    expect(rateDirection(move('HUF', 0.014708, 0.014662))).toBe('down');
    expect(rateDirection(move('IDR', 0.000262, 0.000264))).toBe('up');
    expect(rateDirection(move('KRW', 0.003542, 0.003528))).toBe('down');
    expect(rateDirection(move('EUR', 5.3398, 5.3408))).toBe('up');
    expect(rateDirection(move('THB', 0.1381, 0.1381))).toBe('flat');
  });

  it('a move the card shows as 0% is flat, not ▲ beside +0%', () => {
    expect(rateDirection(move('EUR', 5.3398, 5.3399))).toBe('flat');
    expect(rateDirection(move('EUR', 5.3399, 5.3398))).toBe('flat');
  });

  it('over the bundled history, flat exactly when the card\'s percentage reads 0', () => {
    let days = 0;
    for (let i = 0; i + 1 < BNR_HISTORY.length; i++) {
      const today: RateTable = { date: BNR_HISTORY[i]!.date, source: 'test', rates: BNR_HISTORY[i]!.rates };
      for (const code of Object.keys(today.rates)) {
        const c = rateChange(code, BNR_HISTORY.slice(i), today);
        if (!c) continue;
        days++;
        // As the card prints it: {sign}{formatNumber(Math.abs(change.share) * 100, 2)}%.
        expect(rateDirection(c) === 'flat', `${today.date} ${code} ${c.share}`).toBe(formatNumber(Math.abs(c.share) * 100, 2) === '0');
      }
    }
    expect(days).toBeGreaterThan(100);
  });
});
