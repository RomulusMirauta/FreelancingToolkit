import { useT } from '../../lib/i18n';
import { P, paramInfo } from '../../lib/tax/params';
import { Fold } from '../../lib/ui/Fold';
import { formatEditable, formatMoney, formatNumber, parseAmount } from '../../lib/ui/numbers';
import { refuseNonNumberPaste, refuseWordIn } from '../../lib/ui/toast';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { numberParam, useUrlQuery, type UrlQuery } from '../../lib/ui/urlQuery';

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

/** VAT in short: the exemption threshold against the income that counts, and what changes by where the client is. */
export function Vat({ annual }: { annual: number }) {
  const t = useT().vat;
  const [romaniaPct, setRomaniaPct] = usePersistentState('ft.vatRomania', VAT_QUERY.defaults, isShare);
  useUrlQuery(VAT_QUERY, romaniaPct);
  // Only supplies located in Romania count (Cod fiscal art. 310 alin. (2)); the app can't tell, so it asks.
  const counted = annual * romaniaPct / 100;
  const share = counted / P.PlafonTVA;
  const over = share >= 1;
  const state = over ? 'over' : share >= 0.8 ? 'near' : 'under';
  const threshold = formatNumber(P.PlafonTVA, 0);
  const rate = formatNumber(P.CotaTVA * 100);
  const sources = [paramInfo('CotaTVA'), paramInfo('PlafonTVA')];

  return (
    <Fold id="vat" title={t.title} summary={t.foldSummary(formatNumber(share * 100, 0))} className="other-income vat">
      <p className="muted small">{t.intro(rate, threshold)}</p>

      {/* Label above, the bar, its scale, then the reading: colour and an icon both carry the state. */}
      <div className={`vat-meter ${state}`}>
        <label className="vat-romania">
          <span>{t.romaniaLabel}</span>
          <span className="fee-pct">
            <input
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
          <strong>{formatNumber(share * 100, 0)}%</strong>
        </div>
        <div
          className="vat-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={P.PlafonTVA}
          aria-valuenow={Math.min(Math.round(counted), P.PlafonTVA)}
          aria-valuetext={`${formatNumber(share * 100, 0)}%`}
          aria-label={t.meterLabel}
        >
          <span style={{ width: `${Math.min(share, 1) * 100}%` }} />
        </div>
        <div className="vat-scale" aria-hidden="true"><span>0</span><span>{threshold} RON</span></div>
        <p>
          <span className={`state-icon ${state}`} aria-hidden="true">{state === 'over' ? '!' : state === 'near' ? '!' : '✓'}</span>
          <span>
            <strong>{t.meter(formatMoney(counted), formatNumber(share * 100, 0), threshold)}</strong>
            <span className="vat-verdict">{over ? t.over : share >= 0.8 ? t.near : t.under}</span>
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
          <a key={s.key} href={s.source} target="_blank" rel="noreferrer" className="vat-source" title={s.legal}>§{' '}{s.legal}</a>
        ))}
      </p>
    </Fold>
  );
}
