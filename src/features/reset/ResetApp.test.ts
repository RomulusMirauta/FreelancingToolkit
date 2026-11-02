import { describe, expect, it } from 'vitest';
import { APP_KEYS, PAGE_KEYS } from './ResetApp';

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

  it('no setting belongs to two places', () => {
    expect(new Set(owned).size).toBe(owned.length);
  });
});
