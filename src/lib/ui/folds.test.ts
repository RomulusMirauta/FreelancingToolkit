import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_FOLDS } from './settingsKeys';

// A tiny browser: an address that history.replaceState changes.
let url: URL;
beforeEach(() => {
  vi.stubGlobal('location', {
    get href() { return url.href; },
    get search() { return url.search; },
    get hash() { return url.hash; },
  });
  vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { url = new URL(next, url); } });
});
afterEach(() => vi.unstubAllGlobals());

/** A page load on `address`: fresh modules, nothing read from the address yet. */
async function load(address: string) {
  url = new URL(address);
  vi.resetModules();
  return { ...(await import('./folds')), ...(await import('./query')) };
}

describe('folded sections in the address', () => {
  it('an unknown name (an edited address) is dropped, so "Reset tab" on each page leaves nothing folded', async () => {
    const { clearFolds, flushQuery, foldParam } = await load('https://x.test/app/?fold=summary,fees,calendar');
    clearFolds(PAGE_FOLDS.converter);
    expect(foldParam()).toBe('calendar');
    clearFolds(PAGE_FOLDS.taxes);
    expect(foldParam()).toBeNull();
    flushQuery();
    expect(url.search).toBe('');
  });

  it('the known names stay, in their order', async () => {
    const { clearFolds, flushQuery } = await load('https://x.test/app/?fold=vat,converter,other#taxes');
    clearFolds(['converter']);
    flushQuery();
    expect(url.search).toBe('?fold=vat,other');
    expect(url.hash).toBe('#taxes');
  });
});
