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

let waiting = false;

/** Calls `reload` once the page is hidden or not in use: looked at now, when the focus moves and every second. */
export function reloadWhenFree(reload: () => void): void {
  if (waiting) return;
  waiting = true;
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
