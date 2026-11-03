type NumberLang = 'ro' | 'en';

let lang: NumberLang = 'ro';

/**
 * The largest amount anyone can type, link or have saved: nine digits before the decimal mark. Far above any
 * freelancer's income, and small enough that every figure derived from it still fits its card.
 */
export const MAX_AMOUNT = 999_999_999.99;
/** The most digits before the decimal mark an amount field takes. */
export const MAX_WHOLE_DIGITS = 9;
/** A sensible amount: a finite number from 0 to MAX_AMOUNT. */
export const isSaneAmount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= MAX_AMOUNT;
let fmt2 = makeMoney('ro-RO');
let fmtRate = makeRate('ro-RO');

function makeMoney(locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
}
function makeRate(locale: string) {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 6, useGrouping: 'always' });
}

/** Switches number formatting: Romanian 1.234,56 or English 1,234.56. */
export function setNumberLocale(next: NumberLang): void {
  if (next === lang) return;
  lang = next;
  const locale = next === 'ro' ? 'ro-RO' : 'en-GB';
  fmt2 = makeMoney(locale);
  fmtRate = makeRate(locale);
}

export function formatMoney(x: number): string {
  return fmt2.format(x);
}

/** A count such as days or a percentage: up to `decimals` decimals, none when it is whole (228, 5,5). */
export function formatNumber(x: number, decimals = 1): string {
  return new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: decimals }).format(x);
}

export function formatRate(x: number): string {
  return fmtRate.format(x);
}

/** A plain number for editing (no grouping, at most 2 decimals), with the language's decimal mark. */
export function formatEditable(x: number): string {
  const s = String(Math.round(x * 100) / 100);
  return lang === 'ro' ? s.replace('.', ',') : s;
}

/**
 * Parses what people type, in either convention: "1200", "1,200.50", "1.200,50", "1200,5", "1 200".
 * When there is only one kind of separator, the language decides:
 * - EN: a lone comma is decimal unless it groups thousands ("1,200" = 1200); "1.5" is decimal.
 * - RO: a lone comma is decimal ("1,200" = 1.2); dots that group thousands ("1.200") mean 1200.
 * Returns null for anything that is not a non-negative number.
 */
export function parseAmount(text: string, as: NumberLang = lang): number | null {
  let s = text.replace(/[\s ']/g, '');
  if (s === '') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const groupsThousands = as === 'en' ? /^\d{1,3}(,\d{3})+$/ : /^\d{1,3}(,\d{3}){2,}$/;
    s = groupsThousands.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else {
    const groupsThousands = as === 'ro' ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(\.\d{3}){2,}$/;
    if (groupsThousands.test(s)) s = s.replace(/\./g, '');
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** The language's marks: Romanian groups with "." and uses "," for decimals, English the other way round. */
export function numberMarks(as: NumberLang = lang): { group: string; decimal: string } {
  return as === 'ro' ? { group: '.', decimal: ',' } : { group: ',', decimal: '.' };
}

/** An amount for editing, thousands grouped: 27.781,52 (RO) or 27,781.52 (EN). */
export function formatEditableGrouped(x: number, as: NumberLang = lang): string {
  const s = String(Math.round(x * 100) / 100);
  return groupTyped(as === 'ro' ? s.replace('.', ',') : s, undefined, as).text;
}

/**
 * Reformats an amount while it is typed, keeping the caret beside the same digit.
 * Keeps the digits and the first decimal mark (at most 2 decimals) and recomputes the thousands marks,
 * so they appear on their own and can be neither typed nor deleted.
 */
export function groupTyped(text: string, caret = text.length, as: NumberLang = lang): { text: string; caret: number } {
  const { group, decimal } = numberMarks(as);
  let whole = '';
  let frac = '';
  let hasDecimal = false;
  // Digits and decimal mark kept before the caret: the caret goes back after the same count.
  let keptBeforeCaret = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    let keep = false;
    if (ch >= '0' && ch <= '9') {
      if (!hasDecimal) { whole += ch; keep = true; }
      else if (frac.length < 2) { frac += ch; keep = true; }
    } else if (ch === decimal && !hasDecimal) {
      hasDecimal = true;
      keep = true;
    }
    if (keep && i < caret) keptBeforeCaret++;
  }
  const out = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (hasDecimal ? decimal + frac : '');
  let pos = 0;
  for (let kept = 0; pos < out.length && kept < keptBeforeCaret; pos++) {
    if (out[pos] !== group) kept++;
  }
  return { text: out, caret: pos };
}
