import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANG_QUERY, WORK_QUERY } from '../../features/app/appQueries';
import { DEFAULT_SOURCE } from '../../features/converter/Converter';
import { COLUMNS_QUERY } from '../../features/converter/converterQueries';
import { FEES_QUERY } from '../../features/converter/Fees';
import { INCOME_QUERY } from '../../features/taxes/Taxes';
import type { UrlQuery } from './urlQuery';

// A tiny browser: an address that history.replaceState changes, a count of reloads, and storage that refuses
// everything, as with site data blocked ("Block all cookies", "Don't allow sites to save data"), or only new
// values, as when it is full.
let url: URL;
let local: Map<string, string>;
let session: Map<string, string>;
let reloads: number;
const refuse = () => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};
const full = () => {
  throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
};
/** Site data blocked: anything done with it throws, as reaching it does in the browser. */
const BLOCKED = new Proxy({}, { get: refuse, ownKeys: refuse });
/** Storage over a map, whose keys Object.keys lists, as a browser's; `methods` replace its own. */
const over = (m: Map<string, string>, methods: Partial<Storage> = {}) => new Proxy({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
  ...methods,
}, { ownKeys: () => [...m.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });

beforeEach(() => {
  url = new URL('https://x.test/app/');
  local = new Map();
  session = new Map();
  reloads = 0;
  vi.stubGlobal('location', {
    get href() { return url.href; },
    get search() { return url.search; },
    get pathname() { return url.pathname; },
    get hash() { return url.hash; },
    get origin() { return url.origin; },
    reload: () => { reloads++; },
  });
  vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { url = new URL(next, url); } });
  vi.stubGlobal('localStorage', BLOCKED);
  vi.stubGlobal('sessionStorage', BLOCKED);
});
afterEach(async () => {
  (await import('./query')).flushQuery();
  vi.unstubAllGlobals();
});

/** The module as a page starts with it: nothing kept in memory. */
async function fresh() {
  vi.resetModules();
  return (await import('./storage')).storage;
}

/** A page load on `address`, or a reload: fresh modules, then what main.tsx runs before the first render. */
async function load(address?: string) {
  if (address) url = new URL(address, url);
  vi.resetModules();
  const share = await import('./share');
  const { applyUrlState } = await import('../../urlState');
  share.applySharedLink();
  applyUrlState();
  share.finishSharedLink();
  (await import('./query')).flushQuery();
  return share;
}

/** What a setting's hook starts from on the first render. */
async function shown<T>(key: string, initial: T, isValid: (v: unknown) => v is T, upgrade?: (v: unknown) => T | null): Promise<T> {
  const { usePersistentState } = await import('./usePersistentState');
  let value = initial;
  function Probe() {
    [value] = usePersistentState(key, initial, isValid, upgrade);
    return null;
  }
  renderToString(createElement(Probe));
  return value;
}
const shownQuery = <T,>(q: UrlQuery<T>) => shown(q.key, q.defaults, q.isValid, q.upgrade);
const isAmount = (v: unknown): v is typeof DEFAULT_SOURCE => typeof v === 'object' && v !== null;

/** What the pages do once drawn: each writes its settings into the address as its hooks show them. */
async function draw() {
  const { URL_QUERIES } = await import('../../urlState');
  const { writeUrlQuery } = await import('./urlQuery');
  const { writeSourceQuery } = await import('../../features/converter/sourceQuery');
  for (const q of URL_QUERIES) writeUrlQuery(q, await shownQuery(q));
  const source = await shown('ft.source', DEFAULT_SOURCE, isAmount);
  writeSourceQuery(source, source === DEFAULT_SOURCE);
  (await import('./query')).flushQuery();
}

// The app's source files, as text.
const SOURCES = import.meta.glob(['../../**/*.{ts,tsx}', '!../../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** Code that uses localStorage itself: one of its methods, or the whole of it (Object.keys(localStorage)). */
const LOCAL_STORAGE = /\blocalStorage\.(getItem|setItem|removeItem|key|clear|length)\b|\(localStorage\)/;

describe('the app\'s storage', () => {
  it('is localStorage when the browser allows it', async () => {
    vi.stubGlobal('localStorage', over(local));
    const storage = await fresh();
    expect(storage.setItem('ft.a', '1')).toBe(true);
    expect(local.get('ft.a')).toBe('1');
    expect(storage.keys()).toEqual(['ft.a']);
    storage.removeItem('ft.a');
    expect(local.size).toBe(0);
    expect(storage.getItem('ft.a')).toBeNull();
  });

  it('with site data blocked, keeps what it is given for as long as the page is open', async () => {
    const storage = await fresh();
    expect(storage.getItem('ft.a')).toBeNull();
    expect(storage.keys()).toEqual([]);
    expect(storage.setItem('ft.a', '1')).toBe(false);
    expect(storage.getItem('ft.a')).toBe('1');
    expect(storage.keys()).toEqual(['ft.a']);
    storage.removeItem('ft.a');
    expect(storage.getItem('ft.a')).toBeNull();
    expect(storage.keys()).toEqual([]);
    // The next page starts with nothing.
    storage.setItem('ft.b', '2');
    expect((await fresh()).getItem('ft.b')).toBeNull();
  });

  it('when full, what was saved stays readable, a value it refuses is read instead, and a removal takes both', async () => {
    local.set('ft.a', 'saved');
    local.set('ft.b', 'saved');
    vi.stubGlobal('localStorage', over(local, { setItem: full }));
    const storage = await fresh();
    expect(storage.setItem('ft.a', 'new')).toBe(false);
    expect(storage.getItem('ft.a')).toBe('new');
    expect(storage.getItem('ft.b')).toBe('saved');
    expect(storage.keys().sort()).toEqual(['ft.a', 'ft.b']);
    storage.removeItem('ft.a');
    expect(storage.getItem('ft.a')).toBeNull();
    expect(local.has('ft.a')).toBe(false);
  });

  it('is the only way the app reaches localStorage (index.html\'s theme script aside)', () => {
    const direct = Object.keys(SOURCES).filter((path) => !path.endsWith('/storage.ts') && LOCAL_STORAGE.test(SOURCES[path]!));
    expect(direct).toEqual([]);
  });
});

describe('with site data blocked', () => {
  it('an address sets the app for the visit, and stays in the address', async () => {
    await load('?lang=en&hours=6&currencies=EUR,USD,PLN&platform=malt&amount=40&currency=EUR&per=hour&fold=fees');
    expect(await shownQuery(LANG_QUERY)).toBe('en');
    expect((await shownQuery(WORK_QUERY)).hoursPerDay).toBe(6);
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD', 'PLN']);
    expect((await shownQuery(FEES_QUERY)).platform).toBe('malt');
    expect(await shown('ft.source', DEFAULT_SOURCE, isAmount)).toEqual({ period: 'hour', currency: 'EUR', amount: 40 });
    // Each page writes what it shows into the address: the defaults emptied it.
    const before = url.search;
    await draw();
    expect(url.search).toBe(before);
    expect(url.searchParams.get('currencies')).toBe('EUR,USD,PLN');
  });

  it('a shared link shows its settings, as the banner says, and a reload shows them again from the address', async () => {
    const share = await load('?share=1&currencies=EUR,USD&platform=malt');
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: false, same: false });
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
    expect((await shownQuery(FEES_QUERY)).platform).toBe('malt');
    await draw();
    expect(url.searchParams.get('currencies')).toBe('EUR,USD');
    expect(url.searchParams.get('platform')).toBe('malt');
    // Nothing could be kept for the banner, so a reload has only the address.
    expect((await load()).sharedLinkState().opened).toBe(false);
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
  });

  it('a reload keeps the tax income the address has: a link\'s default one stays the default', async () => {
    // The link's income is the default (it would have income= otherwise). Each reload found no saved amount, took
    // the address's for a new one, and the income followed it: 33,137.87 lei a month, written into the address.
    await load('?share=1&lang=en&amount=40&currency=USD&per=hour');
    await draw();
    for (let i = 0; i < 2; i++) {
      await load();
      expect(await shownQuery(INCOME_QUERY)).toEqual(INCOME_QUERY.defaults);
      await draw();
      expect(url.searchParams.has('income')).toBe(false);
      expect(url.searchParams.get('amount')).toBe('40');
    }
  });

  for (const hours of ['', '&hours=6']) {
    it(`"Reset tab" on Taxes puts the income back to its default after the reload${hours && ', with a working time'}`, async () => {
      await load(`?lang=en${hours}&amount=45&currency=EUR&per=hour&income=41658.24&income_currency=RON&income_per=month`);
      expect((await shownQuery(INCOME_QUERY)).amount).toBe(41658.24);
      // What resetPage('taxes') does: the income leaves the address and storage (the amount isn't the income's).
      const { writeQuery, flushQuery } = await import('./query');
      writeQuery((params) => INCOME_QUERY.names.forEach((k) => params.delete(k)));
      flushQuery();
      (await import('./storage')).storage.removeItem(INCOME_QUERY.key);
      await load();
      expect(await shownQuery(INCOME_QUERY)).toEqual(INCOME_QUERY.defaults);
      await draw();
      expect(url.searchParams.has('income')).toBe(false);
    });
  }

  it('a link with settings that aren\'t valid says so on the page it opens', async () => {
    // Found before the first render, the toast went to session storage, which threw: it was skipped.
    await load('?lang=en&amount=abc&currency=EUR&per=hour');
    const { droppedParams } = await import('./urlQuery');
    const toast = await import('./toast');
    expect(droppedParams().length).toBeGreaterThan(0);
    toast.notifyLater('badLink');
    expect(toast.takeLater()).toEqual([{ id: 'badLink' }]);
    // Taken once: the second run of the mount effect (StrictMode) doesn't show it again.
    expect(toast.takeLater()).toEqual([]);
  });
});

describe('with only new values refused (storage full)', () => {
  const LINK = '?share=1&currencies=EUR,USD&platform=malt';
  /** The viewer's own settings, saved before the storage filled up. */
  const OWN: Record<string, string> = {
    'ft.columns': '["RON","EUR","PLN"]',
    'ft.fees': '{"platform":"fiverr","platformPct":20,"transfer":"custom","transferPct":1.5}',
  };
  const ownSettings = () => Object.fromEntries(Object.keys(OWN).map((k) => [k, local.get(k)]));

  it('a link with settings no longer says nothing changed', async () => {
    vi.stubGlobal('localStorage', over(local, { setItem: full }));
    vi.stubGlobal('sessionStorage', over(session, { setItem: full }));
    const share = await load(LINK);
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: false, same: false });
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
  });

  it('"Back to my settings" keeps the own settings set aside until they can be saved', async () => {
    for (const [k, v] of Object.entries(OWN)) local.set(k, v);
    vi.stubGlobal('localStorage', over(local, { setItem: full }));
    vi.stubGlobal('sessionStorage', over(session));
    const share = await load(LINK);
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
    // Kept for this page only, they would be gone after a reload, which showed the defaults under a toast saying
    // they were back: the page stays on the link's, which the address keeps, and the banner stays.
    share.restoreOwnSettings();
    expect(reloads).toBe(0);
    expect(session.get('ft-toast-after-reload') ?? '').not.toContain('restored');
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
    (await import('./query')).flushQuery();
    expect(url.searchParams.get('currencies')).toBe('EUR,USD');
    expect((await load()).sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
    // With room again, they are back for good.
    vi.stubGlobal('localStorage', over(local));
    (await load()).restoreOwnSettings();
    expect(ownSettings()).toEqual(OWN);
    expect((await load()).sharedLinkState().opened).toBe(false);
  });

  it('"Keep the link\'s" after a refused "Back to my settings" keeps the link\'s settings', async () => {
    for (const [k, v] of Object.entries(OWN)) local.set(k, v);
    vi.stubGlobal('localStorage', over(local, { setItem: full }));
    vi.stubGlobal('sessionStorage', over(session));
    const share = await load(LINK);
    share.restoreOwnSettings();
    share.settleSharedLink();
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
    expect((await load()).sharedLinkState().opened).toBe(false);
    expect(await shownQuery(COLUMNS_QUERY)).toEqual(['EUR', 'USD']);
  });
});
