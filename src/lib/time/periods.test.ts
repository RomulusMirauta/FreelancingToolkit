import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK, PERIODS, hoursIn, rescale, type Period } from './periods';

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
    const s = { hoursPerDay: 6, daysPerWeek: 4, weeksOff: 4 };
    expect(hoursIn('week', s)).toBe(24);
    expect(hoursIn('year', s)).toBe(24 * 48);
    expect(hoursIn('month', s)).toBe(96);
  });
});
