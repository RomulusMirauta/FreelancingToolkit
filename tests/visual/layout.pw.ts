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
    // All, PFA and SRL: with none found, the loop would check nothing and pass.
    await expect(chips).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await chips.nth(i).click();
      await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'true');
      const backgrounds = await page.locator('.deadlines li').evaluateAll((items) => items.map((li) => getComputedStyle(li).backgroundColor));
      // A filter with three deadlines or fewer has only the big cards: at the fixed date, PFA's. "All" and SRL have a list.
      if (i !== 1) expect(backgrounds.length).toBeGreaterThan(0);
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

const regimeCard = (page: Page, regime: string) => page.locator('article.regime').filter({ has: page.locator(`#rg-${regime}`) });

test('tax cards: the bar of what you keep follows the take-home, and the details keep the minus of a loss', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  // 30,000 RON a month with 20,000 of expenses: 6,277.50 a month is 20.9% of the gross (the bar said 87.6%).
  await page.goto('./?lang=en&income=30000&income_currency=RON&income_per=month&expenses_pfa=20000#taxes');
  const pfa = regimeCard(page, 'pfaReal');
  await expect(pfa.locator('.take-home')).toContainText('6,277.50');
  await expect(pfa.locator('.kept-meter')).toHaveAttribute('aria-label', 'You keep 20.9% of the gross');
  // 1,500 RON a month: the income norm's taxes are more than that. The bar said −21.5%, the details 322.50 a month.
  await page.goto('./?lang=en&income=1500&income_currency=RON&income_per=month#taxes');
  const norm = regimeCard(page, 'pfaNorm');
  await expect(norm.locator('.kept-meter')).toHaveAttribute('aria-label', 'You keep 0% of the gross');
  await expect(norm.locator('.regime-details tr.total td')).toHaveText(['−322.50', '−3,870.00']);
  // The micro-enterprise counts no pay for "Another employee", and says where it goes.
  await expect(regimeCard(page, 'srlMicro').locator('label.toggle', { hasText: 'Another employee' }))
    .toHaveAttribute('title', 'Their pay and the taxes on it are not counted: add them to the deductible expenses');
});

test('tax page in Romanian: "Microîntreprindere" wraps at its soft hyphen where it must, so nothing is wider than the page', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'taxes' });
  // As one unbreakable word, it made the phone ranking 0.56 px too wide at 360 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test('VAT: just under the threshold the meter reads 99%, exactly on it 100% and still within, a ban over it 101%', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  const meter = page.locator('.vat-meter');
  for (const [income, pct, state, verdict] of [
    ['394999.99', '99%', 'near', 'You are close to the threshold'],
    ['395000', '100%', 'near', 'You are close to the threshold'],
    ['395000.01', '101%', 'over', 'You are over the threshold'],
  ] as const) {
    await page.goto(`./?lang=en&income=${income}&income_currency=RON&income_per=year#taxes`);
    await expect(meter).toHaveClass(new RegExp(state));
    await expect(meter.locator('.vat-meter-head strong')).toHaveText(pct);
    await expect(meter.locator('.vat-bar')).toHaveAttribute('aria-valuetext', pct);
    await expect(meter.locator('p strong')).toContainText(`${pct} of the 395,000 RON threshold`);
    await expect(meter.locator('.vat-verdict')).toContainText(verdict);
  }
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

test('toasts reach screen readers through a live region that is there, empty, before the first one', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  const region = page.locator('.sr-only[role="status"]');
  await expect(region).toHaveCount(1);
  await expect(region).toBeEmpty();
  const before = (await region.elementHandle())!;
  // A word put into an amount is refused, and the toast is the only answer. Each toast was a new role="status"
  // element with its text already in it, which screen readers usually don't read.
  const income = page.locator('.income-main input');
  await income.selectText();
  await page.keyboard.insertText('thirty');
  const toast = page.locator('.toast');
  await expect(toast).toContainText('“thirty” isn’t a number.');
  await expect(region).toHaveText('“thirty” isn’t a number. Type digits, e.g. 30 or 1250.');
  expect(await before.evaluate((el) => el.isConnected && el.textContent)).toBe('“thirty” isn’t a number. Type digits, e.g. 30 or 1250.');
  expect(await toast.getAttribute('role')).toBeNull();
  await page.locator('.toast-close').click();
  await expect(toast).toHaveCount(0);
  await expect(region).toBeEmpty();
});

test('a toast with Undo stays while the keyboard or the pointer is on it, then goes on with the time it had left', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T10:00:00+02:00') });
  await page.addInitScript(() => sessionStorage.setItem('ft-toast-after-reload', JSON.stringify([{ id: 'pageReset', arg: 'converter' }])));
  await page.goto('./?lang=en');
  const toast = page.locator('.toast');
  await expect(toast).toContainText('The converter is back to its defaults.');
  await page.clock.runFor(2000);
  // Its 10 s ran out with the focus on Undo, often before a keyboard got there.
  await toast.getByRole('button', { name: 'Undo' }).focus();
  await page.clock.runFor(20_000);
  await expect(toast).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.clock.runFor(4000);
  await expect(toast).toBeVisible();
  await toast.hover();
  await page.clock.runFor(20_000);
  await expect(toast).toBeVisible();
  // About 4 s were left: started again from 10 s, it would still be there.
  await page.mouse.move(0, 0);
  await page.clock.runFor(4500);
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

test('rate cards: a currency quoted per 100 shows its move, and a market rate is the one said to be in use', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.goto('./?lang=en&currencies=EUR,RON,HUF,ARS');
  const card = (code: string) => page.locator('.rate-tile').filter({ has: byName(page, `rate-${code}`) });
  // In the test rates the forint fell 0.05%: 0.000008 lei, under the 0.00005 lei that used to count as no move.
  await expect(card('HUF').locator('.rate-chg')).toHaveClass('rate-chg down');
  await expect(card('HUF').locator('.rate-chg')).toHaveText('▼down−0.05%');
  await expect(card('EUR').locator('.rate-in-use')).toHaveText('BNR rate in use');
  await expect(card('ARS').locator('.rate-in-use')).toHaveText('market rate in use');
  await chooseLanguage(page, 'Română');
  await expect(card('EUR').locator('.rate-in-use')).toHaveText('se folosește cursul BNR');
  await expect(card('ARS').locator('.rate-in-use')).toHaveText('se folosește cursul de piață');
});

test('market rates: both pages link to their source, as its terms ask, also with a tax income in a market currency', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  // This income is converted at a market rate, and the tax page had no link to where the rate came from.
  await page.goto('./?lang=en&income=1000000&income_currency=VND&income_per=month#taxes');
  await expect(page.locator('.income-row-main .income-total')).toContainText('(market rate, not BNR)');
  const footer = page.locator('footer');
  const credit = footer.getByRole('link');
  await expect(credit).toHaveText('Rates By Exchange Rate API');
  await expect(credit).toHaveAttribute('href', 'https://www.exchangerate-api.com');
  await expect(credit).toBeVisible();
  await expect(footer).toHaveText('Exchange rates: National Bank of Romania (BNR) reference rates; market rates for currencies BNR does not publish (Rates By Exchange Rate API). Not financial or tax advice.');
  await page.goto('./?lang=ro');
  await expect(page.locator('.rate-grid')).toBeVisible();
  await expect(credit).toHaveText('Rates By Exchange Rate API');
  await expect(credit).toHaveAttribute('href', 'https://www.exchangerate-api.com');
  await expect(footer).toContainText('cursuri de piață (Rates By Exchange Rate API). Nu reprezintă');
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

for (const lang of LANGS) {
  test(`working time, fees and VAT: a field left out of range shows the value in use (${lang})`, async ({ page }) => {
    await openApp(page, { lang, tab: 'converter' });
    // Typed key by key, as people type: "2" applies, then "25" is refused and the app goes on with 2 hours a day.
    const hours = byName(page, 'hoursPerDay');
    const work = page.locator('details.settings:not(.fees) > summary');
    await hours.selectText();
    await page.keyboard.type('25');
    await expect(hours).toHaveAttribute('aria-invalid', 'true');
    await expect(work).toContainText('2 h/');
    // Left, it went on showing 25 while the app used 2.
    await page.keyboard.press('Tab');
    await expect(hours).toHaveValue('2');
    await expect(hours).toHaveAttribute('aria-invalid', 'false');
    await expect(work).toContainText('2 h/');

    const fee = byName(page, 'fee-1');
    await fee.selectText();
    await page.keyboard.type('150');
    await expect(fee).toHaveAttribute('aria-invalid', 'true');
    await fee.blur();
    await expect(fee).toHaveValue('15');
    await expect(fee).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('details.fees > summary')).toContainText(' 15%');

    await page.goto(`./?lang=${lang}#taxes`);
    const vat = byName(page, 'vat-romania');
    await vat.selectText();
    await page.keyboard.type('101');
    await expect(vat).toHaveAttribute('aria-invalid', 'true');
    await vat.blur();
    await expect(vat).toHaveValue('10');
    await expect(vat).toHaveAttribute('aria-invalid', 'false');
    await expect(page).toHaveURL(/vat_romania=10(&|#|$)/);
    // A word put in at once goes back to the 10 shown, not to the 101 refused.
    await vat.focus();
    await page.keyboard.press('End');
    await page.keyboard.insertText('abc');
    await expect(vat).toHaveValue('10');
    await expect(vat).toHaveAttribute('aria-invalid', 'false');
  });
}

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

test('amounts: digits typed into a field that shows 0 replace the 0, wherever the click put the caret', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'taxes' });
  const option = (regime: string) => page.locator('article.regime').filter({ has: page.locator(`#rg-${regime}`) }).locator('input[name="amount"]');
  // The fields are right-aligned: most of the box is left of the 0 (it gave 20.000), its right edge after it (02.000).
  for (const [field, x, caret] of [[option('pfaReal'), 0.1, 0], [option('srlMicro'), 0.98, 1]] as const) {
    await expect(field).toHaveValue('0');
    const box = (await field.boundingBox())!;
    await field.click({ position: { x: box.width * x, y: box.height / 2 } });
    expect(await field.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(caret);
    await page.keyboard.type('2000');
    await expect(field).toHaveValue('2.000');
  }
  await expect(page).toHaveURL(/expenses_pfa=2000(&|#|$)/);
  await expect(page).toHaveURL(/expenses_micro=2000(&|#|$)/);
});

/** Drags `text` from a span made for it to the end of `field`: a real drop, which the field reads as it reads a paste. */
async function dropAtEnd(page: Page, field: Locator, text: string) {
  await page.evaluate((t) => {
    const span = document.createElement('span');
    span.id = 'drag-me';
    span.textContent = t;
    span.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 9999; font-size: 2rem;';
    document.body.append(span);
    const range = document.createRange();
    range.selectNodeContents(span);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  }, text);
  const box = (await field.boundingBox())!;
  await page.locator('#drag-me').dragTo(field, { targetPosition: { x: box.width - 3, y: box.height / 2 } });
  await page.locator('#drag-me').evaluate((el) => el.remove());
}

test('amounts: text put in at once is read whole, without its currency sign, in either convention', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'taxes' });
  const income = page.locator('.income-main input');
  // A phone keyboard's clipboard strip types the copied text in at once, with no paste event. "$1,234.56" gave 1,23
  // and "2500.00" 250.000.
  for (const [text, shown, amount] of [['$1,234.56', '1.234,56', 1234.56], ['2500.00', '2.500', 2500]] as const) {
    await income.selectText();
    await page.keyboard.insertText(text);
    await expect(income).toHaveValue(shown);
    await expect.poll(() => saved(page, 'ft.taxIncome')).toContain(`"amount":${amount},`);
  }
  // Dropped (or pasted: the checks leave the clipboard alone) beside the digits, its digits join them. The field's
  // own thousands mark was read as a decimal: "0" at the end of 10.000 gave 10.
  await income.selectText();
  await page.keyboard.type('10000');
  await dropAtEnd(page, income, '0');
  await expect(income).toHaveValue('100.000');
  // Not an amount: refused whole, with the toast that quotes it (it gave 20.261.108).
  await income.selectText();
  await page.keyboard.insertText('2026-11-08');
  await expect(page.locator('.toast')).toContainText('„2026-11-08” nu e un număr.');
  await expect(income).toHaveValue('100.000');

  // English: "1 234,56 €" gave 123,456.
  await page.goto('./?lang=en#taxes');
  await income.selectText();
  await page.keyboard.insertText('1 234,56 €');
  await expect(income).toHaveValue('1,234.56');
  // A converter cell showed it as invalid and kept its figure.
  await page.goto('./?lang=en');
  const cell = byName(page, 'hour-EUR');
  await focusCell(page, cell);
  await page.keyboard.insertText('1.234,56 €');
  await cell.blur();
  await expect(cell).toHaveValue('1,234.56');
  await expect.poll(() => saved(page, 'ft.source')).toContain('"amount":1234.56');
});

test('holding an arrow key in a field keeps the page, under Safari\'s limit, and the address catches up, also when the page is left', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  // Each step changed the address twice (working time, and the income that follows it); Safari throws on a 101st
  // change within 10 seconds, which used to leave an empty page. Chrome doesn't, so the changes are counted.
  await page.addInitScript(() => {
    const replace = history.replaceState.bind(history);
    const w = window as unknown as { addressChanges: number };
    w.addressChanges = 0;
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      w.addressChanges++;
      replace(...args);
    };
  });
  const addressChanges = () => page.evaluate(() => (window as unknown as { addressChanges: number }).addressChanges);
  await openApp(page, { lang: 'en', tab: 'converter' });
  const field = page.locator('input[name="daysOff"]');
  await field.focus();
  const before = await addressChanges();
  for (let i = 0; i < 120; i++) await page.keyboard.press('ArrowUp');
  await expect(field).toHaveValue('120');
  await expect(page).toHaveURL(/days_off=120(&|$)/);
  expect(await addressChanges() - before).toBeLessThan(100);
  await expect(page.locator('.app-header')).toBeVisible();
  // Past the changes that go into the address at once, the latest waits up to 250 ms for it: leaving the page in that
  // time (another site, or a phone closing the hidden page) keeps it all the same.
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
  await page.goto('./icon.svg');
  await page.goBack();
  await expect(field).toHaveValue('125');
  await expect(page).toHaveURL(/days_off=125(&|$)/);
});

test('a reload right after a change keeps it', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  const income = page.locator('.income-main input');
  await income.selectText();
  await page.keyboard.type('1234');
  await expect(page).toHaveURL(/income=1234(&|#|$)/);
  // The browser picks the address it reloads before the page can write to it, and the address wins over what is
  // saved: a change that waited 250 ms for the address went back to 1,234 (F5 just after typing).
  await page.keyboard.type('5');
  await page.reload();
  await expect(income).toHaveValue('12,345');
  expect(await saved(page, 'ft.taxIncome')).toContain('"amount":12345,');
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

/** Own settings saved in one tab, then someone's link opened in a tab of its own and closed without a choice. */
async function closeSharedLinkTab(page: Page) {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.goto('./?lang=en&currencies=EUR,RON,PLN');
  await drawn(page);
  const linkTab = await page.context().newPage();
  await linkTab.goto('./?share=1&currencies=EUR,USD');
  await expect(linkTab.locator('.shared-banner').getByRole('button', { name: 'Back to my settings' })).toBeVisible();
  await linkTab.close();
}

test('shared link: with its tab closed before a choice, the next visit puts the own settings back and says so', async ({ context, page }) => {
  await closeSharedLinkTab(page);
  await page.close();
  const later = await context.newPage();
  await openApp(later, { lang: 'en', tab: 'converter' });
  await expect(later.locator('.toast')).toContainText('Your own settings are back.');
  await expect(later.locator('.shared-banner')).toHaveCount(0);
  await expect(later).toHaveURL(/currencies=EUR,RON,PLN(&|$)/);
  await expect(byName(later, 'hour-PLN')).toHaveCount(1);
  await expect(byName(later, 'hour-USD')).toHaveCount(0);
});

test('shared link: "Reset app" in a tab open from before also ends a link whose tab was closed before a choice', async ({ context, page }) => {
  await closeSharedLinkTab(page);
  await page.locator('.reset-wrap > .menu-trigger').click();
  await page.locator('.reset-row').getByRole('button', { name: 'Reset app' }).click();
  await Promise.all([page.waitForURL((u) => u.search === ''), page.locator('.reset-confirm .danger').click()]);
  await drawn(page);
  // Nothing comes back after the reset, nor on the next visit.
  await expect(page).not.toHaveURL(/currencies=/);
  const later = await context.newPage();
  await openApp(later, { lang: 'en', tab: 'converter' });
  await expect(later).not.toHaveURL(/currencies=/);
  await expect(later.locator('.toast')).toHaveCount(0);
});

test('with site data blocked, a link sets the app for the visit, as its banner says, and the address keeps it', async ({ page }) => {
  // "Block all cookies", "Don't allow sites to save data": reaching either storage throws. The app showed its
  // defaults and emptied the address, under a banner saying it showed the sender's settings.
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }, configurable: true });
    }
  });
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.goto('./?share=1&lang=en&currencies=EUR,USD,PLN&platform=malt&amount=50&currency=EUR&per=hour');
  const banner = page.locator('.shared-banner');
  await expect(banner).toContainText('you see the app as the person who sent it set it up');
  await expect(byName(page, 'hour-EUR')).toHaveValue('50.00');
  await expect(byName(page, 'hour-PLN')).toHaveCount(1);
  await expect(byName(page, 'hour-RON')).toHaveCount(0);
  await expect(page).toHaveURL(/currencies=EUR,USD,PLN(&|$)/);
  await expect(page).toHaveURL(/platform=malt(&|$)/);
  await expect(page).toHaveURL(/amount=50(&|$)/);
  // Nothing could be saved: a reload has the address alone, and no banner.
  await page.reload();
  await drawn(page);
  await expect(banner).toHaveCount(0);
  await expect(byName(page, 'hour-EUR')).toHaveValue('50.00');
  await expect(byName(page, 'hour-PLN')).toHaveCount(1);
});

test('an address with a double slash opens the app at its own address', async ({ page }) => {
  // GitHub Pages serves the app at …github.io//FreelancingToolkit/ too, where it registered a second service worker
  // with its own copy of the app, and a change went into that address.
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.goto('.//?lang=en#taxes');
  await drawn(page);
  await expect(page).toHaveURL((u) => u.pathname === '/' && u.search === '?lang=en' && u.hash === '#taxes');
  await page.locator('.income-main input').selectText();
  await page.keyboard.type('5000');
  await expect(page).toHaveURL((u) => u.pathname === '/' && u.searchParams.get('income') === '5000');
});

test('"Reset app" says the language and theme go back to Romanian and automatic, and they do', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.goto('./?lang=en&theme=dark');
  await page.locator('.reset-wrap > .menu-trigger').click();
  await page.locator('.reset-row').getByRole('button', { name: 'Reset app' }).click();
  // It said "Language and theme stay."
  await expect(page.locator('#reset-desc')).toContainText('The language goes back to Romanian, and the theme to automatic.');
  await Promise.all([page.waitForURL((u) => u.search === ''), page.locator('.reset-confirm .danger').click()]);
  await drawn(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
});

for (const lang of LANGS) {
  test(`Tools: the button says when something can be reset, and each item's name holds the word it shows (${lang})`, async ({ page }) => {
    // On the defaults, Romanian included (English is a setting "Reset app" clears), there is nothing to reset.
    await openApp(page, { lang: 'ro', tab: 'converter' });
    const tools = page.locator('.reset-wrap > .menu-trigger');
    await expect(tools.locator('.dot')).not.toHaveClass(/pulse/);
    await expect(tools).toHaveAccessibleName('Unelte');
    // Only the pulsing dot said it, with a label screen readers don't read inside a button.
    await page.goto(`./?lang=${lang}&hours=6`);
    await expect(tools.locator('.dot')).toHaveClass(/pulse/);
    await expect(tools).toHaveAccessibleName(lang === 'en' ? 'Tools (something can be reset)' : 'Unelte (ai setări care pot fi resetate)');
    await tools.click();
    await expect(page.locator('.reset-row')).toBeVisible();
    // Phones show one word (Hide, Tab, All): "All" was named only "Reset app", so voice control couldn't find it.
    // Matched word by word, as voice control and axe do; text in brackets doesn't count.
    const words = (text: string) => ` ${text.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')} `;
    const items = await page.locator('.reset-row > button').evaluateAll((buttons) =>
      buttons.map((b) => ({ shown: (b as HTMLElement).innerText.replace('↺', ''), name: b.getAttribute('aria-label') ?? '' })));
    expect(items).toHaveLength(3);
    for (const { shown, name } of items) {
      expect(words(shown).trim()).not.toBe('');
      expect(words(name)).toContain(words(shown));
    }
  });
}

test('tax page: the currency button\'s name holds the symbol it shows', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  const currency = page.locator('.income-row-main .add-currency').first().getByRole('button');
  // It shows "RON lei" and was named "Currency: RON".
  await expect(currency).toHaveAccessibleName('Currency: RON lei');
  await page.goto('./?lang=ro&income=5000&income_currency=EUR&income_per=month#taxes');
  await expect(currency).toHaveAccessibleName('Monedă: EUR €');
});

test('currency search with no match: the box points to no list, and "no match" comes in a region that was there', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.locator('.add-btn').click();
  const search = page.locator('.add-pop input');
  const status = page.locator('.add-pop [role="status"]');
  await expect(status).toBeEmpty();
  // Empty, it takes no room.
  expect(await status.evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`[id="${await search.getAttribute('aria-controls')}"]`)).toHaveAttribute('role', 'listbox');
  // It stayed "expanded", pointing to a list that was gone, and the line that replaced it wasn't read.
  await search.fill('zzzz');
  await expect(status).toHaveText('No currency matches “zzzz”.');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(search).not.toHaveAttribute('aria-controls');
  await search.fill('zl');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await expect(status).toBeEmpty();
});

test('Copy link: when the browser blocks copying, the field with the link says what it is', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } });
  });
  await openApp(page, { lang: 'en', tab: 'converter' });
  await page.locator('.top-actions .menu-trigger').click();
  await page.locator('.top-actions .menu-pop button', { hasText: 'Copy link' }).click();
  const field = page.locator('input[name="share-link"]');
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleName('Copy this link:');
});

/** The focus is on something in the page, and nothing open is drawn over its middle. */
const focusInView = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement!;
    const r = el.getBoundingClientRect();
    return el !== document.body && el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });

const settingsButton = (page: Page) => page.locator('.top-actions .menu-trigger');
const toolsButton = (page: Page) => page.locator('.reset-wrap > .menu-trigger');

test('"Settings & options" and "Tools" are buttons that show a named group, not menus whose arrow keys do nothing', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  // Both were role="menu" around radio groups and plain buttons, which axe calls critical.
  await expect(page.locator('[role="menu"], [role="menuitem"], [role="none"], [aria-haspopup="menu"]')).toHaveCount(0);
  for (const [button, name] of [[settingsButton(page), 'Settings & options'], [toolsButton(page), 'Tools']] as const) {
    const panel = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
    await expect(panel).toHaveAttribute('role', 'group');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAccessibleName(name);
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  }
});

test('keyboard: Esc in "Settings & options" gives the focus back to its button, and tabbing out of it closes it', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  await openApp(page, { lang: 'en', tab: 'converter' });
  const gear = settingsButton(page);
  const panel = page.locator('.top-actions .menu-pop');
  await gear.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('radio', { name: 'Automatic (follows the system)' })).toBeFocused();
  // The menu went with the focus on its theme switch, and the focus fell to the page.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(gear).toBeFocused();
  // Tabbed past its last item, it stayed open over the Converter button, which had the focus under it.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  for (let i = 0; i < 6 && (await panel.evaluate((p) => p.contains(document.activeElement))); i++) await page.keyboard.press('Tab');
  await expect(panel).toBeHidden();
  await expect(gear).toHaveAttribute('aria-expanded', 'false');
  expect(await focusInView(page)).toBe(true);
});

test('keyboard: Tab goes from "Tools" into its items, and Esc there or in "Reset app?" gives the focus back to it', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  // English is a setting, so "Reset app" can be chosen.
  await openApp(page, { lang: 'en', tab: 'converter' });
  const tools = toolsButton(page);
  const items = page.locator('.reset-row');
  await tools.focus();
  await page.keyboard.press('Enter');
  // The items came before their button: Tab left the page, and only Shift+Tab reached them.
  await page.keyboard.press('Tab');
  await expect(items.getByRole('button', { name: 'Hide the sections' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(items).toBeHidden();
  await expect(tools).toBeFocused();
  // "Reset app?" took its focused Cancel with it, on Esc and on Cancel, and the focus fell to the page.
  const confirm = page.locator('.reset-confirm');
  for (const key of ['Escape', 'Enter']) {
    await page.keyboard.press('Enter');
    await items.getByRole('button', { name: 'Reset app' }).focus();
    await page.keyboard.press('Enter');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press(key);
    await expect(confirm).toHaveCount(0);
    await expect(tools).toBeFocused();
  }
});

test('keyboard: the install steps take the focus, and they and the copy-link panel give it back to "Settings & options"', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  await page.addInitScript(() => {
    // The app's own steps rather than Chrome's install dialog, and copying blocked, for the panel with the link.
    window.addEventListener('beforeinstallprompt', (e) => e.stopImmediatePropagation(), true);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } });
  });
  await openApp(page, { lang: 'en', tab: 'converter' });
  const gear = settingsButton(page);
  const choose = async (item: string) => {
    await gear.focus();
    await page.keyboard.press('Enter');
    await page.locator('.top-actions .menu-pop button', { hasText: item }).focus();
    await page.keyboard.press('Enter');
  };
  const steps = page.locator('.install-steps');
  // The focus stayed on the menu's item, hidden, and fell to the page; Esc left the steps open.
  await choose('Install the app');
  await expect(steps.getByRole('heading', { name: 'How to install the app' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(steps).toHaveCount(0);
  await expect(gear).toBeFocused();
  // Close took the focus with it.
  await choose('Install the app');
  await steps.getByRole('button', { name: 'Close' }).focus();
  await page.keyboard.press('Enter');
  await expect(steps).toHaveCount(0);
  await expect(gear).toBeFocused();

  const link = page.locator('input[name="share-link"]');
  for (const close of ['Escape', '×']) {
    await choose('Copy link');
    await expect(link).toBeFocused();
    if (close === '×') await page.locator('.panel-x').focus();
    await page.keyboard.press(close === '×' ? 'Enter' : 'Escape');
    await expect(link).toHaveCount(0);
    await expect(gear).toBeFocused();
  }
});

test('keyboard: "+ Add currency" gives the focus back to its button after a choice or Esc, and Tab closes its list', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  await openApp(page, { lang: 'en', tab: 'converter' });
  const add = page.locator('.add-btn');
  const list = page.locator('.add-pop');
  // The focus fell to the page, and the button was drawn anew, beside the new last chip.
  await add.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('huf');
  await page.keyboard.press('Enter');
  await expect.poll(() => saved(page, 'ft.addedCurrencies')).toBe('["HUF"]');
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(add).toBeFocused();
  // Tab went on through the table with the list still open over it.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(list).toHaveCount(0);
  expect(await focusInView(page)).toBe(true);
});

test('keyboard: a fee platform and the tax page\'s currency give the focus back to their button after a choice', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboards only');
  await openApp(page, { lang: 'en', tab: 'converter' });
  // Each choice drew both fee steps anew, their buttons with them, and the focus fell to the page.
  const platform = page.locator('.fee-step').first().getByRole('button');
  await platform.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('fiverr');
  await page.keyboard.press('Enter');
  await expect(byName(page, 'fee-1')).toHaveValue('20');
  await expect(platform).toBeFocused();

  await page.goto('./?lang=en#taxes');
  const currency = page.locator('.income-row-main .add-currency').first().getByRole('button');
  await currency.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('eur');
  await page.keyboard.press('Enter');
  await expect(currency).toHaveAccessibleName('Currency: EUR €');
  await expect(currency).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('.add-pop')).toHaveCount(0);
  await expect(currency).toBeFocused();
});

test('fees: the monthly figures are not named "per hour"; only the hourly path is', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await expect(page.locator('dl.fee-summary')).toHaveAccessibleName('');
  await expect(page.locator('ol.fee-flow')).toHaveAccessibleName('From the invoice to your account, per hour');
});

test('fees: with nothing to take a cut of, what goes on fees reads 0,00 RON, not −0,00', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'converter' });
  const fees = page.locator('dl.fee-summary > div').nth(1);
  await expect(fees.locator('dd')).toHaveText(/^−\d/);
  await expect(fees).toHaveClass('stat-cut');
  // An amount of 0, and one whose fees come to under half a ban (11.8% of 0.01 RON).
  for (const query of ['amount=0&currency=EUR&per=hour', 'amount=0.01&currency=RON&per=month']) {
    await page.goto(`./?lang=ro&${query}`);
    await expect(fees.locator('dd')).toHaveText('0,00 RON');
    await expect(fees).not.toHaveClass('stat-cut');
  }
});

test('card options saved by an older version, or with one the card can\'t take, keep the others', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  // Saved before "Children in school" existed, with 2.5 dependants from an old link. An older shape sent every option
  // back to its default and deleted the saved ones; 2.5 dependants, saved in the current shape, made the CIM card NaN.
  await page.evaluate(() => localStorage.setItem('ft.taxOptions', JSON.stringify({
    employee: { dependants: 2.5, under26: true },
    pfaReal: { expensesMonthly: 1500, hasSalary: false, pensioner: false, sickLeave: false },
  })));
  // The installed app opens on the bare address, on the converter: the tax page isn't there to merge them, and the
  // address, so a link copied there, had none of them.
  await page.goto('./?lang=en');
  await drawn(page);
  await expect(page).toHaveURL(/under26=1&expenses_pfa=1500(&|$)/);
  // The income is low, where the dependants change the net.
  await page.goto('./?lang=en&income=5000&income_currency=RON&income_per=month#taxes');
  await expect(regimeCard(page, 'pfaReal').locator('input[name="amount"]')).toHaveValue('1,500');
  await expect(regimeCard(page, 'employee').locator('.take-home')).not.toContainText('NaN');
  await expect.poll(() => saved(page, 'ft.taxOptions')).toContain('"employee":{"dependants":0,"under26":true,"schoolChildren":0}');
  await expect(page).toHaveURL(/expenses_pfa=1500/);
  await expect(page).not.toHaveURL(/dependants=/);
});

test('a currency the rates no longer have leaves on its own; the other currencies and custom rates stay', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  // XYZ stands for a code the market list stopped listing after it was saved: the columns, the added currencies and
  // every custom rate went back to their defaults, and the saved ones were deleted.
  await page.evaluate(() => {
    localStorage.setItem('ft.columns', JSON.stringify(['EUR', 'RON', 'TRY', 'XYZ']));
    localStorage.setItem('ft.addedCurrencies', JSON.stringify(['TRY', 'XYZ']));
    localStorage.setItem('ft.customRates', JSON.stringify({ EUR: 5.1, XYZ: 1.2 }));
  });
  await page.goto('./?lang=en');
  await expect(byName(page, 'rate-EUR')).toHaveValue('5.1');
  await expect.poll(() => saved(page, 'ft.columns')).toBe('["EUR","RON","TRY"]');
  expect(await saved(page, 'ft.addedCurrencies')).toBe('["TRY"]');
  expect(await saved(page, 'ft.customRates')).toBe('{"EUR":5.1}');
  await expect(page).toHaveURL(/currencies=EUR,RON,TRY(&|$)/);
  await expect(page).toHaveURL(/rates=EUR(:|%3A)5\.1(&|$)/);
  // Saved, not linked: no word about the link.
  await expect(page.locator('.toast')).toHaveCount(0);

  // In a link it leaves on its own too, and the toast says something in the link wasn't valid.
  await page.goto('./?lang=en&currencies=EUR,USD,XYZ&rates=USD:4.9,XYZ:1.2');
  await expect(page.locator('.toast')).toContainText('Some settings in the link weren’t valid.');
  await expect.poll(() => saved(page, 'ft.columns')).toBe('["EUR","USD"]');
  expect(await saved(page, 'ft.customRates')).toBe('{"USD":4.9}');
  await expect(page).toHaveURL(/currencies=EUR,USD(&|$)/);
  await expect(page).not.toHaveURL(/XYZ/);
});

test('a currency turned off and on again is no change: nothing saved or in the address, and the Tools dot stays still', async ({ page }) => {
  await openApp(page, { lang: 'ro', tab: 'converter' });
  const eur = page.locator('.chips .chip').filter({ hasText: 'EUR' });
  const dot = page.locator('.reset-wrap .dot');
  await expect(dot).not.toHaveClass(/pulse/);
  await eur.click();
  await expect(eur).toHaveAttribute('aria-pressed', 'false');
  await expect(dot).toHaveClass(/pulse/);
  // Turned on again, it went to the end of the saved columns (RON, USD, GBP, EUR) while the grid looked as before.
  await eur.click();
  await expect(eur).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => saved(page, 'ft.columns')).toBeNull();
  await expect(dot).not.toHaveClass(/pulse/);
  await expect(page).not.toHaveURL(/currencies=/);
});

test('"Reset tab" on the converter also resets a tax income the converter sent before the rates changed', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  // 40 EUR an hour, sent to the tax page at the previous day's rate (5.3403; the test rates are of the next day):
  // worked out again with today's rate it no longer matched, and the reset kept it while the converter went back
  // to 30 EUR an hour.
  await page.evaluate(() => {
    localStorage.setItem('ft.source', JSON.stringify({ period: 'hour', currency: 'EUR', amount: 40 }));
    localStorage.setItem('ft.taxIncome', JSON.stringify({ amount: 37026.08, per: 'month', currency: 'RON' }));
  });
  await page.goto('./?lang=en');
  await expect(page).toHaveURL(/income=37026\.08/);
  await page.locator('.reset-wrap > .menu-trigger').click();
  await Promise.all([page.waitForEvent('load'), page.locator('.reset-row').getByRole('button', { name: 'Reset tab' }).click()]);
  await drawn(page);
  expect(await saved(page, 'ft.source')).toBeNull();
  expect(await saved(page, 'ft.taxIncome')).toBeNull();
  await expect(page).not.toHaveURL(/income=/);
});

test('an amount whose income a month passes the limit stops the tax income there, and a reload finds nothing broken', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  const cell = byName(page, 'hour-EUR');
  await focusCell(page, cell);
  await page.keyboard.type('2000000');
  await cell.blur();
  // 2,000,000 EUR an hour is 1.85 billion lei a month: saved and put in the address, it was refused on the next
  // start ("Some settings in the link weren't valid") and the tax page went back to its default income.
  await expect(page.locator('.toast')).toContainText('not the only one testing');
  await expect.poll(() => saved(page, 'ft.taxIncome')).toBe('{"amount":999999999.99,"per":"month","currency":"RON"}');
  await expect(page).toHaveURL(/income=999999999\.99/);
  await page.reload();
  await drawn(page);
  await expect(byName(page, 'hour-EUR')).toHaveValue('2,000,000.00');
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#taxes'; });
  await expect(page.locator('.income-main input')).toHaveValue('999,999,999.99');
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('a page left open moves on to the next day, at midnight in Romania or on coming back to it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T22:00:00+02:00') });
  await page.goto('./?lang=en#taxes');
  const monthly = page.locator('.calendar .monthly strong');
  const first = page.locator('.next-deadlines li').first();
  await expect(monthly).toHaveText('Every month on the 25th (next: Wed, 25 November 2026, today)');
  await expect(first).toContainText('in 61 days');
  // Nothing drew the page again: at 09:00 the next morning it still said "today" for the 25th, and every "in N
  // days" was a day too many, until a click.
  await page.clock.fastForward('11:00:00');
  await expect(monthly).toHaveText('Every month on the 25th (next: Mon, 21 December 2026, in 25 days)');
  await expect(first).toContainText('in 60 days');
  // A hidden page's timers can sleep through midnight: back in view, it reads the date again.
  await page.clock.setSystemTime(new Date('2026-11-27T09:00:00+02:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(monthly).toHaveText('Every month on the 25th (next: Mon, 21 December 2026, in 24 days)');
});

test('a page left open over New Year counts the new year\'s public holidays', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-31T22:00:00+02:00') });
  await page.goto('./?lang=en&holidays=1');
  const label = page.locator('.settings-check span');
  const summary = page.locator('.settings:not(.fees) > summary .muted');
  await expect(label).toHaveText('Take off the public holidays (11 working days in 2026)');
  await expect(summary).toContainText('249 working days/year');
  // The year was read once, when the app loaded: 2026's holidays stayed until a reload.
  await page.clock.fastForward('12:00:00');
  await expect(label).toHaveText('Take off the public holidays (9 working days in 2027)');
  await expect(summary).toContainText('251 working days/year');
});

/** The line with the date of the BNR rates, under the converter: it warns once they are more than a few days old. */
const ratesLine = (page: Page) => page.locator('.converter .rates > p').first();

test('a page left open warns of old rates from midnight in Romania', async ({ page }) => {
  // The test rates are of 3 November: 4 days old on the 7th, 5 on the 8th, when the warning comes on.
  await page.clock.install({ time: new Date('2026-11-07T23:00:00+02:00') });
  await page.goto('./?lang=en');
  await expect(ratesLine(page)).toHaveClass('muted');
  await expect(ratesLine(page)).not.toHaveAttribute('role');
  await page.clock.fastForward('02:00:00');
  await expect(ratesLine(page)).toHaveClass('warn');
  await expect(ratesLine(page)).toHaveAttribute('role', 'status');
  await expect(ratesLine(page)).toContainText('these rates are more than a few days old');
});

test.describe('in another time zone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('the payment calendar counts from the date in Romania', async ({ page }) => {
    // 16:30 on 25 November in California is 02:30 on the 26th in Romania, where the 25th's deadline has passed: the
    // page said it was today.
    await page.clock.setFixedTime(new Date('2026-11-26T00:30:00Z'));
    await page.goto('./?lang=en#taxes');
    await expect(page.locator('.calendar .monthly strong')).toHaveText('Every month on the 25th (next: Mon, 21 December 2026, in 25 days)');
  });

  test('the converter counts the rates\' age from the date in Romania', async ({ page }) => {
    // 16:30 on 7 November in California is 02:30 on the 8th in Romania: the test rates, of 3 November, are 5 days old
    // there, and 4 by the device's date.
    await page.clock.setFixedTime(new Date('2026-11-08T00:30:00Z'));
    await page.goto('./?lang=en');
    await expect(ratesLine(page)).toHaveClass('warn');
    await expect(ratesLine(page)).toHaveAttribute('role', 'status');
    await expect(ratesLine(page)).toContainText('these rates are more than a few days old');
  });
});

/**
 * Focus as the Tab key gives it, which is what shows a focus ring: a step on and back. Not back and on: before the
 * page's first button, Firefox leaves the page.
 */
async function tabTo(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(target).toBeFocused();
}

/**
 * An element's focus ring: its lowest contrast with the colours beside it (the element's own background inside it,
 * its parent's outside), and whether a box that clips its content cuts it off.
 */
const ringOf = (target: Locator) =>
  target.evaluate((el) => {
    const rgba = (c: string) => c.match(/[\d.]+/g)!.map(Number);
    // The colour seen through an element: its background over its ancestors', down to an opaque one.
    const backdrop = (from: Element) => {
      const layers: number[][] = [];
      for (let e: Element | null = from; e && layers.at(-1)?.[3] !== 1; e = e.parentElement) {
        const [r = 0, g = 0, b = 0, a = 1] = rgba(getComputedStyle(e).backgroundColor);
        if (a > 0) layers.push([r, g, b, a]);
      }
      return layers.reduceRight((under, [r = 0, g = 0, b = 0, a = 1]) => [r * a + under[0]! * (1 - a), g * a + under[1]! * (1 - a), b * a + under[2]! * (1 - a)], [255, 255, 255]);
    };
    const lum = (c: number[]) => {
      const [r = 0, g = 0, b = 0] = c.map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const s = getComputedStyle(el);
    const offset = parseFloat(s.outlineOffset);
    const reach = offset + parseFloat(s.outlineWidth);
    const beside = [...(reach >= 0 ? [backdrop(el.parentElement!)] : []), ...(offset < 0 ? [backdrop(el)] : [])];
    const box = el.getBoundingClientRect();
    let clipped = false;
    for (let e = el.parentElement; e; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
      const clip = e.getBoundingClientRect();
      if (box.left - reach < clip.left || box.right + reach > clip.right || box.top - reach < clip.top || box.bottom + reach > clip.bottom) clipped = true;
    }
    return { style: s.outlineStyle, contrast: Math.min(...beside.map((c) => contrast(rgba(s.outlineColor), c))), clipped };
  });

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`focus rings, ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('the tax page\'s switches, pickers and lists, and the settings menu, show a ring of at least 3:1', async ({ page }, info) => {
      test.skip(isPhone(info), 'keyboards only');
      await openApp(page, { lang: 'ro', tab: 'taxes' });
      const shown = async (target: Locator) => {
        const ring = await ringOf(target);
        expect(ring.style).not.toBe('none');
        expect(ring.contrast).toBeGreaterThanOrEqual(3);
        expect(ring.clipped).toBe(false);
      };
      // The CIM | mandate switch clipped its ring away; the best card's "Reference" drew it in the header's own
      // colour (1:1), the other cards' in 1.6:1 on the light theme; the pickers had only a faint halo.
      for (const target of [
        page.locator('.segmented button').first(),
        page.locator('.segmented button').nth(1),
        page.locator('.regime.is-best .ref-toggle').first(),
        page.locator('.regime:not(.is-best) .ref-toggle').first(),
        page.locator('.income-row-main .currency-btn').first(),
        page.locator('.income-row-main .currency-btn').last(),
        page.locator('.regime-options .currency-btn').first(),
      ]) {
        await tabTo(page, target);
        await shown(target);
      }
      // The option the arrow keys reach, and the menu's items, had only a tint (1.2:1).
      await tabTo(page, page.locator('.income-row-main .currency-btn').last());
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await shown(page.locator('.list-pop li.active'));
      await page.keyboard.press('Escape');
      await tabTo(page, page.locator('.top-actions .menu-trigger'));
      await page.keyboard.press('Enter');
      const item = page.locator('.top-actions .menu-pop > button').first();
      await tabTo(page, item);
      await shown(item);
    });
  });

  test.describe(`Windows contrast theme, ${colorScheme}`, () => {
    test.use({ colorScheme, forcedColors: 'active' });

    test('the selected view, theme, language, currencies, quick pick, filter, pay contract and list option stand out', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'contrast themes are a Windows feature, drawn here by Chromium');
      await openApp(page, { lang: 'ro', tab: 'taxes' });
      // The theme replaced every colour that marked them, so the selected one looked like the others.
      const system = await page.evaluate(() => {
        const probe = document.body.appendChild(document.createElement('i'));
        const read = (c: string) => { probe.style.color = c; return getComputedStyle(probe).color; };
        const colours = { highlight: read('Highlight'), highlightText: read('HighlightText') };
        probe.remove();
        return colours;
      });
      const look = (target: Locator) => target.first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, text: s.color, adjust: s.getPropertyValue('forced-color-adjust') };
      });
      // Drawn as set (forced-color-adjust: none): the plate the browser puts behind text hid the HighlightText.
      const highlighted = { background: system.highlight, text: system.highlightText, adjust: 'none' };
      const isHighlighted = async (on: Locator, off: Locator) => {
        expect(await look(on)).toEqual(highlighted);
        expect((await look(off)).background).not.toBe(system.highlight);
      };
      const thumbMarks = async (thumb: Locator, on: Locator, off: Locator) => {
        expect((await look(thumb)).background).toBe(system.highlight);
        expect(await look(on)).toMatchObject({ text: system.highlightText, adjust: 'none' });
        expect((await look(off)).text).not.toBe(system.highlightText);
      };
      await thumbMarks(page.locator('.views-thumb'), page.locator('.views button[aria-current="page"]'), page.locator('.views button:not([aria-current])'));
      await isHighlighted(page.locator('.calendar .chip.on'), page.locator('.calendar .chip:not(.on)'));
      await isHighlighted(page.locator('.segmented button.on'), page.locator('.segmented button:not(.on)'));
      await page.locator('.income-row-main .currency-btn').last().click();
      await page.keyboard.press('ArrowDown');
      await isHighlighted(page.locator('.list-pop li.active'), page.locator('.list-pop li:not(.active)'));
      await page.keyboard.press('Escape');

      await page.goto('./?lang=ro');
      await isHighlighted(page.locator('.chips .chip.on'), page.locator('.chips .chip:not(.on)'));
      await isHighlighted(page.locator('.settings-presets .chip.on'), page.locator('.settings-presets .chip:not(.on)'));
      // Its hours keep a colour of their own, which the theme turned into its text colour on the highlight.
      expect((await look(page.locator('.settings-presets .chip.on .preset-detail'))).text).toBe(system.highlightText);
      await page.locator('.top-actions .menu-trigger').click();
      for (const slider of ['.theme-slider', '.lang-slider']) {
        await thumbMarks(page.locator(`${slider} .slider-thumb`), page.locator(`${slider} button[aria-checked="true"]`), page.locator(`${slider} button[aria-checked="false"]`));
      }
    });
  });
}

/** Every element, ::before and ::after still set to move: a transition of a property that moves it, or an animation. */
const stillMoving = (page: Page) =>
  page.evaluate(() => {
    const MOVES = /^(all|transform|translate|rotate|scale|width|height|top|right|bottom|left|inset|margin.*|padding.*)$/;
    const seconds = (list: string) => list.split(',').map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 0.001 : 1));
    const found = new Set<string>();
    for (const el of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        if (pseudo && (s.content === 'none' || s.content === 'normal')) continue;
        const durations = seconds(s.transitionDuration);
        const moves = s.transitionProperty.split(',').map((p) => p.trim()).filter((p, i) => MOVES.test(p) && durations[i % durations.length]! > 0);
        const animation = s.animationName !== 'none' && seconds(s.animationDuration).some((d) => d > 0) ? s.animationName : '';
        if (moves.length || animation) found.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${pseudo ?? ''}: ${animation || moves.join(', ')}`);
      }
    }
    return [...found];
  });

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing on either tab is set to move', async ({ page }) => {
    // The ↺ turned and the Tools buttons and a shared link's buttons lifted; the chevrons inside the tax cards turned.
    await openApp(page, { lang: 'en', tab: 'converter', motion: true });
    await page.goto('./?lang=en&share=1&currencies=EUR,USD');
    await expect(page.locator('.shared-banner')).toBeVisible();
    expect(await stillMoving(page)).toEqual([]);
    await page.goto('./?lang=en#taxes');
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    expect(await stillMoving(page)).toEqual([]);
  });
});

test('phones: a list opened near the right edge stays inside the screen while it comes in', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phones only');
  await openApp(page, { lang: 'ro', tab: 'taxes', motion: true });
  const width = page.viewportSize()!.width;
  await page.locator('.income-row-main .currency-btn').last().click();
  // Each frame of its pop-in. The animation's transform replaced the shift that keeps it on screen: for 0.2 s it reached
  // 75 px past the edge, and the page stayed that much wider while the list was open.
  const frames = await page.evaluate(() => new Promise<{ right: number; page: number }[]>((resolve) => {
    const seen: { right: number; page: number }[] = [];
    const start = performance.now();
    const frame = () => {
      seen.push({ right: document.querySelector('.list-pop')!.getBoundingClientRect().right, page: document.scrollingElement!.scrollWidth });
      if (performance.now() - start < 300) requestAnimationFrame(frame);
      else resolve(seen);
    };
    frame();
  }));
  expect(frames.length).toBeGreaterThan(5);
  for (const f of frames) {
    expect(f.right).toBeLessThanOrEqual(width);
    expect(f.page).toBe(width);
  }
});

/**
 * What runs past its place on the tax page: the page wider than the screen, a row of the phone ranking past the list,
 * its name under its amount or a word of the name split over two lines (anywhere but after its hyphen or soft hyphen,
 * as "Micro-" in Romanian), a card option past its card, a label over its field.
 */
const overflowsOnTaxes = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    const box = (el: Element) => el.getBoundingClientRect();
    const over = (a: number, b: number) => a > b + 0.5;
    // The middle of the line a letter is on, by the last of its boxes: a range that touches the break after a soft
    // hyphen also gets the hyphen drawn at the end of the line before.
    const lineOf = (node: Node, at: number) => {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const last = [...range.getClientRects()].at(-1)!;
      return last.top + last.height / 2;
    };
    if (over(document.scrollingElement!.scrollWidth, innerWidth)) found.push(`page ${document.scrollingElement!.scrollWidth} px wide`);
    const rank = box(document.querySelector('.rank')!);
    for (const li of document.querySelectorAll('.rank li')) {
      const row = li.textContent!;
      const amount = box(li.querySelector('b')!);
      if (over(box(li).right, rank.right) || over(amount.right, box(li).right)) found.push(`${row}: past the list`);
      if (over(box(li.querySelector('.regime-name')!).right, amount.left)) found.push(`${row}: name under the amount`);
      const text = li.querySelector('.kw-rest')!.firstChild!;
      // A word ends at a space, after a hyphen or at a soft hyphen: where the name may break.
      for (const word of text.textContent!.matchAll(/[^\s\u00ad-]+-?/g)) {
        if (Math.abs(lineOf(text, word.index) - lineOf(text, word.index + word[0].length - 1)) > 5) found.push(`${row}: "${word[0]}" split`);
      }
    }
    for (const card of document.querySelectorAll('.regime')) {
      const name = card.querySelector('h3')!.textContent!;
      for (const el of card.querySelectorAll('.regime-options *')) if (over(box(el).right, box(card).right)) found.push(`${name}: ${el.className} past the card`);
      for (const field of card.querySelectorAll('.regime-options .field')) {
        const words = document.createRange();
        words.selectNodeContents(field.firstElementChild!);
        const label = words.getBoundingClientRect();
        const input = box(field.lastElementChild!);
        if (over(label.right, input.left) && over(label.bottom, input.top)) found.push(`${name}: ${field.firstElementChild!.textContent} over its field`);
      }
    }
    return found;
  });

for (const lang of LANGS) {
  test(`narrow phones: nothing on the tax page runs off a 320 px screen, nor with the largest income (${lang})`, async ({ page }, info) => {
    test.skip(!isPhone(info), 'phones only');
    const fits = async () => {
      await expect(page.locator('.rank')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await overflowsOnTaxes(page)).toEqual([]);
    };
    // 320 px is also a 1280 px window zoomed to 400%. The ranking ran 31 px past its list and 6 px off the screen,
    // cutting "RON", and in English the expenses' "RON/month" ran 12 px past its card.
    await page.setViewportSize({ width: 320, height: 860 });
    await openApp(page, { lang, tab: 'taxes' });
    await fits();
    // 999,999,999.99 EUR an hour, 24 hours a day, 7 days a week: the ranking's amounts ran past the list, and on most
    // phones pushed the page sideways.
    await page.goto(`./?lang=${lang}&income=999999999.99&income_currency=EUR&income_per=hour&hours=24&days=7#taxes`);
    await fits();
    await page.setViewportSize(info.project.use.viewport!);
    await fits();
  });
}
