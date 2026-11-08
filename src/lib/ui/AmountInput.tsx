import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import { MAX_WHOLE_DIGITS, formatEditableGrouped, isAtOnce, numberMarks, parseAmount, pastedAmount, typedAmount } from './numbers';
import { notifyNotNumber, notifyTooBig, refuseNonNumberPaste, refuseWord } from './toast';

/**
 * A money amount that groups thousands as it is typed (27.781,52 in Romanian, 27,781.52 in English).
 * The thousands marks are added automatically: Backspace or Delete next to one removes the digit beyond it.
 */
export function AmountInput({ value, onChange, name = 'amount' }: { value: number; onChange: (v: number) => void; name?: string }) {
  const lang = useLang();
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatEditableGrouped(value));
  const caret = useRef<number | null>(null);
  const shownLang = useRef(lang);
  /** The selection a change replaces, noted on beforeinput: comparing the texts misplaces a paste that starts like the
      amount it replaces (1.5 over 1.000 read as 15). */
  const replaced = useRef<[number, number] | null>(null);

  // Follow changes from outside (reset, the converter's link, a language switch).
  useEffect(() => {
    if (shownLang.current !== lang || (parseAmount(text) ?? 0) !== value) {
      shownLang.current = lang;
      setText(formatEditableGrouped(value));
    }
    // Only changes from outside: following `text` too would reformat the amount while it is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, lang]);

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current === document.activeElement) ref.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  useEffect(() => {
    const input = ref.current!;
    const note = () => { replaced.current = [input.selectionStart ?? 0, input.selectionEnd ?? 0]; };
    input.addEventListener('beforeinput', note);
    return () => input.removeEventListener('beforeinput', note);
  }, []);

  const { group, decimal } = numberMarks();

  return (
    <input
      ref={ref}
      name={name}
      inputMode="decimal"
      value={text}
      // Lets the stylesheet size the box to the amount (see .income-main input).
      style={{ '--chars': Math.max(text.length, 1) } as CSSProperties}
      aria-invalid={(text !== '' && parseAmount(text) === null) || undefined}
      onPaste={refuseNonNumberPaste}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        const at = el.selectionStart ?? 0;
        if (at !== el.selectionEnd) return;
        // Step over a thousands mark, so the key removes the digit beyond it.
        if (e.key === 'Backspace' && at > 0 && el.value[at - 1] === group) el.setSelectionRange(at - 1, at - 1);
        if (e.key === 'Delete' && el.value[at] === group) el.setSelectionRange(at + 1, at + 1);
      }}
      onChange={(e) => {
        const over = replaced.current;
        replaced.current = null;
        if (refuseWord(text, e.target.value)) return;
        const native = e.nativeEvent as InputEvent;
        const raw = e.target.value;
        const at = e.target.selectionStart ?? raw.length;
        // Pasted, dropped or put in by a phone keyboard's clipboard strip: read whole, in either convention.
        const next = isAtOnce(native)
          ? pastedAmount(text, raw, at, over)
          : typedAmount(text, raw, at, native.inputType === 'insertText' ? native.data : null);
        if ('notAmount' in next) {
          notifyNotNumber(next.notAmount);
          return;
        }
        // Over nine digits before the decimal mark: the keystroke (or paste) is refused, with a word in the corner.
        // Only when it adds digits, so a longer amount coming from elsewhere can still be shortened.
        const whole = (s: string) => s.split(decimal)[0]!.replace(/\D/g, '').length;
        if (whole(next.text) > MAX_WHOLE_DIGITS && whole(next.text) > whole(text)) {
          notifyTooBig();
          return;
        }
        caret.current = Math.min(next.caret, next.text.length);
        setText(next.text);
        // An emptied field counts as 0, and stays empty while typing.
        const v = next.text === '' ? 0 : parseAmount(next.text);
        if (v !== null) onChange(v);
      }}
    />
  );
}
