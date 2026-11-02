import { useT } from '../../lib/i18n';
import { P, paramInfo } from '../../lib/tax/params';
import { Fold } from '../../lib/ui/Fold';
import { formatMoney, formatNumber } from '../../lib/ui/numbers';

/** VAT in short: the exemption threshold against this income, and what changes by where the client is. */
export function Vat({ annual }: { annual: number }) {
  const t = useT().vat;
  const share = annual / P.PlafonTVA;
  const over = share >= 1;
  const threshold = formatNumber(P.PlafonTVA, 0);
  const rate = formatNumber(P.CotaTVA * 100);
  const sources = [paramInfo('CotaTVA'), paramInfo('PlafonTVA')];

  return (
    <Fold id="vat" title={t.title} summary={t.foldSummary(formatNumber(share * 100, 0))} className="other-income vat">
      <p className="muted small">{t.intro(rate, threshold)}</p>

      <div className={`vat-meter${over ? ' over' : share >= 0.8 ? ' near' : ''}`}>
        <div className="vat-bar" role="meter" aria-valuemin={0} aria-valuemax={P.PlafonTVA} aria-valuenow={Math.round(annual)} aria-label={t.meterLabel}>
          <span style={{ width: `${Math.min(share, 1) * 100}%` }} />
        </div>
        <p>
          <strong>{t.meter(formatMoney(annual), formatNumber(share * 100, 0), threshold)}</strong>{' '}
          {over ? t.over : share >= 0.8 ? t.near : t.under}
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
