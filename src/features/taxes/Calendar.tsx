import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { Fold } from '../../lib/ui/Fold';
import { daysUntil, nextMonthly, upcomingDeadlines, type Audience } from '../../lib/tax/calendar';

type Filter = 'all' | Audience;
const FILTERS: Filter[] = ['all', 'pfa', 'srl'];

/** The tax deadlines of the next twelve months, soonest first, plus the monthly ones on the 25th. */
export function Calendar() {
  const { calendar: t, locale } = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const today = new Date();
  const list = upcomingDeadlines(today).filter((d) => filter === 'all' || d.audience.includes(filter));
  const monthly = nextMonthly(today);
  const fmt = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Fold
      id="calendar"
      title={t.title}
      summary={list[0] && t.foldSummary(list[0].date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }), t.inDays(daysUntil(today, list[0].date)))}
      className="other-income calendar"
    >
      <p className="muted small">{t.intro}</p>
      <div className="chips" role="group" aria-label={t.filterLabel}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={filter === f ? 'chip on' : 'chip'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t.filters[f]}
          </button>
        ))}
      </div>
      <ol className="deadlines">
        {list.map((d, i) => (
          <li key={`${d.kind}${d.year}${d.quarter ?? ''}`} className={i === 0 ? 'next' : undefined}>
            <time dateTime={d.date.toISOString().slice(0, 10)}>{fmt(d.date)}</time>
            <span className="muted small">{t.inDays(daysUntil(today, d.date))}</span>
            <span className="deadline-what">
              {t.kinds[d.kind](d.year, d.quarter ?? 0)}
              {d.kind === 'bonus' && <span className="badge">{t.toConfirm}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="monthly">
        <strong>{t.monthlyTitle(fmt(monthly), t.inDays(daysUntil(today, monthly)))}</strong>
        <ul>
          {t.monthly.filter((m) => filter === 'all' || m.audience.includes(filter)).map((m) => <li key={m.text}>{m.text}</li>)}
        </ul>
      </div>
      <p className="muted small">{t.note}</p>
    </Fold>
  );
}
