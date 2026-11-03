/**
 * Visit counts with GoatCounter (https://www.goatcounter.com): free, open source, no cookies, so no consent
 * banner. Sent: the page (/ or /taxes), a few event names (copy-link, install-app, add-currency), the screen
 * width and the referring site (origin only); never the address's settings or amounts. GoatCounter's count.js
 * is not used because it always sends the whole query string (?amount=…&platform=…). Off in development, on
 * localhost and for automated browsers; offline visits are not counted.
 */
export const GOATCOUNTER = 'romulusmirauta';

export type Count = { path: string; title: string; event?: boolean };

export const analyticsOn = (code = GOATCOUNTER, host = location.hostname, prod = import.meta.env.PROD) =>
  code !== '' && prod && host !== 'localhost' && host !== '127.0.0.1';

/** The counting address: only what is listed above, nothing from the page's own address. */
export function countUrl(c: Count, env: { referrer: string; origin: string; width: number; code?: string }): string {
  const q = new URLSearchParams({ p: c.path, t: c.title, s: String(env.width), b: '0' });
  if (c.event) q.set('e', 'true');
  else if (env.referrer) {
    try {
      const from = new URL(env.referrer).origin;
      if (from !== env.origin) q.set('r', from);
    } catch {
      // not a URL: no referrer
    }
  }
  q.set('rnd', Math.random().toString(36).slice(2, 7));
  return `https://${env.code ?? GOATCOUNTER}.goatcounter.com/count?${q}`;
}

const count = (c: Count) => {
  if (!analyticsOn() || navigator.webdriver) return;
  try {
    const url = countUrl(c, { referrer: document.referrer, origin: location.origin, width: screen.width });
    if (!navigator.sendBeacon?.(url)) new Image().src = url;
  } catch {
    // blocked or offline: nothing is counted
  }
};

/** A page view: the open page only, without the address's settings. */
export const trackView = (view: 'converter' | 'taxes') =>
  count({ path: view === 'taxes' ? '/taxes' : '/', title: view === 'taxes' ? 'Taxes' : 'Converter' });

/** Something done in the app, e.g. "copy-link" or "add-currency/TRY". */
export const trackEvent = (name: string) => count({ path: name, title: name, event: true });
