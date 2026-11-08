import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny browser: an address that history.replaceState changes, the app's storage, the tab's session storage
// (a reload keeps it, as a browser does; another tab has its own) and a count of reloads.
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

/** The next visit: a new tab, or the installed app's window, with a session storage of its own. */
async function visit(address = './') {
  session = new Map();
  vi.stubGlobal('sessionStorage', storage(session));
  return load(address);
}

/** Back to a tab still open, as that page had it. */
function backTo(tab: Map<string, string>) {
  session = tab;
  vi.stubGlobal('sessionStorage', storage(session));
}

/** The toasts this page shows once it has started. */
const toasts = () => (JSON.parse(session.get('ft-toast-after-reload') ?? '[]') as { id: string }[]).map((n) => n.id);

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

  it('after a link with the own settings, the next link sets aside the settings as they are then', async () => {
    const own = await load();
    await load(own.shareUrl('converter'));
    local.set('ft.columns', '["RON","EUR"]');
    url.searchParams.set('currencies', 'RON,EUR');
    const share = await load(LINK);
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    share.restoreOwnSettings();
    expect(local.get('ft.columns')).toBe('["RON","EUR"]');
  });

  it('the own link opened again after a change says it replaced the change, and offers the way back', async () => {
    const own = await load();
    const link = own.shareUrl('converter');
    await load(link);
    local.set('ft.columns', '["RON","EUR"]');
    url.searchParams.set('currencies', 'RON,EUR');
    const share = await load(link);
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(local.get('ft.columns')).toBe('["RON","EUR","PLN"]');
    share.restoreOwnSettings();
    expect(local.get('ft.columns')).toBe('["RON","EUR"]');
  });

  it('"Copy link" while the address catches up (a key held down) has the latest change', async () => {
    const share = await load();
    const { flushQuery, writeQuery } = await import('./query');
    // Past the changes that go into the address at once, the latest waits a moment for it.
    let n = 0;
    do writeQuery((p) => p.set('days_off', String(++n)));
    while (url.searchParams.get('days_off') === String(n) && n < 1000);
    expect(url.searchParams.get('days_off')).not.toBe(String(n));
    expect(share.shareUrl('converter')).toMatch(new RegExp(`[?&]days_off=${n}(&|$)`));
    flushQuery();
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

describe('a link whose tab is closed before a choice', () => {
  // A link from a chat app opens in a tab of its own (on Android, an in-app browser), often closed without a choice.
  it('replaced the own settings for that visit: the next one puts them back, once, and says so', async () => {
    await load();
    await load(LINK);
    const later = await visit();
    expect(later.sharedLinkState().opened).toBe(false);
    expect(ownSettings()).toEqual(OWN);
    expect(url.searchParams.get('currencies')).toBe('RON,EUR,PLN');
    expect(toasts()).toEqual(['restored']);
    expect(local.has('ft-shared-backup')).toBe(false);
    await visit();
    expect(toasts()).toEqual([]);
    expect(ownSettings()).toEqual(OWN);
  });

  it('the next visit puts them back also on an address that still has the link\'s settings', async () => {
    await load();
    await load(LINK);
    // The link's tab reopened without its session storage, or its address copied into a new tab.
    await visit(url.href);
    expect(ownSettings()).toEqual(OWN);
    expect(url.searchParams.get('currencies')).toBe('RON,EUR,PLN');
    expect(url.searchParams.get('platform')).toBe('fiverr');
  });

  it('its tab, still open, keeps the way back on a reload, also after another tab put the own settings back', async () => {
    await load();
    await load(LINK);
    const linkTab = session;
    const linkAddress = url.href;
    expect((await load()).sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
    // Another tab can't tell the link's tab is still open.
    await visit();
    expect(ownSettings()).toEqual(OWN);
    // The link's tab reloads (an update): its address brings the link's settings back, and the way back stays.
    backTo(linkTab);
    expect((await load(linkAddress)).sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
    // Then closed without a choice: the next visit puts the own settings back again.
    await visit();
    expect(ownSettings()).toEqual(OWN);
  });

  it('after a choice, the next visit leaves the settings as they are', async () => {
    await load();
    (await load(LINK)).settleSharedLink();
    await visit();
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
    expect(toasts()).toEqual([]);
    local = new Map(Object.entries(OWN));
    vi.stubGlobal('localStorage', storage(local));
    (await load(LINK)).restoreOwnSettings();
    await visit();
    expect(ownSettings()).toEqual(OWN);
    expect(toasts()).toEqual([]);
    expect(local.has('ft-shared-backup')).toBe(false);
  });

  it('with no own settings replaced, or the same ones, there is nothing for the next visit to put back', async () => {
    // A first visit: the link's settings are all the viewer has.
    local = new Map();
    vi.stubGlobal('localStorage', storage(local));
    await load(LINK);
    await visit();
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
    expect(toasts()).toEqual([]);
    // The viewer's own link, then a change of their own.
    local = new Map(Object.entries(OWN));
    vi.stubGlobal('localStorage', storage(local));
    const own = await load();
    await load(own.shareUrl('converter'));
    expect(local.has('ft-shared-backup')).toBe(false);
    local.set('ft.columns', '["EUR","USD"]');
    await visit();
    expect(local.get('ft.columns')).toBe('["EUR","USD"]');
    expect(toasts()).toEqual([]);
  });

  it('a link opened on the next visit sets aside the own settings, not the first link\'s', async () => {
    await load();
    await load(LINK);
    const share = await visit('?share=1&currencies=GBP,RON&hours=4');
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    expect(toasts()).toEqual([]);
    share.restoreOwnSettings();
    expect(ownSettings()).toEqual(OWN);
    await visit();
    expect(toasts()).toEqual([]);
  });

  it('a choice in one tab leaves the link waiting in another', async () => {
    await load();
    const first = await load(LINK);
    const firstTab = session;
    await visit('?share=1&currencies=GBP,RON&hours=4');
    backTo(firstTab);
    first.settleSharedLink();
    expect(local.has('ft-shared-backup')).toBe(true);
    // The second tab closed without a choice: the next visit puts back the own settings its link set aside.
    await visit();
    expect(ownSettings()).toEqual(OWN);
    expect(toasts()).toEqual(['restored']);
  });

  it('"Reset app" in a tab open from before also ends a link left waiting in another', async () => {
    const open = await load();
    const openTab = session;
    await visit(LINK);
    backTo(openTab);
    // Kept, the next visit would undo the reset.
    open.settleSharedLink(true);
    expect(local.has('ft-shared-backup')).toBe(false);
    await visit();
    expect(toasts()).toEqual([]);
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
