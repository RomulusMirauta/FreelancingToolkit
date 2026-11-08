import { describe, expect, it } from 'vitest';
import { en, ro } from '../../lib/i18n/strings';
import { STORAGE_PREFIX } from '../../lib/ui/usePersistentState';
import { APP_KEYS, PAGE_FOLDS, PAGE_KEYS } from './ResetApp';

// The app's source files, as text.
const SOURCES = import.meta.glob(['../../**/*.{ts,tsx}', '!../../**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every 'ft.…' storage key written anywhere in the app's source. */
function keysInSource(): Set<string> {
  const found = new Set<string>();
  for (const text of Object.values(SOURCES)) {
    for (const m of text.matchAll(/'(ft\.[A-Za-z]+)'/g)) found.add(m[1]!);
  }
  return found;
}

describe('reset buttons', () => {
  const owned = [...PAGE_KEYS.converter, ...PAGE_KEYS.taxes, ...APP_KEYS];

  it('every saved setting belongs to a tab or to the whole app, so a reset never forgets one', () => {
    const found = keysInSource();
    expect(found.size).toBeGreaterThan(8);
    const missing = [...found].filter((k) => !owned.includes(k));
    expect(missing).toEqual([]);
  });

  it('every foldable section belongs to a tab, so "Reset tab" unfolds it', () => {
    const ids = new Set<string>();
    for (const text of Object.values(SOURCES)) {
      for (const m of text.matchAll(/<Fold\s+id="([A-Za-z]+)"/g)) ids.add(m[1]!);
    }
    expect(ids.size).toBe(9);
    const owned = [...PAGE_FOLDS.converter, ...PAGE_FOLDS.taxes];
    expect([...ids].filter((id) => !owned.includes(id))).toEqual([]);
    expect(owned.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('no setting belongs to two places', () => {
    expect(new Set(owned).size).toBe(owned.length);
  });

  it('"Reset app" clears the language and theme too, and its confirmation says so', () => {
    // resetApp() removes every saved key with the prefix; the confirmation said "Language and theme stay".
    expect(APP_KEYS.every((k) => k.startsWith(STORAGE_PREFIX))).toBe(true);
    expect(en.reset.confirmText).toMatch(/ The language goes back to Romanian, and the theme to automatic\.$/);
    expect(ro.reset.confirmText).toMatch(/ Limba revine la română, iar tema trece pe automat\.$/);
    for (const text of [en.reset.confirmText, ro.reset.confirmText]) expect(text).not.toMatch(/stay|rămân/);
  });
});
