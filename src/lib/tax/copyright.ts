import { casBand, cassTiers } from './contributions';
import { P, mw } from './params';

export interface CopyrightYear {
  gross: number;
  netIncome: number;
  tax: number;
  cas: number;
  cass: number;
  takeHome: number;
}

/** Copyright (IP) income: 40% flat-rate expenses, then tax and band contributions. */
export function copyrightYear(gross: number, employeeOrPensioner = false): CopyrightYear {
  const netIncome = gross * (1 - P.CotaForfetaraDA);
  const tax = netIncome * P.CotaImpozit;
  const cas = employeeOrPensioner ? 0 : casBand(netIncome);
  const cass = employeeOrPensioner ? 0 : cassTiers(netIncome);
  return { gross, netIncome, tax, cas, cass, takeHome: gross - tax - cas - cass };
}

/** Smallest annual gross whose take-home is at least `target`. Bands create cliffs, so each band is solved exactly. */
export function copyrightGrossForNet(target: number, employeeOrPensioner = false): number {
  const keep = 1 - (1 - P.CotaForfetaraDA) * P.CotaImpozit;
  if (employeeOrPensioner) return target / keep;
  const bands: [number, number | null][] = [
    [0, P.CASSPrag1], [P.CASSPrag1, P.PragCAS1], [P.PragCAS1, P.PragCAS2], [P.PragCAS2, null],
  ];
  let best = Infinity;
  for (const [low, high] of bands) {
    const probe = low ? mw(low) : 0;
    const gross = (target + casBand(probe) + cassTiers(probe)) / keep;
    const net = gross * (1 - P.CotaForfetaraDA);
    if (net >= mw(low) && (high === null || net < mw(high))) best = Math.min(best, gross);
  }
  return best;
}
