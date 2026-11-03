import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CURRENCIES, currencySymbol, type CurrencyInfo } from '../../lib/currency/currencies';
import { useLang, useT } from '../../lib/i18n';

/** Lower-case, without diacritics, so "zloty" finds "złoty" and "krona" finds "króna". */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

/**
 * Codes starting with the query first, then names with a word starting with it, then any other match.
 * Both the English and the Romanian name are searched, whatever the app language.
 */
export function searchCurrencies(options: CurrencyInfo[], query: string): CurrencyInfo[] {
  const q = fold(query.trim());
  if (!q) return options;
  const rank = (c: CurrencyInfo) => {
    const code = fold(c.code);
    const names = fold(`${c.name} ${c.ro}`);
    if (code.startsWith(q)) return 0;
    if (names.split(/[\s()-]+/).some((w) => w.startsWith(q))) return 1;
    if (code.includes(q) || names.includes(q)) return 2;
    return -1;
  };
  return options
    .map((c) => [c, rank(c)] as const)
    .filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([c]) => c);
}

interface Props {
  /** What the button shows. */
  trigger: ReactNode;
  triggerClass: string;
  triggerLabel?: string;
  /** Codes left out of the list. */
  exclude?: string[];
  /** The current choice, marked in the list. */
  selected?: string;
  onPick: (code: string) => void;
}

/** A button that opens a searchable list of every BNR currency (keyboard: ↑ ↓ Enter Esc). */
export function CurrencyPicker({ trigger, triggerClass, triggerLabel, exclude = [], selected, onPick }: Props) {
  const t = useT().addCurrency;
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const options = CURRENCIES.filter((c) => !exclude.includes(c.code)).sort((a, b) => a.code.localeCompare(b.code));
  const matches = searchCurrencies(options, query);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const pick = (code: string) => {
    onPick(code);
    close();
  };

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Opened near the right edge (e.g. the tax page's currency on a phone), slide the panel back inside the screen.
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) return;
    pop.style.left = '';
    const { left, right } = pop.getBoundingClientRect();
    const overflow = right - (document.documentElement.clientWidth - 16);
    if (overflow > 0) pop.style.left = `${-Math.min(overflow, left - 16)}px`;
  }, [open]);

  // Keep the highlighted option in view while arrowing through the list.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="add-currency" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? close() : setOpen(true))}
      >
        {trigger}
      </button>
      {open && (
        <div className="add-pop" ref={popRef}>
          <input
            type="search"
            name="currency-search"
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={matches[active] ? `${listId}-${matches[active].code}` : undefined}
            aria-label={t.search}
            placeholder={t.placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(active + 1, matches.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(active - 1, 0));
              } else if (e.key === 'Enter' && matches[active]) {
                e.preventDefault();
                pick(matches[active].code);
              } else if (e.key === 'Escape') {
                close();
              }
            }}
          />
          {matches.length > 0 ? (
            <ul className="add-list" role="listbox" id={listId} ref={listRef} aria-label={t.list}>
              {matches.map((c, i) => (
                <li
                  key={c.code}
                  id={`${listId}-${c.code}`}
                  role="option"
                  aria-selected={i === active}
                  className={[i === active ? 'active' : '', c.code === selected ? 'selected' : ''].join(' ').trim() || undefined}
                  onPointerEnter={() => setActive(i)}
                  // pointerdown keeps focus in the input; click would blur it first.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pick(c.code);
                  }}
                >
                  <strong>{c.code}</strong>
                  {/* Its own column, so names line up whether or not the currency has a symbol. */}
                  <span className="sym-col" aria-hidden="true">{currencySymbol(c.code)}</span>
                  <span>{lang === 'ro' ? c.ro : c.name}</span>
                  {c.market && <span className="market-tag" title={t.marketTitle}>{t.market}</span>}
                  {c.code === selected && <span className="check" aria-hidden="true">✓</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="add-empty">{t.noMatch(query)}</p>
          )}
        </div>
      )}
    </div>
  );
}
