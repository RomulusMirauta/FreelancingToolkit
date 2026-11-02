import { useEffect, useState } from 'react';
import { Converter } from './features/converter/Converter';
import { ResetApp } from './features/reset/ResetApp';
import { Settings } from './features/settings/Settings';
import { DEFAULT_INCOME, Taxes, isTaxIncome } from './features/taxes/Taxes';
import { DEFAULT_LANG, LANGS, LangProvider, isLang, useT, type Lang } from './lib/i18n';
import { DEFAULT_WORK, isValidWork, type WorkSettings } from './lib/time/periods';
import { THEMES, applyTheme, isTheme, type Theme } from './lib/ui/theme';
import { usePersistentState } from './lib/ui/usePersistentState';

const isWork = (v: unknown): v is WorkSettings =>
  typeof v === 'object' && v !== null &&
  ['hoursPerDay', 'daysPerWeek', 'weeksOff'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number') &&
  isValidWork(v as WorkSettings);

type View = 'converter' | 'taxes';
const viewFromHash = (): View => (location.hash === '#taxes' ? 'taxes' : 'converter');

export function App() {
  const [lang, setLang] = usePersistentState<Lang>('ft.lang', DEFAULT_LANG, isLang);
  return (
    <LangProvider lang={lang}>
      <Shell lang={lang} setLang={setLang} />
    </LangProvider>
  );
}

function Shell({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT();
  const [work, setWork] = usePersistentState('ft.work', DEFAULT_WORK, isWork);
  const [income, setIncome] = usePersistentState('ft.taxIncome', DEFAULT_INCOME, isTaxIncome);
  const [view, setView] = useState<View>(viewFromHash);
  const [theme, setTheme] = usePersistentState<Theme>('ft.theme', 'system', isTheme);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (v: View) => {
    history.replaceState(null, '', v === 'taxes' ? '#taxes' : location.pathname + location.search);
    setView(v);
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* Display switches in the strip above the header: language top-left, theme top-right. */}
      <div className="lang-switch corner-left" role="group" aria-label={t.app.language}>
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="corner">
        <div className="theme-switch" role="group" aria-label={t.app.theme}>
          {THEMES.map((th) => (
            <button key={th} type="button" aria-pressed={theme === th} aria-label={t.app.themes[th]} title={t.app.themes[th]} onClick={() => setTheme(th)}>
              <span aria-hidden="true">{th === 'system' ? '◐' : th === 'light' ? '☀' : '☾'}</span>
            </button>
          ))}
        </div>
      </div>
      <header className="app-header">
        <div>
          <h1>FreelancingToolkit</h1>
          <p className="muted">{t.app.subtitle}</p>
        </div>
        <div className="header-controls">
          <nav className="views" aria-label={t.app.sections}>
            <button type="button" aria-current={view === 'converter' ? 'page' : undefined} onClick={() => go('converter')}>
              <ConverterIcon />
              {t.app.converter}
            </button>
            <button type="button" aria-current={view === 'taxes' ? 'page' : undefined} onClick={() => go('taxes')}>
              <TaxesIcon />
              {t.app.taxes}
            </button>
          </nav>
        </div>
      </header>
      <main>
        {view === 'converter' ? (
          <>
            <Converter
              work={work}
              onTaxes={(yearRon) => {
                setIncome({ amount: Math.round(yearRon / 12), per: 'month', currency: 'RON' });
                go('taxes');
              }}
            />
            <Settings work={work} setWork={setWork} />
          </>
        ) : (
          <Taxes income={income} setIncome={setIncome} work={work} />
        )}
      </main>
      <footer className="muted small">{t.app.footer}</footer>
      <ResetApp page={view} />
    </>
  );
}

/* Small line icons for the section switch; they inherit the text colour. */
function ConverterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

function TaxesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9.5 14.5l5-5M10 10h.01M14 14h.01" />
    </svg>
  );
}
