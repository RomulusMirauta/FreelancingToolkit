import { expect, test } from '@playwright/test';
import { openApp } from './app';

// Both tabs, whole page, as a first visit sees them: any layout shift shows up as a changed pixel.
for (const lang of ['ro', 'en'] as const) {
  for (const tab of ['converter', 'taxes'] as const) {
    test(`${tab} ${lang}`, async ({ page }) => {
      await openApp(page, { lang, tab });
      await expect(page).toHaveScreenshot(`${tab}-${lang}.png`, { fullPage: true });
    });
  }
}
