import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK, PERIODS, hoursIn, isValidWork, readWork, rescale, workDaysIn, type Period } from './periods';

describe('periods', () => {
  it('scales the default 30 €/h across every period', () => {
    const expected: Record<Period, number> = {
      hour: 30, day: 240, week: 1200, month: 5200,
      months3: 15600, months6: 31200, months9: 46800, year: 62400,
    };
    for (const p of PERIODS) expect(rescale(30, 'hour', p, DEFAULT_WORK)).toBeCloseTo(expected[p], 9);
  });

  it('round-trips from any period', () => {
    expect(rescale(62400, 'year', 'hour', DEFAULT_WORK)).toBeCloseTo(30, 9);
    expect(rescale(5200, 'month', 'day', DEFAULT_WORK)).toBeCloseTo(240, 9);
  });

  it('applies working-time settings', () => {
    const s = { hoursPerDay: 6, daysPerWeek: 4, daysOff: 16, holidays: false, billablePct: 100 };
    expect(hoursIn('week', s)).toBe(24);
    expect(hoursIn('year', s)).toBe(24 * 48);
    expect(hoursIn('month', s)).toBe(96);
  });

  it('takes public holidays off the working days', () => {
    const s = { ...DEFAULT_WORK, daysOff: 21, holidays: true };
    expect(workDaysIn(s, 2026)).toBe(260 - 21 - 11);
    expect(hoursIn('year', s, 2026)).toBe(8 * 228);
    expect(hoursIn('day', s, 2026)).toBe(8);
  });

  it('bills only the billable share of the time', () => {
    const s = { ...DEFAULT_WORK, billablePct: 75 };
    expect(hoursIn('day', s)).toBe(6);
    expect(hoursIn('year', s)).toBe(1560);
    expect(rescale(30, 'hour', 'year', s)).toBe(46800);
  });

  it('upgrades working time saved with weeks off', () => {
    expect(readWork({ hoursPerDay: 6, daysPerWeek: 4, weeksOff: 4 })).toEqual({ hoursPerDay: 6, daysPerWeek: 4, daysOff: 16, holidays: false, billablePct: 100 });
    expect(readWork({ hoursPerDay: 0, daysPerWeek: 4 })).toBeNull();
    expect(readWork('8')).toBeNull();
  });

  it('refuses more days off than the year has', () => {
    expect(isValidWork({ ...DEFAULT_WORK, daysOff: 259 })).toBe(true);
    expect(isValidWork({ ...DEFAULT_WORK, daysOff: 260 })).toBe(false);
    expect(isValidWork({ ...DEFAULT_WORK, billablePct: 0 })).toBe(false);
  });
});
