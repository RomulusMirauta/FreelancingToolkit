import { currencySymbol } from './currencies';

/** An ISO code with its symbol as a small hint after it ("EUR €"), when the symbol is unambiguous. */
export function CurrencyCode({ code }: { code: string }) {
  const symbol = currencySymbol(code);
  return (
    <>
      {code}
      {/* A word joiner (no width, no line break) starts the pill: the text read "RONlei", one word, which checks that
          match a name word by word (axe) don't find in "Currency: RON lei". In the hidden pill it stays out of the
          names screen readers make from the text (the chips, the column headers). */}
      {symbol && <span className="cur-sym" aria-hidden="true">{'\u2060'}{symbol}</span>}
    </>
  );
}
