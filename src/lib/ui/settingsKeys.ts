export type Page = 'converter' | 'taxes';

/**
 * The settings each page owns, for "Reset tab" and the shared link. Working time is shown on the converter,
 * so it goes with it; language and theme belong to the whole app and only "Reset app" clears them.
 */
export const PAGE_KEYS: Record<Page, readonly string[]> = {
  converter: ['ft.source', 'ft.columns', 'ft.addedCurrencies', 'ft.customRates', 'ft.work', 'ft.fees', 'ft.goalNote'],
  taxes: ['ft.taxIncome', 'ft.taxOptions', 'ft.taxRef', 'ft.sideJob', 'ft.solverTarget', 'ft.vatRomania'],
};

/** The foldable sections of each page (their ids in ?fold=…), so "Reset tab" unfolds its own. */
export const PAGE_FOLDS: Record<Page, readonly string[]> = {
  converter: ['converter', 'work', 'fees'],
  taxes: ['taxes', 'sideJob', 'other', 'solver', 'vat', 'calendar'],
};

/**
 * Address parameters each page owns, cleared by "Reset tab" (otherwise a reload would bring them back).
 * A test checks this against every setting's parameters (urlState.ts).
 */
export const PAGE_QUERY: Record<Page, readonly string[]> = {
  converter: [
    'amount', 'currency', 'per',
    'currencies', 'added', 'rates', 'goal_note',
    'hours', 'days', 'days_off', 'holidays', 'billable',
    'platform', 'platform_pct', 'transfer', 'transfer_pct',
  ],
  taxes: [
    'income', 'income_currency', 'income_per', 'net', 'net_currency', 'net_per', 'salary', 'side', 'ref', 'vat_romania',
    'dependants', 'children', 'under26',
    'expenses_pfa', 'pfa_salary', 'pfa_pensioner', 'pfa_sick',
    'norm', 'norm_salary', 'norm_pensioner', 'norm_sick',
    'expenses_micro', 'micro_owner_paid', 'micro_pay', 'micro_other_employee', 'micro_single',
    'expenses_profit_salary', 'profit_pay', 'expenses_profit',
    'copyright_insured',
  ],
};

/** Settings of the whole app (the viewer's own choice), cleared only by "Reset app" and never shared. */
export const APP_KEYS: readonly string[] = ['ft.lang', 'ft.theme'];
/** Their address parameters: in the address, but left out of a copied link. */
export const APP_QUERY: readonly string[] = ['lang', 'theme'];
