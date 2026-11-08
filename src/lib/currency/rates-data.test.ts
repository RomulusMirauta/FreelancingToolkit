import { describe, expect, it } from 'vitest';
import bnr from '../../data/rates.json';
import market from '../../data/market-rates.json';
import { historyMoves, sourcesApart } from '../../../scripts/rates-snapshot.mjs';

// The workflow refreshes these files before testing and building; when anything fails, nothing is deployed and the
// site stays on the last good version. The fetch scripts keep the saved file when new rates fail the checks in
// scripts/rates-snapshot.mjs. Those that need no earlier file run here too, on what is committed (so a file edited or
// merged by hand is checked as well), with the checks for a download broken in other ways.
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

describe('BNR history', () => {
  const history = (bnr as { history?: { date: string; rates: Record<string, number> }[] }).history ?? [];
  it('has up to 10 banking days, newest first, starting at the snapshot date', () => {
    expect(history.length).toBeGreaterThan(1);
    expect(history.length).toBeLessThanOrEqual(10);
    expect(history[0]!.date).toBe(bnr.date);
    for (let i = 1; i < history.length; i++) expect(history[i]!.date < history[i - 1]!.date).toBe(true);
  });
  it('every day has EUR and only positive rates', () => {
    for (const day of history) {
      expect(day.rates.EUR, day.date).toBeGreaterThan(3);
      for (const rate of Object.values(day.rates)) expect(rate > 0).toBe(true);
    }
  });
  it('no rate moves more than 5 times either way from one banking day to the next', () => {
    expect(historyMoves(history)).toEqual([]);
  });
});

describe('BNR and market rates', () => {
  // A multiplier lost puts a BNR rate 100 times off the market one; the two differ by under 2% on a normal day.
  it('are within 3 times of each other for every currency both price', () => {
    expect(sourcesApart(bnr.rates, market.rates)).toEqual([]);
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
