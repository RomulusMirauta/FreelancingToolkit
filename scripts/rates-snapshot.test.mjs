import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, historyMoves, holdBack, isMain, movedFrom, notPositive, notUpdated, readSnapshot, sourcesApart, writeSnapshot } from './rates-snapshot.mjs';

const committed = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
/** BNR quotes these per 100: with the multiplier lost, they read 100 times too high. */
const PER_100 = ['HUF', 'IDR', 'ISK', 'JPY', 'KRW'];
const multiplierLost = (rates) => Object.fromEntries(Object.entries(rates).map(([c, r]) => [c, PER_100.includes(c) ? r * 100 : r]));
const codes = (problems) => problems.map((p) => p.split(':')[0]);

// The deploy downloads both files again before testing, and a feed that stops listing one of these isn't a broken
// download (BNR stopped publishing BGN in 2026): the checks expect those the files have. They run on the committed
// files, and on copies as they would read once BNR stops quoting ISK or the market source drops JPY.
const SNAPSHOTS = [
  ['the committed files', () => {}],
  ['BNR without ISK', (bnr) => {
    delete bnr.rates.ISK;
    delete bnr.history[0].rates.ISK;
  }],
  ['the market without JPY', (_, market) => {
    delete market.rates.JPY;
    delete market.names.JPY;
  }],
];
const snapshots = async (change) => {
  const [bnr, market] = await Promise.all([committed('rates.json'), committed('market-rates.json')]);
  change(bnr, market);
  return { bnr, market };
};

describe('BNR against the market', () => {
  it.each(SNAPSHOTS)('%s: flags every currency both price with the multiplier lost, and only those', async (_, change) => {
    const { bnr, market } = await snapshots(change);
    expect(sourcesApart(bnr.rates, market.rates)).toEqual([]);
    expect(codes(sourcesApart(multiplierLost(bnr.rates), market.rates))).toEqual(PER_100.filter((c) => c in bnr.rates && c in market.rates));
  });

  it('allows up to 3 times either way, and skips what only one of them prices', () => {
    const bnr = { EUR: 5.34, USD: 4.78, JPY: 3.0197, XAU: 624.9 };
    expect(sourcesApart(bnr, { EUR: 5.34 * 2.99, USD: 4.78 / 2.99, JPY: 0.030197, ARS: 0.0031 })).toEqual(['JPY: BNR 3.0197, market 0.030197']);
    expect(sourcesApart(bnr, { EUR: 5.34 * 3.01 })).toHaveLength(1);
    expect(sourcesApart(bnr, { USD: 4.78 / 3.01 })).toHaveLength(1);
    expect(sourcesApart(bnr, undefined)).toEqual([]);
    expect(sourcesApart(undefined, { EUR: 5.34 })).toEqual([]);
  });

  it('flags a rate that is not a positive number', () => {
    expect(sourcesApart({ EUR: 0, USD: -4.78, GBP: Number.NaN }, { EUR: 5.34, USD: 4.78, GBP: 6.4 })).toHaveLength(3);
  });
});

describe('a new snapshot against the saved one', () => {
  const saved = { date: '2026-11-06', rates: { EUR: 5.3408, SAR: 1.26801, EGP: 0.1483 } };

  it('flags a rate 1,000 times off, with the saved date', () => {
    expect(movedFrom({ EUR: 5.3417, SAR: 1268.01 }, saved)).toEqual(['SAR: 1268.01, 1.26801 on 2026-11-06']);
  });

  it('allows up to 5 times either way: the largest real move was EGP 1.63 times in a day', () => {
    expect(movedFrom({ EUR: 5.3408 * 4.99, SAR: 1.26801 / 4.99, EGP: 0.0908 }, saved)).toEqual([]);
    expect(movedFrom({ EUR: 5.3408 * 5.01 }, saved)).toHaveLength(1);
    expect(movedFrom({ SAR: 1.26801 / 5.01 }, saved)).toHaveLength(1);
  });

  it('has nothing to compare with when nothing was saved', () => {
    expect(movedFrom({ SAR: 1268.01 }, null)).toEqual([]);
  });

  it.each(SNAPSHOTS)('%s: catches the multiplier lost on every day of a new 10-day file, which day-to-day checks miss', async (_, change) => {
    const { bnr } = await snapshots(change);
    const lost = bnr.history.map((day) => ({ date: day.date, rates: multiplierLost(day.rates) }));
    expect(historyMoves(lost)).toEqual([]);
    expect(codes(movedFrom(lost[0].rates, bnr))).toEqual(PER_100.filter((c) => c in bnr.rates));
  });
});

describe('a BNR history, day to day', () => {
  it('lets the real moves through (EGP, 5 to 6 March 2024)', () => {
    expect(historyMoves([{ date: '2024-03-06', rates: { EGP: 0.0908 } }, { date: '2024-03-05', rates: { EGP: 0.1483 } }])).toEqual([]);
  });

  it('flags a day with the multiplier lost, against the days on both sides', () => {
    const history = [
      { date: '2026-11-06', rates: { EUR: 5.3408, JPY: 0.030197 } },
      { date: '2026-11-05', rates: { EUR: 5.3398, JPY: 3.0262 } },
      { date: '2026-11-04', rates: { EUR: 5.3381, JPY: 0.030214 } },
      { date: '2026-11-03', rates: { EUR: 5.3373 } },
    ];
    expect(historyMoves(history)).toEqual([
      'JPY: 0.030197 on 2026-11-06, 3.0262 on 2026-11-05',
      'JPY: 3.0262 on 2026-11-05, 0.030214 on 2026-11-04',
    ]);
  });

  it('passes the committed history', async () => {
    expect(historyMoves((await committed('rates.json')).history)).toEqual([]);
    expect(historyMoves([])).toEqual([]);
  });
});

describe('the rest of the checks', () => {
  it('flags each rate that is not a positive number', () => {
    expect(notPositive({ EUR: 5.34, USD: 0, GBP: -1, JPY: Number.NaN, HUF: null, CHF: '5.84', CAD: Infinity })).toEqual([
      'USD: 0', 'GBP: -1', 'JPY: NaN', 'HUF: null', 'CHF: 5.84', 'CAD: Infinity',
    ]);
  });

  it('holds back only with problems, naming them all', () => {
    expect(() => holdBack([])).not.toThrow();
    expect(() => holdBack(['JPY: BNR 3.0197, market 0.030197', 'HUF: 0'])).toThrow(
      'the new rates look wrong (JPY: BNR 3.0197, market 0.030197; HUF: 0)',
    );
  });
});

describe('the saved file', () => {
  let dir;
  let file;
  let lines;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ft-snapshot-'));
    file = pathToFileURL(join(dir, 'rates.json'));
    lines = [];
    for (const level of ['log', 'warn']) vi.spyOn(console, level).mockImplementation((line) => lines.push(line));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('is read when it is a snapshot', async () => {
    await writeFile(file, '{ "date": "2026-11-06", "rates": { "EUR": 5.3408 } }');
    expect(await readSnapshot(file)).toEqual({ date: '2026-11-06', rates: { EUR: 5.3408 } });
    expect(lines).toEqual([]);
  });

  it('counts as none when it is missing, quietly', async () => {
    expect(await readSnapshot(file)).toBeNull();
    expect(lines).toEqual([]);
  });

  it('counts as none, with a warning, when a merge conflict or a cut-off write broke it', async () => {
    for (const text of ['<<<<<<< HEAD\n{ "date": "2026-11-06" }\n=======\n{ "date": "2026-11-05" }\n>>>>>>> main\n', '{ "date": "2026-1', '[]', '{ "date": "2026-11-06" }']) {
      await writeFile(file, text);
      expect(await readSnapshot(file), text).toBeNull();
    }
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/rates\.json isn't a rates snapshot, so new rates will replace it\.$/);
  });

  it('is replaced in one step, through a temporary file that does not stay', async () => {
    await writeFile(file, 'broken');
    const { ino } = await stat(file);
    await writeSnapshot(file, { date: '2026-11-09', rates: { EUR: 5.3417 } });
    expect(await readFile(file, 'utf8')).toBe('{\n  "date": "2026-11-09",\n  "rates": {\n    "EUR": 5.3417\n  }\n}\n');
    // A new file took its place: one written over in place keeps its inode, and is half a file if the write is cut off.
    expect((await stat(file)).ino).not.toBe(ino);
    expect(await readdir(dir)).toEqual(['rates.json']);
  });

  it('stays, and the run says why, in one line', () => {
    notUpdated('BNR rates', new Error('HTTP 503'));
    notUpdated('Market rates', new Error('line 1\nline 2, 100%'));
    expect(lines).toEqual([
      '::error title=BNR rates not updated::HTTP 503; the saved file is unchanged.',
      '::error title=Market rates not updated::line 1%0Aline 2, 100%25; the saved file is unchanged.',
    ]);
  });

  it('when there was none, the run says that no file was written', async () => {
    // Deleted to take a real jump, say: the build can't run without it.
    notUpdated('BNR rates', new Error('HTTP 503'), await exists(file));
    await writeFile(file, 'broken');
    notUpdated('BNR rates', new Error('HTTP 503'), await exists(file));
    expect(lines).toEqual([
      '::error title=BNR rates not updated::HTTP 503; no file was written.',
      '::error title=BNR rates not updated::HTTP 503; the saved file is unchanged.',
    ]);
  });
});

describe('a script', () => {
  it('runs when Node is started with it, also on a Node without import.meta.main, and not when imported', async () => {
    expect(isMain({ main: true, url: 'file:///a.mjs' })).toBe(true);
    expect(isMain({ main: false, url: 'file:///a.mjs' })).toBe(false);
    // import.meta.main came with Node 22.18 and 24.2: before, it is undefined, and the scripts did nothing at all. Here a
    // script started by Node passes isMain its import.meta without it, and another module's.
    const dir = await mkdtemp(join(tmpdir(), 'ft-main-'));
    try {
      const script = join(dir, 'script.mjs');
      const other = pathToFileURL(join(dir, 'other.mjs')).href;
      await writeFile(script, `import { isMain } from ${JSON.stringify(new URL('rates-snapshot.mjs', import.meta.url).href)};\n`
        + `console.log(isMain({ url: import.meta.url }), isMain({ url: ${JSON.stringify(other)} }));\n`);
      const { stdout } = await promisify(execFile)(process.execPath, [script]);
      expect(stdout.trim()).toBe('true false');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
