import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

// A tiny browser that refuses what Safari refuses: a 101st address change within 10 seconds, and an address on
// another site. Each refusal is a SecurityError, as in the browser.
let url: URL;
let changes: number[];
let refused: number;
beforeEach(() => {
  vi.useFakeTimers();
  url = new URL('https://x.test/app/');
  changes = [];
  refused = 0;
  vi.stubGlobal('location', {
    get href() { return url.href; },
    get origin() { return url.origin; },
    get pathname() { return url.pathname; },
    get search() { return url.search; },
    get hash() { return url.hash; },
  });
  vi.stubGlobal('history', {
    state: null,
    replaceState: (_: unknown, __: string, next: string) => {
      const target = new URL(next, url);
      if (target.origin !== url.origin) throw new DOMException(`A history state object with URL '${target.href}' cannot be created in a document with origin '${url.origin}'.`, 'SecurityError');
      if (changes.filter((t) => Date.now() - t < 10_000).length >= 100) {
        refused++;
        throw new DOMException('Attempt to use history.replaceState() more than 100 times per 10 seconds', 'SecurityError');
      }
      changes.push(Date.now());
      url = target;
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** query.ts as a page load starts it: nothing waiting for the address. */
async function load() {
  vi.resetModules();
  return import('./query');
}

describe('the address follows the app', () => {
  it('holding an arrow key for 30 s (1,000 changes) stays under Safari\'s limit; the app reads each change, the address ends on the last', async () => {
    const { flushQuery, readQuery, writeQuery } = await load();
    flushQuery(); // the start's (main.tsx)
    for (let n = 1; n <= 1000; n++) {
      writeQuery((p) => p.set('days_off', String(n)));
      expect(readQuery().get('days_off')).toBe(String(n));
      vi.advanceTimersByTime(30);
    }
    vi.advanceTimersByTime(250);
    expect(url.search).toBe('?days_off=1000');
    expect(refused).toBe(0);
    // Not even close: at most 80 in any 10 seconds (40 at once, then one every 250 ms).
    for (const t of changes) expect(changes.filter((u) => u >= t && u - t < 10_000).length).toBeLessThanOrEqual(80);
    // 10 seconds after the burst, a change goes in at once again.
    vi.advanceTimersByTime(10_000);
    writeQuery((p) => p.set('days_off', '7'));
    expect(url.search).toBe('?days_off=7');
  });

  it('after the start, a change is in the address at once, so a reload right after it keeps it', async () => {
    // The browser picks the address it reloads before pagehide runs, and the address wins over the saved value:
    // a change that waited 250 ms for the address was undone by a reload in that time.
    const { flushQuery, writeQuery } = await load();
    flushQuery();
    writeQuery((p) => p.set('days_off', '21'));
    expect(url.search).toBe('?days_off=21');
    writeQuery((p) => p.set('income', '12345'));
    expect(url.search).toBe('?days_off=21&income=12345');
  });

  it('while the page starts, the changes wait for its one flush', async () => {
    const { flushQuery, readQuery, writeQuery } = await load();
    writeQuery((p) => p.set('lang', 'en'));
    writeQuery((p) => p.set('days_off', '21'));
    expect(changes).toEqual([]);
    expect(readQuery().toString()).toBe('lang=en&days_off=21');
    flushQuery();
    expect(changes.length).toBe(1);
    expect(url.search).toBe('?lang=en&days_off=21');
  });

  it('a change the browser refuses is written once it allows changes again; the app reads it meanwhile', async () => {
    const { readQuery, writeQuery } = await load();
    for (let n = 0; n < 100; n++) history.replaceState(null, '', `?n=${n}`);
    writeQuery((p) => p.set('amount', '40'));
    vi.advanceTimersByTime(250);
    expect(url.search).toBe('?n=99');
    expect(readQuery().get('amount')).toBe('40');
    vi.advanceTimersByTime(11_000);
    expect(url.search).toBe('?n=99&amount=40');
  });

  it('at an address with a double slash (…//app/) it stays on the app\'s own site, commas and colons readable', async () => {
    url = new URL('https://x.test//app/?amount=40#taxes');
    const { flushQuery, writeQuery } = await load();
    writeQuery((p) => {
      p.set('fold', 'converter,fees');
      p.set('rates', 'USD:4.9');
    });
    flushQuery();
    expect(url.href).toBe('https://x.test//app/?amount=40&fold=converter,fees&rates=USD:4.9#taxes');
  });

  it('the open page goes into the address at once, with the latest query', async () => {
    const { flushQuery, writeQuery } = await load();
    writeQuery((p) => p.set('amount', '40'));
    flushQuery('#taxes');
    expect(url.href).toBe('https://x.test/app/?amount=40#taxes');
    flushQuery('');
    expect(url.href).toBe('https://x.test/app/?amount=40');
  });

  it('a change that leaves the query as it was writes nothing', async () => {
    url = new URL('https://x.test/app/?amount=40');
    const { writeQuery } = await load();
    writeQuery((p) => p.set('amount', '40'));
    vi.advanceTimersByTime(1000);
    expect(changes).toEqual([]);
  });
});

/** index.html's script that gives the app one address, run as it is before the app starts. */
const ONE_ADDRESS = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).find((s) => s.includes('replaceState'))!;

describe('one address for the app', () => {
  it('a double slash (…//app/) goes back to one before the app reads the address, with the query and the page kept', () => {
    // At …github.io//FreelancingToolkit/ the app registered a second service worker, with its own copy of the app.
    const cases = [
      ['https://x.test//app/?amount=40&fold=converter,fees#taxes', 'https://x.test/app/?amount=40&fold=converter,fees#taxes'],
      ['https://x.test///app//', 'https://x.test/app/'],
    ] as const;
    for (const [from, to] of cases) {
      url = new URL(from);
      new Function(ONE_ADDRESS)();
      expect(url.href).toBe(to);
    }
    // The app's own address is left as it is.
    url = new URL('https://x.test/app/?amount=40#taxes');
    new Function(ONE_ADDRESS)();
    expect(changes.length).toBe(cases.length);
  });
});
