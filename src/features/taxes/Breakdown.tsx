import { AmountInput } from '../../lib/ui/AmountInput';
import { useLang, useT, type Lang } from '../../lib/i18n';
import { paramInfo, type ParamInfo } from '../../lib/tax/params';
import { formatMoney, formatNumber } from '../../lib/ui/numbers';

export interface Line {
  label: string;
  /** Annual amount in lei. */
  annual: number;
  /** Keys in data/params-2026.json that this line is computed from. */
  sources?: string[];
  kind?: 'minus' | 'total' | 'info';
}

/** A breakdown table with per-month and per-year amounts and a legal source on each line. */
export function Breakdown({ lines, caption }: { lines: Line[]; caption: string }) {
  const t = useT().taxes;
  return (
    <table className="breakdown">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{t.lei}</th>
          <th scope="col">{t.perMonth}</th>
          <th scope="col">{t.perYear}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.label} className={l.kind ?? ''}>
            <th scope="row">
              {l.label}
              {l.sources && <Sources keys={l.sources} />}
            </th>
            <td>{lineAmount(l.kind, l.annual / 12)}</td>
            <td>{lineAmount(l.kind, l.annual)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A line's amount: one taken off shows a minus, and any other keeps its own (a negative take-home, a loss), as on
 * the card. Under half a ban it is 0,00, never −0,00.
 */
export function lineAmount(kind: Line['kind'], x: number): string {
  if (Math.abs(x) < 0.005) return formatMoney(0);
  const negative = kind === 'minus' ? x > 0 : x < 0;
  return (negative ? '−' : '') + formatMoney(Math.abs(x));
}

/** Small "§" links to the official sources of the parameters, one per document, with the legal basis on hover. */
export function Sources({ keys }: { keys: string[] }) {
  const lang = useLang();
  const t = useT().taxes;
  const byUrl = new Map<string, string[]>();
  for (const k of keys) {
    const p = paramInfo(k);
    if (!p) continue;
    byUrl.set(p.source, [...(byUrl.get(p.source) ?? []), sourceLine(p, lang, t)]);
  }
  return (
    <span className="sources">
      {[...byUrl].map(([url, lines]) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" title={lines.join('\n')} aria-label={`${t.source}: ${lines.join('; ')}`}>
          §
        </a>
      ))}
    </span>
  );
}

/**
 * A parameter as its § reads it, in the page's language: "Gross minimum wage, January–June 2026: 4,050 RON/month
 * (HG 1506/2024 art. 1; …)". A percentage keeps its base ("15% of the minimum wage"), and a yes or no is a word.
 */
export function sourceLine(p: ParamInfo, lang: Lang, t: { yes: string; no: string }): string {
  const en = lang === 'en';
  const value = typeof p.value === 'string'
    ? p.value === 'Da' ? t.yes : p.value === 'Nu' ? t.no : p.value
    : p.value < 1 ? `${formatNumber(p.value * 100, 2)}%` : formatNumber(p.value, 4);
  // A yes or no has no unit: "Da/Nu" only names the choice.
  const unit = typeof p.value === 'number' && p.unit ? ` ${en ? p.unitEn ?? p.unit : p.unit}` : '';
  return `${en ? p.en : p.ro}: ${value}${unit} (${legalBasis(p, lang)})`;
}

/** A parameter's legal basis in the page's language: in English the words around the citations are English. */
export function legalBasis(p: ParamInfo, lang: Lang): string {
  return lang === 'en' ? p.legalEn ?? p.legal : p.legal;
}

export function Toggle({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" name="option" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** An amount of money in a card's options, grouped like every other amount (8.000, 48.600). */
export function NumberField({ label, value, onChange, suffix }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="field field-amount">
      <span>{label}</span>
      <span className="field-input">
        <AmountInput value={value} onChange={onChange} />
        {suffix && <span className="muted">{suffix}</span>}
      </span>
    </label>
  );
}
