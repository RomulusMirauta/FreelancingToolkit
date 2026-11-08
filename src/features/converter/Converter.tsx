import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { CURRENCIES, MAIN_CODES } from '../../lib/currency/currencies';
import { convert } from '../../lib/currency/convert';
import { BNR_RATES, MARKET_RATES, effectiveRates, isMarketRate, isStale } from '../../lib/currency/rates';
import { useLang, useT } from '../../lib/i18n';
import { PERIODS, rescale, type Period, type WorkSettings } from '../../lib/time/periods';
import { bareAmount, formatEditable, formatMoney, isAtOnce, isSaneAmount, parseAmount } from '../../lib/ui/numbers';
import { notifyTooBig, refuseNonNumberPaste, refuseWord } from '../../lib/ui/toast';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { CurrencyCode } from '../../lib/currency/CurrencyCode';
import { Fold } from '../../lib/ui/Fold';
import { AddCurrency } from './AddCurrency';
import { trackEvent } from '../../lib/analytics';
import { RateTiles } from './RateTiles';
import { writeSourceQuery } from './sourceQuery';
import {
  ADDED_QUERY, COLUMNS_QUERY, DEFAULT_COLUMNS, GOAL_QUERY, RATES_QUERY,
  isCodes, isColumns, isFlag, isOverrides, knownAdded, knownColumns, knownRates,
} from './converterQueries';
import { useUrlQuery } from '../../lib/ui/urlQuery';

/** The cell the user last typed into; every other cell is derived from it. */
export interface SourceCell {
  period: Period;
  currency: string;
  amount: number;
}

export const DEFAULT_SOURCE: SourceCell = { period: 'hour', currency: 'EUR', amount: 30 };
const KNOWN = new Set(CURRENCIES.map((c) => c.code));
const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

const isSource = (v: unknown): v is SourceCell =>
  typeof v === 'object' && v !== null &&
  PERIODS.includes((v as SourceCell).period) &&
  KNOWN.has((v as SourceCell).currency) &&
  isSaneAmount((v as SourceCell).amount);

interface Props {
  work: WorkSettings;
  /** Opens the tax calculator for this income, given in lei per year. */
  onTaxes: (yearRon: number) => void;
  /** The amount per month in lei changed: the tax page's income follows it. */
  onIncome: (monthRon: number) => void;
  /** The converter's current figures, for the fees card under it. */
  onSnapshot: (s: ConverterSnapshot) => void;
}

export interface ConverterSnapshot {
  /** Amount per month in RON, before fees. */
  monthRon: number;
  /** Hourly rate in the anchor currency, before fees. */
  hour: number;
  anchor: string;
}

export function Converter({ work, onTaxes, onIncome, onSnapshot }: Props) {
  const t = useT();
  const tc = t.converter;
  const lang = useLang();
  const nameOf = (code: string) => (lang === 'ro' ? BY_CODE.get(code)?.ro : BY_CODE.get(code)?.name) ?? code;
  const [source, setSource] = usePersistentState('ft.source', DEFAULT_SOURCE, isSource);
  // A saved currency the rates no longer have leaves on its own; the others, and their custom rates, stay.
  const [shown, setShown] = usePersistentState('ft.columns', DEFAULT_COLUMNS, isColumns, knownColumns);
  /** Currencies the user added from the dropdown; they get a chip next to the main ones. */
  const [added, setAdded] = usePersistentState<string[]>('ft.addedCurrencies', [], isCodes, knownAdded);
  const [overrides, setOverrides] = usePersistentState('ft.customRates', {}, isOverrides, knownRates);
  /** The "Or work backwards" note beside the grid; its × hides it (Reset tab brings it back). */
  const [goalShown, setGoalShown] = usePersistentState('ft.goalNote', true, isFlag);
  // Every one of these is in the address too (?currencies=, ?added=, ?rates=, ?goal_note=).
  useUrlQuery(COLUMNS_QUERY, shown);
  useUrlQuery(ADDED_QUERY, added);
  useUrlQuery(RATES_QUERY, overrides);
  useUrlQuery(GOAL_QUERY, goalShown);
  const [editing, setEditing] = useState<{ period: Period; currency: string; text: string } | null>(null);

  // Chip order is also column order: EUR, RON, USD, GBP, then added currencies in the order they were added.
  const chips = [...new Set([...MAIN_CODES, ...added, ...shown])];
  const columns = chips.filter((c) => shown.includes(c));
  const toggle = (code: string) => {
    // Back in chip order: a currency turned off and on again leaves the saved columns as they were.
    if (!shown.includes(code)) setShown(chips.filter((c) => c === code || shown.includes(c)));
    else if (shown.length > 1) setShown(shown.filter((c) => c !== code));
  };
  const add = (code: string) => {
    if (!chips.includes(code)) setAdded([...added, code]);
    if (!shown.includes(code)) setShown([...shown, code]);
    trackEvent(`add-currency/${code}`);
  };

  const rates = useMemo(() => effectiveRates(BNR_RATES, overrides), [overrides]);
  // A saved source currency may have been hidden; values stay anchored to it anyway.
  const valueAt = (period: Period, currency: string) =>
    convert(rescale(source.amount, source.period, period, work), source.currency, currency, rates);

  // The tax page's income follows the converter: whenever the amount per month changes here (rate, working
  // time, custom rate), it is sent on. Compared with the last value, not skipped on mount, so StrictMode's
  // double effect doesn't overwrite an income set on the tax page.
  const monthRon = valueAt('month', 'RON');
  const sentRef = useRef(monthRon);
  useEffect(() => {
    if (sentRef.current === monthRon) return;
    sentRef.current = monthRon;
    onIncome(monthRon);
  }, [monthRon, onIncome]);

  // The cell typed into lives in the address too (?amount=40&currency=EUR&per=hour).
  useEffect(() => {
    writeSourceQuery(source, source.amount === DEFAULT_SOURCE.amount && source.currency === DEFAULT_SOURCE.currency && source.period === DEFAULT_SOURCE.period);
  }, [source]);

  /** The source when a cell got focus, so Esc can undo what was typed there. */
  const startRef = useRef<SourceCell | null>(null);
  /** The figure the focused cell offered for editing: typed back, nothing has changed. */
  const offeredRef = useRef<number | null>(null);
  /** Spreadsheet keys: arrows move between cells (left/right only at the edge of the text), Enter goes down,
   *  Shift+Enter up, Esc puts back the value from before. Typing applies at once, as before. */
  const onCellKey = (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const input = e.currentTarget;
    const move = (r: number, c: number) => {
      const next = scrollRef.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`);
      if (!next) return false;
      e.preventDefault();
      next.focus();
      return true;
    };
    const { selectionStart: a, selectionEnd: b, value } = input;
    const all = a === 0 && b === value.length;
    if (e.key === 'ArrowUp') move(row - 1, col);
    else if (e.key === 'ArrowDown') move(row + 1, col);
    else if (e.key === 'ArrowLeft' && (all || (a === 0 && b === 0))) move(row, col - 1);
    else if (e.key === 'ArrowRight' && (all || (a === value.length && b === value.length))) move(row, col + 1);
    else if (e.key === 'Enter') {
      if (!move(row + (e.shiftKey ? -1 : 1), col)) input.blur();
    } else if (e.key === 'Escape') {
      if (startRef.current) setSource(startRef.current);
      input.blur();
    }
  };

  const onType = (period: Period, currency: string, typed: string, atOnce: boolean) => {
    if (editing && refuseWord(editing.text, typed)) return;
    // Pasted with its currency sign or code ($1,234.56, 1.234,56 lei): read, and kept, without them.
    const bare = bareAmount(typed);
    const text = atOnce && parseAmount(typed) === null && parseAmount(bare) !== null ? bare : typed;
    const amount = parseAmount(text);
    // Above the limit the keystroke is refused (the cell keeps its text), with a word in the corner.
    if (amount !== null && !isSaneAmount(amount)) {
      notifyTooBig();
      return;
    }
    setEditing({ period, currency, text });
    if (amount === null) return;
    // The cell's own figure typed back (a digit deleted and typed again): the amount typed elsewhere stays the
    // source, instead of this cell's figure rounded to 2 decimals (10,000 RON a month became 9,997.98).
    if (amount === offeredRef.current && startRef.current) setSource(startRef.current);
    else setSource({ period, currency, amount });
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const brace = useBrace(scrollRef, columns.length);

  // Read on every render on purpose, so a page left open notices when the rates get old.
  // eslint-disable-next-line react/purity
  const stale = isStale(BNR_RATES.date, new Date());
  const anchor = columns.includes('EUR') ? 'EUR' : columns[0]!;
  const hourAnchor = valueAt('hour', anchor);
  useEffect(() => onSnapshot({ monthRon, hour: hourAnchor, anchor }), [monthRon, hourAnchor, anchor, onSnapshot]);

  return (
    <Fold
      id="converter"
      title={tc.title}
      summary={tc.summary(formatMoney(valueAt('hour', anchor)), anchor, formatMoney(monthRon))}
      className="converter"
    >
      <p className="edit-hint">
        <span className="pencil" aria-hidden="true">✎</span>
        {tc.hintBefore}<strong>{tc.hintStrong}</strong>{tc.hintAfter}
      </p>

      <div className="currency-bar">
        <div className="chips" role="group" aria-label={tc.currenciesShown}>
          {chips.map((code, i) => {
            const on = shown.includes(code);
            const button = (
              <button
                key={code}
                type="button"
                className={`chip${on ? ' on' : ''}`}
                aria-pressed={on}
                title={tc.chipTitle(nameOf(code), on)}
                disabled={on && shown.length === 1}
                onClick={() => toggle(code)}
              >
                <CurrencyCode code={code} />
              </button>
            );
            // "+ Add currency" follows the last chip and wraps only together with it, never alone on a row.
            return i < chips.length - 1 ? button : (
              <div key={code} className="chips-last">
                {button}
                <AddCurrency exclude={chips} onAdd={add} />
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`grid-scroll${brace === 'full' ? '' : brace === 'slim' ? ' slim-brace' : ' no-brace'}${scrolled ? ' scrolled' : ''}`}
        ref={scrollRef}
        // Shades the frozen Per column's edge once currencies pass under it.
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      >
        <table className="rate-grid">
          <thead>
            <tr>
              <th scope="col" className="period-col">{tc.per}</th>
              {columns.map((code) => (
                <th scope="col" key={code} title={nameOf(code)}><CurrencyCode code={code} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, row) => (
              <tr key={period} className={period === 'hour' ? 'start-row' : undefined}>
                <th scope="row" className="period-col">
                  {period === 'hour' ? (
                    // Together, so the tag (an arrow on phones) can sit midway between the word and the first cell.
                    <span className="start-wrap">{t.periods[period]}<span className="start-tag"><span>{tc.startHere}</span></span></span>
                  ) : t.periods[period]}
                </th>
                {columns.map((code, col) => {
                  const isEditing = editing?.period === period && editing.currency === code;
                  const isSourceCell = source.period === period && source.currency === code;
                  const invalid = isEditing && parseAmount(editing.text) === null;
                  return (
                    <td key={code}>
                      <input
                        className={`cell${isSourceCell ? ' source' : ''}${invalid ? ' invalid' : ''}`}
                        inputMode="decimal"
                        autoComplete="off"
                        name={`${period}-${code}`}
                        data-cell={`${row}-${col}`}
                        aria-label={tc.cellLabel(code, t.periods[period])}
                        aria-invalid={invalid || undefined}
                        title={isSourceCell ? tc.cellTitleSource : tc.cellTitleEdit}
                        value={isEditing ? editing.text : formatMoney(valueAt(period, code))}
                        onFocus={(e) => {
                          const text = formatEditable(valueAt(period, code));
                          startRef.current = source;
                          offeredRef.current = parseAmount(text);
                          setEditing({ period, currency: code, text });
                          // Only if focus stayed: select() would pull it back from wherever a fast Tab has moved it.
                          requestAnimationFrame(() => { if (document.activeElement === e.target) e.target.select(); });
                        }}
                        onChange={(e) => onType(period, code, e.target.value, isAtOnce(e.nativeEvent as InputEvent))}
                        onPaste={refuseNonNumberPaste}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => onCellKey(e, row, col)}
                      />
                    </td>
                  );
                })}
                {period === 'day' && goalShown && (
                  <td rowSpan={PERIODS.length - 1} className="goal-note">
                    <GoalNote onClose={() => setGoalShown(false)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {goalShown && (
        <p className="goal-hint-narrow">
          <span aria-hidden="true">↑</span> {tc.goalNarrow}
          <button type="button" className="goal-close" aria-label={tc.goalClose} title={tc.goalClose} onClick={() => setGoalShown(false)}>×</button>
        </p>
      )}

      <button type="button" className="cta" onClick={() => onTaxes(valueAt('year', 'RON'))}>
        {/* The amount never breaks: on phones it gets its own line. */}
        {tc.cta} <span className="cta-amount">{tc.ctaAmount(formatMoney(valueAt('month', 'RON')))}</span>
      </button>

      <div className="rates">
        <p className={stale ? 'warn' : 'muted'} role={stale ? 'status' : undefined}>
          {tc.ratesOf} <strong>{formatDate(BNR_RATES.date, t.locale)}</strong>
          {stale && tc.stale}
        </p>
        {columns.some(isMarketRate) && (
          // ExchangeRate-API's terms ask for this attribution link.
          <p className="muted small">
            {tc.marketOf} <strong>{formatDate(MARKET_RATES.date, t.locale)}</strong> ·{' '}
            <a href={MARKET_RATES.provider} target="_blank" rel="noreferrer">{tc.marketBy}</a>
          </p>
        )}
        <RateTiles
          codes={columns.filter((c) => c !== 'RON')}
          rates={rates}
          overrides={overrides}
          setOverrides={setOverrides}
          anchor={anchor}
        />
        <p className="muted small rate-note">{tc.changeNote} {tc.customNote}</p>
      </div>
    </Fold>
  );
}

const BRACE_WIDTH = 260;
const SLIM_BRACE_WIDTH = 44;

/**
 * How the brace note fits beside the grid: in full, slim (the brace and a few words turned sideways, on phones)
 * or not at all. With many columns it would be scrolled out of view, so the one-line hint under the grid is shown
 * instead. Measured without the note to avoid flip-flopping.
 */
function useBrace(scrollRef: RefObject<HTMLDivElement | null>, columnCount: number): 'full' | 'slim' | 'none' {
  const [fits, setFits] = useState<'full' | 'slim' | 'none'>('full');
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const measure = () => {
      const table = box.querySelector('table');
      const note = box.querySelector<HTMLElement>('.goal-note');
      if (!table) return;
      const gridOnly = table.offsetWidth - (note?.offsetWidth ?? 0);
      setFits(gridOnly + BRACE_WIDTH <= box.clientWidth ? 'full' : gridOnly + SLIM_BRACE_WIDTH <= box.clientWidth ? 'slim' : 'none');
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [scrollRef, columnCount]);
  return fits;
}

/** A brace spanning Day → Year with a nudge to type a goal there, not only an hourly rate. */
function GoalNote({ onClose }: { onClose: () => void }) {
  const tc = useT().converter;
  return (
    <div className="goal-inner">
      <svg className="brace" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 1 Q10 1 10 9 L10 42 Q10 50 18 50 Q10 50 10 58 L10 91 Q10 99 2 99" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="goal-text">
        {/* The × sits on the title's line, next to the text it hides. */}
        <span className="goal-title">
          <strong>{tc.goalTitle}</strong>
          <button type="button" className="goal-close" aria-label={tc.goalClose} title={tc.goalClose} onClick={onClose}>×</button>
        </span>
        <span>
          {tc.goalBefore}<em>{tc.goalEm}</em>{tc.goalAfter}
        </span>
        <span className="goal-example">{tc.goalExample}</span>
      </div>
      <span className="goal-slim">{tc.goalSlim}</span>
    </div>
  );
}

function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
