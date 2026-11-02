import type { ReactNode } from 'react';
import { useFold } from './folds';

/**
 * A card that folds: the title with a chevron, and a short summary beside it that stays readable
 * while the card is folded. Open by default; a folded card is remembered in the address (see folds.ts).
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
  return (
    <details className={`card fold${className ? ` ${className}` : ''}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <h2>{title}</h2>
        {summary && <span className="muted">{summary}</span>}
      </summary>
      {children}
    </details>
  );
}
