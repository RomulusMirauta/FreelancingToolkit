/**
 * Visit counts with GoatCounter (https://www.goatcounter.com): free, open source, no cookies, so no consent
 * banner. Sent: the page (/ or /taxes) and a few event names (copy-link, install-app, add-currency), never
 * the address's settings or amounts. Off while GOATCOUNTER is empty, in development and on localhost; offline
 * visits are not counted.
 */
export const GOATCOUNTER = 'romulusmirauta';

type Count = { path: string; title?: string; event?: boolean };
declare global {
  interface Window {
    goatcounter?: { count?: (c: Count) => void; no_onload?: boolean };
  }
}

/** Counts made before count.js has loaded, sent once it has. */
const queue: Count[] = [];
let started = false;

export const analyticsOn = (code = GOATCOUNTER, host = location.hostname, prod = import.meta.env.PROD) =>
  code !== '' && prod && host !== 'localhost' && host !== '127.0.0.1';

/** Loads count.js once; it counts nothing by itself (no_onload), the app says what to count. */
export function startAnalytics(): void {
  if (started || !analyticsOn()) return;
  started = true;
  window.goatcounter = { no_onload: true };
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  s.onload = () => queue.splice(0).forEach(send);
  document.head.append(s);
}

const send = (c: Count) => {
  try {
    window.goatcounter?.count?.(c);
  } catch {
    // blocked or offline: nothing is counted
  }
};

const count = (c: Count) => {
  if (!started) return;
  if (window.goatcounter?.count) send(c);
  else queue.push(c);
};

/** A page view: the open page only, without the address's settings. */
export const trackView = (view: 'converter' | 'taxes') =>
  count({ path: view === 'taxes' ? '/taxes' : '/', title: view === 'taxes' ? 'Taxes' : 'Converter' });

/** Something done in the app, e.g. "copy-link" or "add-currency/TRY". */
export const trackEvent = (name: string) => count({ path: name, title: name, event: true });
