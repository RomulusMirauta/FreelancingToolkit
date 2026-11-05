import { LANG_QUERY, THEME_QUERY, WORK_QUERY } from './features/app/appQueries';
import { DEFAULT_SOURCE } from './features/converter/Converter';
import { ADDED_QUERY, COLUMNS_QUERY, GOAL_QUERY, RATES_QUERY } from './features/converter/converterQueries';
import { FEES_QUERY } from './features/converter/Fees';
import { applySourceQuery } from './features/converter/sourceQuery';
import { SIDE_JOB_QUERY } from './features/taxes/SideJob';
import { INCOME_QUERY, OPTIONS_QUERY, REF_QUERY, TARGET_QUERY } from './features/taxes/Taxes';
import { VAT_QUERY } from './features/taxes/Vat';
import { applyUrlQuery, type UrlQuery } from './lib/ui/urlQuery';

/**
 * Every saved setting in the address, so a reload, a bookmark or a link shows the app exactly as it was. The
 * converter's amount (?amount=&currency=&per=) has its own handler (it also sets the tax income), and folded
 * sections are kept by folds.ts (?fold=).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = UrlQuery<any>;

/** Read before the converter's amount: its tax income is worked out with the working time and custom rates. */
const BEFORE_SOURCE: readonly AnyQuery[] = [LANG_QUERY, THEME_QUERY, WORK_QUERY, RATES_QUERY, COLUMNS_QUERY, ADDED_QUERY, GOAL_QUERY, FEES_QUERY];
/** Read after it, so an income in the address wins over the one worked out from the converter. */
const AFTER_SOURCE: readonly AnyQuery[] = [INCOME_QUERY, TARGET_QUERY, SIDE_JOB_QUERY, OPTIONS_QUERY, REF_QUERY, VAT_QUERY];

export const URL_QUERIES: readonly AnyQuery[] = [...BEFORE_SOURCE, ...AFTER_SOURCE];

/** Runs once before the first render: the address wins over what is saved, and what is saved fills the address. */
export function applyUrlState(): void {
  BEFORE_SOURCE.forEach(applyUrlQuery);
  applySourceQuery(DEFAULT_SOURCE);
  AFTER_SOURCE.forEach(applyUrlQuery);
}
