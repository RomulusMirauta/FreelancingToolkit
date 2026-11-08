// What the two fetch scripts share: reading the saved snapshot, checking new rates before they replace it, and writing
// it. src/lib/currency/rates-data.test.ts runs the same checks on the committed files.
//
// A multiplier lost (BNR quotes HUF, IDR, ISK, JPY and KRW per 100) or a glitch at the provider puts a rate 100 or 1,000
// times off. Real moves stay far inside the factors below: the largest from one BNR fixing to the next since 2008 is
// EGP's, x1.63 on 6 March 2024, and on a normal day the two sources differ by under 2%. A real jump past them (a
// redenomination) is held back too: delete the saved file and run npm run rates again to take it.
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** BNR's rate and the market rate for the same currency stay within this factor of each other, either way. */
export const SOURCES_FACTOR = 3;
/** A rate stays within this factor of the saved snapshot's, and of the previous banking day's, either way. */
export const MOVE_FACTOR = 5;

const within = (rate, other, factor) => rate / other >= 1 / factor && rate / other <= factor;

/** The codes in both tables whose rates are more than `factor` apart (a rate that isn't a positive number too). */
const apart = (rates, other, factor) => Object.keys(rates).filter((code) => code in other && !within(rates[code], other[code], factor));

/** Each rate that isn't a positive number. */
export const notPositive = (rates) =>
  Object.entries(rates).filter(([, rate]) => !(Number.isFinite(rate) && rate > 0)).map(([code, rate]) => `${code}: ${rate}`);

/** The currencies both sources price, with rates more than SOURCES_FACTOR apart. */
export const sourcesApart = (bnr = {}, market = {}) =>
  apart(bnr, market, SOURCES_FACTOR).map((code) => `${code}: BNR ${bnr[code]}, market ${market[code]}`);

/** The currencies whose rate is more than MOVE_FACTOR from the saved snapshot's. */
export const movedFrom = (rates, saved) =>
  saved ? apart(rates, saved.rates, MOVE_FACTOR).map((code) => `${code}: ${rates[code]}, ${saved.rates[code]} on ${saved.date}`) : [];

/** In a BNR history, newest first: the currencies whose rate is more than MOVE_FACTOR from the previous banking day's. */
export const historyMoves = (history = []) =>
  history.slice(1).flatMap((before, i) => {
    const day = history[i];
    return apart(day.rates, before.rates, MOVE_FACTOR)
      .map((code) => `${code}: ${day.rates[code]} on ${day.date}, ${before.rates[code]} on ${before.date}`);
  });

/** Stops the update when the new rates have problems: the saved file stays and the run shows them. */
export function holdBack(problems) {
  if (problems.length) throw new Error(`the new rates look wrong (${problems.join('; ')})`);
}

/**
 * The snapshot saved in `file`, or null when there is none or it isn't one (a merge conflict, a cut-off write): the new
 * rates then replace it, where giving up would leave it broken.
 */
export async function readSnapshot(file) {
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return null;
  try {
    const saved = JSON.parse(text);
    if (typeof saved?.date === 'string' && saved.rates && typeof saved.rates === 'object') return saved;
  } catch {
    // Not JSON: said below.
  }
  console.warn(`${relative(process.cwd(), fileURLToPath(file))} isn't a rates snapshot, so new rates will replace it.`);
  return null;
}

/** Writes a temporary file and renames it over the saved one, so a write cut off halfway leaves the old file whole. */
export async function writeSnapshot(file, snapshot) {
  const temporary = `${fileURLToPath(file)}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Says why the saved file stays, as an error on the GitHub Actions run. The script still exits 0, so a deploy of new
 * code goes on with the saved rates.
 */
export function notUpdated(what, err) {
  // A workflow command ends at a line break, and reads % as the start of an escape.
  const message = `${err.message}; the saved file is unchanged.`.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=${what} not updated::${message}`);
}
