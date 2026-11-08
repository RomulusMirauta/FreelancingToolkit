import { describe, expect, it } from 'vitest';
import table from '../../data/currency-symbols.json';
import { CURRENCIES, currencySymbol } from './currencies';

const SYMBOLS: Record<string, string> = table;
const CODES = new Set(CURRENCIES.map((c) => c.code));

describe('currency symbols are shown correctly', () => {
  // Checked by hand against each central bank's own usage.
  it.each([
    ['EUR', '€'], ['RON', 'lei'], ['USD', '$'], ['GBP', '£'], ['PLN', 'zł'], ['CZK', 'Kč'], ['HUF', 'Ft'],
    ['SEK', 'kr'], ['DKK', 'kr'], ['NOK', 'kr'], ['ISK', 'kr'], ['JPY', '¥'], ['CNY', '¥'], ['INR', '₹'],
    ['TRY', '₺'], ['UAH', '₴'], ['ILS', '₪'], ['KRW', '₩'], ['THB', '฿'], ['PHP', '₱'], ['RUB', '₽'],
    ['BRL', 'R$'], ['ZAR', 'R'], ['CAD', '$'], ['AUD', '$'], ['MXN', '$'], ['NGN', '₦'], ['VND', '₫'],
    ['GEL', '₾'], ['KZT', '₸'], ['BAM', 'KM'], ['IDR', 'Rp'], ['MYR', 'RM'], ['EGP', 'E£'],
  ])('%s → %s', (code, symbol) => expect(currencySymbol(code)).toBe(symbol));

  it.each(['CHF', 'AED', 'SAR', 'RSD', 'MDL', 'BGN', 'KGS', 'XYZ', ''])('%j has no symbol besides its code', (code) =>
    expect(currencySymbol(code)).toBeUndefined());
});

describe('no symbol is paired with the wrong currency', () => {
  // Every symbol that belongs to specific currencies, with all the currencies allowed to use it.
  const OWNERS: Record<string, string[]> = {
    '€': ['EUR'], 'lei': ['RON'], 'zł': ['PLN'], 'Kč': ['CZK'], 'Ft': ['HUF'], 'kn': ['HRK'],
    '£': ['GBP', 'FKP', 'GIP', 'SHP', 'SSP', 'SYP'], 'E£': ['EGP'], 'L£': ['LBP'],
    'kr': ['SEK', 'DKK', 'NOK', 'ISK'], '¥': ['JPY', 'CNY'], '₹': ['INR'], '₺': ['TRY'], '₴': ['UAH'],
    '₪': ['ILS'], '₩': ['KRW'], '฿': ['THB'], '₱': ['PHP'], '₽': ['RUB'], '₦': ['NGN'], '₫': ['VND'],
    '₸': ['KZT'], '₾': ['GEL'], '₼': ['AZN'], '֏': ['AMD'], '؋': ['AFN'], '৳': ['BDT'], '₡': ['CRC'],
    '₭': ['LAK'], '₮': ['MNT'], '₲': ['PYG'], '៛': ['KHR'], 'R$': ['BRL'], 'R': ['ZAR'], 'RM': ['MYR'],
    'Rp': ['IDR'], 'Rs': ['LKR', 'MUR', 'NPR', 'PKR'], 'KM': ['BAM'], 'C$': ['NIO'], 'T$': ['TOP'],
    'GH₵': ['GHS'],
    // Dollars, and pesos written with the same sign.
    '$': ['USD', 'ARS', 'AUD', 'BBD', 'BMD', 'BND', 'BSD', 'BZD', 'CAD', 'CLP', 'COP', 'CUP', 'DOP', 'FJD', 'GYD',
      'HKD', 'JMD', 'KYD', 'LRD', 'MXN', 'NAD', 'NZD', 'SBD', 'SGD', 'SRD', 'TTD', 'TWD', 'UYU', 'XCD'],
  };

  it.each(Object.entries(SYMBOLS))('%s → %s', (code, symbol) => {
    const owners = OWNERS[symbol];
    // Symbols not listed above are letters for one currency only (Kz, Bs, FCFA…): they must be unique.
    if (owners) expect(owners).toContain(code);
    else expect(Object.entries(SYMBOLS).filter(([, s]) => s === symbol).map(([c]) => c)).toEqual([code]);
  });

  it('a symbol is never another currency’s code', () => {
    for (const [code, symbol] of Object.entries(SYMBOLS)) {
      expect(symbol).not.toBe(code);
      if (CODES.has(symbol)) throw new Error(`${code} shows ${symbol}, which is another currency's code`);
    }
  });

  // The deploy downloads the currency lists again before testing: a currency the feeds have since dropped stays in the
  // table, unused, until npm run symbols rewrites it, so only the ones the app lists are checked.
  it('the symbol of every currency the app lists is short enough for a chip', () => {
    for (const [code, symbol] of Object.entries(SYMBOLS).filter(([c]) => CODES.has(c))) {
      expect(symbol.trim(), code).toBe(symbol);
      expect(symbol.length, code).toBeGreaterThan(0);
      expect(symbol.length, code).toBeLessThanOrEqual(5);
    }
  });
});
