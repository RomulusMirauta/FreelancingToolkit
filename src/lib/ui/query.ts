/**
 * The address's query string as app state (folded sections, the converter's amount). Changes replace the
 * current history entry and keep the other parameters and the #taxes hash.
 *
 * A change goes into the address at once: a reload started right after it opens the address the browser has then
 * (it picks it before pagehide runs), and the address wins over the saved value. Only a burst waits: Safari throws
 * on a 101st address change within 10 seconds, and holding an arrow key in a field changes a value 30 times a
 * second, so past AT_ONCE changes in 10 seconds the address catches up once every 250 ms. Until then the app reads
 * the query from here, and the address catches up before a reload or when the page is left (see flushQuery).
 */
let pending: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
/** When the address changed, over the last 10 seconds. */
const recent: number[] = [];
/** Address changes made at once within 10 seconds, well under Safari's 100: with the 250 ms ones, at most 80. */
const AT_ONCE = 40;
/** Until the flush at the end of the start (main.tsx), changes wait for it: the start writes the address once. */
let started = false;

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
  const now = Date.now();
  while (recent.length > 0 && now - recent[0]! >= 10_000) recent.shift();
  if (started && timer === undefined && recent.length < AT_ONCE) flushQuery();
  // Past that, at most one address change every 250 ms, with the latest query.
  else timer ??= setTimeout(flushQuery, 250);
}

/**
 * Writes the latest query into the address now: at the end of the start, before a reload or a location.replace,
 * when the page is hidden, and with `hash` (the open page: '#taxes', or '' for the converter) when that changes.
 */
export function flushQuery(hash?: string): void {
  clearTimeout(timer);
  timer = undefined;
  started = true;
  if (pending === null && hash === undefined) return;
  // A whole address on the page's own origin: at …github.io//FreelancingToolkit/ the path alone would read as
  // another site (//FreelancingToolkit/…), which the browser refuses.
  const url = new URL(location.href);
  if (pending !== null) url.search = pending;
  if (hash !== undefined) url.hash = hash;
  try {
    if (url.href !== location.href) {
      history.replaceState(history.state, '', url.href);
      recent.push(Date.now());
    }
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
