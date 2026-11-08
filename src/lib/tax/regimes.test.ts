import { describe, expect, it } from 'vitest';
import golden from '../../../data/golden-2026.json';
import { compareYear } from './compare';
import { copyrightYear } from './copyright';
import { employeeMonth, employeeYear } from './employee';
import { pfaYear } from './pfa';
import { BOARD_REGIMES, DEFAULT_TAX_OPTIONS, computeRegime, computeSideJob, mergeTaxOptions } from './regimes';
import { mandateMonth, srlYear } from './srl';

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
