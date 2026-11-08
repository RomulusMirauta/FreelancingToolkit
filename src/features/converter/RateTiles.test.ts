import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RateTiles } from './RateTiles';

// Two fixings in a row: EUR up and USD down by 0.0001 lei, under 0.005% of their rates, so their cards read 0% and
// unchanged; GBP the same on both days. (Vitest applies vi.mock before any import.)
vi.mock('../../data/rates.json', async (importOriginal) => {
  const { default: real } = await importOriginal<{ default: { rates: Record<string, number> } }>();
  const rates = { ...real.rates, EUR: 5.3416, USD: 4.7795, GBP: 6.4015 };
  const copy = {
    ...real,
    date: '2026-11-06',
    rates,
    history: [{ date: '2026-11-06', rates }, { date: '2026-11-05', rates: { ...rates, EUR: 5.3415, USD: 4.7796 } }],
  };
  return { default: copy, ...copy };
});

/** The card of each currency, as the page draws it (in Romanian, the default language). */
function cards(): Record<string, string> {
  const html = renderToStaticMarkup(createElement(RateTiles, { codes: ['EUR', 'USD', 'GBP'], rates: {}, overrides: {}, setOverrides: () => {}, anchor: 'RON' }));
  return Object.fromEntries(html.split('<li').slice(1).map((li) => [/name="rate-(\w+)"/.exec(li)![1]!, li]));
}

describe('rate cards', () => {
  it('a move too small for the percentage reads 0%, unchanged, and its amount in lei keeps its sign', () => {
    const { EUR, USD } = cards();
    // The lei line and the pill's title had no sign, the same for a rise as for a fall.
    expect(EUR).toContain('class="rate-chg flat" title="+0,0001 RON ');
    expect(EUR).toContain('<span class="sr-only">neschimbat</span>0%</span>');
    expect(EUR).toContain('<span>+0,0001 RON</span>');
    expect(USD).toContain('class="rate-chg flat" title="−0,0001 RON ');
    expect(USD).toContain('<span>−0,0001 RON</span>');
  });

  it('a rate that didn\'t move has no sign', () => {
    const { GBP } = cards();
    expect(GBP).toContain('class="rate-chg flat" title="0 RON ');
    expect(GBP).toContain('<span>0 RON</span>');
  });
});
