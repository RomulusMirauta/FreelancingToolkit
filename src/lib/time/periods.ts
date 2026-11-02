import { holidaysOnWorkdays } from './holidays';

export const PERIODS = ['hour', 'day', 'week', 'month', 'months3', 'months6', 'months9', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export interface WorkSettings {
  hoursPerDay: number;
  daysPerWeek: number;
  /** Unpaid working days off per year (leave, sick days), on top of public holidays. */
  daysOff: number;
  /** Take the Romanian public holidays that land on working days off the year. */
  holidays: boolean;
  /** Share of the working time that is billed (the rest goes on e-mails, offers, admin), in %. */
  billablePct: number;
}

export const DEFAULT_WORK: WorkSettings = { hoursPerDay: 8, daysPerWeek: 5, daysOff: 0, holidays: false, billablePct: 100 };

export const WEEKS_PER_YEAR = 52;

/** The year the public holidays are counted for: the current one. */
export const HOLIDAY_YEAR = new Date().getFullYear();

/** Working days in the year: 52 weeks, minus days off and, if chosen, public holidays on working days. */
export function workDaysIn(s: WorkSettings, year = HOLIDAY_YEAR): number {
  return WEEKS_PER_YEAR * s.daysPerWeek - s.daysOff - (s.holidays ? holidaysOnWorkdays(year, s.daysPerWeek) : 0);
}

/** Billable hours in one period. Months are a twelfth of the billable year. */
export function hoursIn(period: Period, s: WorkSettings, year = HOLIDAY_YEAR): number {
  const day = s.hoursPerDay * (s.billablePct / 100);
  const yearHours = day * workDaysIn(s, year);
  switch (period) {
    case 'hour': return 1;
    case 'day': return day;
    case 'week': return day * s.daysPerWeek;
    case 'month': return yearHours / 12;
    case 'months3': return yearHours / 4;
    case 'months6': return yearHours / 2;
    case 'months9': return (yearHours * 3) / 4;
    case 'year': return yearHours;
  }
}

/** Converts an amount earned per `from` period into the amount per `to` period. */
export function rescale(amount: number, from: Period, to: Period, s: WorkSettings): number {
  const hFrom = hoursIn(from, s);
  return hFrom === 0 ? 0 : (amount / hFrom) * hoursIn(to, s);
}

/** The most days off that still leave one working day in the year. */
export function maxDaysOff(s: Pick<WorkSettings, 'daysPerWeek' | 'holidays'>): number {
  return Math.floor(workDaysIn({ ...DEFAULT_WORK, ...s, daysOff: 0 }) - 1);
}

export function isValidWork(s: WorkSettings): boolean {
  return (
    s.hoursPerDay > 0 && s.hoursPerDay <= 24 &&
    s.daysPerWeek > 0 && s.daysPerWeek <= 7 &&
    s.daysOff >= 0 && s.daysOff <= maxDaysOff(s) &&
    s.billablePct > 0 && s.billablePct <= 100
  );
}

/**
 * Reads saved working time, filling settings added later with their defaults. Older versions saved
 * weeks off instead of days off: those become days (weeks × days per week).
 */
export function readWork(v: unknown): WorkSettings | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : undefined);
  const hoursPerDay = num('hoursPerDay');
  const daysPerWeek = num('daysPerWeek');
  if (hoursPerDay === undefined || daysPerWeek === undefined) return null;
  const weeksOff = num('weeksOff');
  const s: WorkSettings = {
    hoursPerDay,
    daysPerWeek,
    daysOff: num('daysOff') ?? (weeksOff !== undefined ? weeksOff * daysPerWeek : DEFAULT_WORK.daysOff),
    holidays: typeof o.holidays === 'boolean' ? o.holidays : DEFAULT_WORK.holidays,
    billablePct: num('billablePct') ?? DEFAULT_WORK.billablePct,
  };
  return isValidWork(s) ? s : null;
}
