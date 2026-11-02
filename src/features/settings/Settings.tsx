import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { DEFAULT_WORK, WEEKS_PER_YEAR, hoursIn, type WorkSettings } from '../../lib/time/periods';
import { parseAmount } from '../../lib/ui/numbers';

interface Props {
  work: WorkSettings;
  setWork: (w: WorkSettings) => void;
}

const FIELDS: { key: keyof WorkSettings; min: number; max: number; step: number }[] = [
  { key: 'hoursPerDay', min: 0.5, max: 24, step: 0.5 },
  { key: 'daysPerWeek', min: 0.5, max: 7, step: 0.5 },
  { key: 'weeksOff', min: 0, max: WEEKS_PER_YEAR - 1, step: 1 },
];

export function Settings({ work, setWork }: Props) {
  const t = useT().settings;
  // The inputs are uncontrolled so partial typing ("0.") is not overwritten; bumping this remounts them on reset.
  const [resets, setResets] = useState(0);
  return (
    <details className="card settings" open>
      <summary>
        <h2>{t.title}</h2>
        <span className="muted">
          {t.summary(work.hoursPerDay, work.daysPerWeek, WEEKS_PER_YEAR - work.weeksOff, Math.round(hoursIn('year', work)))}
        </span>
      </summary>
      <div className="settings-grid" key={resets}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span>{t[f.key]}</span>
            <input
              type="number"
              inputMode="decimal"
              min={f.min}
              max={f.max}
              step={f.step}
              defaultValue={work[f.key]}
              onChange={(e) => {
                const v = parseAmount(e.target.value);
                if (v !== null && v >= f.min && v <= f.max) setWork({ ...work, [f.key]: v });
              }}
            />
          </label>
        ))}
        <button type="button" className="link-btn" onClick={() => {
            setWork(DEFAULT_WORK);
            setResets(resets + 1);
          }}>
          {t.reset}
        </button>
      </div>
      <p className="muted small">{t.note}</p>
    </details>
  );
}
