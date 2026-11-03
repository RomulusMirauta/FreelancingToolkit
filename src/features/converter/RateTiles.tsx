import { crossRate } from '../../lib/currency/convert';
import { CurrencyCode } from '../../lib/currency/CurrencyCode';
import { baseRate, isMarketRate, rateChange, rateSeries } from '../../lib/currency/rates';
import { useT } from '../../lib/i18n';
import { formatNumber, formatRate, isSaneAmount, parseAmount } from '../../lib/ui/numbers';
import { notifyTooBig } from '../../lib/ui/toast';

interface Props {
  /** The currencies shown in the grid, RON left out. */
  codes: string[];
  /** The rates in use (custom ones included), RON per unit. */
  rates: Record<string, number>;
  overrides: Record<string, number>;
  setOverrides: (next: Record<string, number>) => void;
  /** The grid's first currency, for the cross rate line ("1 EUR = 1,12 USD"). */
  anchor: string;
}

/** Below this (RON per unit) a move counts as no change. */
const FLAT = 0.00005;

/**
 * One card per currency (XE / Wise style): the published rate in large type, its change against the previous
 * banking day with a small chart of the last ten, and the custom rate field under it. The change and the chart
 * are BNR's; a custom rate has no history, so they keep showing BNR's while it is in use.
 */
export function RateTiles({ codes, rates, overrides, setOverrides, anchor }: Props) {
  const t = useT();
  const tc = t.converter;
  const shortDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(t.locale, { day: 'numeric', month: 'short' });
  };
  /** With the weekday, so "vs Fri, 30 Oct" on a Monday reads as the previous banking day, not a mistake. */
  const dayDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(t.locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <ul className="rate-tiles">
      {codes.map((code) => {
        const custom = overrides[code];
        const published = baseRate(code) ?? 0;
        const change = rateChange(code);
        const dir = !change ? null : Math.abs(change.change) < FLAT ? 'flat' : change.change > 0 ? 'up' : 'down';
        const sign = dir === 'up' ? '+' : dir === 'down' ? '−' : '';
        const vs = change ? tc.rateVs(dayDate(change.previousDate)) : '';
        /** A custom rate equal to BNR's (as shown, or exactly) is no custom rate. */
        const isBnr = (v: number) => v === published || v === parseAmount(formatRate(published));
        return (
          <li key={code} className="rate-tile">
            <div className="rate-tile-top">
              <strong><CurrencyCode code={code} /></strong>
              {change && dir && (
                <span className={`rate-chg ${dir}`} title={`${sign}${formatRate(Math.abs(change.change))} RON ${vs}`}>
                  <span aria-hidden="true">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}</span>
                  <span className="sr-only">{tc.rateDir[dir]}</span>
                  {sign}{formatNumber(Math.abs(change.share) * 100, 2)}%
                </span>
              )}
              {isMarketRate(code) && <span className="badge market" title={tc.marketTitle}>{tc.marketBadge}</span>}
            </div>
            <div className="rate-tile-rate">
              {formatRate(published)} <span className="unit">RON</span>
            </div>
            <div className="rate-tile-mid">
              {/* The change on one line, what it is measured against on the next. */}
              <span className="muted small rate-tile-change">
                {change ? (
                  <>
                    <span>{sign}{formatRate(Math.abs(change.change))} RON</span>
                    <span>{vs}</span>
                  </>
                ) : `1 ${code} = ${formatRate(published)} RON`}
              </span>
              <Sparkline code={code} dir={dir ?? 'flat'} shortDate={shortDate} label={tc.rateRange} />
            </div>
            {anchor !== 'RON' && anchor !== code && (
              <p className="muted small rate-tile-cross">1 {anchor} = {formatRate(crossRate(anchor, code, rates))} {code}</p>
            )}
            <label className="rate-tile-custom">
              {/* The label, and under it whether the custom rate is the one in use. */}
              <span className="rate-tile-custom-label">
                <span className="small muted">{tc.custom}</span>
                {/* Which rate is in use, on every card: the same two lines, centred beside the field. */}
                {custom !== undefined
                  ? <span className="applied-tag">{tc.customApplied}</span>
                  : <span className="rate-in-use">{tc.customUsingBnr}</span>}
              </span>
              <input
                className="custom-rate-input"
                inputMode="decimal"
                autoComplete="off"
                placeholder={formatRate(published)}
                defaultValue={custom !== undefined ? String(custom) : ''}
                aria-label={tc.customLabel(code)}
                // An empty field shows BNR's rate in grey; clicking it puts that rate in as text, so a digit or two
                // can be changed instead of typing the whole rate. Filled before the press lands, so the caret goes
                // where the click was; reached with Tab, the caret goes to the end. Left unchanged, it goes back
                // to empty (BNR's rate).
                onPointerDown={(e) => {
                  if (e.currentTarget.value === '') e.currentTarget.value = formatRate(published);
                }}
                onFocus={(e) => {
                  const input = e.currentTarget;
                  if (input.value !== '') return;
                  input.value = formatRate(published);
                  input.setSelectionRange(input.value.length, input.value.length);
                }}
                onBlur={(e) => {
                  // Back on BNR's rate (untouched, or edited back to it): the field shows it in grey again.
                  const v = parseAmount(e.currentTarget.value);
                  if (v !== null && isBnr(v)) e.currentTarget.value = '';
                }}
                onChange={(e) => {
                  const v = parseAmount(e.target.value);
                  if (v !== null && !isSaneAmount(v)) {
                    notifyTooBig();
                    return;
                  }
                  const next = { ...overrides };
                  // Typed back to BNR's own rate: not a custom rate, so no "applied" tag.
                  if (v && v > 0 && !isBnr(v)) next[code] = v;
                  else delete next[code];
                  setOverrides(next);
                }}
              />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** The last banking days' rates as a line, the newest as a dot; nothing when there is no history. */
function Sparkline({ code, dir, shortDate, label }: {
  code: string;
  dir: 'up' | 'down' | 'flat';
  shortDate: (iso: string) => string;
  label: (from: string, to: string, low: string, high: string) => string;
}) {
  const series = rateSeries(code);
  if (series.length < 2) return null;
  const w = 110;
  const h = 30;
  const values = series.map((d) => d.rate);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const points = values.map((v, i) => [2 + (i * (w - 4)) / (values.length - 1), h - 3 - ((v - low) / span) * (h - 6)] as const);
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = points[points.length - 1]!;
  const text = label(shortDate(series[0]!.date), shortDate(series[series.length - 1]!.date), formatRate(low), formatRate(high));
  return (
    <svg className={`spark ${dir}`} viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={text}>
      <title>{text}</title>
      <path d={path} />
      <circle cx={lx} cy={ly} r={2.6} />
    </svg>
  );
}
