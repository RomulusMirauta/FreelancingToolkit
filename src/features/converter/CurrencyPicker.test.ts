import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '../../lib/currency/currencies';
import { searchCurrencies } from './CurrencyPicker';

const codes = (q: string) => searchCurrencies(CURRENCIES, q).map((c) => c.code);

describe('searchCurrencies', () => {
  it('matches codes first', () => expect(codes('ch')[0]).toBe('CHF'));
  it('matches names by word', () => expect(codes('yen')).toEqual(['JPY']));
  it('ignores diacritics', () => {
    expect(codes('zloty')).toEqual(['PLN']);
    expect(codes('krona')).toContain('ISK');
  });
  it('is case-insensitive', () => expect(codes('SWISS')).toEqual(['CHF']));
  it('lists everything for an empty query', () => expect(codes('  ')).toHaveLength(CURRENCIES.length));
  it('finds Romanian names too', () => {
    expect(codes('lira')).toEqual(expect.arrayContaining(['GBP', 'EGP', 'TRY']));
    expect(codes('elvetian')).toEqual(['CHF']);
    expect(codes('zlot')).toEqual(['PLN']);
  });
  it('returns nothing for nonsense', () => expect(codes('qqq')).toEqual([]));
});
