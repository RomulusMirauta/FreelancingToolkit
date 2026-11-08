import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFold } from './folds';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A card that folds: the title with a chevron, and a short summary beside it that stays readable
 * while the card is folded. Open by default; a folded card is remembered in the address (see folds.ts).
 * Opening and closing slide the body's height (measured, so any content works); a closing card stays
 * open in the DOM until its body has slid shut. No motion when the system asks for less. A folded card the
 * browser opens by itself (find in page, a link to text in it) counts as opened.
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
      // Opening ends a close still in progress, before the first frame (this is a layout effect).
      // eslint-disable-next-line react/set-state-in-effect
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
      // The finished animation keeps the body shut until the card closes, then goes (below).
      running.current.onfinish = () => {
        body.style.overflow = '';
        setClosing(false);
      };
    }
  }, [open]);

  // Once the card has shut, its finished close animation goes: kept, it left a card the browser opens by itself
  // with a 0 px, transparent body whose fields lay over the cards below and took their clicks and typing.
  // Only a finished one: in the commit that starts a close, `closing` is still false and the new animation runs.
  useLayoutEffect(() => {
    if (open || closing || running.current?.playState !== 'finished') return;
    running.current.cancel();
    running.current = null;
  }, [open, closing]);

  return (
    <details
      className={`card fold${className ? ` ${className}` : ''}`}
      open={open || closing}
      // The browser opened a folded card to show a match: the app follows (the address, Tools), without sliding it
      // open again.
      onToggle={(e) => {
        if (!e.currentTarget.open || open || closing) return;
        was.current = true;
        setOpen(true);
      }}
    >
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
