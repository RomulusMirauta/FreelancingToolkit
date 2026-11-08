import { isSaneAmount } from '../ui/numbers';
import { copyrightYear } from './copyright';
import { employeeMonth, employeeYear } from './employee';
import { P, mw } from './params';
import { pfaYear } from './pfa';
import { MICRO_CEILING_LEI, ownerSalaryYear, srlYear, type OwnerPay } from './srl';

/** The regimes shown side by side on the tax board, in display order. */
export const BOARD_REGIMES = [
  'employee', 'pfaReal', 'pfaNorm', 'srlMicro', 'srlProfitSalary', 'srlProfitNoSalary', 'copyright',
] as const;
export type BoardRegime = (typeof BOARD_REGIMES)[number];

/**
 * Ways of working that any freelancer can choose between: these compete for "most money" and can be the reference.
 * Copyright income is only for real creative works (a transfer-of-rights contract), so it is shown apart.
 */
export const MAIN_REGIMES: BoardRegime[] = BOARD_REGIMES.filter((r) => r !== 'copyright');
export const OTHER_REGIMES: BoardRegime[] = ['copyright'];

/** What the user can change on each card. Expenses are monthly, like the gross income input. */
export interface TaxOptions {
  employee: { dependants: number; under26: boolean; schoolChildren: number };
  pfaReal: { expensesMonthly: number; hasSalary: boolean; pensioner: boolean; sickLeave: boolean };
  pfaNorm: { normYearly: number; hasSalary: boolean; pensioner: boolean; sickLeave: boolean };
  srlMicro: { expensesMonthly: number; ownerEmployed: boolean; ownerPay: OwnerPay; otherEmployee: boolean; singleMicro: boolean };
  srlProfitSalary: { expensesMonthly: number; ownerPay: OwnerPay };
  srlProfitNoSalary: { expensesMonthly: number };
  copyright: { insured: boolean };
}

export const DEFAULT_TAX_OPTIONS: TaxOptions = {
  employee: { dependants: 0, under26: false, schoolChildren: 0 },
  pfaReal: { expensesMonthly: 0, hasSalary: false, pensioner: false, sickLeave: false },
  pfaNorm: { normYearly: mw(P.NormaMin), hasSalary: false, pensioner: false, sickLeave: false },
  srlMicro: { expensesMonthly: 0, ownerEmployed: true, ownerPay: 'cim', otherEmployee: false, singleMicro: true },
  srlProfitSalary: { expensesMonthly: 0, ownerPay: 'cim' },
  srlProfitNoSalary: { expensesMonthly: 0 },
  copyright: { insured: false },
};

/** Keeps saved options usable after the shape changes: unknown keys are dropped, missing ones defaulted. */
export function mergeTaxOptions(saved: unknown): TaxOptions {
  const out = structuredClone(DEFAULT_TAX_OPTIONS) as unknown as Record<string, Record<string, unknown>>;
  if (typeof saved !== 'object' || saved === null) return out as unknown as TaxOptions;
  for (const [regime, defaults] of Object.entries(out)) {
    const s = (saved as Record<string, unknown>)[regime];
    if (typeof s !== 'object' || s === null) continue;
    for (const [k, v] of Object.entries(defaults)) {
      const sv = (s as Record<string, unknown>)[k];
      const okString = typeof sv !== 'string' || (k === 'ownerPay' && (sv === 'cim' || sv === 'mandate'));
      if (typeof sv === typeof v && okString && (typeof sv !== 'number' || isSaneAmount(sv))) defaults[k] = sv;
    }
  }
  return out as unknown as TaxOptions;
}

export type LineKey =
  | 'gross' | 'revenue' | 'expenses' | 'netIncome' | 'taxedNorm' | 'flat'
  | 'cas' | 'cass' | 'incomeTax' | 'ownerGross' | 'cam' | 'microTax' | 'profitTax' | 'profit'
  | 'dividendTax' | 'cassDividends' | 'netDividends' | 'ownerNet' | 'takeHome' | 'employerCam' | 'employerTopUp' | 'employerCost' | 'sickLeave'
  | 'salaryNet' | 'sideNet';

export interface ResultLine {
  key: LineKey;
  /** Annual amount in lei. */
  annual: number;
  kind?: 'minus' | 'total' | 'info';
  sources?: string[];
}

export type Notice =
  | { kind: 'microOk' }
  | { kind: 'microFallback'; reason: 'ceiling' | 'noEmployee' | 'otherMicro' }
  | { kind: 'normLimit'; overLimit: boolean }
  | { kind: 'employeeHalves'; netH1: number; netH2: number }
  | { kind: 'belowMinimum' }
  | { kind: 'untaxedAmount' };

export interface RegimeResult {
  /** Annual take-home in lei. */
  takeHome: number;
  /** Taxes and contributions paid, as a share of the gross amount. */
  taxShare: number;
  lines: ResultLine[];
  notice?: Notice;
  /** Further notes under the main notice. */
  notes?: Notice[];
}

const CAS_KEYS = ['CotaCAS', 'PragCAS1', 'PragCAS2', 'SalMinRef'];
const CASS_TIER_KEYS = ['CotaCASS', 'CASSPrag1', 'CASSPrag2', 'CASSPrag3', 'SalMinRef'];
// Rounded to the ban like the micro-enterprise ceiling, so a future rate can't leave it a hair off (2026's is exact).
export const NORM_LIMIT_LEI = Math.round(P.PlafonNormaEUR * P.CursEURMediu2025 * 100) / 100;

/**
 * Revenue over the income-norm limit (Cod fiscal art. 69 alin. (9)): 25,000 EUR at BNR's average rate for the year the
 * revenue is earned, about the rates the revenue itself comes in at. So revenue in another currency is compared in EUR
 * (`eurPerYear`), and revenue in lei with the limit in lei at the 2025 average, the last one known.
 */
function normOverLimit(annual: number, eurPerYear?: number): boolean {
  return eurPerYear === undefined ? annual > NORM_LIMIT_LEI : eurPerYear > P.PlafonNormaEUR;
}

/** The range of the optional sick-leave insurance over the year: the lowest month and the highest. */
export const SICK_LEAVE_MONTHLY_MIN = P.CotaConcediiPFA * P.SalMin;
export const SICK_LEAVE_MONTHLY_MAX = P.CotaConcediiPFA * P.SalMinIul * P.BazaConcediiMaxSM;

/**
 * Optional sick-leave insurance for a PFA over a year: 1% a month of the income declared for CASS, kept between
 * 1 and 3 minimum wages (OUG 158/2005 art. 5). The limits follow the minimum wage of each month, so they rise in July.
 */
export function sickLeaveYearly(declaredYearly: number): number {
  const half = (minWage: number) =>
    6 * P.CotaConcediiPFA * Math.min(Math.max(declaredYearly / 12, minWage), P.BazaConcediiMaxSM * minWage);
  return half(P.SalMin) + half(P.SalMinIul);
}

/** What the owner's minimum-wage job costs in taxes each month (CAS, CASS, income tax, CAM), as a yearly average. */
export function ownerSalaryTaxesMonthly(): number {
  const s = ownerSalaryYear(true);
  return (s.gross - s.net + s.cam) / 12;
}

const share = (paid: number, of: number) => (of > 0 ? paid / of : 0);

/**
 * One regime, one yearly amount (gross salary for the employee, revenue for the rest). `eurPerYear`: the same amount
 * in EUR when it is earned in another currency, for the income-norm limit.
 */
export function computeRegime(regime: BoardRegime, annual: number, o: TaxOptions, eurPerYear?: number): RegimeResult {
  switch (regime) {
    case 'employee': {
      const opts = o.employee;
      const y = employeeYear(annual / 12, opts);
      const h1 = employeeMonth(annual / 12, 1, opts);
      const h2 = employeeMonth(annual / 12, 2, opts);
      const netH2 = h2.net;
      const netH1 = h1.net;
      return {
        takeHome: y.net,
        taxShare: share(y.gross - y.net, y.gross),
        // Only when July's minimum wage changes the net (low salaries); above that both halves are the same.
        notice: Math.abs(netH1 - netH2) >= 0.005 ? { kind: 'employeeHalves', netH1, netH2 } : undefined,
        notes: [
          ...(y.employerTopUp > 0 ? [{ kind: 'belowMinimum' as const }] : []),
          ...(h1.nontaxable > 0 || h2.nontaxable > 0 ? [{ kind: 'untaxedAmount' as const }] : []),
        ],
        lines: [
          { key: 'gross', annual: y.gross },
          { key: 'cas', annual: y.cas, kind: 'minus', sources: ['CotaCAS'] },
          { key: 'cass', annual: y.cass, kind: 'minus', sources: ['CotaCASS'] },
          { key: 'incomeTax', annual: y.tax, kind: 'minus', sources: ['CotaImpozit', 'DedPlafon', 'DedU26', 'DedCopil', 'SumaNetax1', 'SumaNetax2'] },
          { key: 'takeHome', annual: y.net, kind: 'total' },
          { key: 'employerCam', annual: y.cam, kind: 'info', sources: ['CotaCAM'] },
          ...(y.employerTopUp > 0 ? [{ key: 'employerTopUp' as const, annual: y.employerTopUp, kind: 'info' as const, sources: ['SalMin', 'SalMinIul', 'SumaNetax1', 'SumaNetax2'] }] : []),
          { key: 'employerCost', annual: y.employerCost, kind: 'info' },
        ],
      };
    }
    case 'pfaReal':
    case 'pfaNorm': {
      const norm = regime === 'pfaNorm';
      const expenses = norm ? 0 : 12 * o.pfaReal.expensesMonthly;
      const opt = norm ? o.pfaNorm : o.pfaReal;
      const r = pfaYear(annual, { expenses, norm: norm ? o.pfaNorm.normYearly : undefined, hasSalary: opt.hasSalary, pensioner: opt.pensioner });
      // Not deductible, so it comes straight off the take-home.
      const sickLeave = opt.sickLeave ? sickLeaveYearly(norm ? o.pfaNorm.normYearly : annual - expenses) : 0;
      const paid = r.cas + r.cass + r.tax + sickLeave;
      return {
        takeHome: r.takeHome - sickLeave,
        taxShare: share(paid, annual),
        notice: norm ? { kind: 'normLimit', overLimit: normOverLimit(annual, eurPerYear) } : undefined,
        lines: [
          { key: 'revenue', annual },
          ...(norm ? [] : [{ key: 'expenses' as const, annual: expenses, kind: 'minus' as const }]),
          { key: norm ? 'taxedNorm' : 'netIncome', annual: r.netIncome, kind: 'info', sources: norm ? ['NormaMin'] : undefined },
          { key: 'cas', annual: r.cas, kind: 'minus', sources: CAS_KEYS },
          { key: 'cass', annual: r.cass, kind: 'minus', sources: ['CotaCASS', 'CASSMinPFA', 'CASSMaxPFA'] },
          { key: 'incomeTax', annual: r.tax, kind: 'minus', sources: norm ? ['CotaImpozit'] : ['CotaImpozit', 'PFADeduceCASCASS'] },
          ...(sickLeave ? [{ key: 'sickLeave' as const, annual: sickLeave, kind: 'minus' as const, sources: ['CotaConcediiPFA', 'BazaConcediiMaxSM'] }] : []),
          { key: 'takeHome', annual: r.takeHome - sickLeave, kind: 'total' },
        ],
      };
    }
    case 'srlMicro':
    case 'srlProfitSalary':
    case 'srlProfitNoSalary': {
      const micro = regime === 'srlMicro';
      const expenses = 12 * o[regime].expensesMonthly;
      const r = srlYear(annual, micro
        ? { expenses, ownerEmployed: o.srlMicro.ownerEmployed, ownerPay: o.srlMicro.ownerPay, otherEmployee: o.srlMicro.otherEmployee, singleMicro: o.srlMicro.singleMicro }
        : { expenses, ownerEmployed: regime === 'srlProfitSalary', ownerPay: o.srlProfitSalary.ownerPay, choseProfitTax: true });
      const isMicro = r.regime === 'micro';
      const ownerTaxes = r.salaryGross - r.salaryNet;
      const paid = r.cam + r.companyTax + r.dividendTax + r.cassDividends + ownerTaxes;
      let notice: Notice | undefined;
      if (micro) {
        notice = isMicro ? { kind: 'microOk' } : {
          kind: 'microFallback',
          reason: annual > MICRO_CEILING_LEI ? 'ceiling'
            : !o.srlMicro.ownerEmployed && !o.srlMicro.otherEmployee ? 'noEmployee' : 'otherMicro',
        };
      }
      return {
        takeHome: r.takeHome,
        taxShare: share(paid, annual),
        notice,
        lines: [
          { key: 'revenue', annual },
          { key: 'expenses', annual: expenses, kind: 'minus' },
          ...(r.salaryGross > 0 ? [
            { key: 'ownerGross' as const, annual: r.salaryGross, kind: 'minus' as const, sources: ['SalMin', 'SalMinIul'] },
            { key: 'cam' as const, annual: r.cam, kind: 'minus' as const, sources: ['CotaCAM'] },
          ] : []),
          isMicro
            ? { key: 'microTax', annual: r.companyTax, kind: 'minus', sources: ['CotaMicro', 'PlafonMicroEUR', 'CursEURPlafon'] }
            : { key: 'profitTax', annual: r.companyTax, kind: 'minus', sources: ['CotaProfit'] },
          { key: 'profit', annual: r.profit, kind: 'info' },
          { key: 'dividendTax', annual: r.dividendTax, kind: 'minus', sources: ['CotaDividende'] },
          { key: 'cassDividends', annual: r.cassDividends, kind: 'minus', sources: CASS_TIER_KEYS },
          { key: 'netDividends', annual: r.netDividends - r.cassDividends, kind: 'info' },
          ...(r.salaryNet > 0 ? [{ key: 'ownerNet' as const, annual: r.salaryNet, kind: 'info' as const }] : []),
          { key: 'takeHome', annual: r.takeHome, kind: 'total' },
        ],
      };
    }
    case 'copyright': {
      const r = copyrightYear(annual, o.copyright.insured);
      return {
        takeHome: r.takeHome,
        taxShare: share(r.tax + r.cas + r.cass, annual),
        lines: [
          { key: 'gross', annual },
          { key: 'flat', annual: annual - r.netIncome, kind: 'info', sources: ['CotaForfetaraDA'] },
          { key: 'netIncome', annual: r.netIncome, kind: 'info' },
          { key: 'incomeTax', annual: r.tax, kind: 'minus', sources: ['CotaImpozit'] },
          { key: 'cas', annual: r.cas, kind: 'minus', sources: CAS_KEYS },
          { key: 'cass', annual: r.cass, kind: 'minus', sources: CASS_TIER_KEYS },
          { key: 'takeHome', annual: r.takeHome, kind: 'total' },
        ],
      };
    }
  }
}

// --- Income on top of a job -----------------------------------------------------------------

export type SideKind = 'pfa' | 'copyright';
export const SIDE_KINDS: SideKind[] = ['pfa', 'copyright'];

export interface SideJobInput {
  salaryMonthly: number;
  sideMonthly: number;
}

export const DEFAULT_SIDE_JOB: SideJobInput = { salaryMonthly: 8000, sideMonthly: 5000 };

export interface SideJobResult {
  /** Annual take-home: net salary plus what is left of the side income. */
  takeHome: number;
  /** Annual net salary alone, the comparison point. */
  salaryNet: number;
  sideNet: number;
  /** Taxes and contributions on the side income, as a share of it. */
  sideTaxShare: number;
  lines: ResultLine[];
  notice: 'cassWaived' | 'cassMin' | 'daEmployee' | 'daNoSalary';
}

/**
 * A job (CIM) plus a PFA on the real system or copyright income. Same rules as the single regimes:
 * - PFA: CAS is still due from 12 minimum wages of net income; the CASS minimum base of 6 minimum wages
 *   is waived when the yearly salary is at least 6 minimum wages (CASS is then due on the real income only).
 * - Copyright: an employee owes no CAS or CASS on it, only income tax.
 */
export function computeSideJob(kind: SideKind, input: SideJobInput): SideJobResult {
  const salary = employeeYear(input.salaryMonthly);
  const side = 12 * input.sideMonthly;
  const employed = input.salaryMonthly > 0;
  let sideNet: number;
  let paid: number;
  let notice: SideJobResult['notice'];
  let detail: ResultLine[];
  if (kind === 'pfa') {
    const waived = 12 * input.salaryMonthly >= mw(P.CASSMinPFA);
    const r = pfaYear(side, { hasSalary: waived });
    sideNet = r.takeHome;
    paid = r.cas + r.cass + r.tax;
    notice = waived ? 'cassWaived' : 'cassMin';
    detail = [
      { key: 'cas', annual: r.cas, kind: 'minus', sources: CAS_KEYS },
      { key: 'cass', annual: r.cass, kind: 'minus', sources: ['CotaCASS', 'CASSMinPFA', 'CASSMaxPFA'] },
      { key: 'incomeTax', annual: r.tax, kind: 'minus', sources: ['CotaImpozit', 'PFADeduceCASCASS'] },
    ];
  } else {
    const r = copyrightYear(side, employed);
    sideNet = r.takeHome;
    paid = r.tax + r.cas + r.cass;
    notice = employed ? 'daEmployee' : 'daNoSalary';
    detail = [
      { key: 'flat', annual: side - r.netIncome, kind: 'info', sources: ['CotaForfetaraDA'] },
      { key: 'incomeTax', annual: r.tax, kind: 'minus', sources: ['CotaImpozit'] },
      { key: 'cas', annual: r.cas, kind: 'minus', sources: CAS_KEYS },
      { key: 'cass', annual: r.cass, kind: 'minus', sources: CASS_TIER_KEYS },
    ];
  }
  return {
    takeHome: salary.net + sideNet,
    salaryNet: salary.net,
    sideNet,
    sideTaxShare: side > 0 ? paid / side : 0,
    notice,
    lines: [
      { key: 'salaryNet', annual: salary.net, kind: 'info' },
      { key: 'revenue', annual: side },
      ...detail,
      { key: 'sideNet', annual: sideNet, kind: 'info' },
      { key: 'takeHome', annual: salary.net + sideNet, kind: 'total' },
    ],
  };
}
