import { describe, expect, it } from 'vitest';
import golden from '../../../data/golden-2026.json';
import { compareYear } from './compare';
import { copyrightYear } from './copyright';
import { employeeYear } from './employee';
import { solveForTakeHome } from './solve';

describe('solveForTakeHome', () => {
  it.each(Object.entries(golden.copyright_gross_for_net))('matches the exact copyright solution for %s', (t, expected) => {
    expect(solveForTakeHome((g) => copyrightYear(g).takeHome, Number(t))).toBeCloseTo(expected, 4);
  });

  it('finds the smallest amount across a CAS cliff', () => {
    // Just above 12 minimum wages of net PFA income, CAS jumps by 12 150 lei.
    const f = (a: number) => compareYear(a).pfa;
    const target = f(48_599);
    const found = solveForTakeHome(f, target)!;
    expect(found).toBeCloseTo(48_599, 3);
    expect(f(found)).toBeGreaterThanOrEqual(target);
  });

  it('solves salaries despite whole-lei rounding', () => {
    const found = solveForTakeHome((a) => employeeYear(a / 12).net, 12 * 5000)!;
    expect(employeeYear(found / 12).net).toBeGreaterThanOrEqual(60_000);
    expect(employeeYear((found - 12) / 12).net).toBeLessThan(60_000);
  });

  it('returns 0 for a zero target', () => expect(solveForTakeHome(() => 0, 0)).toBe(0));
});
