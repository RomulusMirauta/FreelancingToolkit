import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny page: the tag that has the focus, what is on screen (each thing as the one selector it matches), whether
// the page is hidden, and the document's listeners.
let focused: string;
let onScreen: string[];
let hidden: boolean;
let listeners: Map<string, Set<() => void>>;
const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
const selectors = (list: string) => list.split(',').map((s) => s.trim());
beforeEach(() => {
  vi.useFakeTimers();
  focused = 'body';
  onScreen = [];
  hidden = false;
  listeners = new Map();
  vi.stubGlobal('document', {
    get activeElement() { return { matches: (list: string) => selectors(list).includes(focused) }; },
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
    vi.advanceTimersByTime(0);
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
});
