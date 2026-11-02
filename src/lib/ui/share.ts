import { foldParam } from './folds';
import { writeQuery } from './query';
import { PAGE_KEYS, PAGE_QUERY, type Page } from './settingsKeys';

/**
 * A link that carries the page settings as query parameters (?share=1&work=…&taxIncome=…), each value the
 * JSON saved in localStorage. Language and theme stay the viewer's own. A setting missing from the link is
 * on its default. Values are checked by each setting's validator when read, so a bad one falls back to it.
 */
const SHARED_KEYS = [...PAGE_KEYS.converter, ...PAGE_KEYS.taxes];
const MARK = 'share';
const param = (key: string) => key.replace(/^ft\./, '');

export function shareUrl(view: Page): string {
  const params = new URLSearchParams({ [MARK]: '1' });
  try {
    for (const key of SHARED_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) params.set(param(key), raw);
    }
  } catch {
    // storage unavailable: the link opens on the defaults
  }
  const fold = foldParam();
  if (fold) params.set('fold', fold); // folded sections travel too
  return `${location.origin}${location.pathname}?${params}${view === 'taxes' ? '#taxes' : ''}`;
}

/** The viewer's own settings from before the link replaced them, for "back to my settings". */
let backup: Record<string, string> | null = null;

/**
 * Runs once before the app renders: if the address is a shared link, its settings replace the page settings
 * and the query string is removed, so a reload or a reset never applies the link again.
 */
export function applySharedLink(): void {
  const params = new URLSearchParams(location.search);
  if (!params.has(MARK)) return;
  try {
    const saved: Record<string, string> = {};
    for (const key of SHARED_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) saved[key] = raw;
      localStorage.removeItem(key);
    }
    backup = saved;
    for (const key of SHARED_KEYS) {
      const raw = params.get(param(key));
      if (raw === null) continue;
      try {
        JSON.parse(raw);
        localStorage.setItem(key, raw);
      } catch {
        // not JSON: that setting stays on its default
      }
    }
  } catch {
    // storage unavailable: the app opens on its defaults
  }
  // Keep only the folded sections, which belong in the address.
  const fold = params.get('fold');
  history.replaceState(null, '', `${location.pathname}${fold ? `?fold=${fold}` : ''}${location.hash}`);
}

/** Whether this visit opened a shared link, and whether there were own settings to go back to. */
export function sharedLinkState(): { opened: boolean; hadOwn: boolean } {
  return { opened: backup !== null, hadOwn: backup !== null && Object.keys(backup).length > 0 };
}

/** Puts back the viewer's own settings and reloads. */
export function restoreOwnSettings(): void {
  // The link's amount is in the address too: drop it, or the reload would apply it over the own settings.
  writeQuery((params) => [...PAGE_QUERY.converter, ...PAGE_QUERY.taxes].forEach((k) => params.delete(k)));
  try {
    for (const key of SHARED_KEYS) localStorage.removeItem(key);
    for (const [key, raw] of Object.entries(backup ?? {})) localStorage.setItem(key, raw);
  } catch {
    // storage unavailable
  }
  location.reload();
}
