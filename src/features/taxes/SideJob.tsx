import { useMemo } from 'react';
import { useT } from '../../lib/i18n';
import { DEFAULT_SIDE_JOB, SIDE_KINDS, computeSideJob, type SideJobInput } from '../../lib/tax/regimes';
import { formatMoney } from '../../lib/ui/numbers';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { Breakdown, NumberField } from './Breakdown';
import { RegimeName } from './RegimeName';

const isSideJob = (v: unknown): v is SideJobInput => {
  const x = v as SideJobInput;
  return typeof v === 'object' && v !== null &&
    typeof x.salaryMonthly === 'number' && x.salaryMonthly >= 0 && typeof x.sideMonthly === 'number' && x.sideMonthly >= 0;
};

/** A job plus a PFA or copyright income: the total take-home, compared with the salary alone. */
export function SideJob() {
  const t = useT();
  const tb = t.board;
  const [input, setInput] = usePersistentState('ft.sideJob', DEFAULT_SIDE_JOB, isSideJob);
  const results = useMemo(() => SIDE_KINDS.map((k) => [k, computeSideJob(k, input)] as const), [input]);
  const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', t.locale === 'ro-RO' ? ',' : '.')}%`;

  return (
    <section className="other-income side-job" aria-labelledby="side-title">
      <h3 id="side-title">{tb.sideTitle}</h3>
      <p className="muted small">{tb.sideNote}</p>
      <div className="side-inputs">
        <NumberField label={tb.sideSalary} value={input.salaryMonthly} onChange={(v) => setInput({ ...input, salaryMonthly: v })} suffix={t.taxes.monthSuffix} />
        <NumberField label={tb.sideExtra} value={input.sideMonthly} onChange={(v) => setInput({ ...input, sideMonthly: v })} suffix={t.taxes.monthSuffix} />
      </div>
      <div className="board">
        {results.map(([kind, r]) => {
          const extra = (r.takeHome - r.salaryNet) / 12;
          const sign = Math.abs(extra) < 0.5 ? 'eq' : extra > 0 ? 'pos' : 'neg';
          return (
            <article key={kind} className="regime" aria-labelledby={`side-${kind}`}>
              <header className="regime-head">
                <h3 id={`side-${kind}`} aria-label={tb.sideNames[kind]}><RegimeName label={tb.sideNames[kind]} /></h3>
              </header>
              <div className="regime-result">
                <span className="small muted">{tb.sideTotal}</span>
                <strong className="take-home">{formatMoney(r.takeHome / 12)} <span className="unit">RON</span></strong>
                <span className={`delta ${sign}`}>
                  {sign === 'eq' ? `= ${tb.equal}` : `${sign === 'pos' ? '+' : '−'}${formatMoney(Math.abs(extra))}`}
                  <span className="vs"> {tb.sideVs}</span>
                </span>
                <span className="small muted">{tb.perYear(formatMoney(r.takeHome))} · {tb.sideShare(pct(r.sideTaxShare))}</span>
              </div>
              <p className="regime-note">{t.notices[r.notice]}</p>
              <details className="regime-details">
                <summary>{tb.details}</summary>
                <Breakdown
                  caption={tb.sideNames[kind]}
                  lines={r.lines.map((l) => ({ label: t.lines[l.key], annual: l.annual, kind: l.kind, sources: l.sources }))}
                />
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
