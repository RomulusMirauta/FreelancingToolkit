export const PERIODS = ['hour', 'day', 'week', 'month', 'months3', 'months6', 'months9', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export interface WorkSettings {
  hoursPerDay: number;
  daysPerWeek: number;
  /** Unpaid weeks per year (holidays, sick days); the year has 52 weeks. */
  weeksOff: number;
}

export const DEFAULT_WORK: WorkSettings = { hoursPerDay: 8, daysPerWeek: 5, weeksOff: 0 };

export const WEEKS_PER_YEAR = 52;

/** Billable hours in one period. Months are a twelfth of the billable year. */
export function hoursIn(period: Period, s: WorkSettings): number {
  const week = s.hoursPerDay * s.daysPerWeek;
  const year = week * (WEEKS_PER_YEAR - s.weeksOff);
  switch (period) {
    case 'hour': return 1;
    case 'day': return s.hoursPerDay;
    case 'week': return week;
    case 'month': return year / 12;
    case 'months3': return year / 4;
    case 'months6': return year / 2;
    case 'months9': return (year * 3) / 4;
    case 'year': return year;
  }
}

/** Converts an amount earned per `from` period into the amount per `to` period. */
export function rescale(amount: number, from: Period, to: Period, s: WorkSettings): number {
  const hFrom = hoursIn(from, s);
  return hFrom === 0 ? 0 : (amount / hFrom) * hoursIn(to, s);
}

export function isValidWork(s: WorkSettings): boolean {
  return (
    s.hoursPerDay > 0 && s.hoursPerDay <= 24 &&
    s.daysPerWeek > 0 && s.daysPerWeek <= 7 &&
    s.weeksOff >= 0 && s.weeksOff < WEEKS_PER_YEAR
  );
}
