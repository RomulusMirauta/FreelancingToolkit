import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
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
      // Under a pixel: WebKit reports the two text nodes 0.008 px apart; a § on its own line is a whole line away.
      expect(Math.abs(l.markTop - l.nextTop)).toBeLessThan(1);
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

test('VAT: the share from clients in Romania drives the bar, stays in the address and survives a reload', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'taxes' });
  const meter = page.locator('.vat-meter');
  const field = meter.locator('input');
  await expect(field).toHaveValue('100');
  await expect(meter).toHaveClass(/near/);
  const full = parseFloat(await page.locator('.vat-bar > span').evaluate((el) => (el as HTMLElement).style.width));

  await field.fill('20');
  await expect(meter).toHaveClass(/under/);
  await expect(meter.locator('.vat-verdict')).toHaveText('Ești sub plafon.');
  expect(parseFloat(await page.locator('.vat-bar > span').evaluate((el) => (el as HTMLElement).style.width))).toBeCloseTo(full / 5, 3);
  await expect(page).toHaveURL(/vat_romania=20/);

  await field.fill('101');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(meter).toHaveClass(/under/);

  await field.fill('20');
  await page.reload();
  await expect(meter.locator('input')).toHaveValue('20');
  await expect(meter).toHaveClass(/under/);
});

test('VAT: the verdict has its own line, and the field shares a line with its question', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'taxes' });
  const boxes = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const words = document.createRange();
    words.selectNodeContents(document.querySelector('.vat-meter p strong')!);
    const rects = [...words.getClientRects()];
    return {
      strongBottom: Math.max(...rects.map((r) => r.bottom)),
      verdictTop: box('.vat-verdict').top,
      label: box('.vat-romania > span:first-child'),
      field: box('.vat-romania .fee-pct'),
      head: box('.vat-meter-head strong'),
    };
  });
  expect(boxes.verdictTop).toBeGreaterThanOrEqual(boxes.strongBottom - 1);
  expect(boxes.field.left).toBeGreaterThan(boxes.label.right);
  expect(boxes.field.top).toBeLessThan(boxes.label.bottom);
  expect(boxes.field.bottom).toBeGreaterThan(boxes.label.top);
  expect(Math.abs(boxes.field.right - boxes.head.right)).toBeLessThanOrEqual(1);
});

test('income norm: an income in EUR is compared with 25,000 EUR, and net to gross marks the norm over its limit', async ({ page }, info) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  const card = page.locator('article.regime').filter({ has: page.locator('#rg-pfaNorm') });
  // 2,000 EUR a month is 24,000 EUR a year: allowed, and the most money, though over 126,037.50 RON. The star comes
  // first: it waits for the page, which has no pill before it is drawn either.
  await page.goto('./?lang=en&income=2000&income_currency=EUR&income_per=month#taxes');
  await expect(card).toHaveClass(/is-best/);
  await expect(card.locator('.not-ranked-tag')).toHaveCount(0);
  await page.goto('./?lang=en&income=25000&income_currency=EUR&income_per=year#taxes');
  await expect(card).toHaveClass(/is-best/);
  await expect(card.locator('.not-ranked-tag')).toHaveCount(0);
  await page.goto('./?lang=en&income=25001&income_currency=EUR&income_per=year#taxes');
  await expect(card.locator('.not-ranked-tag')).toHaveText('Over the limit');

  // The default 10,000 RON a month: the norm needs 141,870 RON a year, over its limit. Phones get the ⚠ of the list of nets.
  const mark = isPhone(info) ? '[role="img"][aria-label="Over the limit"]' : '.not-ranked-tag';
  const rows = page.locator('.solver tbody tr');
  await expect(rows.locator(mark)).toHaveCount(1);
  await expect(rows.filter({ has: page.locator(mark) })).toContainText('Income norm');
  // 1,700 EUR a month needs a gross of about 24,500 EUR a year, over 126,037.50 RON: allowed.
  await page.goto('./?lang=en&net=1700&net_currency=EUR&net_per=month#taxes');
  await expect(page.locator('.solver summary')).toContainText('1,700.00 EUR');
  await expect(rows.locator(mark)).toHaveCount(0);
});

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

test('Tab goes through the table even when pressed faster than a frame', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  await openApp(page, { lang: 'ro', tab: 'converter' });
  await page.locator('[data-cell="0-0"]').focus();
  // Selecting the text a frame later used to pull focus back and hold it in the table.
  for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-cell'))).toBe(false);
});

const byName = (page: Page, name: string) => page.locator(`input[name="${name}"]`);
const saved = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

/**
 * Focuses a grid cell, which puts in its edit text and selects it a frame later. Not fill(): it selects before
 * focusing, so its text would land after the edit text.
 */
async function focusCell(page: Page, cell: Locator) {
  await cell.focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

/** The language switch in "Settings & options": the page stays, so fields already on it must follow. */
async function chooseLanguage(page: Page, name: 'English' | 'Română') {
  await page.locator('.top-actions .menu-trigger').click();
  await page.getByRole('radio', { name }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', name === 'English' ? 'en' : 'ro');
}

/** The edit the custom rate invites: the last digit changed. */
async function changeLastDigit(page: Page, input: Locator, digit: string) {
  await input.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(digit);
}

test('custom rate: three decimals keep their decimal mark after a reload and a language switch', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'converter' });
  await page.goto('./?lang=ro&currencies=EUR,RON,USD');
  const rate = byName(page, 'rate-USD');
  // Focused, the empty field takes BNR's rate as text; typed over, that becomes the custom rate.
  await rate.focus();
  await rate.selectText();
  await page.keyboard.type('4,815');
  await expect.poll(() => saved(page, 'ft.customRates')).toBe('{"USD":4.815}');
  // The address follows a moment later; reloaded before that, it would bring back a rate typed halfway.
  await expect(page).toHaveURL(/rates=USD(:|%3A)4\.815(&|$)/);
  await page.reload();
  // "4.815" would read as 4815 in Romanian.
  await expect(rate).toHaveValue('4,815');
  await changeLastDigit(page, rate, '6');
  await expect.poll(() => saved(page, 'ft.customRates')).toBe('{"USD":4.816}');
  await chooseLanguage(page, 'English');
  await expect(rate).toHaveValue('4.816');
  await changeLastDigit(page, rate, '7');
  await expect.poll(() => saved(page, 'ft.customRates')).toBe('{"USD":4.817}');
});

test('working time, fees and VAT: the fields take the new decimal mark after a language switch', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'converter' });
  await page.goto('./?lang=ro&hours=7.5&days=4.5&transfer=wise&transfer_pct=0.5');
  const fields = { hoursPerDay: '7,5', daysPerWeek: '4,5', 'fee-2': '0,5' };
  for (const [name, ro] of Object.entries(fields)) await expect(byName(page, name)).toHaveValue(ro);
  await chooseLanguage(page, 'English');
  for (const [name, ro] of Object.entries(fields)) await expect(byName(page, name)).toHaveValue(ro.replace(',', '.'));

  await page.goto('./?lang=en&vat_romania=12.5#taxes');
  await expect(byName(page, 'vat-romania')).toHaveValue('12.5');
  await chooseLanguage(page, 'Română');
  await expect(byName(page, 'vat-romania')).toHaveValue('12,5');
});

test('converter: typing back the figure a cell shows keeps the amount typed elsewhere', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'converter' });
  const goal = byName(page, 'month-RON');
  const cell = byName(page, 'hour-EUR');
  await focusCell(page, goal);
  await page.keyboard.type('10000');
  await goal.blur();
  await expect(goal).toHaveValue('10.000,00');
  const shown = await cell.inputValue();
  // A digit deleted and typed again.
  await focusCell(page, cell);
  const offered = await cell.inputValue();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(offered.slice(-1));
  await cell.blur();
  await expect(goal).toHaveValue('10.000,00');
  // The figure shown, typed over the selected text.
  await focusCell(page, cell);
  await page.keyboard.type(shown);
  await cell.blur();
  await expect(goal).toHaveValue('10.000,00');
  // Another figure starts from this cell.
  await focusCell(page, cell);
  await page.keyboard.type('11');
  await cell.blur();
  await expect(goal).not.toHaveValue('10.000,00');
});

test('holding an arrow key in a field keeps the page, and the address catches up', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  await openApp(page, { lang: 'en', tab: 'converter' });
  const field = page.locator('input[name="daysOff"]');
  await field.focus();
  // Each step changed the address twice (working time, and the income that follows it); Safari throws on a 101st
  // change within 10 seconds, which used to leave an empty page.
  for (let i = 0; i < 70; i++) await page.keyboard.press('ArrowUp');
  await expect(field).toHaveValue('70');
  await expect(page).toHaveURL(/days_off=70/);
  await expect(page.locator('.app-header')).toBeVisible();
});

/** Own settings saved, then someone's link opened in the same tab: its banner. */
async function openSharedLink(page: Page) {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.goto('./?lang=en&currencies=EUR,RON,PLN');
  await page.goto('./?share=1&currencies=EUR,USD');
  return page.locator('.shared-banner');
}

/** The page is drawn: the banner, if any, comes in the same render as the header. */
const drawn = (page: Page) => expect(page.locator('.app-header')).toBeVisible();

test('shared link: a reload keeps "Back to my settings", which brings the own settings back', async ({ page }) => {
  const banner = await openSharedLink(page);
  const back = banner.getByRole('button', { name: 'Back to my settings' });
  await expect(back).toBeVisible();
  // The app reloads by itself when an update arrives, often seconds after the link is opened.
  await page.reload();
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.locator('.toast')).toContainText('Your own settings are back.');
  await expect(page).toHaveURL(/currencies=EUR,RON,PLN/);
  await expect(banner).toHaveCount(0);
  await page.reload();
  await drawn(page);
  await expect(banner).toHaveCount(0);
});

test('shared link: "Keep the link’s" and "Reset app" end it, and a reload brings no banner back', async ({ page }) => {
  const banner = await openSharedLink(page);
  await banner.getByRole('button', { name: 'Keep the link’s' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await drawn(page);
  await expect(banner).toHaveCount(0);
  await expect(page).toHaveURL(/currencies=EUR,USD/);

  await page.goto('./?share=1&currencies=GBP,RON');
  await expect(banner).toBeVisible();
  await page.locator('.reset-wrap > .menu-trigger').click();
  await page.locator('.reset-row').getByRole('button', { name: 'Reset app' }).click();
  await Promise.all([page.waitForURL((u) => u.search === ''), page.locator('.reset-confirm .danger').click()]);
  await drawn(page);
  await expect(banner).toHaveCount(0);
  await page.reload();
  await drawn(page);
  await expect(banner).toHaveCount(0);
});
