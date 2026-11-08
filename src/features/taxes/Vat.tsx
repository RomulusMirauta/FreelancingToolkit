import { useLang, useT } from '../../lib/i18n';
import { P, paramInfo } from '../../lib/tax/params';
import { Fold } from '../../lib/ui/Fold';
import { formatEditable, formatMoney, formatNumber, parseAmount } from '../../lib/ui/numbers';
import { refuseNonNumberPaste, refuseWordIn } from '../../lib/ui/toast';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { numberParam, useUrlQuery, type UrlQuery } from '../../lib/ui/urlQuery';
import { legalBasis } from './Breakdown';

const isShare = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** The share of the income from clients in Romania, in %: ?vat_romania=20 (all of it, the default, has none). */
export const VAT_QUERY: UrlQuery<number> = {
  key: 'ft.vatRomania',
  names: ['vat_romania'],
  toParams: (v) => [String(v)],
  fromParams: ([s]) => numberParam(s!),
  isValid: isShare,
  defaults: 100,
};

/**
 * Where the income that counts stands against the VAT threshold, in whole percent. Over it means above it: exactly
 * 395,000 RON is still within (Cod fiscal art. 310 alin. (1) "nu depășește", alin. (6)). The percentage is rounded
 * towards its side of the threshold, so it never reads 100% on the wrong side: just under it 99%, just over it 101%
 * (and 79% just under 80%, where the bar turns amber). In bani, so a whole percentage stays whole: 0.57 × 100 is
 * 56.99999999999999.
 */
export function vatReading(counted: number): { pct: number; state: 'under' | 'near' | 'over' } {
  const pct = Math.round(counted * 100) / P.PlafonTVA;
  if (pct > 100) return { pct: Math.ceil(pct), state: 'over' };
  return { pct: Math.floor(pct), state: pct >= 80 ? 'near' : 'under' };
}

/** VAT in short: the exemption threshold against the income that counts, and what changes by where the client is. */
export function Vat({ annual }: { annual: number }) {
  const t = useT().vat;
  const lang = useLang();
  const [romaniaPct, setRomaniaPct] = usePersistentState('ft.vatRomania', VAT_QUERY.defaults, isShare);
  useUrlQuery(VAT_QUERY, romaniaPct);
  // Only supplies located in Romania count (Cod fiscal art. 310 alin. (2)); the app can't tell, so it asks.
  const counted = annual * romaniaPct / 100;
  const share = counted / P.PlafonTVA;
  const { pct, state } = vatReading(counted);
  const shown = formatNumber(pct, 0);
  const threshold = formatNumber(P.PlafonTVA, 0);
  const rate = formatNumber(P.CotaTVA * 100);
  const sources = [paramInfo('CotaTVA'), paramInfo('PlafonTVA')];

  return (
    <Fold id="vat" title={t.title} summary={t.foldSummary(shown)} className="other-income vat">
      <p className="muted small">{t.intro(rate, threshold)}</p>

      {/* Label above, the bar, its scale, then the reading: colour and an icon both carry the state. */}
      <div className={`vat-meter ${state}`}>
        <label className="vat-romania">
          <span>{t.romaniaLabel}</span>
          <span className="fee-pct">
            <input
              // Uncontrolled: a new language mounts it again, with that language's decimal mark.
              key={lang}
              inputMode="decimal"
              autoComplete="off"
              name="vat-romania"
              defaultValue={formatEditable(romaniaPct)}
              onPaste={refuseNonNumberPaste}
              onChange={(e) => {
                if (refuseWordIn(e.currentTarget)) return;
                const v = parseAmount(e.target.value);
                const ok = v !== null && isShare(v);
                e.currentTarget.setAttribute('aria-invalid', String(!ok));
                if (ok) setRomaniaPct(v);
              }}
            />
            <span aria-hidden="true">%</span>
          </span>
        </label>
        <div className="vat-meter-head">
          <span>{t.meterLabel}</span>
          <strong>{shown}%</strong>
        </div>
        <div
          className="vat-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={P.PlafonTVA}
          aria-valuenow={Math.min(Math.round(counted), P.PlafonTVA)}
          aria-valuetext={`${shown}%`}
          aria-label={t.meterLabel}
        >
          <span style={{ width: `${Math.min(share, 1) * 100}%` }} />
        </div>
        <div className="vat-scale" aria-hidden="true"><span>0</span><span>{threshold} RON</span></div>
        <p>
          <span className={`state-icon ${state}`} aria-hidden="true">{state === 'over' ? '!' : state === 'near' ? '!' : '✓'}</span>
          <span>
            <strong>{t.meter(formatMoney(counted), shown, threshold)}</strong>
            <span className="vat-verdict">{t[state]}</span>
          </span>
        </p>
      </div>

      <ul className="vat-cases">
        {t.cases.map((c) => (
          <li key={c.who}>
            <strong>{c.who}</strong> {c.what(rate)}
          </li>
        ))}
      </ul>
      <p className="muted small">
        {t.scope}{' '}
        {sources.map((s) => s && (
          <a key={s.key} href={s.source} target="_blank" rel="noreferrer" className="vat-source" title={legalBasis(s, lang)}>§{' '}{legalBasis(s, lang)}</a>
        ))}
      </p>
    </Fold>
  );
}
