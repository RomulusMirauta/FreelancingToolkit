// import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';
import { PAGE_FOLDS, PAGE_KEYS, PAGE_QUERY, type Page } from '../../lib/ui/settingsKeys';
import { writeQuery } from '../../lib/ui/query';
import { clearFolds, useClosedFolds, useFoldAll } from '../../lib/ui/folds';
import { useHoverMenu } from '../../lib/ui/useHoverMenu';
import { STORAGE_PREFIX, useIsModified } from '../../lib/ui/usePersistentState';

export { APP_KEYS, PAGE_FOLDS, PAGE_KEYS, type Page } from '../../lib/ui/settingsKeys';

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
  // Folded sections count as changes too: a reset unfolds them (the page's own, or all).
  const closed = useClosedFolds();
  const modified = useIsModified() || closed.size > 0;
  const pageModified = useIsModified(PAGE_KEYS[page]) || PAGE_FOLDS[page].some((id) => closed.has(id));
  const { anyOpen, toggleAll } = useFoldAll();
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

  const menu = useHoverMenu();

  return (
    <div className={`reset-wrap hover-menu${menu.open ? ' open' : ''}`} ref={menu.rootRef} {...menu.hoverProps}>
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
      {/* Hidden behind "Tools" until hovered or clicked; opens upwards. */}
      <div className="reset-row menu-pop" role="menu" aria-label={t.menu}>
        <button
          type="button"
          className="reset-app"
          aria-label={anyOpen ? t.foldAll : t.unfoldAll}
          title={anyOpen ? t.foldAllTitle : t.unfoldAllTitle}
          onClick={toggleAll}
        >
          <span className={`icon fold-icon${anyOpen ? '' : ' closed'}`} aria-hidden="true" />
          <ResetLabel full={anyOpen ? t.foldAll : t.unfoldAll} short={anyOpen ? t.foldShort : t.unfoldShort} />
        </button>
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
      <button type="button" className="reset-app menu-trigger" aria-haspopup="menu" aria-expanded={menu.open} onClick={menu.toggle} aria-label={t.menu}>
        <span className="icon" aria-hidden="true"><ToolsIcon /></span>
        <span>{t.menu}</span>
        {/* Always there to draw the eye; it pulses while something can be reset. */}
        <span className={`dot${modified ? ' pulse' : ''}`} aria-label={modified ? t.menuDot : undefined} aria-hidden={modified ? undefined : true} />
        <span className="chev up" aria-hidden="true" />
      </button>
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

/** Clears the page's saved settings, unfolds its sections and reloads on the same page. */
function resetPage(page: Page) {
  clearFolds(PAGE_FOLDS[page]);
  writeQuery((params) => PAGE_QUERY[page].forEach((k) => params.delete(k)));
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
  // No query string: a shared link's settings must not come back after a reset.
  location.replace(location.pathname);
}

/** A wrench, for the "Tools" button. */
function ToolsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
