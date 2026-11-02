// Downloads market rates for the currencies BNR does not publish into src/data/market-rates.json,
// with their English and Romanian names. Source: ExchangeRate-API's open access endpoint (no key;
// its terms ask for an attribution link, shown in the app next to these rates).
// On any failure the committed snapshot is kept and the script exits 0.
import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'https://open.er-api.com/v6/latest/RON';
const PROVIDER = 'https://www.exchangerate-api.com';
const OUT = new URL('../src/data/market-rates.json', import.meta.url);
// The IMF's SDR is not a currency people get paid in.
const SKIP = new Set(['RON', 'XDR']);

const en = new Intl.DisplayNames('en', { type: 'currency' });
const ro = new Intl.DisplayNames('ro', { type: 'currency' });
const capitalize = (s) => s.charAt(0).toLocaleUpperCase('ro') + s.slice(1);
const sig6 = (x) => Number(x.toPrecision(6));

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

  const previous = JSON.parse(await readFile(OUT, 'utf8').catch(() => 'null'));
  if (previous?.date === date) {
    console.log(`Market rates unchanged (${date}).`);
  } else {
    await writeFile(OUT, JSON.stringify({ date, source: SOURCE, provider: PROVIDER, rates, names }, null, 2) + '\n');
    console.log(`Market rates updated to ${date}: ${Object.keys(rates).length} currencies.`);
  }
} catch (err) {
  console.warn(`Market rates fetch failed, keeping the committed snapshot: ${err.message}`);
}
