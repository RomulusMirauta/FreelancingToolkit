import { useState } from 'react';
import { useLang, useT } from '../../lib/i18n';
import { Fold } from '../../lib/ui/Fold';
import { Notes } from '../../lib/ui/Notes';
import { holidaysOnWorkdays } from '../../lib/time/holidays';
import { DEFAULT_WORK, holidayYear, hoursIn, isValidWork, maxDaysOff, workDaysIn, type WorkSettings } from '../../lib/time/periods';
import { formatEditable, formatNumber, parseAmount } from '../../lib/ui/numbers';

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
  // Not "weekends only": up to five days a week, the public holidays counted are Monday to Friday's (holidaysOnWorkdays).
  { key: 'twoDay', hoursPerDay: 8, daysPerWeek: 2 },
] as const;

export function Settings({ work, setWork }: Props) {
  const t = useT().settings;
  const lang = useLang();
  // The inputs are uncontrolled so partial typing ("0.") is not overwritten; bumping this remounts them on a preset.
  // A new language remounts them too, so their text takes its decimal mark (7,5 → 7.5).
  const [resets, setResets] = useState(0);
  const year = holidayYear();
  const holidayDays = holidaysOnWorkdays(year, work.daysPerWeek);
  return (
    <Fold
      id="work"
      title={t.title}
      summary={t.summary(formatNumber(work.hoursPerDay), formatNumber(work.daysPerWeek), formatNumber(workDaysIn(work)), formatNumber(hoursIn('year', work), 0))}
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
      <div className="settings-grid" key={`${resets}-${lang}`}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span>{t[f.key]}</span>
            <input
              // Text with a decimal keypad, not type=number: no spinners, no scroll-wheel changes, a comma works.
              inputMode={f.step < 1 ? 'decimal' : 'numeric'}
              autoComplete="off"
              name={f.key}
              defaultValue={formatEditable(work[f.key])}
              onChange={(e) => {
                const v = parseAmount(e.target.value);
                const next = { ...work, [f.key]: v };
                const ok = v !== null && v >= f.min && v <= fieldMax(f.key, work) && isValidWork(next);
                e.currentTarget.setAttribute('aria-invalid', String(!ok));
                if (ok) setWork(next);
              }}
              onKeyDown={(e) => {
                // Up and down step the value, as a number field would.
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                e.preventDefault();
                const v = (parseAmount(e.currentTarget.value) ?? work[f.key]) + (e.key === 'ArrowUp' ? f.step : -f.step);
                const clamped = Math.min(Math.max(v, f.min), fieldMax(f.key, work));
                const next = { ...work, [f.key]: clamped };
                if (!isValidWork(next)) return;
                e.currentTarget.value = formatEditable(clamped);
                e.currentTarget.setAttribute('aria-invalid', 'false');
                setWork(next);
              }}
            />
          </label>
        ))}
        <label className="settings-check">
          <input
            type="checkbox"
            name="holidays"
            checked={work.holidays}
            onChange={(e) => {
              const next = { ...work, holidays: e.target.checked };
              setWork({ ...next, daysOff: Math.min(next.daysOff, maxDaysOff(next)) });
              setResets(resets + 1);
            }}
          />
          <span>{t.holidays(year, formatNumber(holidayDays))}</span>
        </label>
      </div>
      {/* What the settings come to, read-only: the figures every period of the converter is built from. */}
      <dl className="stat-row" aria-label={t.statsLabel}>
        <div><dt>{t.stats.week}</dt><dd>{formatNumber(hoursIn('week', work))}</dd></div>
        <div><dt>{t.stats.month}</dt><dd>{formatNumber(hoursIn('month', work))}</dd></div>
        <div><dt>{t.stats.year}</dt><dd>{formatNumber(hoursIn('year', work), 0)}</dd></div>
        <div><dt>{t.stats.days}</dt><dd>{formatNumber(workDaysIn(work))}</dd></div>
      </dl>
      <Notes items={t.notes} />
    </Fold>
  );
}
