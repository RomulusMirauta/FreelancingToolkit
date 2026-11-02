// import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';
import { STORAGE_PREFIX, useIsModified } from '../../lib/ui/usePersistentState';

export type Page = 'converter' | 'taxes';

/**
 * The settings each page owns, for "Reset page". Working time is shown on the converter, so it goes with it;
 * language and theme belong to the whole app and only "Reset app" clears them.
 */
export const PAGE_KEYS: Record<Page, readonly string[]> = {
  converter: ['ft.source', 'ft.columns', 'ft.addedCurrencies', 'ft.customRates', 'ft.work'],
  taxes: ['ft.taxIncome', 'ft.taxOptions', 'ft.taxRef', 'ft.sideJob', 'ft.solverTarget'],
};

/** Settings of the whole app, cleared only by "Reset app". */
export const APP_KEYS: readonly string[] = ['ft.lang', 'ft.theme'];

/**
 * Floating "Reset tab" and "Reset app" buttons, stacked: one click resets instantly.
 * "Reset tab" clears only the open page's settings and stays on it.
 *
 * The confirmation panel below is commented out on purpose (the user asked for an instant reset).
 * To bring it back, uncomment the import, the state/effect, the panel, and switch onClick to
 * `setAsking(!asking)`. It is an in-page panel because window.confirm is suppressed in
 * embedded browsers such as VS Code's.
 */
export function ResetApp({ page }: { page: Page }) {
  const t = useT().reset;
  const modified = useIsModified();
  const pageModified = useIsModified(PAGE_KEYS[page]);
  // const [asking, setAsking] = useState(false);
  // const cancelRef = useRef<HTMLButtonElement>(null);
  //
  // useEffect(() => {
  //   if (!asking) return;
  //   cancelRef.current?.focus();
  //   const onKey = (e: KeyboardEvent) => {
  //     if (e.key === 'Escape') setAsking(false);
  //   };
  //   window.addEventListener('keydown', onKey);
  //   return () => window.removeEventListener('keydown', onKey);
  // }, [asking]);

  return (
    <div className="reset-wrap">
      {/* {asking && (
        <div className="reset-confirm" role="alertdialog" aria-labelledby="reset-title" aria-describedby="reset-desc">
          <h2 id="reset-title">Reset the app?</h2>
          <p id="reset-desc">Your currencies, custom rates, working time and tax income go back to the defaults.</p>
          <div className="actions">
            <button ref={cancelRef} type="button" className="secondary" onClick={() => setAsking(false)}>Cancel</button>
            <button type="button" className="danger" onClick={resetApp}>Reset</button>
          </div>
        </div>
      )} */}
      <div className="reset-row">
        <button
          type="button"
          className="reset-app"
          disabled={!pageModified}
          aria-label={t.pageLabel}
          title={pageModified ? t.pageTitleOn(page) : t.pageTitleOff(page)}
          onClick={() => resetPage(page)}
        >
          <span className="icon" aria-hidden="true">↺</span>
          <ResetLabel full={t.pageLabel} short={t.pageShort} />
        </button>
        <button
          type="button"
          className="reset-app"
          disabled={!modified}
          aria-label={t.label}
          title={modified ? t.titleOn : t.titleOff}
          onClick={resetApp}
        >
          <span className="icon" aria-hidden="true">↺</span>
          <ResetLabel full={t.label} short={t.short} />
        </button>
      </div>
    </div>
  );
}

/** The full label, or a one-word one on phones so the floating buttons don't cover the page. */
function ResetLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="reset-full">{full}</span>
      <span className="reset-short" aria-hidden="true">{short}</span>
    </>
  );
}

/** Clears the page's saved settings and reloads on the same page. */
function resetPage(page: Page) {
  try {
    for (const key of PAGE_KEYS[page]) localStorage.removeItem(key);
  } catch {
    // storage unavailable: nothing was saved
  }
  location.reload();
}

/** Clears every saved setting and reloads on the converter. */
function resetApp() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable: nothing was saved, so the reload alone restores the defaults
  }
  location.replace(location.pathname + location.search);
}
