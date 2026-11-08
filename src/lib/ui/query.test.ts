import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny browser that refuses what Safari refuses: a 101st address change within 10 seconds, and an address on
// another site. Each refusal is a SecurityError, as in the browser.
let url: URL;
let changes: number[];
beforeEach(() => {
  vi.useFakeTimers();
  url = new URL('https://x.test/app/');
  changes = [];
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
      if (changes.filter((t) => Date.now() - t < 10_000).length >= 100) throw new DOMException('Attempt to use history.replaceState() more than 100 times per 10 seconds', 'SecurityError');
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
  it('holding an arrow key for 9 s (300 changes) never throws; the app reads each change, the address ends on the last', async () => {
    const { readQuery, writeQuery } = await load();
    for (let n = 1; n <= 300; n++) {
      writeQuery((p) => p.set('days_off', String(n)));
      expect(readQuery().get('days_off')).toBe(String(n));
      vi.advanceTimersByTime(30);
    }
    vi.advanceTimersByTime(250);
    expect(url.search).toBe('?days_off=300');
    // One change every 250 ms at most, far under Safari's 100 in 10 seconds.
    expect(changes.length).toBeLessThanOrEqual(9000 / 250 + 1);
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
