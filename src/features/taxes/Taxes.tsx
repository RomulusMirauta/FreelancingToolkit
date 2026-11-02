import { useMemo } from 'react';
import { CURRENCIES } from '../../lib/currency/currencies';
import { convert } from '../../lib/currency/convert';
import { BNR_RATES, effectiveRates, isMarketRate } from '../../lib/currency/rates';
import { DEFAULT_WORK, PERIODS, rescale, type Period, type WorkSettings } from '../../lib/time/periods';
import { DEFAULT_SOURCE } from '../converter/Converter';
import { CurrencyPicker } from '../converter/CurrencyPicker';
import { CurrencyCode } from '../../lib/currency/CurrencyCode';
import { useT } from '../../lib/i18n';
import { PARAMS_CHECKED_ON, PARAMS_YEAR } from '../../lib/tax/params';
import {
  BOARD_REGIMES, DEFAULT_TAX_OPTIONS, MAIN_REGIMES, OTHER_REGIMES, computeRegime, mergeTaxOptions, type BoardRegime, type RegimeResult, type TaxOptions,
} from '../../lib/tax/regimes';
import { solveForTakeHome } from '../../lib/tax/solve';
import { AmountInput } from '../../lib/ui/AmountInput';
import { formatMoney, formatRate } from '../../lib/ui/numbers';
import { useLang } from '../../lib/i18n';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { Fold } from '../../lib/ui/Fold';
import { RegimeCard } from './RegimeCard';
import { SideJob } from './SideJob';
import { Vat } from './Vat';
import { Calendar } from './Calendar';
import { ListPicker } from './ListPicker';
import { RegimeName } from './RegimeName';

export interface TaxIncome {
  amount: number;
  per: Period;
  /** Any BNR currency code, or RON. */
  currency: string;
}

const RATES = effectiveRates(BNR_RATES, {});
const KNOWN = new Set(CURRENCIES.map((c) => c.code));

/** The converter's default rate (30 EUR/hour at 8 h × 5 days × 52 weeks) in lei per month: 27,781.52. */
export const DEFAULT_INCOME: TaxIncome = {
  amount: Math.round(convert(rescale(DEFAULT_SOURCE.amount, DEFAULT_SOURCE.period, 'month', DEFAULT_WORK), DEFAULT_SOURCE.currency, 'RON', RATES) * 100) / 100,
  per: 'month',
  currency: 'RON',
};

export function isTaxIncome(v: unknown): v is TaxIncome {
  const x = v as TaxIncome;
  return typeof v === 'object' && v !== null && typeof x.amount === 'number' && x.amount >= 0 &&
    PERIODS.includes(x.per) && typeof x.currency === 'string' && KNOWN.has(x.currency);
}

/** Converts the entered income to lei per year: BNR reference rate, and the working time for hours, days and weeks. */
export function annualLei(i: TaxIncome, work: WorkSettings): number {
  return rescale(convert(i.amount, i.currency, 'RON', RATES), i.per, 'year', work);
}

const isOptions = (v: unknown): v is TaxOptions => JSON.stringify(mergeTaxOptions(v)) === JSON.stringify(v);
const isRegime = (v: unknown): v is BoardRegime => MAIN_REGIMES.includes(v as BoardRegime);

/** All regimes side by side: one income in, the monthly take-home of each out, compared to a reference. */
export function Taxes({ income, setIncome, work }: { income: TaxIncome; setIncome: (i: TaxIncome) => void; work: WorkSettings }) {
  const { taxes: t, board: tb, locale } = useT();
  const [options, setOptions] = usePersistentState('ft.taxOptions', DEFAULT_TAX_OPTIONS, isOptions);
  const [reference, setReference] = usePersistentState<BoardRegime>('ft.taxRef', 'employee', isRegime);
  const annual = annualLei(income, work);

  const results = useMemo(
    () => Object.fromEntries(BOARD_REGIMES.map((r) => [r, computeRegime(r, annual, options)])) as Record<BoardRegime, RegimeResult>,
    [annual, options],
  );
  // A regime the income would not be allowed in (income norm above its limit) can't be "most money".
  const allowed = MAIN_REGIMES.filter((r) => !(results[r].notice?.kind === 'normLimit' && results[r].notice.overLimit));
  const best = Math.max(...allowed.map((r) => results[r].takeHome));

  const [cy, cm, cd] = PARAMS_CHECKED_ON.split('-').map(Number) as [number, number, number];
  const checkedOn = new Date(cy, cm - 1, cd).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <Fold id="taxes" title={t.title(PARAMS_YEAR)} summary={t.foldSummary(formatMoney(annual / 12))} className="taxes">
        <p className="muted subtitle">{t.subtitle}</p>

        <IncomeInput value={income} onChange={setIncome} work={work} label={t.income} hint={t.incomeHint} main />

        <p className="legend small">
          <span className="delta pos">+</span>
          <span className="delta neg">−</span>
          <span className="delta eq">=</span>
          {tb.legend}
        </p>

        <div className="board">
          {MAIN_REGIMES.map((r) => (
            <RegimeCard
              key={r}
              regime={r}
              annual={annual}
              result={results[r]}
              referenceRegime={reference}
              referenceTakeHome={results[reference].takeHome}
              isBest={annual > 0 && allowed.includes(r) && results[r].takeHome === best}
              options={options}
              setOptions={setOptions}
              onSetReference={() => setReference(r)}
            />
          ))}
        </div>
      </Fold>

      <SideJob />

      <Fold id="other" title={tb.otherTitle} className="other-income">
        <p className="muted small">{tb.otherNote}</p>
        <div className="board">
          {OTHER_REGIMES.map((r) => (
            <RegimeCard
              key={r}
              regime={r}
              annual={annual}
              result={results[r]}
              referenceRegime={reference}
              referenceTakeHome={results[reference].takeHome}
              isBest={false}
              options={options}
              setOptions={setOptions}
              onSetReference={() => undefined}
              canBeReference={false}
            />
          ))}
        </div>
      </Fold>

      <Solver options={options} work={work} />

      <Vat annual={annual} />

      <Calendar />

      <p className="disclaimer small">{t.disclaimer(PARAMS_YEAR, checkedOn)}</p>
    </>
  );
}

const DEFAULT_TARGET: TaxIncome = { amount: 10_000, per: 'month', currency: 'RON' };

/** Amount + currency (searchable) + period, with the equivalent in lei per month and per year underneath. */
function IncomeInput({ value, onChange, work, label, hint, main = false }: {
  value: TaxIncome;
  onChange: (v: TaxIncome) => void;
  work: WorkSettings;
  label: string;
  hint?: string;
  /** The page's main input: larger and lime. */
  main?: boolean;
}) {
  const { taxes: t, periods } = useT();
  const lang = useLang();
  const annual = annualLei(value, work);
  const info = CURRENCIES.find((c) => c.code === value.currency);

  return (
    <div className={`income${main ? ' income-row-main' : ''}`}>
      <label className={`field${main ? ' income-main' : ' income-amount'}`}>
        <span>{label}</span>
        <AmountInput value={value.amount} onChange={(amount) => onChange({ ...value, amount })} />
      </label>
      <div className="field">
        <span>{t.currency}</span>
        <CurrencyPicker
          triggerClass="currency-btn"
          triggerLabel={t.currency}
          selected={value.currency}
          onPick={(code) => onChange({ ...value, currency: code })}
          trigger={<><span title={info ? (lang === 'ro' ? info.ro : info.name) : undefined}><CurrencyCode code={value.currency} /></span></>}
        />
      </div>
      <div className="field">
        <span>{t.per}</span>
        <ListPicker value={value.per} options={PERIODS.map((p) => ({ value: p, label: periods[p].toLowerCase() }))} onChange={(per) => onChange({ ...value, per })} label={t.per} />
      </div>
      {/* Under the fields, so the label stays short and the currency and period sit next to the amount. */}
      {hint && <p className="muted small income-hint">{hint}</p>}
      <p className="muted small income-total">
        {t.total(formatMoney(annual / 12), formatMoney(annual))}
        {value.currency !== 'RON' && t.atRate(value.currency, formatRate(RATES[value.currency]!))}
        {isMarketRate(value.currency) && t.marketRate}
      </p>
    </div>
  );
}

function Solver({ options, work }: { options: TaxOptions; work: WorkSettings }) {
  const { solver: ts, regimes, periods } = useT();
  const [target, setTarget] = usePersistentState('ft.solverTarget', DEFAULT_TARGET, isTaxIncome);
  const targetLei = annualLei(target, work);
  const needed = useMemo(
    () => Object.fromEntries(MAIN_REGIMES.map((r) => [r, solveForTakeHome((a) => computeRegime(r, a, options).takeHome, targetLei)])) as Record<BoardRegime, number | null>,
    [targetLei, options],
  );
  // Show the answer in the target's currency: for its period, plus month and year as reference points.
  const inTarget = (yearLei: number, per: Period) => convert(rescale(yearLei, 'year', per, work), 'RON', target.currency, RATES);
  const columns = PERIODS.filter((p) => p === target.per || p === 'month' || p === 'year');

  return (
    <Fold id="solver" title={ts.title} summary={ts.foldSummary(formatMoney(target.amount), target.currency, periods[target.per].toLowerCase())} className="solver">
      <div className="solver-body">
      <IncomeInput value={target} onChange={setTarget} work={work} label={ts.label} />
      <table className="breakdown">
        <caption className="sr-only">{ts.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{ts.regime}</th>
            {columns.map((p) => <th key={p} scope="col">{ts.neededPer(periods[p].toLowerCase(), target.currency)}</th>)}
          </tr>
        </thead>
        <tbody>
          {MAIN_REGIMES.map((r) => {
            const a = needed[r];
            return (
              <tr key={r}>
                <th scope="row"><RegimeName label={regimes[r]} /></th>
                {columns.map((p) => <td key={p}>{a === null ? '—' : formatMoney(inTarget(a, p))}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">{ts.note}</p>
      </div>
    </Fold>
  );
}
