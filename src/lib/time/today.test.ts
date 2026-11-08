import { afterEach, describe, expect, it, vi } from 'vitest';
import { daysUntil, nextMonthly } from '../tax/calendar';
import { msToRomanianMidnight, todayInRomania } from './today';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOUR = 3_600_000;
// The device's time zone is Node's TZ, which takes effect at once; src is typed for the browser, without `process`.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

describe('today in Romania', () => {
  const tz = env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    if (tz === undefined) delete env.TZ;
    else env.TZ = tz;
  });

  it('is the date in Bucharest, whatever the device\'s time zone', () => {
    vi.useFakeTimers();
    // 16:30 on Wednesday 25 November in California is 02:30 on the 26th in Romania: the 25th's deadline has passed.
    env.TZ = 'America/Los_Angeles';
    vi.setSystemTime(new Date('2026-11-26T00:30:00Z'));
    expect(new Date().getDate()).toBe(25);
    expect(iso(todayInRomania())).toBe('2026-11-26');
    expect(iso(nextMonthly(todayInRomania()))).toBe('2026-12-21');
    // 06:30 on the 26th in Tokyo is 23:30 on the 25th in Romania: the deadline is still today.
    env.TZ = 'Asia/Tokyo';
    vi.setSystemTime(new Date('2026-11-25T21:30:00Z'));
    expect(new Date().getDate()).toBe(26);
    const today = todayInRomania();
    expect(iso(today)).toBe('2026-11-25');
    expect(daysUntil(today, nextMonthly(today))).toBe(0);
  });

  it('moves on at midnight in Romania, summer and winter time included', () => {
    expect(msToRomanianMidnight(Date.parse('2026-11-25T20:00:00Z'))).toBe(2 * HOUR); // 22:00 in winter
    expect(msToRomanianMidnight(Date.parse('2026-11-25T21:59:59.250Z'))).toBe(750);
    expect(msToRomanianMidnight(Date.parse('2026-11-25T22:00:00Z'))).toBe(24 * HOUR); // midnight itself
    expect(msToRomanianMidnight(Date.parse('2026-07-15T20:30:00Z'))).toBe(0.5 * HOUR); // 23:30 in summer
    // The night the clocks go forward (28 March 2027) the day has 23 hours, back (25 October 2026) 25.
    expect(msToRomanianMidnight(Date.parse('2027-03-27T22:30:00Z'))).toBe(22.5 * HOUR);
    expect(msToRomanianMidnight(Date.parse('2026-10-24T21:30:00Z'))).toBe(24.5 * HOUR);
  });
});
