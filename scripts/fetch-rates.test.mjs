import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBnrRates } from './fetch-bnr-rates.mjs';
import { fetchMarketRates } from './fetch-market-rates.mjs';
import { exists } from './rates-snapshot.mjs';

// The two scripts of npm run rates, on files of their own, with the downloads simulated.
const TEN_DAYS = 'https://curs.bnr.ro/nbrfxrates10days.xml';
const DAILY = 'https://curs.bnr.ro/nbrfxrates.xml';
const MARKET = 'https://open.er-api.com/v6/latest/RON';
const PROVIDER = 'https://www.exchangerate-api.com';

/**
 * BNR's file with these days, newest first, in lei per unit. HUF is written per 100, as BNR does, with `huf` after its
 * code (a day's own `huf` first).
 */
const bnrXml = (days, huf = ' multiplier="100"') => `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd"><Header><PublishingDate>${days[0].date}</PublishingDate></Header><Body>
${days.map(({ date, rates, huf: dayHuf = huf }) => `<Cube date="${date}">${Object.entries(rates).map(([code, rate]) => code === 'HUF'
    ? `<Rate currency="HUF"${dayHuf}>${+(rate * 100).toFixed(4)}</Rate>`
    : `<Rate currency="${code}">${rate}</Rate>`).join('')}</Cube>`).join('\n')}
</Body></DataSet>`;

/** The market source's reply for these lei per unit: it gives units per leu. */
const marketReply = (date, lei) => ({
  result: 'success',
  base_code: 'RON',
  time_last_update_unix: Date.parse(`${date}T00:02:31Z`) / 1000,
  rates: { RON: 1, ...Object.fromEntries(Object.entries(lei).map(([code, rate]) => [code, 1 / rate])) },
});

const day = (date, EUR, HUF) => ({ date, rates: { EUR, USD: 4.7795, HUF } });
const NOV_5 = day('2026-11-05', 5.3398, 0.014708);
const NOV_6 = day('2026-11-06', 5.3408, 0.014662);
const NOV_9 = day('2026-11-09', 5.3417, 0.01465);
const SAVED_BNR = { date: '2026-11-06', source: TEN_DAYS, rates: NOV_6.rates, history: [NOV_6, NOV_5] };
const SAVED_MARKET = {
  date: '2026-11-06', source: MARKET, provider: PROVIDER,
  rates: { EUR: 5.34017, HUF: 0.01466, SAR: 1.268, USD: 4.78, ZWG: 0.179, ZWL: 0.179 },
  names: { EUR: { en: 'Euro', ro: 'Euro' } },
};
const MARKET_LEI = { EUR: 5.34017, HUF: 0.0146598, SAR: 1.26801, USD: 4.7795, XDR: 6.471, ZWG: 0.179189, ZWL: 0.179189 };

let dir;
let bnrFile;
let marketFile;
let lines;
let routes;
const save = (file, snapshot) => writeFile(file, JSON.stringify(snapshot, null, 2) + '\n');
const text = (file) => readFile(file, 'utf8');
const json = async (file) => JSON.parse(await text(file));
const serve = (url, body, status = 200) => {
  routes[url] = () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ft-rates-'));
  bnrFile = pathToFileURL(join(dir, 'rates.json'));
  marketFile = pathToFileURL(join(dir, 'market-rates.json'));
  await save(bnrFile, SAVED_BNR);
  await save(marketFile, SAVED_MARKET);
  lines = [];
  for (const level of ['log', 'warn']) vi.spyOn(console, level).mockImplementation((line) => lines.push(line));
  routes = {};
  vi.stubGlobal('fetch', vi.fn(async (url) => (routes[url] ? routes[url]() : new Response('Not found', { status: 404 }))));
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

describe('BNR rates', () => {
  const run = () => fetchBnrRates(bnrFile, marketFile);

  it('a later fixing replaces the saved file, with its history, through a temporary file that does not stay', async () => {
    serve(TEN_DAYS, bnrXml([NOV_9, NOV_6, NOV_5]));
    await run();
    expect(await json(bnrFile)).toEqual({ date: '2026-11-09', source: TEN_DAYS, rates: NOV_9.rates, history: [NOV_9, NOV_6, NOV_5] });
    expect((await readdir(dir)).sort()).toEqual(['market-rates.json', 'rates.json']);
    expect(lines).toEqual(['Rates updated to 2026-11-09: EUR 5.3417, 3 currencies, 3 days of history.']);
  });

  it('the same fixing, or an older one, leaves the saved file as it is', async () => {
    const before = await text(bnrFile);
    serve(TEN_DAYS, bnrXml([NOV_6, NOV_5]));
    await run();
    serve(TEN_DAYS, bnrXml([NOV_5]));
    await run();
    expect(await text(bnrFile)).toBe(before);
    expect(lines).toEqual(['Rates unchanged (2026-11-06).', 'Rates unchanged (2026-11-05, older than the saved 2026-11-06).']);
  });

  it('from the daily file, an older fixing changes nothing and a later one goes before the saved days', async () => {
    const before = await text(bnrFile);
    serve(TEN_DAYS, 'Service Unavailable', 503);
    serve(DAILY, bnrXml([NOV_5]));
    await run();
    expect(await text(bnrFile)).toBe(before);
    serve(DAILY, bnrXml([NOV_9]));
    await run();
    expect(await json(bnrFile)).toEqual({ date: '2026-11-09', source: DAILY, rates: NOV_9.rates, history: [NOV_9, NOV_6, NOV_5] });
  });

  it('a fixing with the multiplier lost is held back, and the run says why', async () => {
    const before = await text(bnrFile);
    serve(TEN_DAYS, bnrXml([NOV_9, NOV_6, NOV_5], ''));
    await run();
    expect(await text(bnrFile)).toBe(before);
    expect(lines).toEqual([
      '::error title=BNR rates not updated::the new rates look wrong (HUF: BNR 1.465, market 0.01466; HUF: 1.465, 0.014662 on 2026-11-06); the saved file is unchanged.',
    ]);
  });

  it('so is a 10-day file with the multiplier lost on an earlier day', async () => {
    const before = await text(bnrFile);
    serve(TEN_DAYS, bnrXml([NOV_9, { ...NOV_6, huf: '' }, NOV_5]));
    await run();
    expect(await text(bnrFile)).toBe(before);
    expect(lines).toEqual([
      '::error title=BNR rates not updated::the new rates look wrong (HUF: 0.01465 on 2026-11-09, 1.4662 on 2026-11-06; '
        + 'HUF: 1.4662 on 2026-11-06, 0.014708 on 2026-11-05); the saved file is unchanged.',
    ]);
  });

  it('a multiplier written in a way the parser does not read is refused, not taken as 1', async () => {
    const before = await text(bnrFile);
    serve(TEN_DAYS, bnrXml([NOV_9, NOV_6], ' Multiplier="100"'));
    serve(DAILY, bnrXml([NOV_9], ' Multiplier="100"'));
    await run();
    expect(await text(bnrFile)).toBe(before);
    expect(lines.at(-1)).toBe(
      '::error title=BNR rates not updated::HUF: multiplier not read in <Rate currency="HUF" Multiplier="100">; the saved file is unchanged.',
    );
  });

  it('a saved file a merge conflict broke is replaced', async () => {
    await writeFile(bnrFile, `<<<<<<< HEAD\n${JSON.stringify(SAVED_BNR)}\n=======\n${JSON.stringify(SAVED_BNR)}\n>>>>>>> main\n`);
    serve(TEN_DAYS, bnrXml([NOV_6, NOV_5]));
    await run();
    expect(await json(bnrFile)).toEqual(SAVED_BNR);
  });

  it('when nothing downloads, the saved file stays and the run says why', async () => {
    const before = await text(bnrFile);
    serve(TEN_DAYS, 'Bad Gateway', 502);
    serve(DAILY, 'Bad Gateway', 502);
    await run();
    expect(await text(bnrFile)).toBe(before);
    expect(lines).toEqual([
      '10-day file failed (HTTP 502), using the daily one.',
      '::error title=BNR rates not updated::HTTP 502; the saved file is unchanged.',
    ]);
  });
});

describe('market rates', () => {
  const run = () => fetchMarketRates(marketFile, bnrFile);

  it('a later day replaces the saved file, without RON, the IMF unit and the old Zimbabwean dollar', async () => {
    serve(MARKET, marketReply('2026-11-09', MARKET_LEI));
    await run();
    const saved = await json(marketFile);
    expect(saved.date).toBe('2026-11-09');
    expect(saved.rates).toEqual({ EUR: 5.34017, HUF: 0.0146598, SAR: 1.26801, USD: 4.7795, ZWG: 0.179189 });
    expect(Object.keys(saved.names)).toEqual(Object.keys(saved.rates));
    expect((await readdir(dir)).sort()).toEqual(['market-rates.json', 'rates.json']);
    expect(lines).toEqual(['Market rates updated to 2026-11-09: 5 currencies.']);
  });

  it('the same day, or an older one, leaves the saved file as it is', async () => {
    const before = await text(marketFile);
    serve(MARKET, marketReply('2026-11-06', MARKET_LEI));
    await run();
    serve(MARKET, marketReply('2026-11-05', MARKET_LEI));
    await run();
    expect(await text(marketFile)).toBe(before);
    expect(lines).toEqual(['Market rates unchanged (2026-11-06).', 'Market rates unchanged (2026-11-05, older than the saved 2026-11-06).']);
  });

  it("a rate 1,000 times the saved one, or 100 times BNR's, is held back", async () => {
    const before = await text(marketFile);
    serve(MARKET, marketReply('2026-11-09', { ...MARKET_LEI, SAR: 1268.01 }));
    await run();
    serve(MARKET, marketReply('2026-11-09', { ...MARKET_LEI, HUF: 1.46598 }));
    await run();
    expect(await text(marketFile)).toBe(before);
    expect(lines).toEqual([
      '::error title=Market rates not updated::the new rates look wrong (SAR: 1268.01, 1.268 on 2026-11-06); the saved file is unchanged.',
      '::error title=Market rates not updated::the new rates look wrong (HUF: BNR 0.014662, market 1.46598; HUF: 1.46598, 0.01466 on 2026-11-06); the saved file is unchanged.',
    ]);
  });

  it('a saved file a merge conflict broke is replaced', async () => {
    await writeFile(marketFile, `<<<<<<< HEAD\n${JSON.stringify(SAVED_MARKET)}\n=======\n${JSON.stringify(SAVED_MARKET)}\n>>>>>>> main\n`);
    serve(MARKET, marketReply('2026-11-06', MARKET_LEI));
    await run();
    expect(await json(marketFile)).toMatchObject({ date: '2026-11-06', rates: { EUR: 5.34017, SAR: 1.26801 } });
  });
});

// A real jump that keeps the currency's code, taken past the checks the way README.md and rates-snapshot.mjs say.
describe('a real jump, such as a redenomination', () => {
  const run = async () => {
    await fetchBnrRates(bnrFile, marketFile);
    await fetchMarketRates(marketFile, bnrFile);
  };

  it('in a currency only the market prices: deleting the market file takes it', async () => {
    serve(TEN_DAYS, bnrXml([NOV_6, NOV_5]));
    serve(MARKET, marketReply('2026-11-09', { ...MARKET_LEI, SAR: 1268.01 }));
    await rm(marketFile);
    await run();
    expect((await json(marketFile)).rates.SAR).toBe(1268.01);
  });

  describe('in one BNR publishes too', () => {
    // TRY at 1,000 times its rate from 9 November, in both feeds.
    const tryAt = ({ date, rates }, TRY) => ({ date, rates: { ...rates, TRY } });
    const NOV_10 = day('2026-11-10', 5.3421, 0.014655);
    beforeEach(async () => {
      await save(bnrFile, { ...SAVED_BNR, rates: { ...NOV_6.rates, TRY: 0.0952 }, history: [tryAt(NOV_6, 0.0952), tryAt(NOV_5, 0.0951)] });
      await save(marketFile, { ...SAVED_MARKET, rates: { ...SAVED_MARKET.rates, TRY: 0.095 } });
      serve(MARKET, marketReply('2026-11-09', { ...MARKET_LEI, TRY: 95.04 }));
    });

    it('both files are held back while it is in BNR\'s 10-day file; deleting rates.json alone leaves it missing', async () => {
      serve(TEN_DAYS, bnrXml([tryAt(NOV_9, 95.2), tryAt(NOV_6, 0.0952), tryAt(NOV_5, 0.0951)]));
      const market = await text(marketFile);
      await rm(bnrFile);
      await run();
      expect(await exists(bnrFile)).toBe(false);
      expect(await text(marketFile)).toBe(market);
      expect(lines).toEqual([
        '::error title=BNR rates not updated::the new rates look wrong (TRY: BNR 95.2, market 0.095; TRY: 95.2 on 2026-11-09, '
          + '0.0952 on 2026-11-06); no file was written.',
        '::error title=Market rates not updated::the new rates look wrong (TRY: 95.04, 0.095 on 2026-11-06); the saved file is unchanged.',
      ]);
    });

    it('once it has left BNR\'s 10-day file, deleting both files takes it in both', async () => {
      serve(TEN_DAYS, bnrXml([tryAt(NOV_10, 95.3), tryAt(NOV_9, 95.2)]));
      await rm(bnrFile);
      await rm(marketFile);
      await run();
      expect((await json(bnrFile)).rates.TRY).toBe(95.3);
      expect((await json(marketFile)).rates.TRY).toBe(95.04);
    });
  });
});
