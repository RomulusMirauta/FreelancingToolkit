import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { setNumberLocale } from '../ui/numbers';
import { en, ro, type Strings } from './strings';

export type Lang = 'ro' | 'en';
export const LANGS: Lang[] = ['ro', 'en'];
export const DEFAULT_LANG: Lang = 'ro';
export const isLang = (v: unknown): v is Lang => v === 'ro' || v === 'en';

const STRINGS: Record<Lang, Strings> = { ro, en };
const LangContext = createContext<Lang>(DEFAULT_LANG);

/** Provides the language to the tree; number formatting follows it (1.234,56 in RO, 1,234.56 in EN). */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  // Set during render so every formatMoney call below already uses the new locale.
  setNumberLocale(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): Strings {
  return STRINGS[useContext(LangContext)];
}
