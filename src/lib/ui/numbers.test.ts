import { describe, expect, it } from 'vitest';
import {
  formatEditable, formatEditableGrouped, formatEditableRate, formatMoney, groupTyped, parseAmount, roundMoney, setNumberLocale,
} from './numbers';

describe('parseAmount', () => {
  it.each([
    ['30', 30], ['1200', 1200], ['1,200.50', 1200.5], ['1.200,50', 1200.5],
    ['1200,5', 1200.5], ['1 200', 1200], ['0.5', 0.5], ['.5', 0.5], ['1.200.000', 1200000],
  ])('%s → %d in both languages', (text, expected) => {
    expect(parseAmount(text, 'en')).toBe(expected);
    expect(parseAmount(text, 'ro')).toBe(expected);
  });

  it('a lone "1,200" is thousands in English, a decimal in Romanian', () => {
    expect(parseAmount('1,200', 'en')).toBe(1200);
    expect(parseAmount('1,200', 'ro')).toBe(1.2);
  });

  it('a lone "1.200" is a decimal in English, thousands in Romanian', () => {
    expect(parseAmount('1.200', 'en')).toBe(1.2);
    expect(parseAmount('1.200', 'ro')).toBe(1200);
    expect(parseAmount('30.5', 'ro')).toBe(30.5);
  });

  it.each(['', 'abc', '-5', '1e3', '.', '12a'])('rejects %j', (text) => expect(parseAmount(text)).toBeNull());
});

describe('formatting follows the language', () => {
  it('Romanian', () => {
    setNumberLocale('ro');
    expect(formatMoney(1234.5)).toBe('1.234,50');
    expect(formatEditable(160.278)).toBe('160,28');
  });
  it('English', () => {
    setNumberLocale('en');
    expect(formatMoney(1234.5)).toBe('1,234.50');
    expect(formatEditable(160.278)).toBe('160.28');
  });
});

describe('groupTyped (thousands marks while typing)', () => {
  it.each([
    ['27781,52', 'ro', '27.781,52'], ['27781.52', 'en', '27,781.52'], ['1234567', 'ro', '1.234.567'],
    ['999', 'ro', '999'], ['1.0000', 'ro', '10.000'], ['12,345', 'ro', '12,34'], ['12,', 'ro', '12,'], ['', 'ro', ''],
  ] as const)('%s (%s) → %s', (text, as, out) => expect(groupTyped(text, undefined, as).text).toBe(out));

  it('keeps the caret beside the same digit', () => {
    // Typing "5" after "1.234" → "12.345", caret at the end.
    expect(groupTyped('1.2345', 6, 'ro')).toEqual({ text: '12.345', caret: 6 });
    // Typing "9" at the start of "1.234" → "91.234", caret after the 9.
    expect(groupTyped('91.234', 1, 'ro')).toEqual({ text: '91.234', caret: 1 });
    // Deleting the "2" of "1.234" → "134", caret after the 1.
    expect(groupTyped('1.34', 2, 'ro')).toEqual({ text: '134', caret: 1 });
  });

  it('round-trips through parseAmount', () => {
    for (const as of ['ro', 'en'] as const) {
      for (const x of [0, 5, 999, 1000, 27781.52, 1234567.5]) expect(parseAmount(formatEditableGrouped(x, as), as)).toBe(x);
    }
  });
});

describe('a saved custom rate, back in its field', () => {
  it('has the language\'s decimal mark, so three decimals are not read as thousands', () => {
    expect(formatEditableRate(4.815, 'ro')).toBe('4,815');
    expect(formatEditableRate(4.815, 'en')).toBe('4.815');
    expect(formatEditableRate(0.0000001, 'ro')).toBe('0,0000001');
  });

  it('round-trips through parseAmount, every digit kept', () => {
    const rates = [4.815, 0.215, 194.477, 0.015, 5.123, 0.014662, 4.7795, 4.9, 0.0001, 0.00000252849, 0.0000001, 1234.5678, 5];
    for (const as of ['ro', 'en'] as const) {
      for (const x of rates) expect(parseAmount(formatEditableRate(x, as), as)).toBe(x);
    }
  });

  it('follows the language set for the page by default', () => {
    setNumberLocale('ro');
    expect(formatEditableRate(0.215)).toBe('0,215');
    setNumberLocale('en');
    expect(formatEditableRate(0.215)).toBe('0.215');
  });
});

describe('an amount ending in half a cent', () => {
  // Amounts with three decimals ending in 5, spread up to about 20,000 (the others round the same either way);
  // Math.round(x * 100) / 100 rounded 1,333 of these differently from what is shown.
  const halves = Array.from({ length: 20_000 }, (_, k) => (k * 101 + 0.5) / 100);

  it('opens for editing as it is shown (1,005 shows 1,01)', () => {
    setNumberLocale('ro');
    expect(formatMoney(1.005)).toBe('1,01');
    expect(formatEditable(1.005)).toBe('1,01');
    expect(formatEditable(0.145)).toBe('0,15');
    expect(formatEditableGrouped(1024.215, 'ro')).toBe('1.024,22');
    for (const as of ['ro', 'en'] as const) {
      setNumberLocale(as);
      const off = halves.filter((x) => parseAmount(formatEditable(x)) !== parseAmount(formatMoney(x)));
      expect(off.slice(0, 5)).toEqual([]);
    }
  });

  it('is kept as the figure shown', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.145)).toBe(0.15);
    expect(roundMoney(1024.215)).toBe(1024.22);
    expect(roundMoney(27781.524)).toBe(27781.52);
    setNumberLocale('en');
    const off = halves.filter((x) => roundMoney(x) !== parseAmount(formatMoney(x)) || parseAmount(formatEditableGrouped(x, 'en'), 'en') !== roundMoney(x));
    expect(off.slice(0, 5)).toEqual([]);
  });
});
