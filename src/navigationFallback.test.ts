import { describe, expect, it } from 'vitest';
import { NAVIGATE_FALLBACK_DENYLIST } from '../vite.config';

/**
 * What the service worker does with an address it keeps no file for (Workbox's NavigationRoute): it answers with the
 * app, unless the path with the query matches the denylist. The hash never reaches it.
 */
const opensApp = (address: string) => {
  const url = new URL(`https://romulusmirauta.github.io${address}`);
  return !NAVIGATE_FALLBACK_DENYLIST.some((r) => r.test(url.pathname + url.search));
};

describe('addresses the service worker answers with the app', () => {
  it('the app\'s folder with any query, and index.html with or without one, so they open offline', () => {
    for (const address of [
      '/FreelancingToolkit/',
      '/FreelancingToolkit/?amount=40&currency=USD&per=hour',
      '/FreelancingToolkit/?share=1&amount=40#taxes',
      '/FreelancingToolkit/?fold=converter,fees&goal_note=a/b',
      '/FreelancingToolkit/index.html',
      '/FreelancingToolkit/index.html?lang=en',
      '//FreelancingToolkit/',
      '//FreelancingToolkit/?lang=en',
    ]) expect(opensApp(address), address).toBe(true);
  });

  it('not an address below the app: it goes to the network, which has no such page', () => {
    for (const address of [
      '/FreelancingToolkit/taxes',
      '/FreelancingToolkit/taxes/',
      '/FreelancingToolkit/a/b?amount=40',
      '/FreelancingToolkit/index.html/',
      '/FreelancingToolkit/screenshots/converter-wide.png',
      '//FreelancingToolkit/taxes/',
    ]) expect(opensApp(address), address).toBe(false);
  });
});
