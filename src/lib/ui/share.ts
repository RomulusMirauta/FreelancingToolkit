import { readable, writeQuery } from './query';
import { APP_QUERY, PAGE_KEYS, PAGE_QUERY, type Page } from './settingsKeys';
import { notifyRestoredAfterReload } from './toast';

/**
 * "Copy link": the address already holds every changed setting (?currencies=…&platform=…&income=…, see
 * urlState.ts), so the link is the address, marked ?share=1, without the viewer's own language and theme.
 * Opening it replaces the page settings for that visit (the own ones are kept for "Back to my settings").
 */
const SHARED_KEYS = [...PAGE_KEYS.converter, ...PAGE_KEYS.taxes];
const MARK = 'share';
/** Links made before the readable address carried each setting as JSON under its key: ?share=1&fees={…}. */
const legacyParam = (key: string) => key.replace(/^ft\./, '');

export function shareUrl(view: Page): string {
  const params = new URLSearchParams(location.search);
  APP_QUERY.forEach((k) => params.delete(k));
  params.delete(MARK);
  const rest = readable(params);
  return `${location.origin}${location.pathname}?${MARK}=1${rest ? `&${rest}` : ''}${view === 'taxes' ? '#taxes' : ''}`;
}

/** The viewer's own settings from before the link replaced them, for "back to my settings". */
let backup: Record<string, string> | null = null;
/** Whether the link held exactly the viewer's own settings (their own link, opened in the same browser). */
let sameAsOwn = false;

const readKeys = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of SHARED_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) out[key] = raw;
  }
  return out;
};

/** Settings as comparable text: keys in order, each value re-serialised. */
const canonical = (m: Record<string, string>) =>
  JSON.stringify(Object.keys(m).sort().map((k) => {
    try {
      return [k, JSON.stringify(JSON.parse(m[k]!))];
    } catch {
      return [k, m[k]];
    }
  }));

/**
 * Runs once before the address is read: on a shared link, the own page settings are set aside and cleared, so
 * the link's (read from the address next) are all that count; a setting the link doesn't have is on its default.
 * The mark leaves the address, so a reload or a reset never treats it as a link again.
 */
export function applySharedLink(): void {
  const params = new URLSearchParams(location.search);
  if (!params.has(MARK)) return;
  try {
    backup = readKeys();
    for (const key of SHARED_KEYS) localStorage.removeItem(key);
    for (const key of SHARED_KEYS) {
      const raw = params.get(legacyParam(key));
      if (raw === null) continue;
      params.delete(legacyParam(key));
      try {
        JSON.parse(raw);
        localStorage.setItem(key, raw);
      } catch {
        // not JSON: that setting stays on its default
      }
    }
  } catch {
    // storage unavailable: the address alone shows the link's settings
    backup = {};
  }
  writeQuery((p) => {
    p.delete(MARK);
    for (const key of SHARED_KEYS) p.delete(legacyParam(key));
  });
}

/** Runs once after the address is read: were the link's settings the very same as the own ones? */
export function finishSharedLink(): void {
  if (backup === null) return;
  try {
    sameAsOwn = canonical(readKeys()) === canonical(backup);
  } catch {
    sameAsOwn = false;
  }
}

/**
 * Whether this visit opened a shared link, whether there were own settings to go back to, and whether the link
 * held the very same settings (then nothing was replaced and there is nothing to go back to).
 */
export function sharedLinkState(): { opened: boolean; hadOwn: boolean; same: boolean } {
  return { opened: backup !== null, hadOwn: backup !== null && Object.keys(backup).length > 0 && !sameAsOwn, same: sameAsOwn };
}

/** Puts back the viewer's own settings and reloads. */
export function restoreOwnSettings(): void {
  // The link's settings are in the address too: drop them, or the reload would apply them over the own ones.
  writeQuery((params) => [...PAGE_QUERY.converter, ...PAGE_QUERY.taxes].forEach((k) => params.delete(k)));
  try {
    for (const key of SHARED_KEYS) localStorage.removeItem(key);
    for (const [key, raw] of Object.entries(backup ?? {})) localStorage.setItem(key, raw);
  } catch {
    // storage unavailable
  }
  // The reload alone looks like nothing happened: after it, a toast says the own settings are back.
  notifyRestoredAfterReload();
  location.reload();
}
