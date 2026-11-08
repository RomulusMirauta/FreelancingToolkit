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
/**
 * formatNumber's formatters for the language in use, by decimals: building one takes about 40 times as long as using
 * it, and every key typed on the tax page formats over 100 figures (the § sources' among them).
 */
let fmtCounts = new Map<number, Intl.NumberFormat>();

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
  fmtCounts = new Map();
}

/** Under half a ban it is 0,00: Intl writes a loss that small, and −0, as -0,00. */
export function formatMoney(x: number): string {
  return fmt2.format(Math.abs(x) < 0.005 ? 0 : x);
}

/** A count such as days or a percentage: up to `decimals` decimals, none when it is whole (228, 5,5). */
export function formatNumber(x: number, decimals = 1): string {
  let fmt = fmtCounts.get(decimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: decimals });
    fmtCounts.set(decimals, fmt);
  }
  return fmt.format(x);
}

export function formatRate(x: number): string {
  return fmtRate.format(x);
}

/**
 * A number with no grouping and the language's decimal mark. Intl rounds the number's shortest decimal form, as
 * formatMoney does; Math.round(x * 100) rounds the binary value, which turns 1.005 into 1 while 1,01 is shown.
 */
function plain(x: number, as: NumberLang, digits: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(as === 'ro' ? 'ro-RO' : 'en-GB', { useGrouping: false, ...digits }).format(x);
}

/** A plain number for editing (no grouping, at most 2 decimals), with the language's decimal mark. */
export function formatEditable(x: number): string {
  return plain(x, lang, { maximumFractionDigits: 2 });
}

/**
 * Leaving a field marked invalid (out of range, or not a number) puts back the value in use, the last valid one, so
 * the field never shows a figure the app isn't using ("25" hours a day while 2 apply). It is also the text
 * refuseWordIn goes back to.
 */
export function showApplied(input: HTMLInputElement, applied: number): void {
  if (input.getAttribute('aria-invalid') !== 'true') return;
  input.value = formatEditable(applied);
  input.dataset.accepted = input.value;
  input.setAttribute('aria-invalid', 'false');
}

/**
 * A rate for editing: every digit kept, no grouping, with the language's decimal mark (4,815 in Romanian).
 * Not String(x): its "4.815" reads as 4815 in Romanian, and below 0.000001 it writes an exponent.
 */
export function formatEditableRate(x: number, as: NumberLang = lang): string {
  return plain(x, as, { maximumSignificantDigits: 21 });
}

/** An amount rounded to 2 decimals the way formatMoney shows it, so the figure kept is the figure on screen. */
export function roundMoney(x: number): number {
  return Number(plain(x, 'en', { maximumFractionDigits: 2 }));
}

/**
 * Parses what people type, in either convention: "1200", "1,200.50", "1.200,50", "1200,5", "1 200".
 * When there is only one kind of separator, the language decides:
 * - EN: a lone comma is decimal unless it groups thousands ("1,200" = 1200); "1.5" is decimal.
 * - RO: a lone comma is decimal ("1,200" = 1.2); dots that group thousands ("1.200") mean 1200.
 * Returns null for anything that is not a non-negative number.
 */
export function parseAmount(text: string, as: NumberLang = lang): number | null {
  const s = plainDigits(text, as);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** What parseAmount reads, written plainly: its digits as they are, "." for the decimal mark ("1.200,50" → "1200.50"). */
function plainDigits(text: string, as: NumberLang): string | null {
  // Swiss amounts group with ’ (1’234.50).
  let s = text.replace(/[\s '’]/g, '');
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
  return /^\d*\.?\d*$/.test(s) && s !== '.' ? s : null;
}

/**
 * An amount as it comes when copied, without the currency sign, code or unit around it: "$1,234.56", "USD 2,500.00",
 * "1.234,56 lei", "12,5%". A decimal mark just before the first digit stays (".50"), and so does everything between
 * the first and the last digit, so "1e3" or a date still doesn't read as an amount.
 */
export function bareAmount(text: string): string {
  return text.replace(/^\D*?(?=[.,]?\d)|\D+$/g, '');
}

/** The language's marks: Romanian groups with "." and uses "," for decimals, English the other way round. */
export function numberMarks(as: NumberLang = lang): { group: string; decimal: string } {
  return as === 'ro' ? { group: '.', decimal: ',' } : { group: ',', decimal: '.' };
}

/** An amount for editing, thousands grouped: 27.781,52 (RO) or 27,781.52 (EN). */
export function formatEditableGrouped(x: number, as: NumberLang = lang): string {
  return groupTyped(plain(x, as, { maximumFractionDigits: 2 }), undefined, as).text;
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

/**
 * Text put into a field at once: pasted, dropped, or typed in whole by a phone keyboard's clipboard strip, which
 * sends it as one `insertText` with no paste event.
 */
export const isAtOnce = (e: { inputType?: string; data?: string | null }): boolean =>
  e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop' || (e.inputType === 'insertText' && (e.data?.length ?? 0) > 1);

/**
 * A keystroke in an amount: the thousands marks redone around it (groupTyped). A digit typed into a field that shows
 * 0, before or after the 0, replaces it, and the other language's decimal key ("." in Romanian) types a decimal mark.
 * `replaceZero`: false when the 0 isn't the one the field showed when it got focus, but one an edit left or undo put
 * back, which stays (50, its 5 deleted and 6 typed, is 60).
 */
export function typedAmount(
  before: string,
  after: string,
  caret: number,
  key: string | null,
  as: NumberLang = lang,
  replaceZero = true,
): { text: string; caret: number } {
  const { group, decimal } = numberMarks(as);
  if (replaceZero && before === '0' && /^(0\d|\d0)$/.test(after)) return { text: after[0] === '0' ? after[1]! : after[0]!, caret: 1 };
  if (key === group && caret > 0) after = after.slice(0, caret - 1) + decimal + after.slice(caret);
  return groupTyped(after, caret, as);
}

/**
 * Where a change went (`start` to `end` in `before`) and what it put there: over `replaced`, the selection noted just
 * before the change, when the change matches it; otherwise where the two texts differ (their common start and end
 * left out), which misplaces text that starts or ends like what it replaced ("30 EUR" over 30 reads as " EUR" put
 * after it).
 */
export function insertedAt(
  before: string,
  after: string,
  replaced: readonly [number, number] | null,
): { start: number; end: number; added: string } {
  let [start, end] = replaced ?? [0, -1];
  const fits = start <= end && end <= before.length && after.length >= start + before.length - end &&
    after.startsWith(before.slice(0, start)) && after.endsWith(before.slice(end));
  if (!fits) {
    // The common start and end of the two texts, as insertedText finds them.
    start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    let same = 0;
    while (same < before.length - start && same < after.length - start && before.at(-1 - same) === after.at(-1 - same)) same++;
    end = before.length - same;
  }
  return { start, end, added: after.slice(start, after.length - (before.length - end)) };
}

/**
 * Text put into an amount at once (isAtOnce), read as a whole: in either convention, without the currency sign, code
 * or unit around it (bareAmount). Over the whole field, or over a field that shows 0, it becomes that amount, rounded
 * to 2 decimals ("$1,234.56" → 1.234,56 in Romanian); next to digits already there, its digits join them, so the
 * field's own thousands marks are never read as decimals (0 pasted after 10.000 → 100.000). `replaced` is the
 * selection the text went over, noted just before the change; without it, or when the change doesn't match it, the
 * change is found by comparing the texts. `notAmount`: text that doesn't read as an amount ("1e3"), to be refused.
 */
export function pastedAmount(
  before: string,
  after: string,
  caret: number,
  replaced: readonly [number, number] | null,
  as: NumberLang = lang,
): { text: string; caret: number } | { notAmount: string } {
  const { start, end, added } = insertedAt(before, after, replaced);
  // Nothing to read (a mark, a space): as if typed.
  if (!/\d/.test(added)) return groupTyped(after, caret, as);
  const digits = plainDigits(bareAmount(added), as);
  if (digits === null) return { notAmount: added };
  const head = before === '0' ? '' : before.slice(0, start);
  const tail = before === '0' ? '' : before.slice(end);
  const n = Number(digits);
  if (head === '' && tail === '' && Number.isFinite(n)) return { text: formatEditableGrouped(n, as), caret: Infinity };
  // Beside other digits, or too long for a number (the field then refuses it as too big): its digits as if typed.
  const typed = digits.replace('.', numberMarks(as).decimal);
  return groupTyped(head + typed + tail, head.length + typed.length, as);
}
