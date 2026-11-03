import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFold } from './folds';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A card that folds: the title with a chevron, and a short summary beside it that stays readable
 * while the card is folded. Open by default; a folded card is remembered in the address (see folds.ts).
 * Opening and closing slide the body's height (measured, so any content works); a closing card stays
 * open in the DOM until its body has slid shut. No motion when the system asks for less.
 */
export function Fold({ id, title, summary, className, children }: {
  /** Short and stable: it appears in the address (?fold=converter,fees). */
  id: string;
  title: ReactNode;
  summary?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useFold(id);
  const [closing, setClosing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const was = useRef(open);
  const running = useRef<Animation | null>(null);

  // Runs for every change of `open`: a click here, "fold all" in Tools, or a reset.
  useLayoutEffect(() => {
    if (was.current === open) return;
    was.current = open;
    const body = bodyRef.current;
    running.current?.cancel();
    if (!body || reducedMotion() || typeof body.animate !== 'function') {
      setClosing(false);
      return;
    }
    const height = `${body.scrollHeight}px`;
    body.style.overflow = 'hidden';
    const done = () => {
      body.style.overflow = '';
      running.current = null;
    };
    if (open) {
      setClosing(false);
      running.current = body.animate(
        [{ height: '0px', opacity: 0 }, { height, opacity: 1 }],
        { duration: 280, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
      running.current.onfinish = done;
    } else {
      setClosing(true);
      running.current = body.animate(
        [{ height, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 200, easing: 'cubic-bezier(0.3, 0, 1, 1)', fill: 'forwards' },
      );
      // The finished animation keeps the body shut until the card closes; it is cancelled on the next change.
      running.current.onfinish = () => {
        body.style.overflow = '';
        setClosing(false);
      };
    }
  }, [open]);

  return (
    <details className={`card fold${className ? ` ${className}` : ''}`} open={open || closing}>
      {/* The click is handled here, not by the browser, so a closing card can animate before it shuts. */}
      <summary
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        <h2>{title}</h2>
        {summary && <span className="muted">{summary}</span>}
      </summary>
      <div className="fold-body" ref={bodyRef}>
        {children}
      </div>
    </details>
  );
}
