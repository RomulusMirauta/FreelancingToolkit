import { defineConfig } from '@playwright/test';

// Visual tests, run on demand (`npm run test:visual`), never in `npm test` or the deploy.
// The reference screenshots are made on Windows with the installed Chrome; another system renders text differently.
const PORT = 4174;

const phone = (width: number) => ({ viewport: { width, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const wide = (width: number) => ({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });

export default defineConfig({
  testDir: 'tests/visual',
  testMatch: '**/*.pw.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/visual/report' }]],
  outputDir: 'tests/visual/results',
  expect: {
    // Any pixel that moves or changes colour is a failure: the shifts we are after are often 1-2 px, and the
    // default colour tolerance (0.2) missed a card's background going from --surface-2 to none.
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixels: 0, threshold: 0 },
  },
  use: {
    baseURL: `http://localhost:${PORT}/`,
    channel: 'chrome',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    timezoneId: 'Europe/Bucharest',
  },
  projects: [
    { name: 'phone-360', use: phone(360) },
    { name: 'phone-390', use: phone(390) },
    { name: 'phone-412', use: phone(412) },
    { name: 'tablet-700', use: wide(700) },
    { name: 'desktop-1280', use: wide(1280) },
    { name: 'desktop-1440', use: wide(1440) },
  ],
  webServer: {
    command: `npx vite build --mode visual && npx vite preview --outDir dist-visual --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    timeout: 120_000,
  },
});
