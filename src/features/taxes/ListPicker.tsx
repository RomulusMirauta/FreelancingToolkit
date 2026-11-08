import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { fold } from '../converter/CurrencyPicker';

/**
 * A short fixed list (periods, dependants): looks like the currency button and opens the same kind of panel
 * (keyboard: ↑ ↓ Enter Esc). `align="right"` opens it towards the left, for choices at a card's right edge.
 * Longer lists can add a search box (`search`) and two columns (`columns={2}`, read down the first column
 * then the second). The panel opens upwards when there is no room below, so it never lengthens the page.
 */
export function ListPicker<T extends string | number>({ value, options, onChange, label, align = 'left', search, columns = 1 }: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  align?: 'left' | 'right';
  search?: { placeholder: string; empty: (q: string) => string };
  columns?: 1 | 2;
}) {
  const index = options.findIndex((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(index);
  const [up, setUp] = useState(false);
  /** How far the panel slides left to stay inside the window (near the right edge, on phones). */
  const [shift, setShift] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options[index]?.label ?? String(value);
  const q = fold(query.trim());
  const shown = q ? options.filter((o) => fold(o.label).includes(q)) : options;

  const show = () => {
    setQuery('');
    setActive(Math.max(index, 0));
    setUp(false);
    setShift(0);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const pick = (v: T) => {
    onChange(v);
    close();
  };

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) (searchRef.current ?? listRef.current)?.focus();
  }, [open]);

  // Open upwards when the panel would run past the bottom of the window and fits above.
  useLayoutEffect(() => {
    if (!open || up || !popRef.current || !buttonRef.current) return;
    const pop = popRef.current.getBoundingClientRect();
    const button = buttonRef.current.getBoundingClientRect();
    if (pop.bottom > window.innerHeight && button.top - pop.height - 6 > 0) setUp(true);
    const over = pop.right - (document.documentElement.clientWidth - 8);
    if (over > 0) setShift(Math.min(over, pop.left - 8));
  }, [open, up]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(active + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === 'Enter' || (e.key === ' ' && !search)) {
      e.preventDefault();
      if (shown[active]) pick(shown[active].value);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      close();
    }
  };

  return (
    <div className="add-currency" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="currency-btn"
        aria-label={`${label}: ${current}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show();
          }
        }}
      >
        {current}
      </button>
      {open && (
        <div
          ref={popRef}
          className={['add-pop', 'list-pop', align === 'right' ? 'pop-right' : '', up ? 'pop-up' : '', columns === 2 ? 'two-cols' : ''].filter(Boolean).join(' ')}
          // A margin, not a transform: the pop-in animation's transform replaced the shift while it ran, and the page
          // stayed as wide as the unshifted panel.
          style={shift ? { marginLeft: -shift } : undefined}
        >
          {search && (
            <input
              ref={searchRef}
              type="search"
              name="search"
              value={query}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          )}
          <ul
            className="add-list"
            role="listbox"
            id={listId}
            ref={listRef}
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={search ? undefined : `${listId}-${active}`}
            // Two columns read downwards: as many rows as half the list.
            style={columns === 2 ? { gridTemplateRows: `repeat(${Math.ceil(shown.length / 2)}, auto)` } : undefined}
            onKeyDown={search ? undefined : onKey}
          >
            {shown.map((o, i) => (
              <li
                key={String(o.value)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={[i === active ? 'active' : '', o.value === value ? 'selected' : ''].join(' ').trim() || undefined}
                onPointerEnter={() => setActive(i)}
                // Picked on click, not on press: on a phone a press may start a scroll through the list, and the
                // browser sends no click then. mousedown is cancelled so the focus stays where it was.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
              >
                <strong>{o.label}</strong>
                {o.value === value && <span className="check" aria-hidden="true">✓</span>}
              </li>
            ))}
          </ul>
          {search && shown.length === 0 && <p className="muted small list-empty">{search.empty(query.trim())}</p>}
        </div>
      )}
    </div>
  );
}
