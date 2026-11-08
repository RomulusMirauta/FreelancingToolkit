import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dropSecondCopy } from './secondCopy';

// A tiny browser on the app's own address, with the site's service workers (the other apps on the origin's too) and
// their caches, named as workbox names them.
const OWN = 'https://x.test/app/';
let unregistered: string[];
let updated: string[];
let cacheNames: string[];

function browser(scopes: string[]) {
  vi.stubGlobal('location', { href: `${OWN}?lang=en#taxes` });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistrations: async () => scopes.map((scope) => ({
        scope,
        unregister: async () => { unregistered.push(scope); return true; },
        update: async () => { updated.push(scope); },
      })),
    },
  });
  cacheNames = [...scopes.map((s) => `workbox-precache-v2-${s}`), 'another-cache'];
  vi.stubGlobal('caches', {
    keys: async () => [...cacheNames],
    delete: async (name: string) => {
      cacheNames = cacheNames.filter((n) => n !== name);
      return true;
    },
  });
}
beforeEach(() => {
  unregistered = [];
  updated = [];
});
afterEach(() => vi.unstubAllGlobals());

describe('one copy of the app', () => {
  it('a service worker registered at the app\'s address with a slash doubled goes, with its copy of the app', async () => {
    browser([OWN, 'https://x.test//app/', 'https://x.test/app//', 'https://x.test/', 'https://x.test/other/', 'https://x.test//other/']);
    await dropSecondCopy();
    expect(unregistered).toEqual(['https://x.test//app/', 'https://x.test/app//']);
    expect(cacheNames).toEqual([
      `workbox-precache-v2-${OWN}`, 'workbox-precache-v2-https://x.test/', 'workbox-precache-v2-https://x.test/other/',
      'workbox-precache-v2-https://x.test//other/', 'another-cache',
    ]);
    // The app's own looks for a newer version at once: it may be behind the copy that went.
    expect(updated).toEqual([OWN]);
  });

  it('without a second copy, nothing changes', async () => {
    browser([OWN, 'https://x.test/', 'https://x.test//other/']);
    await dropSecondCopy();
    expect(unregistered).toEqual([]);
    expect(updated).toEqual([]);
    expect(cacheNames).toHaveLength(4);
  });
});
