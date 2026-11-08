import { useState } from 'react';
import { useLang, useT } from '../../lib/i18n';
import { Fold } from '../../lib/ui/Fold';
import { Notes } from '../../lib/ui/Notes';
import { formatEditable, formatMoney, formatNumber, parseAmount, roundMoney } from '../../lib/ui/numbers';
import { refuseNonNumberPaste, refuseWordIn } from '../../lib/ui/toast';
import { usePersistentState } from '../../lib/ui/usePersistentState';
import { numberParam, useUrlQuery, type UrlQuery } from '../../lib/ui/urlQuery';
import { ListPicker } from '../taxes/ListPicker';
import type { ConverterSnapshot } from './Converter';

/**
 * Typical cuts, in %, as published in 2026. They change often and some vary per contract
 * (Upwork 0–15%), so each is only a starting point and the % stays editable.
 */
export const PLATFORMS = [
  { id: 'none', pct: 0 },
  { id: 'upwork', pct: 10 },
  { id: 'fiverr', pct: 20 },
  { id: 'freelancer', pct: 10 },
  { id: 'malt', pct: 10 },
  { id: 'guru', pct: 9 },
  // These charge the client (or a subscription) instead of the freelancer.
  { id: 'toptal', pct: 0 },
  { id: 'braintrust', pct: 0 },
  { id: 'arc', pct: 0 },
  { id: 'contra', pct: 0 },
  { id: 'freelancermap', pct: 0 },
] as const;

export const TRANSFERS = [
  { id: 'none', pct: 0 },
  { id: 'wise', pct: 0.5 },
  { id: 'revolut', pct: 0 },
  { id: 'payoneer', pct: 2 },
  { id: 'bank', pct: 2 },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]['id'];
export type TransferId = (typeof TRANSFERS)[number]['id'];

export interface FeeSettings {
  platform: PlatformId | 'custom';
  platformPct: number;
  transfer: TransferId | 'custom';
  transferPct: number;
}

/**
 * The common case, so the money that really reaches a freelancer is shown from the start: work found on
 * Upwork (the usual 10%) and paid into a Romanian bank account that changes it into RON (about 2% over BNR).
 */
export const DEFAULT_FEES: FeeSettings = { platform: 'upwork', platformPct: 10, transfer: 'bank', transferPct: 2 };

const pctOk = (x: unknown) => typeof x === 'number' && x >= 0 && x < 100;
export const isFees = (v: unknown): v is FeeSettings => {
  const f = v as FeeSettings;
  return typeof v === 'object' && v !== null &&
    (f.platform === 'custom' || PLATFORMS.some((p) => p.id === f.platform)) &&
    (f.transfer === 'custom' || TRANSFERS.some((p) => p.id === f.transfer)) &&
    pctOk(f.platformPct) && pctOk(f.transferPct);
};

/** The share of the gross that reaches your account: the platform takes its cut, then the transfer its own. */
export const keptShare = (f: FeeSettings) => (1 - f.platformPct / 100) * (1 - f.transferPct / 100);

/** Platform and transfer in the address, each part only when changed: ?platform=fiverr&transfer=wise&transfer_pct=0.5. */
export const FEES_QUERY: UrlQuery<FeeSettings> = {
  key: 'ft.fees',
  names: ['platform', 'platform_pct', 'transfer', 'transfer_pct'],
  toParams: (f) => [f.platform, String(f.platformPct), f.transfer, String(f.transferPct)],
  fromParams: ([platform, platformPct, transfer, transferPct]) => {
    const p = numberParam(platformPct!);
    const t = numberParam(transferPct!);
    return p === null || t === null ? null : { platform: platform!.toLowerCase(), platformPct: p, transfer: transfer!.toLowerCase(), transferPct: t };
  },
  isValid: isFees,
  defaults: DEFAULT_FEES,
  sparse: true,
};

export function useFees() {
  const [fees, setFees] = usePersistentState('ft.fees', DEFAULT_FEES, isFees);
  useUrlQuery(FEES_QUERY, fees);
  return [fees, setFees] as const;
}

/**
 * Its own collapsible card under the converter, like Working time: platform fee and currency-exchange cost,
 * then the path of the money from the invoice to your account.
 */
export function Fees({ monthRon, hour, anchor }: ConverterSnapshot) {
  const t = useT().fees;
  const lang = useLang();
  const [fees, setFees] = useFees();
  // Bumped when a choice sets a %, so the uncontrolled % fields show the new value; a new language remounts them
  // too, for its decimal mark.
  const [picks, setPicks] = useState(0);
  const kept = keptShare(fees);
  const feesMonth = monthRon * (1 - kept);
  // The minus only on an amount that shows: with nothing to take a cut of, 0,00 rather than −0,00.
  const cut = roundMoney(feesMonth) > 0;
  const platformCut = hour * (fees.platformPct / 100);
  const transferCut = (hour - platformCut) * (fees.transferPct / 100);

  const choice = (name: string, pct: number) => `${name} ${formatNumber(pct, 2)}%`;
  const summary = kept < 1
    ? t.summary(
      formatNumber(kept * 100, 2),
      [fees.platformPct > 0 && choice(fees.platform === 'custom' ? t.platform : t.platforms[fees.platform], fees.platformPct),
        fees.transferPct > 0 && choice(fees.transfer === 'custom' ? t.transfer : t.transfers[fees.transfer], fees.transferPct)]
        .filter(Boolean).join(' · '),
    )
    : t.summaryNone;

  return (
    <Fold id="fees" title={t.title} summary={summary} className="settings fees">
      <p className="muted small">{t.intro}</p>

      {/* The answer first (what reaches you a month), then the choices that lead to it. */}
      <dl className="stat-row fee-summary">
        <div className="stat-result"><dt>{t.sumReaches}</dt><dd>{formatMoney(monthRon * kept)} <span className="unit">{t.ronMonth}</span></dd></div>
        <div className={cut ? 'stat-cut' : undefined}><dt>{t.sumFees}</dt><dd>{cut ? '−' : ''}{formatMoney(feesMonth)} <span className="unit">{t.ronMonth}</span></dd></div>
      </dl>

      <div className="fee-steps" key={`${picks}-${lang}`}>
        <FeeStep
          step={1}
          label={t.platform}
          options={PLATFORMS}
          names={t.platforms}
          hints={t.platformHints}
          selected={fees.platform}
          pct={fees.platformPct}
          customLabel={t.custom}
          customHint={t.customHint}
          pctLabel={t.platformPct}
          search={{ placeholder: t.searchPlatform, empty: t.noPlatform }}
          onPick={(id, pct) => { setFees({ ...fees, platform: id as PlatformId | 'custom', platformPct: pct }); setPicks(picks + 1); }}
          onPct={(pct) => setFees({ ...fees, platform: 'custom', platformPct: pct })}
        />
        <FeeStep
          step={2}
          label={t.transfer}
          options={TRANSFERS}
          names={t.transfers}
          hints={t.transferHints}
          selected={fees.transfer}
          pct={fees.transferPct}
          customLabel={t.custom}
          customHint={t.customHint}
          pctLabel={t.transferPct}
          onPick={(id, pct) => { setFees({ ...fees, transfer: id as TransferId | 'custom', transferPct: pct }); setPicks(picks + 1); }}
          onPct={(pct) => setFees({ ...fees, transfer: 'custom', transferPct: pct })}
        />
      </div>

      {/* The path of one hour's pay: invoiced, minus each cut, kept. */}
      <ol className="fee-flow" aria-label={t.flowLabel}>
        <li>
          <span className="small muted">{t.invoiced}</span>
          <strong>{formatMoney(hour)} <span className="unit">{anchor}/{t.hourUnit}</span></strong>
        </li>
        <li className={platformCut > 0 ? 'cut' : 'cut zero'}>
          <span className="small muted">{t.platformCut(formatNumber(fees.platformPct, 2))}</span>
          <strong>−{formatMoney(platformCut)}</strong>
        </li>
        <li className={transferCut > 0 ? 'cut' : 'cut zero'}>
          <span className="small muted">{t.transferCut(formatNumber(fees.transferPct, 2))}</span>
          <strong>−{formatMoney(transferCut)}</strong>
        </li>
        <li className="fee-kept">
          <span className="small">{t.kept(formatNumber(kept * 100, 2))}</span>
          <strong>{formatMoney(hour * kept)} <span className="unit">{anchor}/{t.hourUnit}</span></strong>
        </li>
      </ol>
      <Notes items={t.notes} />
    </Fold>
  );
}

function FeeStep<Id extends string>({ step, label, options, names, hints, selected, pct, customLabel, customHint, pctLabel, search, onPick, onPct }: {
  step: number;
  label: string;
  options: readonly { id: Id; pct: number }[];
  names: Record<Id, string>;
  hints: Record<Id, string>;
  selected: Id | 'custom';
  pct: number;
  customLabel: string;
  customHint: string;
  pctLabel: string;
  search?: { placeholder: string; empty: (q: string) => string };
  onPick: (id: Id | 'custom', pct: number) => void;
  onPct: (pct: number) => void;
}) {
  const list = [
    ...options.map((o) => ({ value: o.id as Id | 'custom', label: o.id === 'none' ? names[o.id] : `${names[o.id]} · ${formatNumber(o.pct)}%` })),
    // Like the other choices ("Upwork · 10%"): "x%" until chosen, then the % typed beside the list.
    { value: 'custom' as const, label: `${customLabel} · ${selected === 'custom' ? formatNumber(pct, 2) : 'x'}%` },
  ];
  return (
    <div className="fee-step">
      <span className="fee-step-head">
        <span className="fee-step-no" aria-hidden="true">{step}</span>
        {label}
      </span>
      <div className="fee-step-fields">
        <ListPicker
          value={selected}
          options={list}
          label={label}
          search={search}
          columns={2}
          onChange={(id) => onPick(id, id === 'custom' ? pct : options.find((o) => o.id === id)!.pct)}
        />
        <label className="fee-pct">
          <input
            inputMode="decimal"
            autoComplete="off"
            name={`fee-${step}`}
            defaultValue={formatEditable(pct)}
            aria-label={pctLabel}
            onPaste={refuseNonNumberPaste}
            onChange={(e) => {
              if (refuseWordIn(e.currentTarget)) return;
              const v = parseAmount(e.target.value);
              const ok = v !== null && v >= 0 && v < 100;
              e.currentTarget.setAttribute('aria-invalid', String(!ok));
              if (ok) onPct(v);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
              e.preventDefault();
              const v = Math.min(Math.max((parseAmount(e.currentTarget.value) ?? pct) + (e.key === 'ArrowUp' ? 0.5 : -0.5), 0), 99);
              e.currentTarget.value = formatEditable(v);
              e.currentTarget.setAttribute('aria-invalid', 'false');
              onPct(v);
            }}
          />
          <span aria-hidden="true">%</span>
        </label>
      </div>
      <p className="small muted fee-hint">{selected === 'custom' ? customHint : hints[selected]}</p>
    </div>
  );
}
