import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CURRENCIES, MAIN_CODES } from '../../lib/currency/currencies';
import { convert, crossRate } from '../../lib/currency/convert';
import { BNR_RATES, MARKET_RATES, baseRate, effectiveRates, isMarketRate, isStale } from '../../lib/currency/rates';
import { useLang, useT } from '../../lib/i18n';
import { PERIODS, rescale, type Period, type WorkSettings } from '../../lib/time/periods';
import { formatEditable, formatMoney, formatRate, parseAmount } from '../../lib/ui/numbers';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { CurrencyCode } from '../../lib/currency/CurrencyCode';
import { AddCurrency } from './AddCurrency';

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
}

export function Converter({ work, onTaxes }: Props) {
  const t = useT();
  const tc = t.converter;
  const lang = useLang();
  const nameOf = (code: string) => (lang === 'ro' ? BY_CODE.get(code)?.ro : BY_CODE.get(code)?.name) ?? code;
  const [source, setSource] = usePersistentState('ft.source', DEFAULT_SOURCE, isSource);
  const [shown, setShown] = usePersistentState('ft.columns', DEFAULT_COLUMNS, isColumns);
  /** Currencies the user added from the dropdown; they get a chip next to the main ones. */
  const [added, setAdded] = usePersistentState<string[]>('ft.addedCurrencies', [], isCodes);
  const [overrides, setOverrides] = usePersistentState('ft.customRates', {}, isOverrides);
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

  return (
    <section className="card" aria-labelledby="converter-title">
      <div className="card-head">
        <h2 id="converter-title">{tc.title}</h2>
        <p className="edit-hint">
          <span className="pencil" aria-hidden="true">✎</span>
          {tc.hintBefore}<strong>{tc.hintStrong}</strong>{tc.hintAfter}
        </p>
      </div>

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
                {period === 'day' && (
                  <td rowSpan={PERIODS.length - 1} className="goal-note">
                    <GoalNote />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="goal-hint-narrow">
        <span aria-hidden="true">↑</span> {tc.goalNarrow}
      </p>

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
        <ul className="rate-list">
          {columns.filter((c) => c !== 'RON').map((code) => {
            const custom = overrides[code];
            return (
              <li key={code}>
                <span>
                  1 {code} = {formatRate(rates[code]!)} RON
                  {custom !== undefined && <span className="badge">{tc.customBadge}</span>}
                  {custom === undefined && isMarketRate(code) && <span className="badge market" title={tc.marketTitle}>{tc.marketBadge}</span>}
                </span>
                {anchor !== code && anchor !== 'RON' && (
                  <span className="muted"> · 1 {anchor} = {formatRate(crossRate(anchor, code, rates))} {code}</span>
                )}
                <label className="custom-rate">
                  <span>{tc.custom}</span>
                  <input
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
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
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
function GoalNote() {
  const tc = useT().converter;
  return (
    <div className="goal-inner">
      <svg className="brace" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 1 Q10 1 10 9 L10 42 Q10 50 18 50 Q10 50 10 58 L10 91 Q10 99 2 99" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="goal-text">
        <strong>{tc.goalTitle}</strong>
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
