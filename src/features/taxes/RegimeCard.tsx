import { useT } from '../../lib/i18n';
import { P } from '../../lib/tax/params';
import type { ConsFacts } from '../../lib/i18n/strings';
import {
  NORM_LIMIT_LEI, SICK_LEAVE_MONTHLY_MAX, SICK_LEAVE_MONTHLY_MIN, ownerSalaryTaxesMonthly,
  type BoardRegime, type Notice, type RegimeResult, type TaxOptions,
} from '../../lib/tax/regimes';
import { MICRO_CEILING_LEI, type OwnerPay } from '../../lib/tax/srl';
import { formatMoney, formatNumber } from '../../lib/ui/numbers';
import { Breakdown, NumberField, Toggle } from './Breakdown';
import { ListPicker } from './ListPicker';
import { RegimeName } from './RegimeName';

const DEPENDANTS = [0, 1, 2, 3, 4].map((n) => ({ value: n, label: n === 4 ? '4+' : String(n) }));
const CHILDREN = Array.from({ length: 11 }, (_, n) => ({ value: n, label: String(n) }));


interface Props {
  regime: BoardRegime;
  annual: number;
  result: RegimeResult;
  referenceRegime: BoardRegime;
  referenceTakeHome: number;
  isBest: boolean;
  /** Left out of "most money": the income is above what this regime allows (income norm over its limit). */
  notRanked?: boolean;
  options: TaxOptions;
  setOptions: (o: TaxOptions) => void;
  onSetReference: () => void;
  /** False for income types shown apart (copyright): no "Compare against this". */
  canBeReference?: boolean;
}

/** One regime: the monthly take-home up top with its difference to the reference, then options and details. */
export function RegimeCard({ regime, result, referenceRegime, referenceTakeHome, isBest, notRanked = false, options, setOptions, onSetReference, canBeReference = true }: Props) {
  const t = useT();
  const tb = t.board;
  const isRef = regime === referenceRegime;
  const diff = (result.takeHome - referenceTakeHome) / 12;
  const sign = Math.abs(diff) < 0.5 ? 'eq' : diff > 0 ? 'pos' : 'neg';
  const pct = (x: number) => `${formatNumber(x * 100, 1)}%`;

  return (
    <article className={`regime${isBest ? ' is-best' : ''}${isRef ? ' is-ref' : ''}`} aria-labelledby={`rg-${regime}`}>
      <header className="regime-head">
        <h3 id={`rg-${regime}`} aria-label={t.regimes[regime]}><RegimeName label={t.regimes[regime]} /></h3>
        {canBeReference && (
          // Works like a radio button: exactly one card is the reference the others are compared with.
          <button
            type="button"
            className={`ref-toggle${isRef ? ' on' : ''}`}
            aria-pressed={isRef}
            aria-label={isRef ? `${tb.reference}: ${t.regimes[regime]}` : `${tb.setReference}: ${t.regimes[regime]}`}
            title={isRef ? tb.reference : tb.setReference}
            onClick={isRef ? undefined : onSetReference}
          >
            <span aria-hidden="true">{isRef ? '◉' : '○'}</span> {tb.reference}
          </button>
        )}
      </header>

      <div className="regime-result">
        <span className="regime-result-top">
          <span className="small muted">{tb.finalMonthly}</span>
          {/* The winner gets a tag in the results colour (lime is kept for what can be edited). */}
          {isBest && <span className="best-tag"><span aria-hidden="true">★</span> {tb.best}</span>}
          {/* Says why a card with more money doesn't get the star (the reason is in the warning lower down). */}
          {notRanked && <span className="not-ranked-tag" title={tb.notRankedTitle}>{tb.notRanked}</span>}
        </span>
        <strong className="take-home">{formatMoney(result.takeHome / 12)} <span className="unit">RON</span></strong>
        {isRef ? (
          <span className="delta eq">= {tb.refBase}</span>
        ) : (
          <span className={`delta ${sign}`}>
            {sign === 'eq' ? `= ${tb.equal}` : `${sign === 'pos' ? '+' : '−'}${formatMoney(Math.abs(diff))}`}
            <span className="vs"> {tb.vsRef(t.regimes[referenceRegime])}</span>
          </span>
        )}
        <span className="kept-meter" role="img" aria-label={tb.keptBar(pct(1 - result.taxShare))} title={tb.keptBar(pct(1 - result.taxShare))}>
          <span style={{ width: `${Math.max(0, Math.min(1, 1 - result.taxShare)) * 100}%` }} />
        </span>
        <dl className="regime-stats">
          <div><dt>{tb.statYear}</dt><dd>{formatMoney(result.takeHome)} RON</dd></div>
          <div><dt>{tb.statRate}</dt><dd>{pct(result.taxShare)}</dd></div>
        </dl>
      </div>

      <Options regime={regime} options={options} setOptions={setOptions} />
      {result.notice && <NoticeText notice={result.notice} />}
      {regime === 'pfaReal' && <p className="regime-note">{t.notices.pfaAlso}</p>}
      {((regime === 'srlMicro' && options.srlMicro.ownerEmployed && options.srlMicro.ownerPay === 'mandate') ||
        (regime === 'srlProfitSalary' && options.srlProfitSalary.ownerPay === 'mandate')) && (
        <p className="regime-note warn-note">{t.notices.mandate}</p>
      )}
      {regime.startsWith('srlProfit') && <p className="regime-note">{t.notices.profit}</p>}

      <Cons regime={regime} />

      <details className="regime-details">
        <summary>{tb.details}</summary>
        <Breakdown
          caption={t.regimes[regime]}
          lines={result.lines.map((l) => ({ label: t.lines[l.key], annual: l.annual, kind: l.kind, sources: l.sources }))}
        />
      </details>
    </article>
  );
}

function Options({ regime, options, setOptions }: { regime: BoardRegime; options: TaxOptions; setOptions: (o: TaxOptions) => void }) {
  const to = useT().opts;
  const monthSuffix = useT().taxes.monthSuffix;
  const yearSuffix = useT().taxes.yearSuffix;
  const set = <R extends BoardRegime>(r: R, patch: Partial<TaxOptions[R]>) => setOptions({ ...options, [r]: { ...options[r], ...patch } });

  switch (regime) {
    case 'employee': {
      const o = options.employee;
      return (
        <div className="regime-options">
          <div className="field">
            <span>{to.dependants}</span>
            {/* The deduction stops growing at 4 people, so "4+" is the last choice. */}
            <ListPicker value={o.dependants} options={DEPENDANTS} onChange={(v) => set('employee', { dependants: v })} label={to.dependants} align="right" />
          </div>
          <div className="field">
            <span>{to.children}</span>
            {/* 100 lei a month for each child, with no ceiling: exact counts, no "N+". */}
            <ListPicker value={o.schoolChildren} options={CHILDREN} onChange={(v) => set('employee', { schoolChildren: v })} label={to.children} align="right" />
          </div>
          <Toggle label={to.under26} checked={o.under26} onChange={(v) => set('employee', { under26: v })} />
        </div>
      );
    }
    case 'pfaReal': {
      const o = options.pfaReal;
      return (
        <div className="regime-options">
          <NumberField label={to.expensesMonthly} value={o.expensesMonthly} onChange={(v) => set('pfaReal', { expensesMonthly: v })} suffix={monthSuffix} />
          <Toggle label={to.hasSalary} hint={to.hasSalaryHint} checked={o.hasSalary} onChange={(v) => set('pfaReal', { hasSalary: v })} />
          <Toggle label={to.pensioner} hint={to.pensionerHint} checked={o.pensioner} onChange={(v) => set('pfaReal', { pensioner: v })} />
          <Toggle label={to.sickLeave} hint={to.sickLeaveHint} checked={o.sickLeave} onChange={(v) => set('pfaReal', { sickLeave: v })} />
        </div>
      );
    }
    case 'pfaNorm': {
      const o = options.pfaNorm;
      return (
        <div className="regime-options">
          <NumberField label={to.normYearly} value={o.normYearly} onChange={(v) => set('pfaNorm', { normYearly: v })} suffix={yearSuffix} />
          <Toggle label={to.hasSalary} hint={to.hasSalaryHint} checked={o.hasSalary} onChange={(v) => set('pfaNorm', { hasSalary: v })} />
          <Toggle label={to.pensioner} hint={to.pensionerHint} checked={o.pensioner} onChange={(v) => set('pfaNorm', { pensioner: v })} />
          <Toggle label={to.sickLeave} hint={to.sickLeaveHint} checked={o.sickLeave} onChange={(v) => set('pfaNorm', { sickLeave: v })} />
        </div>
      );
    }
    case 'srlMicro': {
      const o = options.srlMicro;
      return (
        <div className="regime-options">
          <NumberField label={to.expensesMonthly} value={o.expensesMonthly} onChange={(v) => set('srlMicro', { expensesMonthly: v })} suffix={monthSuffix} />
          <Toggle label={to.ownerEmployed} checked={o.ownerEmployed} onChange={(v) => set('srlMicro', { ownerEmployed: v })} />
          {o.ownerEmployed && <OwnerPayChoice value={o.ownerPay} onChange={(v) => set('srlMicro', { ownerPay: v })} />}
          <Toggle label={to.otherEmployee} checked={o.otherEmployee} onChange={(v) => set('srlMicro', { otherEmployee: v })} />
          <Toggle label={to.singleMicro} checked={o.singleMicro} onChange={(v) => set('srlMicro', { singleMicro: v })} />
        </div>
      );
    }
    case 'srlProfitSalary':
    case 'srlProfitNoSalary':
      return (
        <div className="regime-options">
          <NumberField label={to.expensesMonthly} value={options[regime].expensesMonthly} onChange={(v) => set(regime, { expensesMonthly: v })} suffix={monthSuffix} />
          {regime === 'srlProfitSalary' && (
            <OwnerPayChoice value={options.srlProfitSalary.ownerPay} onChange={(v) => set('srlProfitSalary', { ownerPay: v })} />
          )}
        </div>
      );
    case 'copyright':
      return (
        <div className="regime-options">
          <Toggle label={to.insured} hint={to.insuredHint} checked={options.copyright.insured} onChange={(v) => set('copyright', { insured: v })} />
        </div>
      );
  }
}

/** CIM or administrator's mandate contract, for the owner's minimum-wage pay. */
function OwnerPayChoice({ value, onChange }: { value: OwnerPay; onChange: (v: OwnerPay) => void }) {
  const to = useT().opts;
  return (
    <div className="pay-choice">
      <span>{to.ownerPay}</span>
      <div className="segmented" role="radiogroup" aria-label={to.ownerPay}>
        {(['cim', 'mandate'] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={value === p} className={value === p ? 'on' : ''} onClick={() => onChange(p)}>
            {p === 'cim' ? 'CIM' : to.mandate}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoticeText({ notice }: { notice: Notice }) {
  const tn = useT().notices;
  switch (notice.kind) {
    case 'microOk':
      return <p className="regime-note">{tn.microOk(String(P.CotaMicro * 100), formatMoney(P.PlafonMicroEUR), formatMoney(MICRO_CEILING_LEI))}</p>;
    case 'microFallback':
      return <p className="regime-note warn-note">{tn.microFallback[notice.reason](formatMoney(MICRO_CEILING_LEI))}</p>;
    case 'normLimit':
      return notice.overLimit
        ? <p className="regime-note warn-note">{tn.normOver(formatMoney(P.PlafonNormaEUR), formatMoney(NORM_LIMIT_LEI))}</p>
        : <p className="regime-note">{tn.normOk(formatMoney(P.PlafonNormaEUR), formatMoney(NORM_LIMIT_LEI))}</p>;
    case 'employeeHalves':
      return <p className="regime-note">{tn.employeeHalves(formatMoney(notice.netH1), formatMoney(notice.netH2))}</p>;
  }
}

/** The disadvantages of a regime, collapsed under a counted heading so the cards stay short. */
function Cons({ regime }: { regime: BoardRegime }) {
  const { cons, locale } = useT();
  const whole = (x: number) => Math.round(x).toLocaleString(locale);
  const facts: ConsFacts = {
    sickMin: formatMoney(SICK_LEAVE_MONTHLY_MIN),
    sickMax: formatMoney(SICK_LEAVE_MONTHLY_MAX),
    ownerSalaryTaxes: whole(ownerSalaryTaxesMonthly()),
    dividendRate: `${P.CotaDividende * 100}%`,
    microCeilingEur: whole(P.PlafonMicroEUR),
    normLimitEur: whole(P.PlafonNormaEUR),
  };
  // The "needs an employee" point is about micro-enterprises; profit-tax SRLs don't need one.
  const [needsEmployee, ...srlRest] = cons.srl;
  const items = {
    employee: cons.employee,
    pfaReal: cons.pfa,
    pfaNorm: [...cons.pfaNorm, ...cons.pfa],
    srlMicro: [needsEmployee!, ...cons.srlMicro, ...srlRest],
    srlProfitSalary: srlRest,
    srlProfitNoSalary: srlRest,
    copyright: cons.copyright,
  }[regime];

  return (
    <details className="regime-cons">
      <summary>⚠ {cons.title} ({items.length})</summary>
      <ul>
        {items.map((item, i) => <li key={i}>{item(facts)}</li>)}
      </ul>
    </details>
  );
}
