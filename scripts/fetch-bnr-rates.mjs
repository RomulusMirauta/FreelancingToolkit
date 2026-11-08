// Downloads the BNR reference rates into src/data/rates.json: the latest ones, plus the last 10 banking days
// (the converter shows the change against the previous day and a small 10-day chart).
// The feed has no CORS header, so the app ships the rates at build time.
// The 10-day file comes first; if it fails, the daily file is used and added to the history already saved.
// Only a later fixing replaces the saved file, and only if its rates pass the checks in rates-snapshot.mjs, against the
// saved ones and the market rates. Otherwise, as on any failure, the saved file stays, the run shows why (::error::)
// and the script exits 0.
import { parseBnrXml } from './bnr-parse.mjs';
import { historyMoves, holdBack, movedFrom, notPositive, notUpdated, readSnapshot, sourcesApart, writeSnapshot } from './rates-snapshot.mjs';

const DAILY = 'https://curs.bnr.ro/nbrfxrates.xml';
const TEN_DAYS = 'https://curs.bnr.ro/nbrfxrates10days.xml';
const OUT = new URL('../src/data/rates.json', import.meta.url);
const MARKET = new URL('../src/data/market-rates.json', import.meta.url);
const HISTORY_DAYS = 10;

const download = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseBnrXml(await res.text());
};

/** Updates `out`, checked against the market rates in `market` (the tests pass files of their own). */
export async function fetchBnrRates(out = OUT, market = MARKET) {
  try {
    const saved = await readSnapshot(out);
    let days;
    let source = TEN_DAYS;
    try {
      days = await download(TEN_DAYS);
    } catch (err) {
      console.warn(`10-day file failed (${err.message}), using the daily one.`);
      source = DAILY;
      const [latest] = await download(DAILY);
      days = [latest, ...(saved?.history ?? []).filter((d) => d.date < latest.date)];
    }
    const [latest] = days;
    if (!latest.rates.EUR) throw new Error('EUR missing from feed');

    if (saved && latest.date <= saved.date) {
      console.log(`Rates unchanged (${latest.date}${latest.date < saved.date ? `, older than the saved ${saved.date}` : ''}).`);
      return;
    }
    const history = days.slice(0, HISTORY_DAYS).map(({ date, rates }) => ({ date, rates }));
    holdBack([
      ...notPositive(latest.rates),
      ...sourcesApart(latest.rates, (await readSnapshot(market))?.rates),
      ...movedFrom(latest.rates, saved),
      ...historyMoves(history),
    ]);
    await writeSnapshot(out, { date: latest.date, source, rates: latest.rates, history });
    console.log(`Rates updated to ${latest.date}: EUR ${latest.rates.EUR}, ${Object.keys(latest.rates).length} currencies, ${history.length} days of history.`);
  } catch (err) {
    notUpdated('BNR rates', err);
  }
}

if (import.meta.main) await fetchBnrRates();
