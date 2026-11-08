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

test('fees: the monthly figures are not named "per hour"; only the hourly path is', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'converter' });
  await expect(page.locator('dl.fee-summary')).toHaveAccessibleName('');
  await expect(page.locator('ol.fee-flow')).toHaveAccessibleName('From the invoice to your account, per hour');
});

test('card options saved by an older version, or with one the card can\'t take, keep the others', async ({ page }) => {
  await openApp(page, { lang: 'en', tab: 'taxes' });
  // Saved before "Children in school" existed, with 2.5 dependants from an old link. An older shape sent every option
  // back to its default and deleted the saved ones; 2.5 dependants, saved in the current shape, made the CIM card NaN.
  await page.evaluate(() => localStorage.setItem('ft.taxOptions', JSON.stringify({
    employee: { dependants: 2.5, under26: true },
    pfaReal: { expensesMonthly: 1500, hasSalary: false, pensioner: false, sickLeave: false },
  })));
  // The installed app opens on the bare address. The income is low, where the dependants change the net.
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

test.describe('in another time zone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('the payment calendar counts from the date in Romania', async ({ page }) => {
    // 16:30 on 25 November in California is 02:30 on the 26th in Romania, where the 25th's deadline has passed: the
    // page said it was today.
    await page.clock.setFixedTime(new Date('2026-11-26T00:30:00Z'));
    await page.goto('./?lang=en#taxes');
    await expect(page.locator('.calendar .monthly strong')).toHaveText('Every month on the 25th (next: Mon, 21 December 2026, in 25 days)');
  });
});
