import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CURRENCIES, MAIN_CODES } from '../../lib/currency/currencies';
import { convert, crossRate } from '../../lib/currency/convert';
import { BNR_RATES, MARKET_RATES, baseRate, effectiveRates, isMarketRate, isStale } from '../../lib/currency/rates';
import { useLang, useT } from '../../lib/i18n';
import { PERIODS, rescale, type Period, type WorkSettings } from '../../lib/time/periods';
import { formatEditable, formatMoney, formatRate, parseAmount } from '../../lib/ui/numbers';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { CurrencyCode } from '../../lib/currency/CurrencyCode';
import { Fold } from '../../lib/ui/Fold';
import { AddCurrency } from './AddCurrency';
import { writeSourceQuery } from './sourceQuery';

/** The cell the user last typed into; every other cell is derived from it. */
export interface SourceCell {
  period: Period;
  currency: string;
  amount: number;
}

export const DEFAULT_SOURCE: SourceCell = { period: 'hour', currency: 'EUR', amount: 30 };
const DEFAULT_COLUMNS = ['EUR', 'RON', 'USD', 'GBP'];
const KNOWN = new Set(CURRENCIES.map((c) => c.code));
const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

const isSource = (v: unknown): v is SourceCell =>
  typeof v === 'object' && v !== null &&
  PERIODS.includes((v as SourceCell).period) &&
  KNOWN.has((v as SourceCell).currency) &&
  typeof (v as SourceCell).amount === 'number' && (v as SourceCell).amount >= 0;
const isCodes = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((c) => typeof c === 'string' && KNOWN.has(c));
const isColumns = (v: unknown): v is string[] => isCodes(v) && v.length > 0;
const isOverrides = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && Object.values(v).every((x) => typeof x === 'number');

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
  const [shown, setShown] = usePersistentState('ft.columns', DEFAULT_COLUMNS, isColumns);
  /** Currencies the user added from the dropdown; they get a chip next to the main ones. */
  const [added, setAdded] = usePersistentState<string[]>('ft.addedCurrencies', [], isCodes);
  const [overrides, setOverrides] = usePersistentState('ft.customRates', {}, isOverrides);
  /** The "Or work backwards" note beside the grid; its × hides it (Reset tab brings it back). */
  const [goalShown, setGoalShown] = usePersistentState('ft.goalNote', true, (v): v is boolean => typeof v === 'boolean');
  const [editing, setEditing] = useState<{ period: Period; currency: string; text: string } | null>(null);

  // Chip order is also column order: EUR, RON, USD, GBP, then added currencies in the order they were added.
  const chips = [...new Set([...MAIN_CODES, ...added, ...shown])];
  const columns = chips.filter((c) => shown.includes(c));
  const toggle = (code: string) => {
    if (!shown.includes(code)) setShown([...shown, code]);
    else if (shown.length > 1) setShown(shown.filter((c) => c !== code));
  };
  const add = (code: string) => {
    if (!chips.includes(code)) setAdded([...added, code]);
    if (!shown.includes(code)) setShown([...shown, code]);
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

  const onType = (period: Period, currency: string, text: string) => {
    setEditing({ period, currency, text });
    const amount = parseAmount(text);
    if (amount !== null) setSource({ period, currency, amount });
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const braceFits = useBraceFits(scrollRef, columns.length);

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
          {chips.map((code) => {
            const on = shown.includes(code);
            return (
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
          })}
        </div>
        <AddCurrency exclude={chips} onAdd={add} />
      </div>

      <div
        className={`grid-scroll${braceFits ? '' : ' no-brace'}${scrolled ? ' scrolled' : ''}`}
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
            {PERIODS.map((period) => (
              <tr key={period} className={period === 'hour' ? 'start-row' : undefined}>
                <th scope="row" className="period-col">
                  {t.periods[period]}
                  {period === 'hour' && <span className="start-tag">{tc.startHere}</span>}
                </th>
                {columns.map((code) => {
                  const isEditing = editing?.period === period && editing.currency === code;
                  const isSourceCell = source.period === period && source.currency === code;
                  const invalid = isEditing && parseAmount(editing.text) === null;
                  return (
                    <td key={code}>
                      <input
                        className={`cell${isSourceCell ? ' source' : ''}${invalid ? ' invalid' : ''}`}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={tc.cellLabel(code, t.periods[period])}
                        aria-invalid={invalid || undefined}
                        title={isSourceCell ? tc.cellTitleSource : tc.cellTitleEdit}
                        value={isEditing ? editing.text : formatMoney(valueAt(period, code))}
                        onFocus={(e) => {
                          setEditing({ period, currency: code, text: formatEditable(valueAt(period, code)) });
                          requestAnimationFrame(() => e.target.select());
                        }}
                        onChange={(e) => onType(period, code, e.target.value)}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
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
        {tc.cta(formatMoney(valueAt('month', 'RON')))}
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
        {/* One table, so "Custom rate" is a column heading instead of a label repeated on every row. */}
        <table className="rate-table">
          <thead>
            <tr>
              <th scope="col">{tc.rateCurrency}</th>
              <th scope="col">{tc.rateBnr}</th>
              {anchor !== 'RON' && <th scope="col" className="rate-cross">{tc.rateCross(anchor)}</th>}
              <th scope="col" className="rate-custom-col">{tc.custom}</th>
            </tr>
          </thead>
          <tbody>
            {columns.filter((c) => c !== 'RON').map((code) => {
              const custom = overrides[code];
              return (
                <tr key={code}>
                  <th scope="row"><CurrencyCode code={code} /></th>
                  <td>
                    1 {code} = <strong>{formatRate(rates[code]!)}</strong> RON
                    {custom !== undefined && <span className="badge">{tc.customBadge}</span>}
                    {custom === undefined && isMarketRate(code) && <span className="badge market" title={tc.marketTitle}>{tc.marketBadge}</span>}
                  </td>
                  {anchor !== 'RON' && (
                    <td className="muted rate-cross">{anchor !== code ? `1 ${anchor} = ${formatRate(crossRate(anchor, code, rates))} ${code}` : '—'}</td>
                  )}
                  <td className="rate-custom-col">
                    <input
                      className="custom-rate-input"
                      inputMode="decimal"
                      placeholder={formatRate(baseRate(code) ?? 0)}
                      defaultValue={custom !== undefined ? String(custom) : ''}
                      aria-label={tc.customLabel(code)}
                      onChange={(e) => {
                        const v = parseAmount(e.target.value);
                        const next = { ...overrides };
                        if (v && v > 0) next[code] = v;
                        else delete next[code];
                        setOverrides(next);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small rate-note">{tc.customNote}</p>
      </div>
    </Fold>
  );
}

const BRACE_WIDTH = 260;

/**
 * Whether the brace note fits beside the grid. With many columns it would be scrolled out of view,
 * so the one-line hint under the grid is shown instead. Measured without the note to avoid flip-flopping.
 */
function useBraceFits(scrollRef: RefObject<HTMLDivElement | null>, columnCount: number): boolean {
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const measure = () => {
      const table = box.querySelector('table');
      const note = box.querySelector<HTMLElement>('.goal-note');
      if (!table) return;
      const gridOnly = table.offsetWidth - (note?.offsetWidth ?? 0);
      setFits(gridOnly + BRACE_WIDTH <= box.clientWidth);
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
    </div>
  );
}

function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
