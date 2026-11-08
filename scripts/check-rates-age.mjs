// Fails the deploy run when the rates just deployed are old, so GitHub emails the owner. npm run rates keeps the saved
// rates when a download fails or looks wrong, and exits 0 so new code still deploys: a source that moved or stopped for
// good would leave every run green. The deploy workflow runs this after the deploy, which it never holds up.
import { readSnapshot } from './rates-snapshot.mjs';

const BNR = new URL('../src/data/rates.json', import.meta.url);
const MARKET = new URL('../src/data/market-rates.json', import.meta.url);

/**
 * The most days BNR's rates can be behind the run. BNR publishes on banking days only, and two holidays next to a
 * weekend keep a fixing for 5 days: Thursday's until Tuesday at Easter, Friday's until Wednesday when 30 November and
 * 1 December fall on a Monday and Tuesday, Wednesday's until Monday when Christmas falls on a Thursday.
 */
export const BNR_MAX_DAYS = 5;
/** The same for the market rates, which their source updates every day. */
export const MARKET_MAX_DAYS = 3;

/** Whole calendar days from `date` (YYYY-MM-DD) to the day of `now`, both in UTC; NaN when `date` isn't one. */
export function ageInDays(date, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return Number.NaN;
  return (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.parse(date)) / 86_400_000;
}

/**
 * Says how old each snapshot is on `now`, as an error on the GitHub Actions run when it is older than its limit or has no
 * date. True when both are recent enough.
 */
export async function checkRatesAge(now = new Date(), bnr = BNR, market = MARKET) {
  let recent = true;
  for (const [what, file, maxDays] of [['BNR rates', bnr, BNR_MAX_DAYS], ['Market rates', market, MARKET_MAX_DAYS]]) {
    const date = (await readSnapshot(file))?.date;
    const age = ageInDays(date, now);
    const said = Number.isNaN(age)
      ? `${what} without a date.`
      : `${what} from ${date}: ${age} ${age === 1 ? 'day' : 'days'} old (${maxDays} at most).`;
    if (age <= maxDays) {
      console.log(said);
    } else {
      recent = false;
      console.log(`::error title=${what} out of date::${said} See what npm run rates said in the build job.`);
    }
  }
  return recent;
}

if (import.meta.main && !(await checkRatesAge())) process.exitCode = 1;
