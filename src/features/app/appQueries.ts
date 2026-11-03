import { DEFAULT_LANG, isLang, type Lang } from '../../lib/i18n';
import { DEFAULT_WORK, isValidWork, type WorkSettings } from '../../lib/time/periods';
import { isTheme, type Theme } from '../../lib/ui/theme';
import { numberParam, type UrlQuery } from '../../lib/ui/urlQuery';

/** Settings of the whole app, and Working time, as they read in the address. */

/** ?lang=en (Romanian, the default, has none). */
export const LANG_QUERY: UrlQuery<Lang> = {
  key: 'ft.lang',
  names: ['lang'],
  toParams: (v) => [v],
  fromParams: ([s]) => s!.toLowerCase(),
  isValid: isLang,
  defaults: DEFAULT_LANG,
};

/** ?theme=dark or ?theme=light (automatic, the default, has none). */
export const THEME_QUERY: UrlQuery<Theme> = {
  key: 'ft.theme',
  names: ['theme'],
  toParams: (v) => [v],
  fromParams: ([s]) => (s === 'auto' ? 'system' : s!.toLowerCase()),
  isValid: isTheme,
  defaults: 'system',
};

export const isWork = (v: unknown): v is WorkSettings =>
  typeof v === 'object' && v !== null &&
  ['hoursPerDay', 'daysPerWeek', 'daysOff', 'billablePct'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number') &&
  typeof (v as WorkSettings).holidays === 'boolean' &&
  isValidWork(v as WorkSettings);

/** Working time, each field on its own and only when changed: ?hours=6&days=4&days_off=20&holidays=1&billable=70. */
export const WORK_QUERY: UrlQuery<WorkSettings> = {
  key: 'ft.work',
  names: ['hours', 'days', 'days_off', 'holidays', 'billable'],
  toParams: (w) => [String(w.hoursPerDay), String(w.daysPerWeek), String(w.daysOff), w.holidays ? '1' : '0', String(w.billablePct)],
  fromParams: ([hours, days, off, holidays, billable]) => {
    const n = [hours, days, off, billable].map((s) => numberParam(s!));
    if (n.some((x) => x === null) || (holidays !== '0' && holidays !== '1')) return null;
    return { hoursPerDay: n[0]!, daysPerWeek: n[1]!, daysOff: n[2]!, holidays: holidays === '1', billablePct: n[3]! };
  },
  isValid: isWork,
  defaults: DEFAULT_WORK,
  sparse: true,
};
