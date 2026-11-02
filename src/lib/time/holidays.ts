/**
 * Romanian public holidays (Codul muncii, art. 139 alin. (1)): fixed dates plus the Orthodox Easter
 * and Pentecost (Rusalii) days, which move every year.
 */

/** Orthodox Easter Sunday (Meeus's Julian algorithm, shifted to the Gregorian calendar; valid 1900–2099). */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April (Julian)
  const day = ((d + e + 114) % 31) + 1;
  return new Date(year, month - 1, day + 13);
}

const FIXED: [month: number, day: number][] = [
  [1, 1], [1, 2], [1, 6], [1, 7], [1, 24], [5, 1], [6, 1], [8, 15], [11, 30], [12, 1], [12, 25], [12, 26],
];

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Every public holiday of the year, once each (Pentecost Monday can fall on 1 June), sorted. */
export function publicHolidays(year: number): Date[] {
  const easter = orthodoxEaster(year);
  const pentecost = addDays(easter, 49);
  const days = [
    ...FIXED.map(([m, d]) => new Date(year, m - 1, d)),
    addDays(easter, -2), easter, addDays(easter, 1), // Good Friday, Easter Sunday and Monday
    pentecost, addDays(pentecost, 1),
  ];
  const unique = new Map(days.map((d) => [iso(d), d]));
  return [...unique.values()].sort((x, y) => x.getTime() - y.getTime());
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Public holidays that fall on Monday–Friday, and on Saturday–Sunday. */
export function holidaySplit(year: number): { weekdays: number; weekend: number } {
  const all = publicHolidays(year);
  const weekend = all.filter(isWeekend).length;
  return { weekdays: all.length - weekend, weekend };
}

/**
 * Public holidays that land on your working days, for a week of `daysPerWeek` days. Up to five days a week
 * you are assumed to work Monday to Friday, a share of them; days six and seven are the weekend.
 */
export function holidaysOnWorkdays(year: number, daysPerWeek: number): number {
  const { weekdays, weekend } = holidaySplit(year);
  return weekdays * (Math.min(daysPerWeek, 5) / 5) + weekend * (Math.max(daysPerWeek - 5, 0) / 2);
}

/** True on Saturdays, Sundays and public holidays. */
export function isDayOff(d: Date): boolean {
  if (isWeekend(d)) return true;
  const key = iso(d);
  return publicHolidays(d.getFullYear()).some((h) => iso(h) === key);
}
