import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny browser: an address that history.replaceState changes, the app's storage, the tab's session storage
// (a reload keeps it, as a browser does) and a count of reloads.
let url: URL;
let local: Map<string, string>;
let session: Map<string, string>;
let reloads: number;
const storage = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
});

/** The viewer's own settings, saved before any link is opened. */
const OWN: Record<string, string> = {
  'ft.columns': '["RON","EUR","PLN"]',
  'ft.fees': '{"platform":"fiverr","platformPct":20,"transfer":"custom","transferPct":1.5}',
  'ft.work': '{"hoursPerDay":6.5,"daysPerWeek":4,"daysOff":20,"holidays":true,"billablePct":70}',
  'ft.taxIncome': '{"amount":12000.5,"per":"hour","currency":"EUR"}',
};
const ownSettings = () => Object.fromEntries(Object.keys(OWN).map((k) => [k, local.get(k)]));

beforeEach(() => {
  url = new URL('https://x.test/app/');
  local = new Map(Object.entries(OWN));
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
  vi.stubGlobal('localStorage', storage(local));
  vi.stubGlobal('sessionStorage', storage(session));
});
afterEach(() => vi.unstubAllGlobals());

/** A page load, on `address` or (a reload) on the current one: fresh modules, then what main.tsx runs first. */
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

const LINK = '?share=1&currencies=EUR,USD&platform=malt';

describe('opening a shared link', () => {
  it('replaces the own settings, and offers to go back to them', async () => {
    await load();
    const share = await load(LINK);
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
    expect(local.has('ft.work')).toBe(false);
    expect(url.searchParams.has('share')).toBe(false);
  });

  it('a reload before choosing (the app reloads itself after an update) keeps the way back', async () => {
    await load();
    await load(LINK);
    const share = await load();
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    share.restoreOwnSettings();
    expect(reloads).toBe(1);
    expect(ownSettings()).toEqual(OWN);
    // After the reload that follows, the settings are the own ones and there is nothing left to choose.
    const after = await load();
    expect(after.sharedLinkState().opened).toBe(false);
    expect(ownSettings()).toEqual(OWN);
  });

  it('keeping the link\'s settings (or closing the banner) is final: a reload shows no banner', async () => {
    await load();
    const share = await load(LINK);
    share.settleSharedLink();
    const after = await load();
    expect(after.sharedLinkState().opened).toBe(false);
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
  });

  it('a second link before choosing keeps the own settings, not the first link\'s', async () => {
    await load();
    await load(LINK);
    const share = await load('?share=1&currencies=GBP,RON&hours=4');
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    share.restoreOwnSettings();
    expect(ownSettings()).toEqual(OWN);
  });

  it('a link with the own settings says so again after a reload, even after a change', async () => {
    const own = await load();
    await load(own.shareUrl('converter'));
    expect((await load()).sharedLinkState()).toEqual({ opened: true, hadOwn: false, same: true });
    expect(ownSettings()).toEqual(OWN);
    // Nothing was replaced: a change made since is the viewer's own, not one to go back from.
    local.set('ft.columns', '["EUR","USD"]');
    url.searchParams.set('currencies', 'EUR,USD');
    expect((await load()).sharedLinkState()).toEqual({ opened: true, hadOwn: false, same: true });
  });

  it('nothing is kept between visits that opened no link', async () => {
    const share = await load();
    expect(share.sharedLinkState().opened).toBe(false);
    expect(session.size).toBe(0);
  });

  it('with storage blocked, the page still starts and a link still opens', async () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    vi.stubGlobal('sessionStorage', blocked);
    expect((await load()).sharedLinkState().opened).toBe(false);
    const share = await load(LINK);
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    share.restoreOwnSettings();
    expect(ownSettings()).toEqual(OWN);
    vi.stubGlobal('localStorage', blocked);
    expect((await load(LINK)).sharedLinkState()).toEqual({ opened: true, hadOwn: false, same: false });
  });
});

describe('the tax income in a shared link', () => {
  // The sender typed 40 EUR an hour in the converter, then put the tax page back on its default income ("Reset
  // tab" there): the address has the amount and no income, which a link worked out from the amount instead.
  const SOURCE = '{"period":"hour","currency":"EUR","amount":40}';
  const sender = async () => {
    local = new Map([['ft.source', SOURCE]]);
    vi.stubGlobal('localStorage', storage(local));
    return (await load()).shareUrl('taxes');
  };

  it('a link with the converter\'s amount and no income opens on the default income, as the sender\'s', async () => {
    const link = await sender();
    expect(link).toBe('https://x.test/app/?share=1&amount=40&currency=EUR&per=hour#taxes');
    // Someone else's browser, with an income of their own.
    local = new Map(Object.entries(OWN));
    vi.stubGlobal('localStorage', storage(local));
    await load(link);
    expect(local.get('ft.source')).toBe(SOURCE);
    expect(local.has('ft.taxIncome')).toBe(false);
    expect(url.searchParams.has('income')).toBe(false);
  });

  it('opened in the sender\'s own browser, it says nothing changed', async () => {
    const share = await load(await sender());
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: false, same: true });
  });

  it('nor does a link\'s working time change the default income', async () => {
    for (const link of ['?share=1&hours=4', '?share=1&hours=4&amount=40&currency=EUR&per=hour']) {
      await load(link);
      expect(local.has('ft.taxIncome'), link).toBe(false);
    }
  });
});
