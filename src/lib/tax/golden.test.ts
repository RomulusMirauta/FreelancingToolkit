import { describe, expect, it } from 'vitest';
import golden from '../../../data/golden-2026.json';
import { compareYear, type Regime } from './compare';
import { copyrightGrossForNet, copyrightYear } from './copyright';
import { employeeMonth, type Half } from './employee';
import { pfaYear } from './pfa';
import { ownerSalaryYear, srlYear } from './srl';

// golden-2026.json is written by scripts/tax2026_reference.py, the same file the workbook is checked against.
const camel = (k: string) => k.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
/** A case's options under the engine's names (school_children → schoolChildren). */
const options = (input: object) => Object.fromEntries(Object.entries(input).map(([k, v]) => [camel(k), v]));

function expectMatches(actual: object, expected: Record<string, unknown>) {
  for (const [k, v] of Object.entries(expected)) {
    const got = (actual as Record<string, unknown>)[camel(k)];
    if (typeof v === 'number') expect(got, k).toBeCloseTo(v, 6);
    else expect(got, k).toBe(v);
  }
}

const COMPARE_KEYS: Record<string, Regime> = {
  Salariat: 'employee',
  PFA: 'pfa',
  'SRL micro': 'srlMicro',
  'SRL profit cu salariu': 'srlProfitSalary',
  'SRL profit fara salariu': 'srlProfitNoSalary',
  'Drepturi de autor': 'copyright',
};

describe('2026 tax engine matches the Python reference', () => {
  it.each(Object.entries(golden.employee_month))('employee month %s', (_, { input: { gross, half, ...opts }, expected }) =>
    expectMatches(employeeMonth(gross, half as Half, options(opts)), expected));

  it('owner salary year', () => expectMatches(ownerSalaryYear(true), golden.owner_salary_year));

  it.each(Object.entries(golden.pfa))('PFA %s lei/year', (rev, expected) => expectMatches(pfaYear(Number(rev)), expected));

  it.each(Object.entries(golden.pfa_options))('PFA %s', (_, { input: { revenue, ...opts }, expected }) =>
    expectMatches(pfaYear(revenue, options(opts)), expected));

  it.each(Object.entries(golden.srl))('SRL %s lei/year', (rev, expected) => expectMatches(srlYear(Number(rev)), expected));

  it.each(Object.entries(golden.srl_options))('SRL %s', (_, { input: { revenue, ...opts }, expected }) =>
    expectMatches(srlYear(revenue, options(opts)), expected));

  it.each(Object.entries(golden.copyright))('copyright %s lei/year', (g, expected) =>
    expectMatches(copyrightYear(Number(g)), expected));

  it.each(Object.entries(golden.copyright_options))('copyright %s', (_, { input, expected }) =>
    expectMatches(copyrightYear(input.gross, input.employee_or_pensioner), expected));

  it.each(Object.entries(golden.copyright_gross_for_net))('copyright gross for %s net', (t, expected) =>
    expect(copyrightGrossForNet(Number(t))).toBeCloseTo(expected, 6));

  it.each(Object.entries(golden.copyright_gross_for_net_options))('copyright gross for a net of %s', (_, { input, expected }) =>
    expect(copyrightGrossForNet(input.target, input.employee_or_pensioner)).toBeCloseTo(expected, 6));

  it.each(Object.entries(golden.compare_monthly))('comparison at %s', (name, expected) => {
    const monthly = golden.scenario_monthly_gross[name as keyof typeof golden.scenario_monthly_gross];
    const year = compareYear(12 * monthly);
    for (const [ro, value] of Object.entries(expected)) expect(year[COMPARE_KEYS[ro]!] / 12, ro).toBeCloseTo(value, 6);
  });
});
