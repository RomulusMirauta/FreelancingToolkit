import { copyrightYear } from './copyright';
import { employeeYear } from './employee';
import { pfaYear } from './pfa';
import { srlYear } from './srl';

export const REGIMES = ['employee', 'pfa', 'srlMicro', 'srlProfitSalary', 'srlProfitNoSalary', 'copyright'] as const;
export type Regime = (typeof REGIMES)[number];

/**
 * Annual take-home for the same yearly amount under each regime. For the employee it is the
 * gross salary (employer cost not included); for the others it is the yearly revenue.
 */
export function compareYear(annual: number): Record<Regime, number> {
  return {
    employee: employeeYear(annual / 12).net,
    pfa: pfaYear(annual).takeHome,
    srlMicro: srlYear(annual, { ownerEmployed: true }).takeHome,
    srlProfitSalary: srlYear(annual, { ownerEmployed: true, choseProfitTax: true }).takeHome,
    srlProfitNoSalary: srlYear(annual, { ownerEmployed: false, choseProfitTax: true }).takeHome,
    copyright: copyrightYear(annual).takeHome,
  };
}
