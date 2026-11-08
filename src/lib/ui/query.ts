/**
 * The address's query string as app state (folded sections, the converter's amount). Changes replace the
 * current history entry and keep the other parameters and the #taxes hash.
 *
 * A change reaches the address a moment later, not at once: Safari throws on a 101st address change within 10
 * seconds, and holding an arrow key in a field changes a value 30 times a second. Until then the app reads the
 * query from here, and the address catches up before a reload or when the page is left (see flushQuery).
 */
let pending: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function readQuery(): URLSearchParams {
  return new URLSearchParams(pending ?? location.search);
}

export function writeQuery(change: (params: URLSearchParams) => void): void {
  const params = readQuery();
  change(params);
  // Commas and colons stay readable: ?fold=converter,fees&rates=USD:4.9, not converter%2Cfees and USD%3A4.9.
  const query = readable(params);
  const next = query ? `?${query}` : '';
  if (next === (pending ?? location.search)) return;
  pending = next;
  // At most one address change every 250 ms, with the latest query.
  timer ??= setTimeout(flushQuery, 250);
}

/**
 * Writes the latest query into the address now: before a reload or a location.replace, when the page is hidden,
 * and with `hash` (the open page: '#taxes', or '' for the converter) when that changes.
 */
export function flushQuery(hash?: string): void {
  clearTimeout(timer);
  timer = undefined;
  if (pending === null && hash === undefined) return;
  // A whole address on the page's own origin: at …github.io//FreelancingToolkit/ the path alone would read as
  // another site (//FreelancingToolkit/…), which the browser refuses.
  const url = new URL(location.href);
  if (pending !== null) url.search = pending;
  if (hash !== undefined) url.hash = hash;
  try {
    if (url.href !== location.href) history.replaceState(history.state, '', url.href);
    pending = null;
  } catch {
    // Refused (Safari's limit): the app keeps reading the query from here, and the address gets it a second later.
    timer = setTimeout(() => flushQuery(hash), 1000);
  }
}

/** The query string with commas and colons left as they are (both are fine in a query). */
export function readable(params: URLSearchParams): string {
  return params.toString().replace(/%2C/gi, ',').replace(/%3A/gi, ':');
}
