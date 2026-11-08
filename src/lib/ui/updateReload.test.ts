import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny page: the tag that has the focus (':focus-visible' for a button the keyboard is on), what is on screen (each
// thing as the one selector it matches), whether text is selected, whether the page is hidden, and the document's
// listeners. Only selectors written here are tested; layout.pw.ts checks the real page.
let focused: string;
let onScreen: string[];
let selected: boolean;
let hidden: boolean;
let listeners: Map<string, Set<() => void>>;
const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
const selectors = (list: string) => list.split(',').map((s) => s.trim());
beforeEach(() => {
  vi.useFakeTimers();
  focused = 'body';
  onScreen = [];
  selected = false;
  hidden = false;
  listeners = new Map();
  const body = { matches: (list: string) => selectors(list).includes('body') };
  vi.stubGlobal('document', {
    body,
    get activeElement() { return focused === 'body' ? body : { matches: (list: string) => selectors(list).includes(focused) }; },
    getSelection: () => ({ isCollapsed: !selected }),
    get visibilityState() { return hidden ? 'hidden' : 'visible'; },
    querySelector: (list: string) => (onScreen.some((s) => selectors(list).includes(s)) ? {} : null),
    addEventListener: (type: string, fn: () => void) => listeners.set(type, (listeners.get(type) ?? new Set()).add(fn)),
    removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A page load: updateReload.ts fresh, and the reload it is given, counted. */
async function load() {
  vi.resetModules();
  const { reloadWhenFree } = await import('./updateReload');
  const reload = vi.fn();
  return { newVersion: () => reloadWhenFree(reload), reload };
}

describe('the reload onto a new version', () => {
  it('comes at once when nothing is in use', async () => {
    const { newVersion, reload } = await load();
    newVersion();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits while a field has the focus, however long, and comes once the focus has left it', async () => {
    focused = 'input';
    const { newVersion, reload } = await load();
    newVersion();
    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();
    focused = 'body';
    fire('focusout');
    vi.advanceTimersByTime(300);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a field left gives what leaving it started time to be saved first, also over the look every second', async () => {
    // Esc in a converter cell puts the amount back and leaves the cell; the tax income follows a few renders later.
    // A reload at once saved the income of the figure Esc had undone.
    focused = 'input';
    const { newVersion, reload } = await load();
    newVersion();
    vi.advanceTimersByTime(900);
    focused = 'body';
    fire('focusout');
    vi.advanceTimersByTime(150);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits while the keyboard is on a button (a reload would put it back at the top of the page), not after a click', async () => {
    focused = ':focus-visible';
    const { newVersion, reload } = await load();
    newVersion();
    vi.advanceTimersByTime(30_000);
    expect(reload).not.toHaveBeenCalled();
    focused = 'button';
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits while text is selected, to be copied, and comes within a second after', async () => {
    selected = true;
    const { newVersion, reload } = await load();
    newVersion();
    vi.advanceTimersByTime(30_000);
    expect(reload).not.toHaveBeenCalled();
    selected = false;
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('Tab from one field to the next is no pause: the focus is looked at once it has landed', async () => {
    focused = 'input';
    const { newVersion, reload } = await load();
    newVersion();
    // While focusout runs, the focus is on neither field.
    focused = 'body';
    fire('focusout');
    focused = 'input';
    vi.advanceTimersByTime(5000);
    expect(reload).not.toHaveBeenCalled();
  });

  for (const [what, selector] of [
    ['a press is under way', ':active'],
    ['a menu or a list is open', '[aria-expanded="true"]'],
    ['the copy-link or install panel is open', '[role="dialog"]'],
    ['the "Reset app" confirmation is open', '[role="alertdialog"]'],
    ['a toast has a button (Undo after "Reset tab")', '.toast-action'],
    ['details are open on the page', 'details[open]:not(.fold)'],
  ] as const) {
    it(`waits while ${what}, and comes within a second after`, async () => {
      onScreen = [selector];
      const { newVersion, reload } = await load();
      newVersion();
      vi.advanceTimersByTime(30_000);
      expect(reload).not.toHaveBeenCalled();
      onScreen = [];
      vi.advanceTimersByTime(1000);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  }

  it('comes at once when the page is hidden, even while typing with a menu open', async () => {
    focused = 'input';
    onScreen = ['[aria-expanded="true"]'];
    const { newVersion, reload } = await load();
    newVersion();
    vi.advanceTimersByTime(5000);
    expect(reload).not.toHaveBeenCalled();
    hidden = true;
    fire('visibilitychange');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('comes at once on a page already hidden', async () => {
    focused = 'input';
    hidden = true;
    const { newVersion, reload } = await load();
    newVersion();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a second new version while waiting brings one reload, and then nothing is left listening', async () => {
    focused = 'select';
    const { newVersion, reload } = await load();
    newVersion();
    newVersion();
    focused = 'body';
    fire('focusout');
    vi.advanceTimersByTime(10_000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect([...listeners.values()].every((fns) => fns.size === 0)).toBe(true);
  });

  it('once it has reloaded, another call changes nothing: the page is on its way', async () => {
    const { newVersion, reload } = await load();
    newVersion();
    newVersion();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('the update in more than one window', () => {
  // Windows of one browser: one localStorage, and for each an address (history.replaceState changes it) and the
  // tab's session storage. location and history are those of the window the code runs in.
  interface Win { url: URL; session: Map<string, string> }
  let local: Map<string, string>;
  let cur: Win;
  let reloads: number;
  const over = (m: () => Map<string, string>) => ({
    getItem: (k: string) => m().get(k) ?? null,
    setItem: (k: string, v: string) => void m().set(k, v),
    removeItem: (k: string) => void m().delete(k),
  });
  const win = (search = ''): Win => ({ url: new URL(`https://x.test/app/${search}`), session: new Map() });
  beforeEach(() => {
    local = new Map();
    reloads = 0;
    cur = win();
    vi.stubGlobal('location', {
      get href() { return cur.url.href; },
      get search() { return cur.url.search; },
      get pathname() { return cur.url.pathname; },
      get hash() { return cur.url.hash; },
      get origin() { return cur.url.origin; },
      reload: () => { reloads++; },
    });
    vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { cur.url = new URL(next, cur.url); } });
    vi.stubGlobal('localStorage', over(() => local));
    vi.stubGlobal('sessionStorage', over(() => cur.session));
  });

  /** A page load in `w`: fresh modules, then main.tsx's start. `update` is the update's reload in that page. */
  async function open(w: Win) {
    cur = w;
    vi.resetModules();
    const share = await import('./share');
    const { applyUrlState } = await import('../../urlState');
    const { reloadForUpdate } = await import('./updateReload');
    share.applySharedLink();
    applyUrlState();
    share.finishSharedLink();
    (await import('./query')).flushQuery();
    return { share, update: () => { cur = w; reloadForUpdate(); } };
  }
  const saved = (key: string): unknown => JSON.parse(local.get(key) ?? 'null');

  it('a window left open since before opens on what another one saved since, and keeps its folds and page', async () => {
    const A = win('?lang=en&amount=55&currency=EUR&per=hour&hours=6&fold=fees#taxes');
    const a = await open(A);
    // Another window changes the amount and the working time, then is closed.
    await open(win('?amount=70&currency=EUR&per=hour&hours=7'));
    const income = saved('ft.taxIncome');
    a.update();
    expect(reloads).toBe(1);
    await open(A);
    expect(saved('ft.source')).toEqual({ period: 'hour', currency: 'EUR', amount: 70 });
    expect(saved('ft.work')).toMatchObject({ hoursPerDay: 7 });
    expect(saved('ft.taxIncome')).toEqual(income);
    expect(A.url.search).toMatch(/^\?fold=fees&/);
    expect(Object.fromEntries(A.url.searchParams)).toMatchObject({ lang: 'en', amount: '70', hours: '7' });
    expect(A.url.hash).toBe('#taxes');
  });

  it('nor does it put the own settings back over a shared link waiting for a choice in another tab', async () => {
    const A = win('?lang=en&amount=55&currency=EUR&per=hour&hours=6&days=4');
    const a = await open(A);
    const B = win('?share=1&amount=40&currency=USD&per=hour');
    const b = await open(B);
    // The link has the default working time.
    expect(saved('ft.work')).toBeNull();
    // The update reloads both.
    a.update();
    await open(A);
    b.update();
    const { share } = await open(B);
    expect(reloads).toBe(2);
    expect(saved('ft.source')).toEqual({ period: 'hour', currency: 'USD', amount: 40 });
    expect(saved('ft.work')).toBeNull();
    expect(B.url.searchParams.has('hours')).toBe(false);
    // The banner still offers the own settings, and brings them back.
    expect(share.sharedLinkState()).toEqual({ opened: true, hadOwn: true, same: false });
    share.restoreOwnSettings();
    expect(saved('ft.source')).toEqual({ period: 'hour', currency: 'EUR', amount: 55 });
    expect(saved('ft.work')).toMatchObject({ hoursPerDay: 6, daysPerWeek: 4 });
  });

  const refuse = (name: string) => () => {
    throw new DOMException('Refused.', name);
  };
  for (const [what, refusing] of [
    ['site data blocked', () => {
      const blocked = new Proxy({}, { get: refuse('SecurityError') });
      vi.stubGlobal('localStorage', blocked);
      vi.stubGlobal('sessionStorage', blocked);
    }],
    ['the storage full', () => vi.stubGlobal('localStorage', { ...over(() => local), setItem: refuse('QuotaExceededError') })],
  ] as const) {
    it(`with ${what}, the address is the only other copy of the settings, and stays`, async () => {
      refusing();
      const A = win('?amount=55&currency=EUR&per=hour&hours=6&fold=fees');
      const a = await open(A);
      const before = A.url.search;
      // Nothing kept between loads: the income is the address's, the default one without income= (sourceQuery.ts).
      expect(before).toBe('?amount=55&currency=EUR&per=hour&hours=6&fold=fees');
      a.update();
      expect(reloads).toBe(1);
      expect(A.url.search).toBe(before);
    });
  }

  describe('a window that registered while another one\'s update was installing (no "activated")', () => {
    // navigator.serviceWorker: the worker in control of the page, and the listeners of its controllerchange.
    let controller: object | null;
    let takeover: Set<() => void>;
    beforeEach(() => {
      controller = {};
      takeover = new Set();
      vi.stubGlobal('navigator', {
        serviceWorker: {
          get controller() { return controller; },
          addEventListener: (type: string, fn: () => void) => { if (type === 'controllerchange') takeover.add(fn); },
        },
      });
    });
    const start = async () => {
      vi.resetModules();
      const m = await import('./updateReload');
      m.reloadOnTakeover();
      return m;
    };
    const newWorker = () => {
      controller = {};
      takeover.forEach((fn) => fn());
    };

    it('reloads onto the new version once its worker takes the page over', async () => {
      await start();
      newWorker();
      expect(reloads).toBe(1);
    });

    it('once, when "activated" comes as well', async () => {
      const { reloadForUpdate } = await start();
      newWorker();
      reloadForUpdate();
      expect(reloads).toBe(1);
    });

    it('not on a first visit, where the worker takes over a page that had none', async () => {
      controller = null;
      await start();
      newWorker();
      expect(reloads).toBe(0);
    });

    it('the page still starts where there are no service workers (plain http, a sandboxed frame)', async () => {
      vi.stubGlobal('navigator', {});
      await expect(start()).resolves.toBeDefined();
    });
  });
});
