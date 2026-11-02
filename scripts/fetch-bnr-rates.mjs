// Downloads the latest BNR reference rates into src/data/rates.json.
// The feed has no CORS header, so the app ships the rates at build time.
// On any failure the committed snapshot is kept and the script exits 0.
import { readFile, writeFile } from 'node:fs/promises';
import { parseBnrXml } from './bnr-parse.mjs';

const SOURCE = 'https://curs.bnr.ro/nbrfxrates.xml';
const OUT = new URL('../src/data/rates.json', import.meta.url);

try {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const [latest] = parseBnrXml(await res.text());
  if (!latest.rates.EUR) throw new Error('EUR missing from feed');

  const previous = JSON.parse(await readFile(OUT, 'utf8').catch(() => 'null'));
  if (previous?.date === latest.date) {
    console.log(`Rates unchanged (${latest.date}).`);
  } else {
    const out = { date: latest.date, source: SOURCE, rates: latest.rates };
    await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
    console.log(`Rates updated to ${latest.date}: EUR ${latest.rates.EUR}, ${Object.keys(latest.rates).length} currencies.`);
  }
} catch (err) {
  console.warn(`BNR fetch failed, keeping the committed snapshot: ${err.message}`);
}
