import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import { THEME_QUERY } from './appQueries';

// index.html's first script sets the theme before the page paints; the app then sets it again from THEME_QUERY.
const SCRIPT = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;

/** The theme the script paints for an address and a saved theme (undefined: automatic, as the system's). */
function painted(search: string, saved: string | null): string | undefined {
  const root = { dataset: {} as Record<string, string> };
  new Function('location', 'localStorage', 'document', SCRIPT)(
    { search },
    { getItem: (key: string) => (key === 'ft.theme' ? saved : null) },
    { documentElement: root },
  );
  return root.dataset.theme;
}

/** The theme the app shows for the same: a valid ?theme= wins over the saved one (applyUrlQuery). */
function shown(search: string, saved: string | null): string | undefined {
  const params = new URLSearchParams(search);
  const fromUrl = params.has('theme') ? THEME_QUERY.fromParams([params.get('theme')!], null) : null;
  const stored: unknown = saved === null ? null : JSON.parse(saved);
  const theme = THEME_QUERY.isValid(fromUrl) ? fromUrl : THEME_QUERY.isValid(stored) ? stored : 'system';
  return theme === 'system' ? undefined : theme;
}

describe('the theme before the app starts', () => {
  it('is the one the app shows, however ?theme= is written', () => {
    const values = ['light', 'dark', 'system', 'auto', 'Light', 'DARK', 'Dark', 'System', 'AUTO', 'purple', ''];
    for (const search of ['', ...values.map((v) => `?theme=${v}`)]) {
      for (const saved of [null, '"light"', '"dark"', '"system"']) {
        expect(painted(search, saved), `${search || 'no ?theme='}, saved ${saved}`).toBe(shown(search, saved));
      }
    }
  });
});
