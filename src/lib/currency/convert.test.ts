import { describe, expect, it } from 'vitest';
import { convert, crossRate } from './convert';
import { CURRENCIES } from './currencies';
import { BNR_RATES, MARKET_RATES, effectiveRates, isMarketRate, isStale, type RateTable } from './rates';

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
  it('only currencies missing from BNR are marked as market rates', () => {
    expect(isMarketRate('EUR')).toBe(false);
    expect(isMarketRate('RON')).toBe(false);
    expect(isMarketRate('ARS')).toBe(true);
    expect(CURRENCIES.filter((c) => c.market).every((c) => isMarketRate(c.code))).toBe(true);
  });
  it('the market snapshot agrees with BNR on EUR within 1%', () => {
    expect(Math.abs(MARKET_RATES.rates.EUR! / BNR_RATES.rates.EUR! - 1)).toBeLessThan(0.01);
  });
});
