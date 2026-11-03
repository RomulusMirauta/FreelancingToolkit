import { useT } from '../../lib/i18n';
import { P, paramInfo } from '../../lib/tax/params';
import { Fold } from '../../lib/ui/Fold';
import { formatMoney, formatNumber } from '../../lib/ui/numbers';

/** VAT in short: the exemption threshold against this income, and what changes by where the client is. */
export function Vat({ annual }: { annual: number }) {
  const t = useT().vat;
  const share = annual / P.PlafonTVA;
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
        <div className="vat-meter-head">
          <span>{t.meterLabel}</span>
          <strong>{formatNumber(share * 100, 0)}%</strong>
        </div>
        <div
          className="vat-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={P.PlafonTVA}
          aria-valuenow={Math.min(Math.round(annual), P.PlafonTVA)}
          aria-valuetext={`${formatNumber(share * 100, 0)}%`}
          aria-label={t.meterLabel}
        >
          <span style={{ width: `${Math.min(share, 1) * 100}%` }} />
          {/* The "nearly there" mark at 80%. */}
          <i className="vat-tick" aria-hidden="true" />
        </div>
        <div className="vat-scale" aria-hidden="true"><span>0</span><span>{threshold} RON</span></div>
        <p>
          <span className={`state-icon ${state}`} aria-hidden="true">{state === 'over' ? '!' : state === 'near' ? '!' : '✓'}</span>
          <span>
            <strong>{t.meter(formatMoney(annual), formatNumber(share * 100, 0), threshold)}</strong>{' '}
            {over ? t.over : share >= 0.8 ? t.near : t.under}
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
        {t.toConfirm}{' '}
        {sources.map((s) => s && (
          <a key={s.key} href={s.source} target="_blank" rel="noreferrer" className="vat-source" title={s.legal}>§ {s.legal}</a>
        ))}
      </p>
    </Fold>
  );
}
