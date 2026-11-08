import { describe, expect, it } from 'vitest';
import { DEFAULT_TAX_OPTIONS, MAIN_REGIMES, computeRegime, type BoardRegime } from '../../lib/tax/regimes';
import { DEFAULT_WORK, type Period, type WorkSettings } from '../../lib/time/periods';
import { annualLei } from './Taxes';

const lei = (amount: number, per: Period = 'month') => ({ amount, per, currency: 'RON' });

// The working-time quick picks, and the settings that change the billable hours.
const WORK: Record<string, WorkSettings> = {
  fullTime: DEFAULT_WORK,
  partTime: { ...DEFAULT_WORK, hoursPerDay: 4 },
  fourDay: { ...DEFAULT_WORK, daysPerWeek: 4 },
  weekend: { ...DEFAULT_WORK, daysPerWeek: 2 },
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
