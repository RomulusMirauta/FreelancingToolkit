import { describe, expect, it } from 'vitest';
import { en, ro } from '../i18n/strings';
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
      statements: '2026-06-02', // 31 May is a Sunday and Pentecost, 1 June a holiday
      d101: '2026-06-25',
    });
  });

  it('has the annual accounts due on 31 May, in a leap year too', () => {
    const statements = (y: number) => iso(deadlinesIn(y).find((d) => d.kind === 'statements')!.date);
    expect(statements(2028)).toBe('2028-05-31');
    expect(statements(2027)).toBe('2027-05-31');
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
    expect(iso(nextMonthly(new Date(2026, 10, 26)))).toBe('2026-12-21'); // December's falls due on the 21st
    expect(iso(nextMonthly(new Date(2026, 11, 21)))).toBe('2026-12-21');
    expect(iso(nextMonthly(new Date(2026, 11, 22)))).toBe('2027-01-25'); // and on past the new year
    expect(iso(nextMonthly(new Date(2024, 11, 2)))).toBe('2024-12-20'); // 21 December 2024 was a Saturday: the working day before
    expect(daysUntil(new Date(2026, 10, 2, 23), new Date(2026, 10, 25))).toBe(23);
  });

  it('lists D390 without being a VAT payer, D301 and D394 too', () => {
    // D390 is for anyone registered under art. 316 or 317 (Cod fiscal art. 325): the list tied it to VAT payers.
    for (const { calendar } of [en, ro]) {
      const pfa = calendar.monthly.filter((m) => m.audience.includes('pfa')).map((m) => m.text);
      const d390 = pfa.find((t) => t.includes('D390'))!;
      expect(d390).toMatch(/art\. 317/);
      expect(d390).not.toMatch(/^(If you are a VAT payer|Dacă ești plătitor de TVA)/);
      expect(pfa.filter((t) => t.includes('D301'))).toHaveLength(1);
      expect(pfa.find((t) => t.includes('D300'))).toMatch(/D394.*30/);
    }
  });
});
