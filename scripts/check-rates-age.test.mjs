import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ageInDays, checkRatesAge } from './check-rates-age.mjs';

/** A moment of a deploy run, in UTC (the scheduled ones start in the evening, hours after their time). */
const at = (day, time = '18:30') => new Date(`${day}T${time}:00Z`);

describe('the age of a snapshot', () => {
  it('counts whole calendar days to the day of the run, in UTC', () => {
    expect(ageInDays('2026-11-06', at('2026-11-06', '00:00'))).toBe(0);
    expect(ageInDays('2026-11-06', at('2026-11-09', '23:59'))).toBe(3);
    expect(ageInDays('2026-11-06', at('2026-11-10', '00:00'))).toBe(4);
    expect(ageInDays('2025-12-24', at('2026-01-02'))).toBe(9);
  });

  it('is not a number without a date written as the snapshots write it', () => {
    for (const date of [undefined, '', '2026-11-6', '6.11.2026', '2026-11-06T00:00']) expect(ageInDays(date, at('2026-11-09')), date).toBeNaN();
  });
});

describe('the check after a deploy', () => {
  let dir;
  let bnrFile;
  let marketFile;
  let lines;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ft-age-'));
    bnrFile = pathToFileURL(join(dir, 'rates.json'));
    marketFile = pathToFileURL(join(dir, 'market-rates.json'));
    lines = [];
    for (const level of ['log', 'warn']) vi.spyOn(console, level).mockImplementation((line) => lines.push(line));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  /** Saves snapshots of these dates and checks them on `now`. */
  const check = async (bnrDate, marketDate, now) => {
    await writeFile(bnrFile, JSON.stringify({ date: bnrDate, rates: { EUR: 5.3408 } }));
    await writeFile(marketFile, JSON.stringify({ date: marketDate, rates: { EUR: 5.34017 } }));
    return checkRatesAge(now, bnrFile, marketFile);
  };
  const HINT = ' See what npm run rates said in the build job.';

  it("passes on a Monday with Friday's rates, and says how old they are", async () => {
    expect(await check('2026-11-06', '2026-11-08', at('2026-11-09'))).toBe(true);
    expect(lines).toEqual(['BNR rates from 2026-11-06: 3 days old (5 at most).', 'Market rates from 2026-11-08: 1 day old (3 at most).']);
  });

  it("passes on the morning before BNR's first fixing after two holidays next to a weekend", async () => {
    // BNR's last fixing before them, and the next banking day at 09:00 in Romania.
    for (const [fixing, day] of [
      ['2025-04-17', '2025-04-22'], // Good Friday and Easter Monday
      ['2026-11-27', '2026-12-02'], // 30 November and 1 December
      ['2025-12-24', '2025-12-29'], // Christmas on a Thursday and Friday
      ['2023-12-29', '2024-01-03'], // New Year on a Monday and Tuesday
      ['2025-01-03', '2025-01-08'], // 6 and 7 January
    ]) {
      expect(await check(fixing, day, at(day, '07:00')), fixing).toBe(true);
    }
    expect(lines.filter((line) => line.startsWith('BNR')).every((line) => line.endsWith(': 5 days old (5 at most).'))).toBe(true);
  });

  it('fails a day later, with the date of the rates', async () => {
    expect(await check('2026-11-27', '2026-12-03', at('2026-12-03'))).toBe(false);
    expect(lines).toEqual([
      `::error title=BNR rates out of date::BNR rates from 2026-11-27: 6 days old (5 at most).${HINT}`,
      'Market rates from 2026-12-03: 0 days old (3 at most).',
    ]);
  });

  it('fails when the market rates are 4 days old', async () => {
    expect(await check('2026-11-06', '2026-11-06', at('2026-11-09'))).toBe(true);
    expect(await check('2026-11-10', '2026-11-06', at('2026-11-10'))).toBe(false);
    expect(lines.at(-1)).toBe(`::error title=Market rates out of date::Market rates from 2026-11-06: 4 days old (3 at most).${HINT}`);
  });

  it('fails, naming both, when both are old', async () => {
    expect(await check('2026-10-30', '2026-10-30', at('2026-11-09'))).toBe(false);
    expect(lines).toEqual([
      `::error title=BNR rates out of date::BNR rates from 2026-10-30: 10 days old (5 at most).${HINT}`,
      `::error title=Market rates out of date::Market rates from 2026-10-30: 10 days old (3 at most).${HINT}`,
    ]);
  });

  it('fails when a snapshot has no date, or is missing', async () => {
    await writeFile(bnrFile, JSON.stringify({ rates: { EUR: 5.3408 } }));
    expect(await checkRatesAge(at('2026-11-09'), bnrFile, marketFile)).toBe(false);
    expect(lines).toEqual([
      expect.stringMatching(/rates\.json isn't a rates snapshot/),
      `::error title=BNR rates out of date::BNR rates without a date.${HINT}`,
      `::error title=Market rates out of date::Market rates without a date.${HINT}`,
    ]);
  });

  it('reads the committed snapshots by default', async () => {
    const committed = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
    const [bnr, market] = await Promise.all([committed('rates.json'), committed('market-rates.json')]);
    // On the day of the BNR rates; the market ones may be of another day, older than their limit even.
    await checkRatesAge(at(bnr.date));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(`BNR rates from ${bnr.date}: 0 days old (5 at most).`);
    expect(lines[1]).toContain(`Market rates from ${market.date}: `);
  });
});
