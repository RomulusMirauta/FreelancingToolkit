// Downloads the BNR reference rates into src/data/rates.json: the latest ones, plus the last 10 banking days
// (the converter shows the change against the previous day and a small 10-day chart).
// The feed has no CORS header, so the app ships the rates at build time.
// The 10-day file comes first; if it fails, the daily file is used and added to the history already saved.
// On any failure the committed snapshot is kept and the script exits 0.
import { readFile, writeFile } from 'node:fs/promises';
import { parseBnrXml } from './bnr-parse.mjs';

const DAILY = 'https://curs.bnr.ro/nbrfxrates.xml';
const TEN_DAYS = 'https://curs.bnr.ro/nbrfxrates10days.xml';
const OUT = new URL('../src/data/rates.json', import.meta.url);
const HISTORY_DAYS = 10;

const download = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseBnrXml(await res.text());
};

try {
  const saved = JSON.parse(await readFile(OUT, 'utf8').catch(() => 'null'));
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

  if (saved?.date === latest.date && saved.history?.length) {
    console.log(`Rates unchanged (${latest.date}).`);
  } else {
    const history = days.slice(0, HISTORY_DAYS).map(({ date, rates }) => ({ date, rates }));
    const out = { date: latest.date, source, rates: latest.rates, history };
    await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
    console.log(`Rates updated to ${latest.date}: EUR ${latest.rates.EUR}, ${Object.keys(latest.rates).length} currencies, ${history.length} days of history.`);
  }
} catch (err) {
  console.warn(`BNR fetch failed, keeping the committed snapshot: ${err.message}`);
}
