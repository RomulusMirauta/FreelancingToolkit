import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openApp } from './app';

// Exact checks for layout decisions: where a screenshot says "something changed", these say what.
const isPhone = (info: TestInfo) => info.project.name.startsWith('phone');
const LANGS = ['ro', 'en'] as const;

/** The word in the hour row, the "start here" mark and the first cell. On phones the mark is an arrow centred in its tag. */
const startRow = (page: Page) =>
  page.evaluate(() => {
    const wrap = document.querySelector('.start-wrap')!;
    const range = document.createRange();
    range.selectNodeContents(wrap.firstChild!);
    const word = range.getBoundingClientRect();
    const tag = wrap.querySelector<HTMLElement>('.start-tag')!;
    const mark = (innerWidth > 600 ? tag.firstElementChild! : tag).getBoundingClientRect();
    const cell = document.querySelector('[data-cell="0-0"]')!.getBoundingClientRect();
    return {
      gapMiddle: (word.right + cell.left) / 2,
      markMiddle: mark.left + mark.width / 2,
      wordMiddleY: word.top + word.height / 2,
      markMiddleY: mark.top + mark.height / 2,
      markLeft: mark.left,
      markRight: mark.right,
      wordRight: word.right,
      cellLeft: cell.left,
      rowHeight: document.querySelector('[data-cell="0-0"]')!.closest('tr')!.getBoundingClientRect().height,
      nextRowHeight: document.querySelector('[data-cell="1-0"]')!.closest('tr')!.getBoundingClientRect().height,
    };
  });

for (const lang of LANGS) {
  test.describe(`start here ${lang}`, () => {
    test('sits midway between the word and the first cell, on the word\'s line', async ({ page }) => {
      await openApp(page, { lang, tab: 'converter' });
      const r = await startRow(page);
      expect(Math.abs(r.markMiddle - r.gapMiddle)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.markMiddleY - r.wordMiddleY)).toBeLessThanOrEqual(3);
      expect(r.markLeft).toBeGreaterThanOrEqual(r.wordRight);
      expect(r.markRight).toBeLessThanOrEqual(r.cellLeft);
    });

    test('on a phone it is an arrow and the row stays as tall as the others', async ({ page }, info) => {
      test.skip(!isPhone(info), 'phones only');
      await openApp(page, { lang, tab: 'converter' });
      const r = await startRow(page);
      // The hour's cell is about 3 px taller on purpose; the old two-line tag made the row far taller.
      expect(r.rowHeight - r.nextRowHeight).toBeLessThanOrEqual(4);
      // A pseudo-element has no box to measure: it is centred if its tag centres it and nothing pushes it aside.
      const arrow = await page.evaluate(() => {
        const tag = document.querySelector('.start-tag')!;
        const after = getComputedStyle(tag, '::after');
        const box = getComputedStyle(tag);
        return { content: after.content, align: box.textAlign, pushed: [after.marginLeft, after.marginRight, after.paddingLeft, after.paddingRight, box.paddingLeft, box.paddingRight] };
      });
      expect(arrow.content).toBe('"→"');
      expect(arrow.align).toBe('center');
      expect(arrow.pushed).toEqual(['0px', '0px', '0px', '0px', '0px', '0px']);
    });
  });

  test(`VAT sources: one per line, the § kept with its text (${lang})`, async ({ page }) => {
    await openApp(page, { lang, tab: 'taxes' });
    const links = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.vat-source')].map((a) => {
        // React keeps "§", the space and the text as separate nodes.
        const r = document.createRange();
        r.selectNode(a.firstChild!);
        const mark = r.getBoundingClientRect();
        r.setStart(a.lastChild!, 0);
        r.setEnd(a.lastChild!, 1);
        const next = r.getBoundingClientRect();
        const box = a.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, parentLeft: a.parentElement!.getBoundingClientRect().left, markTop: mark.top, nextTop: next.top, starts: a.textContent!.startsWith('§\u00a0') };
      }),
    );
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const [i, l] of links.entries()) {
      expect(l.starts).toBe(true);
      expect(l.markTop).toBe(l.nextTop);
      expect(l.left).toBe(l.parentLeft);
      if (i > 0) expect(l.top).toBeGreaterThanOrEqual(links[i - 1]!.bottom);
    }
  });

  test(`calendar: every deadline has its card, under every filter (${lang})`, async ({ page }) => {
    await openApp(page, { lang, tab: 'taxes' });
    const chips = page.locator('.calendar .chips .chip');
    for (let i = 0; i < (await chips.count()); i++) {
      await chips.nth(i).click();
      const backgrounds = await page.locator('.deadlines li').evaluateAll((items) => items.map((li) => getComputedStyle(li).backgroundColor));
      // A filter with three deadlines or fewer has only the big cards; the first one, "all", always has a list.
      if (i === 0) expect(backgrounds.length).toBeGreaterThan(0);
      expect(backgrounds).not.toContain('rgba(0, 0, 0, 0)');
    }
  });
}

/** A toast waiting for the page, the way a reload hands one over. */
const withToast = (page: Page) =>
  page.addInitScript(() => sessionStorage.setItem('ft-toast-after-reload', JSON.stringify([{ id: 'offline' }])));

test('toast text size', async ({ page }, info) => {
  await withToast(page);
  await openApp(page, { lang: 'ro', tab: 'converter' });
  const size = (selector: string) => page.locator(selector).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(await size('.toast strong')).toBeCloseTo(isPhone(info) ? 13.6 : 15.2, 1);
  if (isPhone(info)) expect(await size('.toast .muted')).toBeCloseTo(12.8, 1);
});

test('toast stays clear of the Tools button', async ({ page }) => {
  await withToast(page);
  await openApp(page, { lang: 'ro', tab: 'converter' });
  const toast = (await page.locator('.toast').boundingBox())!;
  const tools = (await page.locator('.reset-wrap > .menu-trigger').boundingBox())!;
  expect(toast.x + toast.width).toBeLessThanOrEqual(tools.x);
  expect(toast.x + toast.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('toast goes out with its animation, then disappears', async ({ page }) => {
  await withToast(page);
  await openApp(page, { lang: 'ro', tab: 'converter', motion: true });
  const toast = page.locator('.toast');
  await expect(toast).toBeVisible();
  await page.locator('.toast-close').click();
  await expect(toast).toHaveClass(/leaving/);
  expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe('toast-out');
  await expect(toast).toHaveCount(0);
});
