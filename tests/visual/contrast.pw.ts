import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

// Text contrast in both themes, measured with axe. Some states are rare (a rate that falls or stays flat, a card
// worse than the reference), so they are forced here: otherwise a problem shows only on the days it happens.
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function contrastProblems(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const { axe } = window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: { nodes: { target: unknown[]; failureSummary?: string }[] }[] }> } };
    const { violations } = await axe.run(document, { runOnly: ['color-contrast'] });
    return violations.flatMap((v) => v.nodes.map((n) => `${String(n.target[0])}: ${n.failureSummary ?? ''}`));
  });
}

const openFolds = (page: Page) => page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`contrast ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const state of ['up', 'down', 'flat']) {
      test(`converter, rates ${state}`, async ({ page }) => {
        await openApp(page, { lang: 'ro', tab: 'converter' });
        await page.evaluate((s) => document.querySelectorAll('.rate-chg').forEach((e) => { e.className = `rate-chg ${s}`; }), state);
        expect(await contrastProblems(page)).toEqual([]);
      });
    }

    test('taxes, with the best card as the reference', async ({ page }) => {
      await openApp(page, { lang: 'ro', tab: 'taxes' });
      await openFolds(page);
      expect(await contrastProblems(page)).toEqual([]);
      const best = page.locator('.regime.is-best').first();
      await best.locator('.ref-toggle').click();
      await expect(best).toHaveClass(/\bis-ref\b/);
      // On the cards: the legend above them always has a "−" pill of its own.
      await expect(page.locator('.board .regime .delta.neg').first()).toBeVisible();
      expect(await contrastProblems(page)).toEqual([]);
    });
  });
}
