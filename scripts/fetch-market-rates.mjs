// Downloads market rates for the currencies BNR does not publish into src/data/market-rates.json,
// with their English and Romanian names. Source: ExchangeRate-API's open access endpoint (no key;
// its terms ask for an attribution link on the pages that use these rates: the app's footer, on both pages).
// Only a later day's rates replace the saved file, and only if they pass the checks in rates-snapshot.mjs, against the
// saved ones and BNR's. Otherwise, as on any failure, the saved file stays, the run shows why (::error::) and the
// script exits 0.
import { exists, holdBack, isMain, movedFrom, notPositive, notUpdated, readSnapshot, sourcesApart, writeSnapshot } from './rates-snapshot.mjs';

const SOURCE = 'https://open.er-api.com/v6/latest/RON';
const PROVIDER = 'https://www.exchangerate-api.com';
const OUT = new URL('../src/data/market-rates.json', import.meta.url);
const BNR = new URL('../src/data/rates.json', import.meta.url);
// The IMF's SDR is not a currency people get paid in. Zimbabwe's dollar (ZWL), replaced in 2024 at 2,498.7242 to one
// ZiG (ZWG), comes priced like the ZiG: about 2,500 times too high.
const SKIP = new Set(['RON', 'XDR', 'ZWL']);

const en = new Intl.DisplayNames('en', { type: 'currency' });
const ro = new Intl.DisplayNames('ro', { type: 'currency' });
const capitalize = (s) => s.charAt(0).toLocaleUpperCase('ro') + s.slice(1);
const sig6 = (x) => Number(x.toPrecision(6));

/** Updates `out`, checked against BNR's rates in `bnr` (the tests pass files of their own). */
export async function fetchMarketRates(out = OUT, bnr = BNR) {
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.result !== 'success' || body.base_code !== 'RON') throw new Error(`unexpected reply: ${body.result}`);
    const date = new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10);

    const rates = {};
    const names = {};
    for (const [code, perRon] of Object.entries(body.rates).sort(([a], [b]) => a.localeCompare(b))) {
      // Codes without a standard name (FOK, GGP, IMP, JEP, KID, TVD) are local, non-ISO currencies pegged 1:1 to another.
      if (SKIP.has(code) || !(perRon > 0) || en.of(code) === code) continue;
      rates[code] = sig6(1 / perRon); // RON per 1 unit, like the BNR snapshot
      names[code] = { en: en.of(code), ro: capitalize(ro.of(code)) };
    }
    if (!rates.EUR || !rates.USD) throw new Error('EUR or USD missing');

    const previous = await readSnapshot(out);
    if (previous && date <= previous.date) {
      console.log(`Market rates unchanged (${date}${date < previous.date ? `, older than the saved ${previous.date}` : ''}).`);
      return;
    }
    holdBack([...notPositive(rates), ...sourcesApart((await readSnapshot(bnr))?.rates, rates), ...movedFrom(rates, previous)]);
    await writeSnapshot(out, { date, source: SOURCE, provider: PROVIDER, rates, names });
    console.log(`Market rates updated to ${date}: ${Object.keys(rates).length} currencies.`);
  } catch (err) {
    notUpdated('Market rates', err, await exists(out));
  }
}

if (isMain(import.meta)) await fetchMarketRates();
