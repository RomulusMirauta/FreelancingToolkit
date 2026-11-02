import { describe, expect, it } from 'vitest';
import bnr from '../../data/rates.json';
import market from '../../data/market-rates.json';

// The workflow refreshes these files before testing and building: a broken download fails here, before deploy,
// and the site stays on the last good version.
describe.each([
  ['BNR', bnr as { date: string; rates: Record<string, number> }],
  ['market', market as { date: string; rates: Record<string, number> }],
])('%s rates snapshot', (_, table) => {
  it('has a real date, not in the future', () => {
    expect(table.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const date = new Date(`${table.date}T00:00:00Z`);
    expect(Number.isNaN(date.getTime())).toBe(false);
    expect(date.getTime()).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });

  it('has EUR and USD, and only positive, finite rates under 3-letter codes', () => {
    expect(table.rates.EUR).toBeGreaterThan(3);
    expect(table.rates.EUR).toBeLessThan(10);
    expect(table.rates.USD).toBeGreaterThan(2);
    for (const [code, rate] of Object.entries(table.rates)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(Number.isFinite(rate) && rate > 0, code).toBe(true);
    }
  });
});

describe('market snapshot', () => {
  it('names every currency it prices, in English and Romanian', () => {
    const names = market.names as Record<string, { en: string; ro: string }>;
    for (const code of Object.keys(market.rates)) {
      expect(names[code]?.en, code).toBeTruthy();
      expect(names[code]?.ro, code).toBeTruthy();
    }
  });

  it('covers well over a hundred currencies', () => {
    expect(Object.keys(market.rates).length).toBeGreaterThan(120);
  });
});
