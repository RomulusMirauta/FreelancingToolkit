/**
 * Today is the date in Romania, whatever the device's time zone: the deadlines are Romanian dates that end at
 * midnight there (Cod de procedură fiscală, art. 75, through Cod de procedură civilă, art. 182 alin. (1)), and so
 * are BNR's fixings and the public holidays. Abroad, the device's own date is a day off for hours every day.
 */
const ROMANIA = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', year: 'numeric', month: 'numeric', day: 'numeric' });

const HOUR = 3_600_000;

/** The date in Romania at `now`, as a local date at midnight (what the calendar and the holidays work with). */
export function todayInRomania(now: number | Date = Date.now()): Date {
  const parts = ROMANIA.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(part('year'), part('month') - 1, part('day'));
}

/** Milliseconds until the date changes in Romania. Its midnight is a whole hour in UTC (UTC+2, UTC+3 in summer). */
export function msToRomanianMidnight(now: number = Date.now()): number {
  const day = todayInRomania(now).getTime();
  let t = now - (now % HOUR) + HOUR;
  while (todayInRomania(t).getTime() === day) t += HOUR;
  return t - now;
}
