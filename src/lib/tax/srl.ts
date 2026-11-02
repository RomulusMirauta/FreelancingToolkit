import { cassTiers } from './contributions';
import { employeeMonth } from './employee';
import { P, rnd } from './params';

/** How the owner is paid: an employment contract (CIM) or an administrator's mandate contract. */
export type OwnerPay = 'cim' | 'mandate';

/**
 * One month of a mandate contract (income assimilated to salary): CAS, CASS and income tax at the salary
 * rates, but no personal deduction and no untaxed minimum-wage amount. CAM is included; sources disagree on
 * whether it is due on mandate contracts, which the app flags as "to confirm".
 */
export function mandateMonth(gross: number): { cas: number; cass: number; tax: number; cam: number; net: number } {
  const cas = rnd(gross * P.CotaCAS);
  const cass = rnd(gross * P.CotaCASS);
  const tax = rnd(Math.max(0, gross - cas - cass) * P.CotaImpozit);
  return { cas, cass, tax, cam: rnd(gross * P.CotaCAM), net: gross - cas - cass - tax };
}

/** The owner paid the minimum wage all year (the usual micro-enterprise setup), by CIM or by mandate. */
export function ownerSalaryYear(employed: boolean, pay: OwnerPay = 'cim'): { gross: number; cam: number; net: number } {
  if (!employed) return { gross: 0, cam: 0, net: 0 };
  const h1 = pay === 'cim' ? employeeMonth(P.SalMin, 1) : mandateMonth(P.SalMin);
  const h2 = pay === 'cim' ? employeeMonth(P.SalMinIul, 2) : mandateMonth(P.SalMinIul);
  return { gross: 6 * P.SalMin + 6 * P.SalMinIul, cam: 6 * h1.cam + 6 * h2.cam, net: 6 * h1.net + 6 * h2.net };
}

export const MICRO_CEILING_LEI = P.PlafonMicroEUR * P.CursEURPlafon;

export function microEligible(revenue: number, ownerEmployed: boolean, otherEmployee = false, singleMicro = true): boolean {
  return revenue <= MICRO_CEILING_LEI && (ownerEmployed || otherEmployee) && singleMicro;
}

export interface SrlOptions {
  expenses?: number;
  /** A mandate paid at least the minimum wage also meets the micro-enterprise employee condition. */
  ownerPay?: OwnerPay;
  ownerEmployed?: boolean;
  otherEmployee?: boolean;
  singleMicro?: boolean;
  choseProfitTax?: boolean;
}

export interface SrlYear {
  regime: 'micro' | 'profit';
  revenue: number;
  salaryGross: number;
  cam: number;
  companyTax: number;
  profit: number;
  dividendTax: number;
  netDividends: number;
  cassDividends: number;
  salaryNet: number;
  takeHome: number;
}

/**
 * Steady state: the company is assumed to have had the same revenue in 2025, so revenue above
 * the micro ceiling means profit tax for the whole year. All profit is paid out as dividends.
 */
export function srlYear(revenue: number, opts: SrlOptions = {}): SrlYear {
  const { expenses = 0, ownerEmployed = true, otherEmployee = false, singleMicro = true, choseProfitTax = false } = opts;
  const sal = ownerSalaryYear(ownerEmployed, opts.ownerPay);
  const micro = !choseProfitTax && microEligible(revenue, ownerEmployed, otherEmployee, singleMicro);
  const companyTax = micro
    ? revenue * P.CotaMicro
    : Math.max(0, revenue - expenses - sal.gross - sal.cam) * P.CotaProfit;
  const profit = revenue - expenses - sal.gross - sal.cam - companyTax;
  const dividends = Math.max(0, profit);
  const dividendTax = dividends * P.CotaDividende;
  const netDividends = dividends - dividendTax;
  const cassDividends = cassTiers(netDividends);
  return {
    regime: micro ? 'micro' : 'profit', revenue, salaryGross: sal.gross, cam: sal.cam, companyTax, profit,
    dividendTax, netDividends, cassDividends, salaryNet: sal.net,
    // A loss (revenue not covering the owner's salary and its taxes) has to come out of the owner's pocket.
    takeHome: netDividends - cassDividends + sal.net + Math.min(0, profit),
  };
}
