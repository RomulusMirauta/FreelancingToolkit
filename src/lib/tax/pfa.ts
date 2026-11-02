import { casBand, cassPfa } from './contributions';
import { P, mw } from './params';

export interface PfaOptions {
  expenses?: number;
  /** Annual income norm; when set, the income-norm system applies (no deductions, floor of 12 minimum wages). */
  norm?: number;
  hasSalary?: boolean;
  pensioner?: boolean;
}

export interface PfaYear {
  revenue: number;
  netIncome: number;
  cas: number;
  cass: number;
  tax: number;
  takeHome: number;
}

export function pfaYear(revenue: number, opts: PfaOptions = {}): PfaYear {
  const { expenses = 0, norm, hasSalary = false, pensioner = false } = opts;
  const real = norm === undefined;
  const netIncome = real ? Math.max(0, revenue - expenses) : Math.max(norm, mw(P.NormaMin));
  const cas = pensioner ? 0 : casBand(netIncome);
  const { total: cass, onIncome } = cassPfa(netIncome, hasSalary || pensioner);
  const deductible = real && P.PFADeduceCASCASS ? cas + onIncome : 0;
  const tax = Math.max(0, netIncome - deductible) * P.CotaImpozit;
  return { revenue, netIncome, cas, cass, tax, takeHome: revenue - expenses - cas - cass - tax };
}
