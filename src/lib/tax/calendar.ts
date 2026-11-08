import { isDayOff } from '../time/holidays';

/** Who a deadline concerns. */
export type Audience = 'pfa' | 'srl';

export type DeadlineKind = 'bonus' | 'du' | 'microQ' | 'microQ4' | 'statements' | 'd101';

export interface Deadline {
  kind: DeadlineKind;
  /** The legal date, moved to the next working day when it falls on a weekend or public holiday. */
  date: Date;
  /** The tax year the deadline is for. */
  year: number;
  /** For quarterly payments: 1–3. */
  quarter?: number;
  audience: Audience[];
}

/** A deadline that falls on a day off moves to the next working day. */
export function nextWorkingDay(d: Date): Date {
  let x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (isDayOff(x)) x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1);
  return x;
}

const on = (y: number, m: number, d: number) => nextWorkingDay(new Date(y, m - 1, d));

/** The yearly deadlines that fall in calendar year `y`. */
export function deadlinesIn(y: number): Deadline[] {
  return [
    // Income of the previous year (Declarația unică, D212): PFA, copyright, CASS on dividends and rents.
    // The discount is on income tax, so not for an SRL owner whose D212 only has CASS on dividends.
    { kind: 'bonus', date: on(y, 4, 15), year: y - 1, audience: ['pfa'] },
    { kind: 'du', date: on(y, 5, 25), year: y - 1, audience: ['pfa', 'srl'] },
    // Quarterly micro-enterprise and profit tax (D100), the 25th of the month after the quarter.
    { kind: 'microQ4', date: on(y, 1, 25), year: y - 1, audience: ['srl'] },
    ...[1, 2, 3].map((q) => ({ kind: 'microQ' as const, date: on(y, q * 3 + 1, 25), year: y, quarter: q, audience: ['srl' as const] })),
    // Annual accounts of a company with a calendar financial year (Legea contabilității 82/1991, art. 36 alin. (1) lit. a)).
    { kind: 'statements', date: on(y, 5, 31), year: y - 1, audience: ['srl'] },
    // Annual profit tax return (D101, Cod fiscal art. 42 alin. (1)).
    { kind: 'd101', date: on(y, 6, 25), year: y - 1, audience: ['srl'] },
  ];
}

/** The deadlines from `from` (inclusive) over the next `months` months, soonest first. */
export function upcomingDeadlines(from: Date, months = 12): Deadline[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  return [start.getFullYear(), start.getFullYear() + 1]
    .flatMap(deadlinesIn)
    .filter((d) => d.date >= start && d.date < end)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** What falls due on the 25th of a month; December's comes early, on the 21st or the working day before it (Cod de procedură fiscală, art. 155 alin. (2)). */
function monthlyDue(y: number, m: number): Date {
  if (m !== 12) return on(y, m, 25);
  let x = new Date(y, 11, 21);
  while (isDayOff(x)) x = new Date(y, 11, x.getDate() - 1);
  return x;
}

/**
 * The next monthly deadline, on or after `from`: salaries (D112), dividend tax, and VAT: D300, D390 for anyone
 * registered under art. 316 or 317 (Cod fiscal art. 325), D301 for the VAT a non-VAT payer owes on services bought
 * from abroad (art. 324 alin. (1) lit. d), art. 307 alin. (2)).
 */
export function nextMonthly(from: Date): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const thisMonth = monthlyDue(start.getFullYear(), start.getMonth() + 1);
  if (thisMonth >= start) return thisMonth;
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return monthlyDue(next.getFullYear(), next.getMonth() + 1);
}

/** Whole days from `from` to `to` (calendar days, ignoring the time of day). */
export function daysUntil(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}
