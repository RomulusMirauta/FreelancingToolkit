import { P, rnd } from './params';

export type Half = 1 | 2;

export interface EmployeeOptions {
  dependants?: number;
  under26?: boolean;
  schoolChildren?: number;
}

export interface EmployeeMonth {
  gross: number;
  mw: number;
  nontaxable: number;
  cas: number;
  cass: number;
  deduction: number;
  tax: number;
  net: number;
  cam: number;
  /** CAS and CASS the employer pays on top, for a salary under the minimum base. */
  employerTopUp: number;
  employerCost: number;
}

/** The least that CAS and CASS are due on: the minimum wage less the untaxed amount (Cod fiscal art. 146 alin. (5^6), art. 168 alin. (6^1); OUG 89/2025). */
export const contributionFloor = (half: Half) => (half === 1 ? P.SalMin - P.SumaNetax1 : P.SalMinIul - P.SumaNetax2);

/**
 * One month of salary. Half 1 is January–June, half 2 is July–December: the minimum wage,
 * the non-taxable amount and the personal deduction differ between them.
 */
export function employeeMonth(gross: number, half: Half, opts: EmployeeOptions = {}): EmployeeMonth {
  const { dependants = 0, under26 = false, schoolChildren = 0 } = opts;
  const MW = half === 1 ? P.SalMin : P.SalMinIul;
  const ntAmount = half === 1 ? P.SumaNetax1 : P.SumaNetax2;
  const ntCeiling = half === 1 ? P.PlafonNetax1 : P.PlafonNetax2;
  const nontaxable = gross >= MW && gross <= ntCeiling ? ntAmount : 0;
  const base = gross - nontaxable;
  const cas = rnd(base * P.CotaCAS);
  const cass = rnd(base * P.CotaCASS);

  let pct = [0.2, 0.25, 0.3, 0.35, 0.45][Math.min(dependants, 4)]!;
  if (gross > MW + P.DedPlafon) pct = 0;
  else if (gross > MW) pct = Math.max(0, pct - 0.005 * Math.ceil((gross - MW) / 50));
  let deduction = rnd(pct * MW) + P.DedCopil * schoolChildren;
  if (under26 && gross <= MW + P.DedPlafon) deduction += rnd(P.DedU26 * MW);
  const beforeDeduction = Math.max(0, base - cas - cass);
  deduction = Math.min(deduction, beforeDeduction);
  const tax = rnd((beforeDeduction - deduction) * P.CotaImpozit);
  const cam = rnd(base * P.CotaCAM);
  // The employee's net is not touched: the employer bears the difference (art. 146 alin. (5^9)). Assumes none of the exceptions in alin. (5^7).
  const floor = contributionFloor(half);
  const employerTopUp = gross > 0 && gross < floor ? rnd(floor * P.CotaCAS) - cas + rnd(floor * P.CotaCASS) - cass : 0;
  return {
    gross, mw: MW, nontaxable, cas, cass, deduction, tax,
    net: gross - cas - cass - tax, cam, employerTopUp, employerCost: gross + cam + employerTopUp,
  };
}

export interface EmployeeYear {
  gross: number;
  cas: number;
  cass: number;
  tax: number;
  net: number;
  cam: number;
  employerTopUp: number;
  employerCost: number;
}

/** A year at the same monthly gross: six months of each half. */
export function employeeYear(monthlyGross: number, opts: EmployeeOptions = {}): EmployeeYear {
  const h1 = employeeMonth(monthlyGross, 1, opts);
  const h2 = employeeMonth(monthlyGross, 2, opts);
  const sum = (k: keyof EmployeeYear) => 6 * h1[k] + 6 * h2[k];
  return {
    gross: sum('gross'), cas: sum('cas'), cass: sum('cass'), tax: sum('tax'),
    net: sum('net'), cam: sum('cam'), employerTopUp: sum('employerTopUp'), employerCost: sum('employerCost'),
  };
}
