import { describe, expect, it, vi } from 'vitest';
import {
  bareAmount, formatEditable, formatEditableGrouped, formatEditableRate, formatMoney, formatNumber, groupTyped, isAtOnce, parseAmount,
  pastedAmount, roundMoney, setNumberLocale, typedAmount,
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
  it('under half a ban an amount is 0,00, never -0,00, as Intl writes a loss that small and −0', () => {
    setNumberLocale('ro');
    expect([-0.004, -1e-12, -0].map(formatMoney)).toEqual(['0,00', '0,00', '0,00']);
    expect([-0.005, 0.004].map(formatMoney)).toEqual(['-0,01', '0,00']);
  });
  it('English', () => {
    setNumberLocale('en');
    expect(formatMoney(1234.5)).toBe('1,234.50');
    expect(formatEditable(160.278)).toBe('160.28');
  });

  it('counts and percentages: one formatter per language and number of decimals, not one per figure', () => {
    const figures = [0, 5, 5.5, 7.25, 228, 1234.567, 4050, 999_999_999.99];
    for (const as of ['en', 'ro'] as const) {
      const locale = as === 'ro' ? 'ro-RO' : 'en-GB';
      const expected = [0, 1, 2].map((decimals) => figures.map((x) => new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(x)));
      setNumberLocale(as === 'ro' ? 'en' : 'ro');
      setNumberLocale(as);
      // Every key typed on the tax page formats over 100 figures, and each one built its own formatter.
      const built = vi.spyOn(Intl, 'NumberFormat');
      try {
        for (let round = 0; round < 3; round++) {
          for (const decimals of [0, 1, 2]) expect(figures.map((x) => formatNumber(x, decimals))).toEqual(expected[decimals]);
          expect(formatNumber(5.5)).toBe(expected[1]![2]);
        }
        expect(built).toHaveBeenCalledTimes(3);
      } finally {
        built.mockRestore();
      }
    }
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

describe('typing into an amount', () => {
  /** Keys typed one at a time at the caret, each through the field's own handling. */
  const type = (text: string, caret: number, keys: string, as: 'ro' | 'en') => {
    let field = { text, caret };
    for (const key of keys) {
      const after = field.text.slice(0, field.caret) + key + field.text.slice(field.caret);
      field = typedAmount(field.text, after, field.caret + 1, key, as);
    }
    return field;
  };

  it('a field that shows 0 takes the digits typed in its place, wherever the caret is', () => {
    // A click left of the 0 (most of a right-aligned field) gave 20.000; a click after it, 02.000.
    expect(type('0', 0, '2000', 'ro')).toEqual({ text: '2.000', caret: 5 });
    expect(type('0', 1, '2000', 'ro')).toEqual({ text: '2.000', caret: 5 });
    expect(type('0', 0, '1500', 'en')).toEqual({ text: '1,500', caret: 5 });
    expect(type('0', 1, '0', 'ro').text).toBe('0');
  });

  it('a 0 an edit left, or undo put back, stays: only the 0 the field showed when it got focus is replaced', () => {
    // 50 an hour, its 5 deleted and 6 typed, gave 6; 90 with its 9 deleted and 3 typed, 3.
    expect(typedAmount('0', '60', 1, '6', 'ro', false)).toEqual({ text: '60', caret: 1 });
    expect(typedAmount('0', '30', 1, '3', 'en', false)).toEqual({ text: '30', caret: 1 });
    // Ctrl+Z after deleting the 5 puts back 50, with no key: it gave 5.
    expect(typedAmount('0', '50', 1, null, 'ro', false)).toEqual({ text: '50', caret: 1 });
  });

  it('a decimal mark after the 0 keeps it', () => {
    expect(type('0', 1, ',5', 'ro').text).toBe('0,5');
    expect(type('0', 1, '.5', 'ro').text).toBe('0,5');
    expect(type('0', 1, '.5', 'en').text).toBe('0.5');
  });

  it('otherwise types as before: thousands marks as they come, and "." for the decimal comma in Romanian', () => {
    expect(type('1.234', 5, '5', 'ro')).toEqual({ text: '12.345', caret: 6 });
    expect(type('', 0, '10000', 'ro').text).toBe('10.000');
    expect(type('12', 2, '.5', 'ro').text).toBe('12,5');
    expect(type('10', 0, '5', 'ro').text).toBe('510');
  });
});

describe('an amount put in at once: pasted, dropped, or from a phone keyboard\'s clipboard strip', () => {
  /** Put over the whole field (selected, as select-all or Tab leaves it). */
  const over = (before: string, text: string, as: 'ro' | 'en') => pastedAmount(before, text, text.length, [0, before.length], as);
  const shown = (text: string, as: 'ro' | 'en') => {
    const r = over('27.781,52', text, as);
    return 'text' in r ? r.text : r;
  };

  it('is a paste, a drop, or more than one character typed in one go', () => {
    expect(isAtOnce({ inputType: 'insertFromPaste', data: null })).toBe(true);
    expect(isAtOnce({ inputType: 'insertFromDrop', data: null })).toBe(true);
    expect(isAtOnce({ inputType: 'insertText', data: '2500.00' })).toBe(true);
    expect(isAtOnce({ inputType: 'insertText', data: '5' })).toBe(false);
    expect(isAtOnce({ inputType: 'deleteContentBackward', data: null })).toBe(false);
    expect(isAtOnce({})).toBe(false);
  });

  it('loses the currency sign, code or unit around it, and nothing in between', () => {
    const cases = {
      '$1,234.56': '1,234.56', 'USD 2,500.00': '2,500.00', '1.234,56 lei': '1.234,56', '1.234,56 lei.': '1.234,56',
      '€ 1.234,56': '1.234,56', '1 234,56 RON': '1 234,56', '12,5%': '12,5', '$.50': '.50', 'Rs. 1,234.56': '1,234.56',
      '1e3': '1e3', '2026-11-08': '2026-11-08', '30': '30', 'lei': '',
    };
    for (const [text, bare] of Object.entries(cases)) expect(bareAmount(text), text).toBe(bare);
  });

  it('is read whole in Romanian, in either convention: the sign no longer turns 1,234.56 into 1,23', () => {
    const cases = {
      '$1,234.56': '1.234,56', 'USD 2,500.00': '2.500', '$2,500.00': '2.500', '1,234.56': '1.234,56', '1234.56': '1.234,56',
      '2500.00': '2.500', '1.234,56 lei': '1.234,56', '2.500 lei': '2.500', '€ 1.234,56': '1.234,56', '1234,567': '1.234,57',
    };
    for (const [text, out] of Object.entries(cases)) expect(shown(text, 'ro'), text).toBe(out);
    expect(over('', '$1,234.56', 'ro')).toEqual({ text: '1.234,56', caret: Infinity });
  });

  it('is read whole in English, in either convention: 1 234,56 € no longer becomes 123,456', () => {
    const cases = {
      '1 234,56 €': '1,234.56', '€1,234.56': '1,234.56', '€ 1.234,56': '1,234.56', '1.234,56 €': '1,234.56',
      '1 234,56 RON': '1,234.56', '2.500,00': '2,500', '12,5%': '12.5', 'CHF 1’234.50': '1,234.5',
      // One dot and three digits is a decimal in English, as when typed.
      'RON 2.500': '2.5',
    };
    for (const [text, out] of Object.entries(cases)) expect(shown(text, 'en'), text).toBe(out);
  });

  it('put over a selection, it is read alone, even when it starts like the amount it replaces', () => {
    // Comparing the texts alone, "1.5" over 1.000 kept "1." and added "5": 15.
    expect(over('1.000', '1.5', 'ro')).toEqual({ text: '1,5', caret: Infinity });
    expect(over('2.500', '2.5', 'ro')).toEqual({ text: '2,5', caret: Infinity });
    expect(over('1,000', '1,5', 'en')).toEqual({ text: '1.5', caret: Infinity });
  });

  it('next to digits already there, its digits join them: the field\'s thousands marks are not decimals', () => {
    // At the end of 10.000, "0" gave 10; "25" after 1.500, 1,5; "9" after 27.781, 27,78.
    expect(pastedAmount('10.000', '10.0000', 7, [6, 6], 'ro')).toEqual({ text: '100.000', caret: 7 });
    expect(pastedAmount('1.500', '1.50025', 7, [5, 5], 'ro')).toEqual({ text: '150.025', caret: 7 });
    expect(pastedAmount('27.781', '27.7819', 7, [6, 6], 'ro')).toEqual({ text: '277.819', caret: 7 });
    expect(pastedAmount('1,500', '1,5000', 6, [5, 5], 'en')).toEqual({ text: '15,000', caret: 6 });
    // In the middle, the caret after what was put in; its zeros count.
    expect(pastedAmount('1.500', '12.500', 2, [1, 1], 'ro')).toEqual({ text: '12.500', caret: 2 });
    expect(pastedAmount('1', '1000', 4, [1, 1], 'ro')).toEqual({ text: '1.000', caret: 5 });
    // A decimal part in the other convention, and a sign, beside digits.
    expect(pastedAmount('10', '10.50', 5, [2, 2], 'ro')).toEqual({ text: '10,50', caret: 5 });
    expect(pastedAmount('10', '10$5', 4, [2, 2], 'ro')).toEqual({ text: '105', caret: 3 });
    // A decimal mark alone goes in as if typed.
    expect(pastedAmount('10', '10,', 3, [2, 2], 'ro')).toEqual({ text: '10,', caret: 3 });
  });

  it('over a field that shows 0, it takes the 0\'s place', () => {
    expect(pastedAmount('0', '15000', 4, [0, 0], 'ro')).toEqual({ text: '1.500', caret: Infinity });
    expect(pastedAmount('0', '01500', 5, [1, 1], 'ro')).toEqual({ text: '1.500', caret: Infinity });
    expect(pastedAmount('0', '0,5', 3, [1, 1], 'ro')).toEqual({ text: '0,5', caret: Infinity });
  });

  it('without the selection, or with one the change doesn\'t match (a drop elsewhere), the texts are compared', () => {
    expect(pastedAmount('10.000', '10.0000', 7, null, 'ro')).toEqual({ text: '100.000', caret: 7 });
    expect(pastedAmount('', '$1,234.56', 9, null, 'ro')).toEqual({ text: '1.234,56', caret: Infinity });
    expect(pastedAmount('1.234', '1.2345', 6, [0, 0], 'ro')).toEqual({ text: '12.345', caret: 6 });
  });

  it('text that doesn\'t read as an amount is refused, never read in pieces', () => {
    for (const text of ['1e3', '12-34', '2026-11-08', '1,2,3']) expect(over('2.500', text, 'ro'), text).toEqual({ notAmount: text });
    expect(pastedAmount('10', '101e3', 5, [2, 2], 'ro')).toEqual({ notAmount: '1e3' });
  });

  it('a number too long for an amount keeps all its digits, so the field refuses it as too big', () => {
    // 26 digits became 1e+25, then 125, under the limit.
    const wholeDigits = (r: ReturnType<typeof pastedAmount>) => ('text' in r ? r.text.split(',')[0]!.replace(/\D/g, '').length : 0);
    expect(formatEditableGrouped(1e25, 'ro')).not.toMatch(/e/i);
    expect(wholeDigits(over('', `1${'0'.repeat(25)}`, 'ro'))).toBe(26);
    expect(wholeDigits(over('', `1${'0'.repeat(400)}`, 'ro'))).toBe(401);
  });
});
