import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';
import { PAGE_FOLDS, PAGE_KEYS, PAGE_QUERY, type Page } from '../../lib/ui/settingsKeys';
import { writeQuery } from '../../lib/ui/query';
import { DEFAULT_SOURCE } from '../converter/Converter';
import { SOURCE_PARAMS, incomeFollowsConverter, sourceFollowsIncome } from '../converter/sourceQuery';
import { INCOME_QUERY } from '../taxes/Taxes';
import { clearFolds, useClosedFolds, useFoldAll } from '../../lib/ui/folds';
import { useHoverMenu } from '../../lib/ui/useHoverMenu';
import { STORAGE_PREFIX, useIsModified } from '../../lib/ui/usePersistentState';
import { notifyLater } from '../../lib/ui/toast';
import { saveBeforeReset } from '../../lib/ui/undoReset';
import { settleSharedLink } from '../../lib/ui/share';

export { APP_KEYS, PAGE_FOLDS, PAGE_KEYS, type Page } from '../../lib/ui/settingsKeys';

/**
 * Floating "Tools" menu: fold all, "Reset tab" and "Reset app".
 * "Reset tab" is instant and clears only the open page's settings. "Reset app" asks first, in a small panel
 * in the page (window.confirm is suppressed in embedded browsers such as VS Code's); Cancel has the focus,
 * Esc or a click outside closes it.
 */
export function ResetApp({ page }: { page: Page }) {
  const t = useT().reset;
  // Folded sections count as changes too: a reset unfolds them (the page's own, or all).
  const closed = useClosedFolds();
  const modified = useIsModified() || closed.size > 0;
  const pageModified = useIsModified(PAGE_KEYS[page]) || PAGE_FOLDS[page].some((id) => closed.has(id));
  const { anyOpen, toggleAll } = useFoldAll();
  const [asking, setAsking] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const menu = useHoverMenu();

  useEffect(() => {
    if (!asking) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAsking(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!menu.rootRef.current?.contains(e.target as Node)) setAsking(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [asking, menu.rootRef]);

  return (
    // hoverProps only reads refs inside its event handlers, not while rendering.
    // eslint-disable-next-line react/refs
    <div className={`reset-wrap hover-menu${menu.open && !asking ? ' open' : ''}${asking ? ' asking' : ''}`} ref={menu.rootRef} {...menu.hoverProps}>
      {asking && (
        <div className="reset-confirm" role="alertdialog" aria-modal="false" aria-labelledby="reset-title" aria-describedby="reset-desc">
          <h2 id="reset-title">{t.confirmTitle}</h2>
          <p id="reset-desc">{t.confirmText}</p>
          <div className="actions">
            <button ref={cancelRef} type="button" className="secondary" onClick={() => setAsking(false)}>{t.confirmCancel}</button>
            <button type="button" className="danger" onClick={resetApp}>{t.confirmOk}</button>
          </div>
        </div>
      )}
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
          onClick={() => {
            menu.setOpen(false);
            setAsking(true);
          }}
        >
          <span className="icon" aria-hidden="true">↺</span>
          <ResetLabel full={t.label} short={t.short} />
        </button>
      </div>
      <button type="button" className="reset-app menu-trigger" aria-haspopup="menu" aria-expanded={menu.open} onClick={menu.toggle} aria-label={t.menu}>
        <span className="icon" aria-hidden="true"><ToolsIcon /></span>
        <span className="menu-word">{t.menu}</span>
        {/* Always there to draw the eye; it pulses while something can be reset. */}
        <span className={`dot${modified ? ' pulse' : ''}`} aria-label={modified ? t.menuDot : undefined} aria-hidden={modified ? undefined : true} />
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
  // Instant, without asking: after the reload a toast offers to undo it.
  saveBeforeReset();
  notifyLater('pageReset', page);
  clearFolds(PAGE_FOLDS[page]);
  // The tax income follows the converter: if it was only following it (not typed on the tax page), it goes
  // back with the converter, so the two pages still agree after the reset.
  // And the other way: a converter amount that only came from the tax page's income goes back with it.
  const withIncome = page === 'converter' && incomeFollowsConverter(DEFAULT_SOURCE);
  const withSource = page === 'taxes' && sourceFollowsIncome();
  writeQuery((params) => {
    PAGE_QUERY[page].forEach((k) => params.delete(k));
    if (withIncome) INCOME_QUERY.names.forEach((k) => params.delete(k));
    if (withSource) SOURCE_PARAMS.forEach((k) => params.delete(k));
  });
  try {
    if (withIncome) localStorage.removeItem(INCOME_QUERY.key);
    if (withSource) localStorage.removeItem('ft.source');
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
  // No query string: a shared link's settings must not come back after a reset. Nor its banner, whose "Back to
  // my settings" would undo the reset.
  settleSharedLink();
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
