// Writes src/data/currency-symbols.json: the symbol of every currency the app lists, from Node's Unicode (CLDR) data.
// The app reads this fixed table instead of the browser's Intl, whose data differs between browsers and versions,
// so every visitor sees the same symbol. Symbols rarely change: run it again after the currency list grows.
// src/lib/currency/symbols.test.ts checks the result.
import { readFile, writeFile } from 'node:fs/promises';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const bnr = await read('../src/data/rates.json');
const market = await read('../src/data/market-rates.json');

// XAU and XDR are hidden in the app. KGS's som sign (U+20C0, 2021) is missing from most fonts and would show as a box.
const SKIP = new Set(['XAU', 'XDR', 'KGS']);
const codes = [...new Set(['RON', ...Object.keys(bnr.rates), ...Object.keys(market.names)])].filter((c) => !SKIP.has(c)).sort();

const symbols = {};
for (const code of codes) {
  const symbol = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
    .formatToParts(1)
    .find((p) => p.type === 'currency')?.value;
  // A currency whose only "symbol" is its code has none to show.
  if (symbol && symbol !== code) symbols[code] = symbol;
}

await writeFile(new URL('../src/data/currency-symbols.json', import.meta.url), JSON.stringify(symbols, null, 2) + '\n');
console.log(`Wrote ${Object.keys(symbols).length} currency symbols (Node ${process.versions.node}, ICU ${process.versions.icu}).`);
