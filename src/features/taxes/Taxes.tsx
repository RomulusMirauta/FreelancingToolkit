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
import { formatMoney, formatRate, isSaneAmount, roundMoney } from '../../lib/ui/numbers';
import { useLang } from '../../lib/i18n';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { useIsPhone } from '../../lib/ui/useIsPhone';
import { numberParam, useUrlQuery, type UrlQuery } from '../../lib/ui/urlQuery';
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
  amount: roundMoney(convert(rescale(DEFAULT_SOURCE.amount, DEFAULT_SOURCE.period, 'month', DEFAULT_WORK), DEFAULT_SOURCE.currency, 'RON', RATES)),
  per: 'month',
  currency: 'RON',
};

export function isTaxIncome(v: unknown): v is TaxIncome {
  const x = v as TaxIncome;
  return typeof v === 'object' && v !== null && isSaneAmount(x.amount) &&
    PERIODS.includes(x.per) && typeof x.currency === 'string' && KNOWN.has(x.currency);
}

/**
 * Converts the entered income to lei per year: BNR reference rate, and the working time for hours, days and weeks.
 * Rounded to the ban: through the billable hours, 4,050 a month comes out a hair under 48,600, which would put an
 * income exactly on a threshold (CAS, the untaxed amount, the micro-enterprise ceiling) on the wrong side of it.
 */
export function annualLei(i: TaxIncome, work: WorkSettings): number {
  return Math.round(rescale(convert(i.amount, i.currency, 'RON', RATES), i.per, 'year', work) * 100) / 100;
}

const isOptions = (v: unknown): v is TaxOptions => JSON.stringify(mergeTaxOptions(v)) === JSON.stringify(v);
const isRegime = (v: unknown): v is BoardRegime => MAIN_REGIMES.includes(v as BoardRegime);

/**
 * Every option on the cards, in the address, each only when changed: amounts (?expenses_pfa=1500&norm=60000),
 * ticks (?pfa_pensioner=1), picks (?dependants=2&micro_pay=mandate). Out-of-range values fall back to the default.
 */
const OPTION_PARAMS: readonly [string, keyof TaxOptions, string][] = [
  ['dependants', 'employee', 'dependants'], ['children', 'employee', 'schoolChildren'], ['under26', 'employee', 'under26'],
  ['expenses_pfa', 'pfaReal', 'expensesMonthly'], ['pfa_salary', 'pfaReal', 'hasSalary'], ['pfa_pensioner', 'pfaReal', 'pensioner'], ['pfa_sick', 'pfaReal', 'sickLeave'],
  ['norm', 'pfaNorm', 'normYearly'], ['norm_salary', 'pfaNorm', 'hasSalary'], ['norm_pensioner', 'pfaNorm', 'pensioner'], ['norm_sick', 'pfaNorm', 'sickLeave'],
  ['expenses_micro', 'srlMicro', 'expensesMonthly'], ['micro_owner_paid', 'srlMicro', 'ownerEmployed'], ['micro_pay', 'srlMicro', 'ownerPay'],
  ['micro_other_employee', 'srlMicro', 'otherEmployee'], ['micro_single', 'srlMicro', 'singleMicro'],
  ['expenses_profit_salary', 'srlProfitSalary', 'expensesMonthly'], ['profit_pay', 'srlProfitSalary', 'ownerPay'],
  ['expenses_profit', 'srlProfitNoSalary', 'expensesMonthly'],
  ['copyright_insured', 'copyright', 'insured'],
];
/** The pickers' ranges: 0-4 dependants ("4+"), 0-10 children; both whole numbers. */
const OPTION_MAX: Record<string, number> = { dependants: 4, schoolChildren: 10 };

const optionValue = (o: TaxOptions, regime: keyof TaxOptions, field: string) => (o[regime] as unknown as Record<string, unknown>)[field];

export const OPTIONS_QUERY: UrlQuery<TaxOptions> = {
  key: 'ft.taxOptions',
  names: OPTION_PARAMS.map(([p]) => p),
  toParams: (o) => OPTION_PARAMS.map(([, r, f]) => {
    const v = optionValue(o, r, f);
    return typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  }),
  fromParams: (values, saved) => {
    const out = structuredClone(mergeTaxOptions(saved)) as unknown as Record<string, Record<string, unknown>>;
    OPTION_PARAMS.forEach(([, r, f], i) => {
      const fallback = optionValue(DEFAULT_TAX_OPTIONS, r, f);
      const s = values[i]!;
      let v: unknown = null;
      if (typeof fallback === 'boolean') v = s === '1' ? true : s === '0' ? false : null;
      else if (typeof fallback === 'number') {
        const n = numberParam(s);
        const max = OPTION_MAX[f];
        v = n !== null && (max === undefined || (Number.isInteger(n) && n <= max)) ? n : null;
      } else v = s === 'cim' || s === 'mandate' ? s : null;
      out[r]![f] = v ?? fallback;
    });
    return mergeTaxOptions(out);
  },
  isValid: isOptions,
  defaults: DEFAULT_TAX_OPTIONS,
  isDefault: (o) => JSON.stringify(o) === JSON.stringify(DEFAULT_TAX_OPTIONS),
  sparse: true,
};

/** The card everything is compared with: ?ref=pfaReal (CIM, the default, has none). */
export const REF_QUERY: UrlQuery<BoardRegime> = {
  key: 'ft.taxRef',
  names: ['ref'],
  toParams: (r) => [r],
  fromParams: ([s]) => s,
  isValid: isRegime,
  defaults: 'employee',
};

/** All regimes side by side: one income in, the monthly take-home of each out, compared to a reference. */
export function Taxes({ income, setIncome, work }: { income: TaxIncome; setIncome: (i: TaxIncome) => void; work: WorkSettings }) {
  const { taxes: t, board: tb, locale } = useT();
  const phone = useIsPhone();
  const [options, setOptions] = usePersistentState('ft.taxOptions', DEFAULT_TAX_OPTIONS, isOptions);
  useUrlQuery(OPTIONS_QUERY, options);
  const [reference, setReference] = usePersistentState<BoardRegime>('ft.taxRef', 'employee', isRegime);
  useUrlQuery(REF_QUERY, reference);
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

        <IncomeInput value={income} onChange={setIncome} work={work} label={t.income} hint={phone ? undefined : t.incomeHint} main />

        {/* On phones the explanations fold away and a short list of every net comes first, so a result fits on the
            first screen. */}
        {phone ? (
          <>
            <details className="howto">
              <summary>{tb.howTo}</summary>
              <p className="muted small">{t.incomeHint}</p>
              <Legend />
            </details>
            {annual > 0 && <Ranking results={results} allowed={allowed} best={best} />}
          </>
        ) : (
          <Legend />
        )}

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
              notRanked={annual > 0 && !allowed.includes(r)}
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

function Legend() {
  const tb = useT().board;
  return (
    <p className="legend small">
      <span className="delta pos">+</span>
      <span className="delta neg">−</span>
      <span className="delta eq">=</span>
      {tb.legend}
    </p>
  );
}

/**
 * Phones: every regime's monthly net, most first. ★ marks the most money among the allowed regimes; ⚠ marks one
 * the income isn't allowed in (income norm over its limit), even when it shows more.
 */
function Ranking({ results, allowed, best }: { results: Record<BoardRegime, RegimeResult>; allowed: BoardRegime[]; best: number }) {
  const { board: tb, regimes } = useT();
  const order = [...MAIN_REGIMES].sort((a, b) => results[b].takeHome - results[a].takeHome);
  return (
    <>
      <p className="rank-title">{tb.rankTitle}</p>
      <ol className="rank">
        {order.map((r) => {
          const isBest = allowed.includes(r) && results[r].takeHome === best;
          const over = !allowed.includes(r);
          return (
            <li key={r} className={isBest ? 'best' : undefined}>
              <span
                className={`rank-mark${over ? ' over' : ''}`}
                role={isBest || over ? 'img' : undefined}
                aria-label={isBest ? tb.best : over ? tb.notRanked : undefined}
                title={isBest ? tb.best : over ? tb.notRankedTitle : undefined}
              >
                {isBest ? '★' : over ? '⚠' : ''}
              </span>
              <RegimeName label={regimes[r]} />
              <b>{formatMoney(results[r].takeHome / 12)} <small>RON</small></b>
            </li>
          );
        })}
      </ol>
    </>
  );
}

const DEFAULT_TARGET: TaxIncome = { amount: 10_000, per: 'month', currency: 'RON' };

/** An amount + currency + period in the address, under `prefix`, `prefix_currency` and `prefix_per`. */
const incomeQuery = (key: string, prefix: string, defaults: TaxIncome): UrlQuery<TaxIncome> => ({
  key,
  names: [prefix, `${prefix}_currency`, `${prefix}_per`],
  toParams: (v) => [String(v.amount), v.currency, v.per],
  fromParams: ([amount, currency, per]) => {
    const a = numberParam(amount!);
    // Same key order as the saved value: settings are compared as JSON, so a different order would look changed.
    return a === null ? null : { amount: a, per, currency: currency!.toUpperCase() };
  },
  isValid: isTaxIncome,
  defaults,
});

/** The gross income: ?income=12000&income_currency=EUR&income_per=month. */
export const INCOME_QUERY = incomeQuery('ft.taxIncome', 'income', DEFAULT_INCOME);
/** "How much do I want to earn?": ?net=10000&net_currency=RON&net_per=month. */
export const TARGET_QUERY = incomeQuery('ft.solverTarget', 'net', DEFAULT_TARGET);

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
          triggerLabel={`${t.currency}: ${value.currency}`}
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
  const phone = useIsPhone();
  const [target, setTarget] = usePersistentState('ft.solverTarget', DEFAULT_TARGET, isTaxIncome);
  useUrlQuery(TARGET_QUERY, target);
  const targetLei = annualLei(target, work);
  const needed = useMemo(
    () => Object.fromEntries(MAIN_REGIMES.map((r) => [r, solveForTakeHome((a) => computeRegime(r, a, options).takeHome, targetLei)])) as Record<BoardRegime, number | null>,
    [targetLei, options],
  );
  // Show the answer in the target's currency: for its period, plus month and year as reference points.
  const inTarget = (yearLei: number, per: Period) => convert(rescale(yearLei, 'year', per, work), 'RON', target.currency, RATES);
  const columns = PERIODS.filter((p) => p === target.per || p === 'month' || p === 'year');
  // Phones: one column, the target's period, with the year (or the month, for a yearly target) small under it.
  const second: Period = target.per === 'year' ? 'month' : 'year';
  const per = (p: Period) => `/ ${periods[p].toLowerCase()}`;

  return (
    <Fold id="solver" title={ts.title} summary={ts.foldSummary(formatMoney(target.amount), target.currency, periods[target.per].toLowerCase())} className="solver">
      <div className="solver-body">
      <IncomeInput value={target} onChange={setTarget} work={work} label={ts.label} />
      {phone && <p className="solver-cap">{ts.phoneCaption(target.currency)}</p>}
      <table className="breakdown">
        <caption className="sr-only">{ts.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{ts.regime}</th>
            {phone
              ? <th scope="col">{ts.gross}</th>
              : columns.map((p) => <th key={p} scope="col">{ts.neededPer(periods[p].toLowerCase(), target.currency)}</th>)}
          </tr>
        </thead>
        <tbody>
          {MAIN_REGIMES.map((r) => {
            const a = needed[r];
            return (
              <tr key={r}>
                <th scope="row"><RegimeName label={regimes[r]} /></th>
                {phone ? (
                  <td className="solver-amount">
                    {a === null ? '—' : <>{formatMoney(inTarget(a, target.per))} {per(target.per)}<small>{formatMoney(inTarget(a, second))} {per(second)}</small></>}
                  </td>
                ) : (
                  columns.map((p) => <td key={p}>{a === null ? '—' : formatMoney(inTarget(a, p))}</td>)
                )}
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
