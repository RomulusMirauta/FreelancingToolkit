import { flushQuery, writeQuery } from './query';
import { APP_QUERY, PAGE_QUERY } from './settingsKeys';
import { sharedLinkState } from './share';
import { storage } from './storage';

/**
 * The reload onto a new version. The app updates itself: once a new version's service worker has taken over,
 * vite-plugin-pwa asks for a reload (main.tsx). The site is rebuilt every banking day, so a returning visitor gets
 * that a few seconds after opening the app, often while typing. The reload waits while the page is in use and comes
 * once nothing is left that it would lose, or at once when the page is hidden. Meanwhile the page keeps working: the
 * app is one bundle, already loaded.
 */

/**
 * What a reload would lose besides a field with the focus: a press under way (its click), a menu, list or panel
 * open, a toast with a button (Undo after "Reset tab"), details opened on the page (the fold cards are saved).
 */
const OPEN = ':active, [aria-expanded="true"], [role="dialog"], [role="alertdialog"], .toast-action, details[open]:not(.fold)';

function inUse(): boolean {
  return Boolean(document.activeElement?.matches('input, select, textarea')) || document.querySelector(OPEN) !== null;
}

/** Set by the first call: the page reloads once, however often it is asked to. */
let asked = false;

/** Calls `reload` once the page is hidden or not in use: looked at now, when the focus moves and every second. */
export function reloadWhenFree(reload: () => void): void {
  if (asked) return;
  asked = true;
  let waiting = true;
  const check = () => {
    if (!waiting || (document.visibilityState !== 'hidden' && inUse())) return;
    waiting = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
    document.removeEventListener('focusout', checkSoon);
    reload();
  };
  // During focusout the focus has left one element and not yet reached the next (Tab to the next field).
  const checkSoon = () => setTimeout(check);
  const timer = setInterval(check, 1000);
  document.addEventListener('visibilitychange', check);
  document.addEventListener('focusout', checkSoon);
  check();
}

/**
 * The update reloads every window of the app, also one left open for days. Each opens on the saved settings, not on
 * its own address, which would put what it showed back over settings changed since in another window, or over a
 * shared link's waiting in another tab. ?fold= and #taxes stay, as only the address has them; so does the whole
 * address while a setting is kept for this page only (storage.ts), as the address is its only other copy, and in a
 * tab where a shared link waits for a choice: another window's start may have put the own settings back since
 * (share.ts), and this address brings the link's back.
 */
export function reloadForUpdate(): void {
  reloadWhenFree(() => {
    if (storage.allSaved() && !sharedLinkState().opened) writeQuery((p) => [...APP_QUERY, ...PAGE_QUERY.converter, ...PAGE_QUERY.taxes].forEach((k) => p.delete(k)));
    flushQuery();
    location.reload();
  });
}

/**
 * The new version's service worker taking over the page is the update too: a window that registered while another
 * window's update was installing gets no "activated" from workbox-window, which looks for an update only once
 * register() has resolved. Not on a first visit, where the worker takes over a page that had none.
 */
export function reloadOnTakeover(): void {
  // None over plain http (the LAN preview) or in a sandboxed frame.
  const sw = navigator.serviceWorker;
  if (sw?.controller) sw.addEventListener('controllerchange', reloadForUpdate);
}
