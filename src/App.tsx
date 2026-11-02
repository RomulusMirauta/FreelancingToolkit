import { useCallback, useEffect, useState } from 'react';
import { SharedBanner, TopActions } from './features/app/TopActions';
import { LangSlider, ThemeSlider } from './features/app/ThemeSlider';
import { ViewSwitch } from './features/app/ViewSwitch';
import { Converter, type ConverterSnapshot } from './features/converter/Converter';
import { Fees } from './features/converter/Fees';
import { ResetApp } from './features/reset/ResetApp';
import { Settings } from './features/settings/Settings';
import { DEFAULT_INCOME, Taxes, isTaxIncome } from './features/taxes/Taxes';
import { DEFAULT_LANG, LangProvider, isLang, useT, type Lang } from './lib/i18n';
import { DEFAULT_WORK, isValidWork, readWork, type WorkSettings } from './lib/time/periods';
import { applyTheme, isTheme, type Theme } from './lib/ui/theme';
import { usePersistentState } from './lib/ui/usePersistentState';

const isWork = (v: unknown): v is WorkSettings =>
  typeof v === 'object' && v !== null &&
  ['hoursPerDay', 'daysPerWeek', 'daysOff', 'billablePct'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number') &&
  typeof (v as WorkSettings).holidays === 'boolean' &&
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
  const [work, setWork] = usePersistentState('ft.work', DEFAULT_WORK, isWork, readWork);
  const [income, setIncome] = usePersistentState('ft.taxIncome', DEFAULT_INCOME, isTaxIncome);
  const [view, setView] = useState<View>(viewFromHash);
  const [theme, setTheme] = usePersistentState<Theme>('ft.theme', 'system', isTheme);

  useEffect(() => applyTheme(theme), [theme]);

  // The converter's figures, for the fees card under Working time.
  const [snapshot, setSnapshot] = useState<ConverterSnapshot | null>(null);

  // Stable, so the converter's effect runs only when its amount changes.
  const followConverter = useCallback(
    (monthRon: number) => setIncome({ amount: Math.round(monthRon * 100) / 100, per: 'month', currency: 'RON' }),
    [setIncome],
  );

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
      {/* Language, theme and the advanced options together in the top-right corner. */}
      <div className="corner">
        <LangSlider lang={lang} setLang={setLang} />
        <ThemeSlider theme={theme} setTheme={setTheme} />
        <TopActions view={view} />
      </div>
      <header className="app-header">
        <div>
          <h1>FreelancingToolkit</h1>
          <p className="muted">{t.app.subtitle}</p>
        </div>
        <div className="header-controls">
          <ViewSwitch
            value={view}
            options={[
              { value: 'converter', label: t.app.converter, icon: <ConverterIcon /> },
              { value: 'taxes', label: t.app.taxes, icon: <TaxesIcon /> },
            ]}
            onChange={go}
            label={t.app.sections}
          />
        </div>
      </header>
      <main>
        <SharedBanner />
        {view === 'converter' ? (
          <>
            <Converter
              work={work}
              onTaxes={(yearRon) => {
                setIncome({ amount: Math.round(yearRon / 12), per: 'month', currency: 'RON' });
                go('taxes');
              }}
              onIncome={followConverter}
              onSnapshot={setSnapshot}
            />
            <Settings work={work} setWork={setWork} />
            {snapshot && <Fees {...snapshot} />}
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
