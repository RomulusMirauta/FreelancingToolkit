export type Page = 'converter' | 'taxes';

/**
 * The settings each page owns, for "Reset tab" and the shared link. Working time is shown on the converter,
 * so it goes with it; language and theme belong to the whole app and only "Reset app" clears them.
 */
export const PAGE_KEYS: Record<Page, readonly string[]> = {
  converter: ['ft.source', 'ft.columns', 'ft.addedCurrencies', 'ft.customRates', 'ft.work', 'ft.fees', 'ft.goalNote'],
  taxes: ['ft.taxIncome', 'ft.taxOptions', 'ft.taxRef', 'ft.sideJob', 'ft.solverTarget'],
};

/** The foldable sections of each page (their ids in ?fold=…), so "Reset tab" unfolds its own. */
export const PAGE_FOLDS: Record<Page, readonly string[]> = {
  converter: ['converter', 'work', 'fees'],
  taxes: ['taxes', 'sideJob', 'other', 'solver', 'vat', 'calendar'],
};

/** Address parameters each page owns, cleared by "Reset tab" (otherwise a reload would bring them back). */
export const PAGE_QUERY: Record<Page, readonly string[]> = {
  converter: ['amount', 'currency', 'per'],
  taxes: [],
};

/** Settings of the whole app (the viewer's own choice), cleared only by "Reset app" and never shared. */
export const APP_KEYS: readonly string[] = ['ft.lang', 'ft.theme'];
