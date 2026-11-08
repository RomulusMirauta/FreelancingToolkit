import { describe, expect, it } from 'vitest';
import golden from '../../../data/golden-2026.json';
import { compareYear } from './compare';
import { copyrightYear } from './copyright';
import { employeeMonth, employeeYear } from './employee';
import { pfaYear } from './pfa';
import {
  BOARD_REGIMES, DEFAULT_TAX_OPTIONS, computeRegime, computeSideJob, keptShare, mergeTaxOptions,
  type LineKey, type RegimeResult, type TaxOptions,
} from './regimes';
import { mandateMonth, srlYear } from './srl';

/** The default card options, with some of them changed. */
function withOptions(patch: { [K in keyof TaxOptions]?: Partial<TaxOptions[K]> }): TaxOptions {
  const o = structuredClone(DEFAULT_TAX_OPTIONS);
  for (const k of Object.keys(patch) as (keyof TaxOptions)[]) Object.assign(o[k], patch[k]);
  return o;
}
const lineOf = (r: RegimeResult, key: LineKey) => r.lines.find((l) => l.key === key)?.annual;

describe('salary under the minimum base', () => {
  it('the employer pays the rest of CAS and CASS, and the net stays', () => {
    const h1 = employeeMonth(3000, 1);
    expect(h1.employerTopUp).toBe(263); // 938 + 375 at the 3,750 base, less 750 + 300
    expect(h1.employerCost).toBe(3000 + h1.cam + 263);
    expect(h1.net).toBe(3000 - 750 - 300 - h1.tax);
    expect(employeeMonth(3000, 2).employerTopUp).toBe(394); // 1,031 + 413 at the 4,125 base, less 750 + 300
  });

  it('stops at the base, and an empty salary owes nothing', () => {
    expect(employeeMonth(3750, 1).employerTopUp).toBe(0);
    expect(employeeMonth(4125, 2).employerTopUp).toBe(0);
    expect(employeeMonth(0, 1).employerTopUp).toBe(0);
  });

  it('the card shows the note and the line only when they apply', () => {
    const notes = (monthly: number) => computeRegime('employee', 12 * monthly, DEFAULT_TAX_OPTIONS).notes?.map((n) => n.kind);
    expect(notes(3000)).toEqual(['belowMinimum']);
    expect(notes(4000)).toEqual(['belowMinimum']); // under July's base only; the January-June top-up is 0
    expect(notes(4200)).toEqual(['untaxedAmount']);
    expect(notes(5000)).toEqual([]);
    const lines = computeRegime('employee', 36_000, DEFAULT_TAX_OPTIONS).lines.map((l) => l.key);
    expect(lines).toContain('employerTopUp');
    expect(computeRegime('employee', 60_000, DEFAULT_TAX_OPTIONS).lines.map((l) => l.key)).not.toContain('employerTopUp');
  });
});

describe('dependants that are not a whole number from 0 to 4', () => {
  it('still give a net: whole people count, and 4 is the most', () => {
    // 5,000 a month is under the minimum wage + 2,000, where the deduction table is read; 2.5 gave NaN.
    for (const dependants of [2.5, -1, Number.NaN]) expect(Number.isFinite(employeeMonth(5000, 1, { dependants }).net), String(dependants)).toBe(true);
    expect(employeeMonth(5000, 1, { dependants: 2.5 })).toEqual(employeeMonth(5000, 1, { dependants: 2 }));
    expect(employeeMonth(5000, 2, { dependants: 7 })).toEqual(employeeMonth(5000, 2, { dependants: 4 }));
    expect(employeeMonth(5000, 1, { dependants: -1 })).toEqual(employeeMonth(5000, 1));
  });
});

// Worked out by hand from params-2026.json and the Fiscal Code, here and in 'card options' below. The golden file comes
// from a Python port of the same rules: it catches a slip in one of the two, not a rule both read wrong.
describe('salary at the edges of the untaxed amount and the deduction (art. 77, OUG 89/2025 art. III)', () => {
  it('the untaxed amount up to its ceiling, inclusive', () => {
    // 4,300 in January–June: 300 untaxed, CAS 1,000, CASS 400, deduction 17.5% of 4,050 = 709, tax 189.
    expect(employeeMonth(4_300, 1)).toMatchObject({ nontaxable: 300, net: 2_711 });
    // 4,600 in July–December: 200 untaxed, CAS 1,100, CASS 440, deduction 17% of 4,325 = 735, tax 213.
    expect(employeeMonth(4_600, 2)).toMatchObject({ nontaxable: 200, net: 2_847 });
  });

  it('the last step of the table, minimum wage + 2,000: 25% with 4 dependants, and nothing a leu above', () => {
    // CAS 1,513, CASS 605, deduction 25% of 4,050 = 1,013, tax 292.
    expect(employeeMonth(6_050, 1, { dependants: 4 })).toMatchObject({ deduction: 1_013, net: 3_640 });
    expect(employeeMonth(6_051, 1, { dependants: 4 }).deduction).toBe(0);
  });

  it('under 26: 15% of the minimum wage up to minimum wage + 2,000, nothing above (alin. (10) lit. a))', () => {
    expect(employeeMonth(6_050, 1, { under26: true }).deduction).toBe(608);
    expect(employeeMonth(10_000, 1, { under26: true }).deduction).toBe(0);
    expect(employeeMonth(10_000, 2, { under26: true }).deduction).toBe(0);
  });
});

describe('micro-enterprise ceiling', () => {
  it('revenue of exactly 100,000 EUR at the 31.12.2025 rate is still micro', () => {
    expect(srlYear(509_850).regime).toBe('micro');
    expect(srlYear(509_850.01).regime).toBe('profit');
  });
});

describe('income-norm limit', () => {
  it('revenue of exactly 25,000 EUR at the 2025 average rate is still allowed', () => {
    expect(computeRegime('pfaNorm', 126_037.5, DEFAULT_TAX_OPTIONS).notice).toEqual({ kind: 'normLimit', overLimit: false });
    expect(computeRegime('pfaNorm', 126_037.51, DEFAULT_TAX_OPTIONS).notice).toEqual({ kind: 'normLimit', overLimit: true });
  });

  it('revenue in another currency is compared in EUR: up to 25,000 EUR it is allowed, whatever it makes in lei', () => {
    // At 5.3408 lei, 24,000 EUR is 128,179.20 lei: over the limit in lei at the 2025 average, not in EUR.
    const notice = (eur: number) => computeRegime('pfaNorm', Math.round(eur * 5.3408 * 100) / 100, DEFAULT_TAX_OPTIONS, eur).notice;
    expect(notice(24_000)).toEqual({ kind: 'normLimit', overLimit: false });
    expect(notice(25_000)).toEqual({ kind: 'normLimit', overLimit: false });
    expect(notice(25_001)).toEqual({ kind: 'normLimit', overLimit: true });
    expect(computeRegime('pfaNorm', 128_179.2, DEFAULT_TAX_OPTIONS).notice).toEqual({ kind: 'normLimit', overLimit: true });
  });
});

describe('PFA net income exactly on a CAS band', () => {
  it('revenue minus expenses of exactly 12 or 24 minimum wages pays that band, whatever the bani', () => {
    const off: string[] = [];
    for (const [monthly, cas] of [[4050, 12_150], [8100, 24_300]] as const) {
      for (let bani = 1; bani <= 200_000; bani++) {
        // A year of (monthly + expenses) a month, to the ban, as the tax page passes it.
        const revenue = (12 * (100 * monthly + bani)) / 100;
        if (pfaYear(revenue, { expenses: 12 * (bani / 100) }).cas !== cas) off.push(`${monthly} + ${bani / 100}`);
      }
    }
    expect(off.slice(0, 10)).toEqual([]);
  });

  it('on the card: 5,500.20 a month less 1,450.20 of expenses', () => {
    const o = { ...DEFAULT_TAX_OPTIONS, pfaReal: { ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly: 1450.2 } };
    expect(computeRegime('pfaReal', 66_002.4, o).lines.find((l) => l.key === 'cas')!.annual).toBe(12_150);
  });

  it('on the card: 10,922.71 a month less 2,822.71 of expenses, on 24 minimum wages', () => {
    // 97,199.99999999999 unrounded: the sweep above never lands a hair under 24 minimum wages, so it can't tell.
    expect(lineOf(computeRegime('pfaReal', 131_072.52, withOptions({ pfaReal: { expensesMonthly: 2822.71 } })), 'cas')).toBe(24_300);
  });
});

describe('copyright net income exactly on a band', () => {
  it('pays CAS and CASS on the same band, also from a link with an amount a hair under it', () => {
    // ?side=6749.9994 (the address takes any decimals): a net income of 48,599.99568, which CAS took to the ban, on 12
    // minimum wages, and CASS didn't, on 6.
    const r = computeSideJob('copyright', { salaryMonthly: 0, sideMonthly: 6749.9994 });
    expect(['cas', 'cass'].map((key) => r.lines.find((l) => l.key === key)!.annual)).toEqual([12_150, 4_860]);
    expect(copyrightYear(161_999.9928)).toMatchObject({ cas: 24_300, cass: 9_720 });
  });
});

describe('tax board regimes', () => {
  it('with default options, match the comparison engine (and so the golden file)', () => {
    for (const monthly of Object.values(golden.scenario_monthly_gross)) {
      const annual = 12 * monthly;
      const c = compareYear(annual);
      const at = (r: (typeof BOARD_REGIMES)[number]) => computeRegime(r, annual, DEFAULT_TAX_OPTIONS).takeHome;
      expect(at('employee')).toBeCloseTo(c.employee, 6);
      expect(at('pfaReal')).toBeCloseTo(c.pfa, 6);
      expect(at('srlMicro')).toBeCloseTo(c.srlMicro, 6);
      expect(at('srlProfitSalary')).toBeCloseTo(c.srlProfitSalary, 6);
      expect(at('srlProfitNoSalary')).toBeCloseTo(c.srlProfitNoSalary, 6);
      expect(at('copyright')).toBeCloseTo(c.copyright, 6);
    }
  });

  it('employee: the Jan–Jun / Jul–Dec note only when the two nets differ', () => {
    expect(computeRegime('employee', 12 * 4_100, DEFAULT_TAX_OPTIONS).notice?.kind).toBe('employeeHalves');
    expect(computeRegime('employee', 12 * 27_776.32, DEFAULT_TAX_OPTIONS).notice).toBeUndefined();
  });

  it('employee at 30,000 lei gross: tax share as in the workbook (H2: 41.5%)', () => {
    const r = computeRegime('employee', 12 * 30_000, DEFAULT_TAX_OPTIONS);
    expect(r.taxShare).toBeCloseTo(0.415, 3);
  });

  it('PFA income norm taxes the norm, not the revenue', () => {
    const r = computeRegime('pfaNorm', 360_000, DEFAULT_TAX_OPTIONS);
    expect(r.lines.find((l) => l.key === 'taxedNorm')!.annual).toBe(48_600);
    expect(r.notice).toEqual({ kind: 'normLimit', overLimit: true });
  });

  it('SRL micro above the ceiling falls back to profit tax and says why', () => {
    expect(computeRegime('srlMicro', 600_000, DEFAULT_TAX_OPTIONS).notice).toEqual({ kind: 'microFallback', reason: 'ceiling' });
  });

  it('monthly expenses are applied twelve times', () => {
    const o = { ...DEFAULT_TAX_OPTIONS, pfaReal: { ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly: 1000 } };
    const r = computeRegime('pfaReal', 120_000, o);
    expect(r.lines.find((l) => l.key === 'netIncome')!.annual).toBe(108_000);
  });

  it('PFA sick-leave insurance is 1% of the declared income, between 1 and 3 minimum wages of each month, and not deductible', () => {
    const cost = (annual: number, expensesMonthly = 0) => {
      const pfaReal = { ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly };
      const off = { ...DEFAULT_TAX_OPTIONS, pfaReal };
      const on = { ...DEFAULT_TAX_OPTIONS, pfaReal: { ...pfaReal, sickLeave: true } };
      return computeRegime('pfaReal', annual, off).takeHome - computeRegime('pfaReal', annual, on).takeHome;
    };
    expect(cost(120_000)).toBeCloseTo(12 * 100, 6); // 10,000 a month, inside the limits
    expect(cost(120_000, 8_000)).toBeCloseTo(6 * 40.5 + 6 * 43.25, 6); // 2,000 a month: the minimum wage of each half
    expect(cost(600_000)).toBeCloseTo(6 * 121.5 + 6 * 129.75, 6); // 50,000 a month: three minimum wages
    expect(cost(150_000)).toBeCloseTo(6 * 121.5 + 6 * 125, 6); // 12,500 a month: over the limit only until June
  });

  it('PFA on an income norm pays sick-leave insurance on the norm, not on the revenue', () => {
    const norm = { ...DEFAULT_TAX_OPTIONS.pfaNorm, normYearly: 72_000 };
    const off = { ...DEFAULT_TAX_OPTIONS, pfaNorm: norm };
    const on = { ...DEFAULT_TAX_OPTIONS, pfaNorm: { ...norm, sickLeave: true } };
    expect(computeRegime('pfaNorm', 300_000, off).takeHome - computeRegime('pfaNorm', 300_000, on).takeHome).toBeCloseTo(720, 6);
  });

  it('SRL owner paid by mandate: no personal deduction, so a lower net than CIM; still a micro-enterprise', () => {
    const cim = computeRegime('srlMicro', 300_000, DEFAULT_TAX_OPTIONS);
    const o = { ...DEFAULT_TAX_OPTIONS, srlMicro: { ...DEFAULT_TAX_OPTIONS.srlMicro, ownerPay: 'mandate' as const } };
    const mandate = computeRegime('srlMicro', 300_000, o);
    expect(mandate.notice).toEqual({ kind: 'microOk' });
    const net = (r: typeof cim) => r.lines.find((l) => l.key === 'ownerNet')!.annual;
    expect(net(mandate)).toBeLessThan(net(cim));
    // H1 month at 4,050: CAS 1,013, CASS 405, tax 263 → net 2,369.
    expect(mandateMonth(4050).net).toBe(2369);
  });

  it('SRL with owner salary: revenue that does not cover the salary costs is paid by the owner', () => {
    // With no revenue, the owner funds the minimum-wage salary and its taxes: take-home is negative, not the net salary.
    expect(computeRegime('srlMicro', 0, DEFAULT_TAX_OPTIONS).takeHome).toBeLessThan(0);
    expect(computeRegime('srlProfitSalary', 0, DEFAULT_TAX_OPTIONS).takeHome).toBeLessThan(0);
  });

  it('merging saved options keeps valid values and defaults the rest', () => {
    const merged = mergeTaxOptions({ employee: { dependants: 2, under26: 'yes' }, bogus: {} });
    expect(merged.employee).toEqual({ dependants: 2, under26: false, schoolChildren: 0 });
    expect(merged.pfaNorm).toEqual(DEFAULT_TAX_OPTIONS.pfaNorm);
  });

  it('merging saved options keeps people only as whole numbers in the pickers\' ranges, as the address does', () => {
    const employee = (saved: object) => mergeTaxOptions({ employee: saved }).employee;
    // From an old link or edited storage: 2.5 dependants made the CIM card NaN, a billion children cancelled the tax.
    expect(employee({ dependants: 2.5, under26: true, schoolChildren: 11 })).toEqual({ dependants: 0, under26: true, schoolChildren: 0 });
    expect(employee({ dependants: 7, under26: false, schoolChildren: 999_999_999 })).toEqual(DEFAULT_TAX_OPTIONS.employee);
    expect(employee({ dependants: 1.5, under26: false, schoolChildren: 0.5 })).toEqual(DEFAULT_TAX_OPTIONS.employee);
    for (let n = 0; n <= 4; n++) expect(employee({ dependants: n }).dependants).toBe(n);
    for (let n = 0; n <= 10; n++) expect(employee({ schoolChildren: n }).schoolChildren).toBe(n);
    // Amounts keep their cents.
    expect(mergeTaxOptions({ pfaReal: { expensesMonthly: 1450.2 } }).pfaReal.expensesMonthly).toBe(1450.2);
  });

  it('the bar of what you keep is the take-home over the gross: expenses are spent, not kept', () => {
    // 30,000 a month with 20,000 of expenses: 6,277.50 a month on the PFA is 20.9% of the gross (it said 87.6%) and
    // 6,651 on the SRL without salary 22.2% (it said 88.8%).
    const o = {
      ...DEFAULT_TAX_OPTIONS,
      pfaReal: { ...DEFAULT_TAX_OPTIONS.pfaReal, expensesMonthly: 20_000 },
      srlProfitNoSalary: { expensesMonthly: 20_000 },
    };
    expect(keptShare(computeRegime('pfaReal', 360_000, o), 360_000)).toBeCloseTo(75_330 / 360_000, 9);
    expect(keptShare(computeRegime('srlProfitNoSalary', 360_000, o), 360_000)).toBeCloseTo(79_812 / 360_000, 9);
  });

  it('without expenses, what you keep is what the taxes leave, on every card', () => {
    for (const annual of [120_000, 333_265.92]) {
      for (const regime of BOARD_REGIMES) {
        const r = computeRegime(regime, annual, DEFAULT_TAX_OPTIONS);
        expect(keptShare(r, annual), regime).toBeCloseTo(1 - r.taxShare, 9);
      }
    }
  });

  it('a loss, or no income, keeps nothing', () => {
    // 1,500 a month on the income norm: its taxes are more than that, a take-home of −322.50 a month.
    const norm = computeRegime('pfaNorm', 18_000, DEFAULT_TAX_OPTIONS);
    expect(norm.takeHome / 12).toBeCloseTo(-322.5, 6);
    expect(keptShare(norm, 18_000)).toBe(0);
    for (const regime of BOARD_REGIMES) expect(keptShare(computeRegime(regime, 0, DEFAULT_TAX_OPTIONS), 0), regime).toBe(0);
  });

  it('CIM + PFA: salary of at least 6 minimum wages a year waives the CASS minimum on the PFA', () => {
    const r = computeSideJob('pfa', { salaryMonthly: 8000, sideMonthly: 1000 });
    expect(r.notice).toBe('cassWaived');
    expect(r.salaryNet).toBeCloseTo(employeeYear(8000).net, 6);
    expect(r.sideNet).toBeCloseTo(pfaYear(12_000, { hasSalary: true }).takeHome, 6);
    // CASS is 10% of 12,000, not the 2,430 minimum.
    expect(r.lines.find((l) => l.key === 'cass')!.annual).toBeCloseTo(1200, 6);
  });

  it('CIM + copyright: an employee pays only income tax on copyright income (6% of gross)', () => {
    const r = computeSideJob('copyright', { salaryMonthly: 8000, sideMonthly: 5000 });
    expect(r.sideNet).toBeCloseTo(copyrightYear(60_000, true).takeHome, 6);
    expect(r.sideTaxShare).toBeCloseTo(0.06, 9);
    expect(r.notice).toBe('daEmployee');
  });
});

describe('card options', () => {
  it('income norm: CAS, CASS and 10% tax on the norm, with nothing deducted (art. 69^2, art. 118 alin. (2))', () => {
    // The default norm, 48,600: CAS 25% of 12 minimum wages, 12,150; CASS 4,860; tax 4,860.
    const r = computeRegime('pfaNorm', 100_000, DEFAULT_TAX_OPTIONS);
    expect(lineOf(r, 'incomeTax')).toBeCloseTo(4_860, 6);
    expect(r.takeHome).toBeCloseTo(78_130, 6);
    // 72,000: CAS still 12,150 (under 24 minimum wages), CASS 7,200, tax 7,200.
    expect(computeRegime('pfaNorm', 100_000, withOptions({ pfaNorm: { normYearly: 72_000 } })).takeHome).toBeCloseTo(73_450, 6);
  });

  it('income norm: a norm under 12 minimum wages is taxed as 48,600 (art. 69 alin. (3))', () => {
    const r = computeRegime('pfaNorm', 100_000, withOptions({ pfaNorm: { normYearly: 20_000 } }));
    expect(lineOf(r, 'taxedNorm')).toBe(48_600);
    expect(r.takeHome).toBeCloseTo(78_130, 6);
  });

  it('PFA pensioner: no CAS (art. 150 alin. (1)), and CASS without the minimum of 6 minimum wages (art. 174 alin. (7))', () => {
    // 100,000: CASS 10,000, tax 10% of 90,000.
    const r = computeRegime('pfaReal', 100_000, withOptions({ pfaReal: { pensioner: true } }));
    expect(lineOf(r, 'cas')).toBe(0);
    expect(r.takeHome).toBeCloseTo(81_000, 6);
    // 20,000: CASS 2,000, not 2,430.
    expect(computeRegime('pfaReal', 20_000, withOptions({ pfaReal: { pensioner: true } })).takeHome).toBeCloseTo(16_200, 6);
    // On the income norm: CASS 4,860 and tax 4,860 on 48,600.
    expect(computeRegime('pfaNorm', 100_000, withOptions({ pfaNorm: { pensioner: true } })).takeHome).toBeCloseTo(90_280, 6);
  });

  it('PFA with a salary of at least 6 minimum wages: CASS without the minimum (art. 174 alin. (7) lit. a))', () => {
    expect(computeRegime('pfaReal', 20_000, withOptions({ pfaReal: { hasSalary: true } })).takeHome).toBeCloseTo(16_200, 6);
  });

  it('SRL expenses lower the profit tax, 16% of what is left, but not the micro tax, 1% of revenue', () => {
    // 600,000 less 120,000: profit tax 76,800, dividend tax 64,512 on 403,200, CASS 9,720 (24 minimum wages).
    const profit = computeRegime('srlProfitNoSalary', 600_000, withOptions({ srlProfitNoSalary: { expensesMonthly: 10_000 } }));
    expect(lineOf(profit, 'profitTax')).toBeCloseTo(76_800, 6);
    expect(profit.takeHome).toBeCloseTo(328_968, 6);
    // 300,000 less 60,000, the owner's 50,250 and CAM 1,062: micro tax 3,000, profit 185,688.
    const micro = computeRegime('srlMicro', 300_000, withOptions({ srlMicro: { expensesMonthly: 5_000 } }));
    expect(lineOf(micro, 'microTax')).toBeCloseTo(3_000, 6);
    expect(lineOf(micro, 'profit')).toBeCloseTo(185_688, 6);
  });

  it('micro-enterprise: an employee, the owner or another, and no other micro-enterprise (art. 47 alin. (1))', () => {
    const notice = (srlMicro: Partial<TaxOptions['srlMicro']>) => computeRegime('srlMicro', 300_000, withOptions({ srlMicro })).notice;
    expect(notice({ ownerEmployed: false })).toEqual({ kind: 'microFallback', reason: 'noEmployee' });
    expect(notice({ ownerEmployed: false, otherEmployee: true })).toEqual({ kind: 'microOk' });
    expect(notice({ singleMicro: false })).toEqual({ kind: 'microFallback', reason: 'otherMicro' });
  });

  it('mandate: CAM is due (art. 220^4), and the profit-tax card pays the owner by mandate too', () => {
    expect(mandateMonth(4_050).cam).toBe(91);
    // 6 × 2,369 in January–June, 6 × 2,530 in July–December (CAS 1,081, CASS 433, tax 281 on 4,325).
    const r = computeRegime('srlProfitSalary', 300_000, withOptions({ srlProfitSalary: { ownerPay: 'mandate' } }));
    expect(lineOf(r, 'ownerNet')).toBe(29_394);
  });

  it('copyright, also an employee or a pensioner: only the income tax (art. 150, art. 154 alin. (1) lit. h^1))', () => {
    // 200,000: tax 12,000 on 120,000; without the option, also CAS 24,300 and CASS 9,720.
    expect(computeRegime('copyright', 200_000, withOptions({ copyright: { insured: true } })).takeHome).toBeCloseTo(188_000, 6);
  });
});
