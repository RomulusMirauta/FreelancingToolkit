export type Theme = 'system' | 'light' | 'dark';
export const THEMES: Theme[] = ['system', 'light', 'dark'];
export const isTheme = (v: unknown): v is Theme => v === 'system' || v === 'light' || v === 'dark';

/** "system" leaves the choice to prefers-color-scheme; light/dark force it (see the tokens in styles.css). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
