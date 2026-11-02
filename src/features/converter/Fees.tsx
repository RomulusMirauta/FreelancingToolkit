import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { Fold } from '../../lib/ui/Fold';
import { formatMoney, formatNumber, parseAmount } from '../../lib/ui/numbers';
import { usePersistentState } from '../../lib/ui/usePersistentState';
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

export function useFees() {
  return usePersistentState('ft.fees', DEFAULT_FEES, isFees);
}

/**
 * Its own collapsible card under the converter, like Working time: platform fee and currency-exchange cost,
 * then the path of the money from the invoice to your account.
 */
export function Fees({ monthRon, hour, anchor }: ConverterSnapshot) {
  const t = useT().fees;
  const [fees, setFees] = useFees();
  // Bumped when a choice sets a %, so the uncontrolled % fields show the new value.
  const [picks, setPicks] = useState(0);
  const kept = keptShare(fees);
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

      <div className="fee-steps" key={picks}>
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
      <p className="fee-month">
        {kept < 1
          ? t.month(formatMoney(monthRon * kept), formatMoney(monthRon * (1 - kept)))
          : t.monthNoFees(formatMoney(monthRon))}
      </p>
      <p className="muted small">{t.note}</p>
      <p className="muted small">{t.defaults}</p>
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
    { value: 'custom' as const, label: customLabel },
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
            type="number"
            inputMode="decimal"
            min={0}
            max={99}
            step={0.5}
            defaultValue={pct}
            aria-label={pctLabel}
            onChange={(e) => {
              const v = parseAmount(e.target.value);
              if (v !== null && v >= 0 && v < 100) onPct(v);
            }}
          />
          <span aria-hidden="true">%</span>
        </label>
      </div>
      <p className="small muted fee-hint">{selected === 'custom' ? customHint : hints[selected]}</p>
    </div>
  );
}
