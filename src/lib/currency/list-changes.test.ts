import { describe, expect, it, vi } from 'vitest';
import { CURRENCIES, currencySymbol } from './currencies';
import { BNR_RATES, MARKET_RATES, effectiveRates, isMarketRate } from './rates';
// The data tests, run again here on the snapshots changed below.
import './rates-data.test';
import './convert.test';
import './symbols.test';

// The deploy downloads both feeds again before testing. A change in either feed's list of currencies isn't a broken
// download, so the data tests must still pass. Here they run on the bundled snapshots as they would read after BNR
// starts publishing KZT (which the market source prices too) and stops publishing RSD (as it did BGN in 2026), and
// after the market source drops HRK, which has a symbol in the fixed table. The market snapshot also has ZWL, as one
// written before npm run rates left it out does. (Vitest applies vi.mock before any import.)
type Rates = Record<string, number>;

vi.mock('../../data/rates.json', async (importOriginal) => {
  const { default: real } = await importOriginal<{ default: { rates: Rates; history: { rates: Rates }[] } }>();
  const copy = structuredClone(real);
  for (const rates of [copy.rates, copy.history[0]!.rates]) {
    rates.KZT = 0.010539;
    delete rates.RSD;
  }
  return { default: copy, ...copy };
});

vi.mock('../../data/market-rates.json', async (importOriginal) => {
  const { default: real } = await importOriginal<{ default: { rates: Rates; names: Record<string, unknown> } }>();
  const copy = structuredClone(real);
  delete copy.rates.HRK;
  delete copy.names.HRK;
  copy.rates.ZWL = 0.179189;
  copy.names.ZWL = { en: 'Zimbabwean Dollar (2009–2024)', ro: 'Dolar Zimbabwe (2009)' };
  return { default: copy, ...copy };
});

describe('after a change in the currency lists', () => {
  const listed = (code: string) => CURRENCIES.find((c) => c.code === code);

  it('a currency BNR starts publishing is listed with its BNR rate, not as a market rate', () => {
    expect(listed('KZT')).toMatchObject({ code: 'KZT' });
    expect(listed('KZT')).not.toHaveProperty('market');
    expect(isMarketRate('KZT')).toBe(false);
    expect(MARKET_RATES.rates.KZT).not.toBe(0.010539);
    expect(effectiveRates(BNR_RATES, {}).KZT).toBe(0.010539);
  });

  it('a currency BNR stops publishing is still listed, as a market rate', () => {
    expect(listed('RSD')).toMatchObject({ ro: 'Dinar sârbesc', market: true });
    expect(isMarketRate('RSD')).toBe(true);
  });

  it('a currency the market source drops is no longer listed; its symbol stays in the table, unused', () => {
    expect(listed('HRK')).toBeUndefined();
    expect(currencySymbol('HRK')).toBe('kn');
  });

  it('the old Zimbabwean dollar, priced like the ZiG, is not listed even when the market snapshot still has it', () => {
    expect(MARKET_RATES.rates.ZWL).toBe(0.179189);
    expect(listed('ZWL')).toBeUndefined();
  });
});
