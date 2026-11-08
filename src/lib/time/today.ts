/**
 * Today is the date in Romania, whatever the device's time zone: the deadlines are Romanian dates that end at
 * midnight there (Cod de procedură fiscală, art. 75, through Cod de procedură civilă, art. 182 alin. (1)), and so
 * are BNR's fixings and the public holidays. Abroad, the device's own date is a day off for hours every day.
 */
const ROMANIA = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', year: 'numeric', month: 'numeric', day: 'numeric' });

const HOUR = 3_600_000;

/**
 * The date last read, kept for its UTC hour: the date in Romania changes only on a whole UTC hour (see below), and the
 * converter asks for it twice per cell on every render. Kept as numbers, so the local date is built in the device's
 * time zone of the moment.
 */
let read: { hour: number; y: number; m: number; d: number } | null = null;

/** The date in Romania at `now`, as a local date at midnight (what the calendar and the holidays work with). */
export function todayInRomania(now: number | Date = Date.now()): Date {
  const ms = typeof now === 'number' ? now : now.getTime();
  const hour = Math.floor(ms / HOUR);
  if (read?.hour !== hour) {
    const parts = ROMANIA.formatToParts(ms);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
    read = { hour, y: part('year'), m: part('month'), d: part('day') };
  }
  return new Date(read.y, read.m - 1, read.d);
}

/** Milliseconds until the date changes in Romania. Its midnight is a whole hour in UTC (UTC+2, UTC+3 in summer). */
export function msToRomanianMidnight(now: number = Date.now()): number {
  const day = todayInRomania(now).getTime();
  let t = now - (now % HOUR) + HOUR;
  while (todayInRomania(t).getTime() === day) t += HOUR;
  return t - now;
}
