/** Converts between two currencies through RON. `rates` are RON per 1 unit. */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const ronFrom = from === 'RON' ? 1 : rates[from];
  const ronTo = to === 'RON' ? 1 : rates[to];
  if (ronFrom === undefined || ronTo === undefined) throw new Error(`No rate for ${from} or ${to}`);
  return (amount * ronFrom) / ronTo;
}

/** Cross rate shown to the user: how many `to` one `from` buys. */
export function crossRate(from: string, to: string, rates: Record<string, number>): number {
  return convert(1, from, to, rates);
}
