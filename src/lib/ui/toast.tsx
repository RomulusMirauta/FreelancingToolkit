import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { formatMoney, MAX_AMOUNT } from './numbers';

const EVENT = 'ft:toast';
/** A toast to show after the next reload (session only, so it is not a saved setting). */
const AFTER_RELOAD = 'ft-toast-after-reload';

type Kind = 'tooBig' | 'restored';

const show = (kind: Kind) => window.dispatchEvent(new CustomEvent<Kind>(EVENT, { detail: kind }));

/** Someone typed (or pasted) an amount above the limit: say so, with a smile, in the bottom-left corner. */
export function notifyTooBig(): void {
  show('tooBig');
}

/** Own settings put back after a shared link: the page reloads, then says so. */
export function notifyRestoredAfterReload(): void {
  try {
    sessionStorage.setItem(AFTER_RELOAD, 'restored');
  } catch {
    // no session storage: the reload alone has to do
  }
}

/** The bottom-left toast. Hides itself after a few seconds; × closes it sooner. */
export function Toast() {
  const t = useT().app;
  const [kind, setKind] = useState<Kind | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const open = (k: Kind) => {
      setKind(k);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setKind(null), 6000);
    };
    const onEvent = (e: Event) => open((e as CustomEvent<Kind>).detail);
    window.addEventListener(EVENT, onEvent);
    try {
      const pending = sessionStorage.getItem(AFTER_RELOAD);
      if (pending === 'restored') open('restored');
      sessionStorage.removeItem(AFTER_RELOAD);
    } catch {
      // no session storage
    }
    return () => {
      window.removeEventListener(EVENT, onEvent);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!kind) return null;
  const [title, hint] = kind === 'tooBig' ? [t.tooBig, t.tooBigHint(formatMoney(MAX_AMOUNT))] : [t.restored, t.restoredHint];
  return (
    <div className="toast" role="status">
      <div>
        <strong>{title}</strong>
        <span className="muted small">{hint}</span>
      </div>
      <button type="button" className="toast-close" aria-label={t.close} title={t.close} onClick={() => setKind(null)}>×</button>
    </div>
  );
}
