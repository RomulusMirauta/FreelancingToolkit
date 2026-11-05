import type { Page } from '@playwright/test';

// The date is fixed (the calendar counts days from today) and the rates come from tests/visual/fixtures.
const TODAY = new Date('2026-11-04T10:00:00+02:00');

export async function openApp(page: Page, { lang, tab, motion = false }: { lang: 'ro' | 'en'; tab: 'converter' | 'taxes'; motion?: boolean }) {
  await page.clock.setFixedTime(TODAY);
  await page.goto(`./?lang=${lang}${tab === 'taxes' ? '#taxes' : ''}`);
  await page.evaluate(() => document.fonts.ready);
  // No motion at all: the Tools wrench and its pulsing dot otherwise differ by a pixel or two between runs.
  if (!motion) await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  // Let the folds and the first render settle.
  await page.waitForTimeout(300);
}
