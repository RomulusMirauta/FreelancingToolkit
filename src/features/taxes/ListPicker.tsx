import { useEffect, useId, useRef, useState } from 'react';

/**
 * A short fixed list (periods, dependants): looks like the currency button and opens the same kind of panel
 * (keyboard: ↑ ↓ Enter Esc). `align="right"` opens it towards the left, for choices at a card's right edge.
 */
export function ListPicker<T extends string | number>({ value, options, onChange, label, align = 'left' }: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  align?: 'left' | 'right';
}) {
  const index = options.findIndex((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(index);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options[index]?.label ?? String(value);

  const show = () => {
    setActive(Math.max(index, 0));
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
    if (open) listRef.current?.focus();
  }, [open]);

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
        <div className={`add-pop list-pop${align === 'right' ? ' pop-right' : ''}`}>
          <ul
            className="add-list"
            role="listbox"
            id={listId}
            ref={listRef}
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(active + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(active - 1, 0));
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (options[active]) pick(options[active].value);
              } else if (e.key === 'Escape' || e.key === 'Tab') {
                close();
              }
            }}
          >
            {options.map((o, i) => (
              <li
                key={String(o.value)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={[i === active ? 'active' : '', o.value === value ? 'selected' : ''].join(' ').trim() || undefined}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(o.value);
                }}
              >
                <strong>{o.label}</strong>
                {o.value === value && <span className="check" aria-hidden="true">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
