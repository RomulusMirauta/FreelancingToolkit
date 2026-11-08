import { useCallback, useEffect, useState } from 'react';
import { SharedBanner, TopActions } from './features/app/TopActions';
import { ViewSwitch } from './features/app/ViewSwitch';
import { Converter, DEFAULT_SOURCE, type ConverterSnapshot } from './features/converter/Converter';
import { saveSource } from './features/converter/sourceQuery';
import { Fees } from './features/converter/Fees';
import { ResetApp } from './features/reset/ResetApp';
import { Settings } from './features/settings/Settings';
import { DEFAULT_INCOME, INCOME_QUERY, Taxes, isTaxIncome, type TaxIncome } from './features/taxes/Taxes';
import { DEFAULT_LANG, LangProvider, isLang, useT, type Lang } from './lib/i18n';
import { DEFAULT_WORK, readWork } from './lib/time/periods';
import { roundMoney } from './lib/ui/numbers';
import { flushQuery } from './lib/ui/query';
import { applyTheme, isTheme, type Theme } from './lib/ui/theme';
import { usePersistentState } from './lib/ui/usePersistentState';
import { useUrlQuery } from './lib/ui/urlQuery';
import { LANG_QUERY, THEME_QUERY, WORK_QUERY, isWork } from './features/app/appQueries';
import { Toast } from './lib/ui/toast';
import { trackView } from './lib/analytics';


type View = 'converter' | 'taxes';
const viewFromHash = (): View => (location.hash === '#taxes' ? 'taxes' : 'converter');

export function App() {
  const [lang, setLang] = usePersistentState<Lang>('ft.lang', DEFAULT_LANG, isLang);
  useUrlQuery(LANG_QUERY, lang);
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
  // Kept here, not on the tax page: the income also follows the converter while the tax page is closed.
  useUrlQuery(INCOME_QUERY, income);
  const [view, setView] = useState<View>(viewFromHash);
  const [theme, setTheme] = usePersistentState<Theme>('ft.theme', 'system', isTheme);
  useUrlQuery(THEME_QUERY, theme);
  useUrlQuery(WORK_QUERY, work);

  useEffect(() => applyTheme(theme), [theme]);

  // The converter's figures, for the fees card under Working time.
  const [snapshot, setSnapshot] = useState<ConverterSnapshot | null>(null);

  // Stable, so the converter's effect runs only when its amount changes.
  const followConverter = useCallback(
    (monthRon: number) => setIncome({ amount: roundMoney(monthRon), per: 'month', currency: 'RON' }),
    [setIncome],
  );

  // The other way round: an income typed on the tax page becomes the converter's amount (same amount,
  // currency and period), so both pages show the same money. The default income gives the default 30 EUR/hour.
  const setIncomeFromTaxes = useCallback((i: TaxIncome) => {
    setIncome(i);
    const isDefault = i.amount === DEFAULT_INCOME.amount && i.currency === DEFAULT_INCOME.currency && i.per === DEFAULT_INCOME.per;
    saveSource(isDefault ? DEFAULT_SOURCE : { amount: i.amount, currency: i.currency, period: i.per }, DEFAULT_SOURCE);
  }, [setIncome]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // A visit to each page, counted without the address's settings (see lib/analytics.ts).
  useEffect(() => trackView(view), [view]);

  const go = (v: View) => {
    flushQuery(v === 'taxes' ? '#taxes' : '');
    setView(v);
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* The advanced options (theme, language, copy link, install) in the top-right corner. */}
      <div className="corner">
        <TopActions view={view} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} />
      </div>
      <header className="app-header">
        <div className="brand">
          {/* The app icon in small, so the header reads like the installed app. */}
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={44} height={44} />
          <div>
            <h1>Freelancing<span>Toolkit</span></h1>
            <p className="muted">{t.app.subtitle}</p>
          </div>
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
                // Rounded to the ban like the income that follows the converter, so the two agree.
                setIncome({ amount: roundMoney(yearRon / 12), per: 'month', currency: 'RON' });
                go('taxes');
              }}
              onIncome={followConverter}
              onSnapshot={setSnapshot}
            />
            <Settings work={work} setWork={setWork} />
            {snapshot && <Fees {...snapshot} />}
          </>
        ) : (
          <Taxes income={income} setIncome={setIncomeFromTaxes} work={work} />
        )}
      </main>
      <footer className="muted small">{t.app.footer}</footer>
      <ResetApp page={view} />
      <Toast />
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
