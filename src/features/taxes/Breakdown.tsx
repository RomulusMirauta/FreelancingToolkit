import { AmountInput } from '../../lib/ui/AmountInput';
import { useLang, useT } from '../../lib/i18n';
import { paramInfo } from '../../lib/tax/params';
import { formatMoney } from '../../lib/ui/numbers';

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
            <td>{amount(l, l.annual / 12)}</td>
            <td>{amount(l, l.annual)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function amount(l: Line, x: number): string {
  return (l.kind === 'minus' && x !== 0 ? '−' : '') + formatMoney(Math.abs(x));
}

/** Small "§" links to the official sources of the parameters, one per document, with the legal basis on hover. */
export function Sources({ keys }: { keys: string[] }) {
  const lang = useLang();
  const sourceWord = useT().taxes.source;
  const byUrl = new Map<string, string[]>();
  for (const k of keys) {
    const p = paramInfo(k);
    if (!p) continue;
    const value = typeof p.value === 'number' && p.value < 1 ? `${+(p.value * 100).toFixed(2)}%` : String(p.value);
    const unit = p.unit && !value.endsWith('%') ? ` ${p.unit}` : '';
    byUrl.set(p.source, [...(byUrl.get(p.source) ?? []), `${lang === 'ro' ? p.ro : p.en}: ${value}${unit} (${p.legal})`]);
  }
  return (
    <span className="sources">
      {[...byUrl].map(([url, lines]) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" title={lines.join('\n')} aria-label={`${sourceWord}: ${lines.join('; ')}`}>
          §
        </a>
      ))}
    </span>
  );
}

export function Toggle({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
