import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORK, PERIODS, holidayYear, hoursIn, isValidWork, readWork, rescale, workDaysIn, type Period } from './periods';

// The device's time zone is Node's TZ, which takes effect at once; src is typed for the browser, without `process`.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

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

  it('counts the public holidays of the year it is in Romania, read again at each call', () => {
    // The year was read once, when the app loaded: a page left open over New Year kept 2026's 11 holidays. In
    // California it is still 31 December at both moments, so the device's year can't pass for Romania's.
    const tz = env.TZ;
    env.TZ = 'America/Los_Angeles';
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-12-31T20:00:00Z')); // 22:00 on 31 December in Romania
      expect(holidayYear()).toBe(2026);
      expect(workDaysIn({ ...DEFAULT_WORK, holidays: true })).toBe(260 - 11);
      vi.setSystemTime(new Date('2026-12-31T22:30:00Z')); // 00:30 on 1 January in Romania
      expect(holidayYear()).toBe(2027);
      expect(workDaysIn({ ...DEFAULT_WORK, holidays: true })).toBe(260 - 9);
      expect(hoursIn('year', { ...DEFAULT_WORK, holidays: true })).toBe(8 * 251);
    } finally {
      vi.useRealTimers();
      if (tz === undefined) delete env.TZ;
      else env.TZ = tz;
    }
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
