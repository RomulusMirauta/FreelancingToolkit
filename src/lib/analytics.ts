/**
 * Visit counts with GoatCounter (https://www.goatcounter.com): free, open source, no cookies, so no consent
 * banner. Sent: the page (/ or /taxes), a few event names (copy-link, install-app, add-currency), the screen
 * width and the referring site (origin only); never the address's settings or amounts. Like any request, a count
 * also carries the IP address, browser and language, from which GoatCounter keeps totals. The README's Privacy
 * section repeats all this: keep the two in step. GoatCounter's count.js is not used because it always sends the
 * whole query string (?amount=…&platform=…). Only on the live site: not in development, on localhost, on a phone
 * test over the local network or on a copy hosted elsewhere; not for automated browsers; offline visits are not
 * counted.
 */
export const GOATCOUNTER = 'romulusmirauta';
/** The only host whose visits are counted; a copy sets its own, with its own code (README, "Deploying your own copy"). */
export const LIVE_HOST = 'romulusmirauta.github.io';

export type Count = { path: string; title: string; event?: boolean };

export const analyticsOn = (code = GOATCOUNTER, host = location.hostname, prod = import.meta.env.PROD) =>
  code !== '' && prod && host === LIVE_HOST;

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
