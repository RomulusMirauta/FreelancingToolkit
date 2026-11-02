import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { Fold } from '../../lib/ui/Fold';
import { holidaysOnWorkdays } from '../../lib/time/holidays';
import { DEFAULT_WORK, HOLIDAY_YEAR, hoursIn, isValidWork, maxDaysOff, workDaysIn, type WorkSettings } from '../../lib/time/periods';
import { formatNumber, parseAmount } from '../../lib/ui/numbers';

interface Props {
  work: WorkSettings;
  setWork: (w: WorkSettings) => void;
}

type NumberKey = 'hoursPerDay' | 'daysPerWeek' | 'daysOff' | 'billablePct';

const FIELDS: { key: NumberKey; min: number; step: number }[] = [
  { key: 'hoursPerDay', min: 0.5, step: 0.5 },
  { key: 'daysPerWeek', min: 0.5, step: 0.5 },
  { key: 'daysOff', min: 0, step: 1 },
  { key: 'billablePct', min: 1, step: 5 },
];

const fieldMax = (key: NumberKey, work: WorkSettings) =>
  key === 'hoursPerDay' ? 24 : key === 'daysPerWeek' ? 7 : key === 'daysOff' ? maxDaysOff(work) : 100;

const PRESETS = [
  { key: 'fullTime', hoursPerDay: DEFAULT_WORK.hoursPerDay, daysPerWeek: DEFAULT_WORK.daysPerWeek },
  { key: 'partTime', hoursPerDay: 4, daysPerWeek: 5 },
  { key: 'fourDay', hoursPerDay: 8, daysPerWeek: 4 },
  { key: 'weekend', hoursPerDay: 8, daysPerWeek: 2 },
] as const;

export function Settings({ work, setWork }: Props) {
  const t = useT().settings;
  // The inputs are uncontrolled so partial typing ("0.") is not overwritten; bumping this remounts them on a preset.
  const [resets, setResets] = useState(0);
  const holidayDays = holidaysOnWorkdays(HOLIDAY_YEAR, work.daysPerWeek);
  return (
    <Fold
      id="work"
      title={t.title}
      summary={t.summary(work.hoursPerDay, work.daysPerWeek, formatNumber(workDaysIn(work)), Math.round(hoursIn('year', work)))}
      className="settings"
    >
      <div className="chips settings-presets" role="group" aria-label={t.presets}>
        {PRESETS.map((p) => {
          const on = work.hoursPerDay === p.hoursPerDay && work.daysPerWeek === p.daysPerWeek;
          return (
            <button
              key={p.key}
              type="button"
              className={on ? 'chip on' : 'chip'}
              aria-pressed={on}
              onClick={() => {
                // A preset only sets the daily and weekly rhythm; days off, holidays and billable share stay.
                const next = { ...work, hoursPerDay: p.hoursPerDay, daysPerWeek: p.daysPerWeek };
                setWork({ ...next, daysOff: Math.min(next.daysOff, maxDaysOff(next)) });
                setResets(resets + 1);
              }}
            >
              {t.presetNames[p.key]} <span className="preset-detail">{t.preset(p.hoursPerDay, p.daysPerWeek)}</span>
            </button>
          );
        })}
      </div>
      <div className="settings-grid" key={resets}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span>{t[f.key]}</span>
            <input
              type="number"
              inputMode="decimal"
              min={f.min}
              max={fieldMax(f.key, work)}
              step={f.step}
              defaultValue={work[f.key]}
              onChange={(e) => {
                const v = parseAmount(e.target.value);
                const next = { ...work, [f.key]: v };
                if (v !== null && v >= f.min && isValidWork(next)) setWork(next);
              }}
            />
          </label>
        ))}
        <label className="settings-check">
          <input
            type="checkbox"
            checked={work.holidays}
            onChange={(e) => {
              const next = { ...work, holidays: e.target.checked };
              setWork({ ...next, daysOff: Math.min(next.daysOff, maxDaysOff(next)) });
              setResets(resets + 1);
            }}
          />
          <span>{t.holidays(HOLIDAY_YEAR, formatNumber(holidayDays))}</span>
        </label>
      </div>
      <p className="muted small">{t.billableHint}</p>
      <p className="muted small">{t.note}</p>
      <p className="muted small">{t.defaults}</p>
    </Fold>
  );
}
