import { currencySymbol } from './currencies';

/** An ISO code with its symbol as a small hint after it ("EUR €"), when the symbol is unambiguous. */
export function CurrencyCode({ code }: { code: string }) {
  const symbol = currencySymbol(code);
  return (
    <>
      {code}
      {symbol && <span className="cur-sym" aria-hidden="true">{symbol}</span>}
    </>
  );
}
