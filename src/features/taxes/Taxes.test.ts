import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convert } from '../../lib/currency/convert';
import { BNR_RATES, effectiveRates } from '../../lib/currency/rates';
import { en, ro } from '../../lib/i18n/strings';
import { DEFAULT_TAX_OPTIONS, MAIN_REGIMES, computeRegime, type BoardRegime } from '../../lib/tax/regimes';
import { DEFAULT_WORK, rescale, type Period, type WorkSettings } from '../../lib/time/periods';
import { DEFAULT_SOURCE } from '../converter/Converter';
import { followedEurYear, monthIncome } from '../converter/sourceQuery';
import { annualEur, annualLei, neededGross, type TaxIncome } from './Taxes';

const lei = (amount: number, per: Period = 'month') => ({ amount, per, currency: 'RON' });

// The working-time quick picks, and the settings that change the billable hours.
const WORK: Record<string, WorkSettings> = {
  fullTime: DEFAULT_WORK,
  partTime: { ...DEFAULT_WORK, hoursPerDay: 4 },
  fourDay: { ...DEFAULT_WORK, daysPerWeek: 4 },
  twoDay: { ...DEFAULT_WORK, daysPerWeek: 2 },
  billable70: { ...DEFAULT_WORK, billablePct: 70 },
  holidays: { ...DEFAULT_WORK, holidays: true },
  daysOff21: { ...DEFAULT_WORK, daysOff: 21 },
};

describe('the yearly income the taxes are worked out on', () => {
  it.each(Object.entries(WORK))('%s: a whole-lei monthly amount gives exactly twelve times it', (_, work) => {
    const off: number[] = [];
    for (let m = 1; m <= 20_000; m++) if (annualLei(lei(m), work) !== 12 * m) off.push(m);
    expect(off.slice(0, 10)).toEqual([]);
  });

  it.each(Object.entries(WORK))('%s: a yearly amount on a threshold stays on it', (_, work) => {
    // 6, 12, 24 and 72 minimum wages, the income-norm limit, the VAT threshold, the micro-enterprise ceiling.
    for (const y of [24_300, 48_600, 97_200, 291_600, 126_037.5, 395_000, 509_850]) expect(annualLei(lei(y, 'year'), work)).toBe(y);
  });
});

describe('an income exactly on a threshold, as typed on the page', () => {
  const at = (amount: number, per: Period = 'month', work = DEFAULT_WORK) => {
    const annual = annualLei(lei(amount, per), work);
    return (r: BoardRegime) => computeRegime(r, annual, DEFAULT_TAX_OPTIONS);
  };
  const cas = (r: ReturnType<typeof computeRegime>) => r.lines.find((l) => l.key === 'cas')!.annual;

  it('4,050 a month, the minimum wage: the CIM keeps its untaxed amount, the PFA pays CAS, "Most money" stays put', () => {
    const r = at(4050);
    expect(r('employee').takeHome / 12).toBeCloseTo(2514.5, 6);
    expect(r('employee').notes).toContainEqual({ kind: 'untaxedAmount' });
    expect(cas(r('pfaReal'))).toBe(12_150);
    expect(r('pfaReal').takeHome / 12).toBeCloseTo(2369.25, 6);
    const most = [...MAIN_REGIMES].sort((a, b) => r(b).takeHome - r(a).takeHome)[0];
    expect(most).toBe('srlProfitNoSalary');
    expect(r('srlProfitNoSalary').takeHome / 12).toBeCloseTo(2655.18, 2);
  });

  it('8,100 a month: the PFA pays CAS on 24 minimum wages', () => {
    expect(cas(at(8100)('pfaReal'))).toBe(24_300);
  });

  it('4-day week: the micro-enterprise ceiling, the income-norm limit and July\'s untaxed-amount ceiling', () => {
    const fourDay = WORK.fourDay!;
    expect(at(42_487.5, 'month', fourDay)('srlMicro').notice).toEqual({ kind: 'microOk' });
    expect(at(126_037.5, 'year', fourDay)('pfaNorm').notice).toEqual({ kind: 'normLimit', overLimit: false });
    expect(at(4600, 'month', fourDay)('employee').notes).toContainEqual({ kind: 'untaxedAmount' });
  });
});

describe('the income-norm limit on the cards', () => {
  // The notice the card shows and "Most money" goes by, for an income as the board gets it.
  const verdict = (income: TaxIncome) => {
    const annual = annualLei(income, DEFAULT_WORK);
    const eur = annualEur(annual, income.currency) ?? followedEurYear(income, DEFAULT_WORK, DEFAULT_SOURCE);
    return computeRegime('pfaNorm', annual, DEFAULT_TAX_OPTIONS, eur).notice;
  };
  const norm = (amount: number, currency: string, per: Period = 'year') => verdict({ amount, per, currency });
  const over = (overLimit: boolean) => ({ kind: 'normLimit', overLimit });

  it('an income in EUR is compared with 25,000 EUR: 24,000 and 25,000 a year are allowed, 25,001 is not', () => {
    expect(norm(24_000, 'EUR')).toEqual(over(false));
    expect(norm(2_000, 'EUR', 'month')).toEqual(over(false));
    expect(norm(25_000, 'EUR')).toEqual(over(false));
    expect(norm(25_001, 'EUR')).toEqual(over(true));
  });

  it('an income in EUR comes back from lei as typed, whatever the day\'s rate', () => {
    // Without the rounding, 25,000 EUR a year comes back as 25,000.000000000004 at about 7% of EUR rates (5.2014, say),
    // over the limit, while at the others, today's included, every other test passes.
    const off: number[] = [];
    for (let cents = 2_499_000; cents <= 2_500_000; cents++) {
      const typed = cents / 100;
      if (annualEur(annualLei({ amount: typed, per: 'year', currency: 'EUR' }, DEFAULT_WORK), 'EUR') !== typed) off.push(typed);
    }
    expect(off.slice(0, 5)).toEqual([]);
  });

  it('an income in lei keeps the limit in lei, at the 2025 average', () => {
    expect(norm(126_037.5, 'RON')).toEqual(over(false));
    expect(norm(126_037.51, 'RON')).toEqual(over(true));
  });

  describe('an amount typed in the converter, which the tax page gets as lei a month', () => {
    let store: Map<string, string>;
    beforeEach(() => {
      store = new Map();
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      });
    });
    afterEach(() => vi.unstubAllGlobals());
    /** The converter's amount, saved, and the income it sends to the tax page (followConverter). */
    const converter = (amount: number, currency: string, per: Period) => {
      store.set('ft.source', JSON.stringify({ period: per, currency, amount }));
      return monthIncome(convert(rescale(amount, per, 'month', DEFAULT_WORK), currency, 'RON', effectiveRates(BNR_RATES, {})));
    };

    it('in EUR, is compared with 25,000 EUR too: 2,000 a month and 25,000 a year are allowed, 25,001 is not', () => {
      // At 5.3408, 2,000 EUR a month came as 10,681.60 RON, 128,179.20 a year: "Over the limit", with the star on SRL micro.
      expect(verdict(converter(2_000, 'EUR', 'month'))).toEqual(over(false));
      expect(verdict(converter(25_000, 'EUR', 'year'))).toEqual(over(false));
      expect(verdict(converter(25_001, 'EUR', 'year'))).toEqual(over(true));
    });

    it('in lei, or typed in lei on the tax page (the converter\'s amount too), keeps the limit in lei', () => {
      expect(verdict(converter(126_037.51, 'RON', 'year'))).toEqual(over(true));
      store.set('ft.source', JSON.stringify({ period: 'month', currency: 'RON', amount: 10_503.13 }));
      expect(verdict({ amount: 10_503.13, per: 'month', currency: 'RON' })).toEqual(over(true));
    });
  });

  it('over the limit, the warning reads the revenue as last year\'s and leaves next year to the 2026 average', () => {
    const enText = en.notices.normOver('25,000.00', '126,037.50');
    const roText = ro.notices.normOver('25.000,00', '126.037,50');
    expect(enText).toContain("If last year's revenue was this high");
    expect(enText).toContain('2026 average');
    expect(enText).not.toContain('would not be allowed next year');
    expect(roText).toContain('Dacă încasările de anul trecut au fost la fel de mari');
    expect(roText).toContain('cursul mediu pe 2026');
    expect(roText).not.toContain('anul viitor norma de venit nu ar mai fi permisă');
  });
});

describe('net to gross: the income norm over its limit is marked', () => {
  const norm = (targetLei: number, currency = 'RON') => neededGross(targetLei, currency, DEFAULT_TAX_OPTIONS).pfaNorm;
  // The norm's taxes are on the norm, not on the revenue: it needs this much on top of the take-home.
  const taxes = 126_037.5 - computeRegime('pfaNorm', 126_037.5, DEFAULT_TAX_OPTIONS).takeHome;

  it('the default 10,000 RON a month: the norm needs 141,870 RON a year, over its limit, and is the only row marked', () => {
    const rows = neededGross(120_000, 'RON', DEFAULT_TAX_OPTIONS);
    expect(rows.pfaNorm.annual).toBeCloseTo(141_870, 2);
    expect(MAIN_REGIMES.filter((r) => rows[r].overLimit)).toEqual(['pfaNorm']);
    expect(norm(60_000).overLimit).toBe(false);
  });

  it('in lei: a gross of exactly 126,037.50 RON a year is allowed, a ban more is not', () => {
    expect(norm(126_037.5 - taxes).overLimit).toBe(false);
    expect(norm(126_037.51 - taxes).overLimit).toBe(true);
  });

  it('in another currency: a gross of 24,000 or 25,000 EUR a year is allowed, 25,001 is not', () => {
    const rate = effectiveRates(BNR_RATES, {}).EUR!;
    const target = (grossEur: number) => Math.round(grossEur * rate * 100) / 100 - taxes;
    expect(norm(target(24_000), 'EUR').overLimit).toBe(false);
    expect(norm(target(25_000), 'EUR').overLimit).toBe(false);
    expect(norm(target(25_001), 'EUR').overLimit).toBe(true);
  });
});
