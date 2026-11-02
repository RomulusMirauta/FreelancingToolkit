import { describe, expect, it } from 'vitest';
import golden from '../../../data/golden-2026.json';
import { compareYear, type Regime } from './compare';
import { copyrightGrossForNet, copyrightYear } from './copyright';
import { employeeMonth, type EmployeeOptions, type Half } from './employee';
import { pfaYear } from './pfa';
import { ownerSalaryYear, srlYear } from './srl';

// golden-2026.json is written by scripts/tax2026_reference.py, the same file the workbook is checked against.
const camel = (k: string) => k.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());

function expectMatches(actual: object, expected: Record<string, unknown>) {
  for (const [k, v] of Object.entries(expected)) {
    const got = (actual as Record<string, unknown>)[camel(k)];
    if (typeof v === 'number') expect(got, k).toBeCloseTo(v, 6);
    else expect(got, k).toBe(v);
  }
}

const EMPLOYEE_CASES: Record<string, [number, Half, EmployeeOptions]> = {
  '4050 H1': [4050, 1, {}],
  '4325 H2': [4325, 2, {}],
  '5000 H1': [5000, 1, {}],
  '5000 H2': [5000, 2, {}],
  '10000 H2': [10000, 2, {}],
  '6000 H1 2 dep u26 1 child': [6000, 1, { dependants: 2, under26: true, schoolChildren: 1 }],
};

const COMPARE_KEYS: Record<string, Regime> = {
  Salariat: 'employee',
  PFA: 'pfa',
  'SRL micro': 'srlMicro',
  'SRL profit cu salariu': 'srlProfitSalary',
  'SRL profit fara salariu': 'srlProfitNoSalary',
  'Drepturi de autor': 'copyright',
};

describe('2026 tax engine matches the Python reference', () => {
  it.each(Object.entries(golden.employee_month))('employee month %s', (name, expected) => {
    const [gross, half, opts] = EMPLOYEE_CASES[name]!;
    expectMatches(employeeMonth(gross, half, opts), expected);
  });

  it('owner salary year', () => expectMatches(ownerSalaryYear(true), golden.owner_salary_year));

  it.each(Object.entries(golden.pfa))('PFA %s lei/year', (rev, expected) => expectMatches(pfaYear(Number(rev)), expected));

  it.each(Object.entries(golden.srl))('SRL %s lei/year', (rev, expected) => expectMatches(srlYear(Number(rev)), expected));

  it.each(Object.entries(golden.copyright))('copyright %s lei/year', (g, expected) =>
    expectMatches(copyrightYear(Number(g)), expected));

  it.each(Object.entries(golden.copyright_gross_for_net))('copyright gross for %s net', (t, expected) =>
    expect(copyrightGrossForNet(Number(t))).toBeCloseTo(expected, 6));

  it.each(Object.entries(golden.compare_monthly))('comparison at %s', (name, expected) => {
    const monthly = golden.scenario_monthly_gross[name as keyof typeof golden.scenario_monthly_gross];
    const year = compareYear(12 * monthly);
    for (const [ro, value] of Object.entries(expected)) expect(year[COMPARE_KEYS[ro]!] / 12, ro).toBeCloseTo(value, 6);
  });
});
