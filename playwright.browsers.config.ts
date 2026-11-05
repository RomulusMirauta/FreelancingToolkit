import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// The exact layout checks in Safari's and Firefox's engines (`npm run test:browsers`), on demand. No reference
// screenshots: each engine draws text its own way. WebKit here is close to Safari, not the real one on an iPhone.
// Firefox has no mobile emulation in Playwright, so its phone is a narrow window with touch off.
const phone = { viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 };
const desktop = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 };

export default defineConfig({
  ...base,
  testMatch: '**/layout.pw.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/visual/report-browsers' }]],
  outputDir: 'tests/visual/results-browsers',
  use: { ...base.use, channel: undefined },
  projects: [
    { name: 'phone-390-webkit', use: { ...phone, browserName: 'webkit', isMobile: true, hasTouch: true } },
    { name: 'desktop-1280-webkit', use: { ...desktop, browserName: 'webkit' } },
    { name: 'phone-390-firefox', use: { ...phone, browserName: 'firefox' } },
    { name: 'desktop-1280-firefox', use: { ...desktop, browserName: 'firefox' } },
  ],
});
