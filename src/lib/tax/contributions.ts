import { P, mw } from './params';

/** CAS on independent activities and IP income: a fixed amount per band (minimum chosen base). */
export function casBand(net: number): number {
  // To the ban: revenue less expenses can come out a hair under a band it is exactly on (66,002.40 − 17,402.40).
  const n = Math.round(net * 100) / 100;
  if (n >= mw(P.PragCAS2)) return mw(P.PragCAS2) * P.CotaCAS;
  if (n >= mw(P.PragCAS1)) return mw(P.PragCAS1) * P.CotaCAS;
  return 0;
}

/**
 * CASS on independent activities. 10% of net income capped at 72 minimum wages, topped up to
 * 6 minimum wages unless the person has a salary of at least 6 minimum wages or a pension.
 * Only the part computed on actual income is deductible from the income tax base (Fiscal Code art. 118).
 */
export function cassPfa(net: number, waived = false): { total: number; onIncome: number } {
  if (net <= 0) return { total: 0, onIncome: 0 };
  const onIncome = Math.min(net, mw(P.CASSMaxPFA)) * P.CotaCASS;
  const total = waived ? onIncome : Math.max(onIncome, mw(P.CASSMinPFA) * P.CotaCASS);
  return { total, onIncome };
}

/** CASS on dividends, IP and other income: band base of 6/12/24 minimum wages. */
export function cassTiers(amount: number): number {
  for (const n of [P.CASSPrag3, P.CASSPrag2, P.CASSPrag1]) {
    if (amount >= mw(n)) return mw(n) * P.CotaCASS;
  }
  return 0;
}
