import { describe, expect, it } from 'vitest';
import { holidaySplit, holidaysOnWorkdays, isDayOff, orthodoxEaster, publicHolidays } from './holidays';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('public holidays', () => {
  it('finds the Orthodox Easter', () => {
    expect(iso(orthodoxEaster(2025))).toBe('2025-04-20');
    expect(iso(orthodoxEaster(2026))).toBe('2026-04-12');
    expect(iso(orthodoxEaster(2027))).toBe('2027-05-02');
  });

  it('lists 2026, counting 1 June once although Pentecost Monday falls on it', () => {
    expect(publicHolidays(2026).map(iso)).toEqual([
      '2026-01-01', '2026-01-02', '2026-01-06', '2026-01-07', '2026-01-24',
      '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-31', '2026-06-01',
      '2026-08-15', '2026-11-30', '2026-12-01', '2026-12-25', '2026-12-26',
    ]);
  });

  it('splits 2026 into 11 weekdays and 5 weekend days', () => {
    expect(holidaySplit(2026)).toEqual({ weekdays: 11, weekend: 5 });
    expect(holidaysOnWorkdays(2026, 5)).toBe(11);
    expect(holidaysOnWorkdays(2026, 7)).toBe(16);
    expect(holidaysOnWorkdays(2026, 2.5)).toBeCloseTo(5.5, 9);
  });

  it('knows weekends and holidays are days off', () => {
    expect(isDayOff(new Date(2026, 6, 25))).toBe(true); // Saturday
    expect(isDayOff(new Date(2026, 11, 1))).toBe(true); // 1 December
    expect(isDayOff(new Date(2026, 6, 27))).toBe(false);
  });
});
