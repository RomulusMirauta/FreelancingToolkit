import { describe, expect, it } from 'vitest';
import { daysUntil, deadlinesIn, nextMonthly, nextWorkingDay, upcomingDeadlines } from './calendar';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('payment calendar', () => {
  it('moves a deadline on a day off to the next working day', () => {
    expect(iso(nextWorkingDay(new Date(2026, 6, 25)))).toBe('2026-07-27'); // Saturday
    expect(iso(nextWorkingDay(new Date(2026, 9, 25)))).toBe('2026-10-26'); // Sunday
    expect(iso(nextWorkingDay(new Date(2026, 4, 25)))).toBe('2026-05-25'); // Monday
  });

  it('lists the 2026 dates', () => {
    const byKind = Object.fromEntries(deadlinesIn(2026).map((d) => [`${d.kind}${d.quarter ?? ''}`, iso(d.date)]));
    expect(byKind).toEqual({
      bonus: '2026-04-15',
      du: '2026-05-25',
      microQ4: '2026-01-26', // 25 January 2026 is a Sunday
      microQ1: '2026-04-27', // Saturday 25 April
      microQ2: '2026-07-27',
      microQ3: '2026-10-26',
      statements: '2026-06-02', // 30 May is a Saturday, 1 June a holiday
      d101: '2026-06-25',
    });
  });

  it('shows the next twelve months, soonest first', () => {
    const list = upcomingDeadlines(new Date(2026, 10, 2));
    expect(list.map((d) => iso(d.date))).toEqual([
      '2027-01-25', '2027-04-15', '2027-04-26', '2027-05-25', '2027-05-31', '2027-06-25', '2027-07-26', '2027-10-25',
    ]);
    expect(list[0]!.year).toBe(2026);
  });

  it('finds the next 25th', () => {
    expect(iso(nextMonthly(new Date(2026, 10, 2)))).toBe('2026-11-25');
    expect(iso(nextMonthly(new Date(2026, 10, 26)))).toBe('2026-12-28'); // 25–27 December are days off
    expect(daysUntil(new Date(2026, 10, 2, 23), new Date(2026, 10, 25))).toBe(23);
  });
});
