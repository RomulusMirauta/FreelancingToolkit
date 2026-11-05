import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { Fold } from '../../lib/ui/Fold';
import { daysUntil, nextMonthly, upcomingDeadlines, type Audience, type Deadline, type DeadlineKind } from '../../lib/tax/calendar';

type Filter = 'all' | Audience;
const FILTERS: Filter[] = ['all', 'pfa', 'srl'];
/** The ANAF form filed at each deadline (the annual accounts have several, by company size: none shown). */
const FORMS: Partial<Record<DeadlineKind, string>> = { bonus: 'D212', du: 'D212', microQ: 'D100', microQ4: 'D100', d101: 'D101' };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const keyOf = (d: Deadline) => `${d.kind}${d.year}${d.quarter ?? ''}`;
/** Deadlines in order, grouped by calendar month. */
function groupByMonth(list: Deadline[]): [string, Deadline[]][] {
  const groups = new Map<string, Deadline[]>();
  for (const d of list) {
    const k = iso(d.date).slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return [...groups];
}

/** The tax deadlines of the next twelve months, soonest first, plus the monthly ones on the 25th. */
export function Calendar() {
  const { calendar: t, locale } = useT();
  const [filter, setFilter] = useState<Filter>('all');
  // Read on every render on purpose, so a page left open moves on to the next day.
  // eslint-disable-next-line react/purity
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
      {list.length > 0 && (
        <>
          <h3 className="cal-heading">{t.nextTitle}</h3>
          {/* The three soonest as cards: the day big, the form to file, what it is. */}
          <ol className="next-deadlines">
            {list.slice(0, 3).map((d, i) => (
              <li key={keyOf(d)} className={i === 0 ? 'next' : undefined}>
                <time className="nd-date" dateTime={iso(d.date)}>
                  <span className="nd-day">{d.date.getDate()}</span>
                  <span className="nd-month">{d.date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}</span>
                </time>
                <span className="nd-body">
                  <span className="nd-meta">
                    {FORMS[d.kind] && <span className="form-code" title={t.formTitle}>{FORMS[d.kind]}</span>}
                    <span className="muted small">{t.inDays(daysUntil(today, d.date))}</span>
                  </span>
                  <span className="nd-what">
                    {t.kinds[d.kind](d.year, d.quarter ?? 0)}
                    {d.kind === 'bonus' && <span className="badge">{t.toConfirm}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {list.length > 3 && (
        <>
          <h3 className="cal-heading">{t.laterTitle}</h3>
          {groupByMonth(list.slice(3)).map(([month, items]) => (
            <section className="month-group" key={month}>
              <h4>{items[0]!.date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h4>
              <ol className="deadlines">
                {items.map((d) => (
                  <li key={keyOf(d)}>
                    <time dateTime={iso(d.date)}>{d.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}</time>
                    <span className="deadline-what">
                      {FORMS[d.kind] && <span className="form-code">{FORMS[d.kind]}</span>}
                      {t.kinds[d.kind](d.year, d.quarter ?? 0)}
                      {d.kind === 'bonus' && <span className="badge">{t.toConfirm}</span>}
                    </span>
                    <span className="muted small deadline-when">{t.inDays(daysUntil(today, d.date))}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
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
