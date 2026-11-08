import { flushQuery, readQuery, readable, writeQuery } from './query';
import { APP_QUERY, PAGE_KEYS, PAGE_QUERY, type Page } from './settingsKeys';
import { storage } from './storage';
import { notifyRestoredAfterReload } from './toast';

/**
 * "Copy link": the address already holds every changed setting (?currencies=…&platform=…&income=…, see
 * urlState.ts), so the link is the address, marked ?share=1, without the viewer's own language and theme.
 * Opening it replaces the page settings until the viewer chooses: the own ones are set aside for "Back to my
 * settings" in this tab's session storage, so a reload (the app reloads itself after an update) keeps them.
 */
const SHARED_KEYS = [...PAGE_KEYS.converter, ...PAGE_KEYS.taxes];
const MARK = 'share';
/** Links made before the readable address carried each setting as JSON under its key: ?share=1&fees={…}. */
const legacyParam = (key: string) => key.replace(/^ft\./, '');
/** The own settings set aside while a link waits for a choice; not an `ft.` key, so it never counts as a setting. */
const PENDING = 'ft-shared-backup';

export function shareUrl(view: Page): string {
  const params = readQuery();
  APP_QUERY.forEach((k) => params.delete(k));
  params.delete(MARK);
  const rest = readable(params);
  return `${location.origin}${location.pathname}?${MARK}=1${rest ? `&${rest}` : ''}${view === 'taxes' ? '#taxes' : ''}`;
}

/** The viewer's own settings from before the link replaced them, for "back to my settings". */
let backup: Record<string, string> | null = null;
/** Whether the link held exactly the viewer's own settings (their own link, opened in the same browser). */
let sameAsOwn = false;
/** Whether this page load opened the link, rather than finding one from before a reload still waiting. */
let openedNow = false;

interface Pending { own: Record<string, string>; same: boolean }

const isPending = (v: unknown): v is Pending => {
  const p = v as Pending;
  return typeof v === 'object' && v !== null && typeof p.same === 'boolean' &&
    typeof p.own === 'object' && p.own !== null && !Array.isArray(p.own) && Object.values(p.own).every((raw) => typeof raw === 'string');
};

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING);
    const pending: unknown = raw === null ? null : JSON.parse(raw);
    return isPending(pending) ? pending : null;
  } catch {
    return null;
  }
}

function savePending(): void {
  try {
    sessionStorage.setItem(PENDING, JSON.stringify({ own: backup ?? {}, same: sameAsOwn } satisfies Pending));
  } catch {
    // no session storage: the own settings are kept until the next reload only
  }
}

const readKeys = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of SHARED_KEYS) {
    const raw = storage.getItem(key);
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
 * The mark leaves the address, so a reload or a reset never treats it as a link again; a link still waiting for
 * a choice comes back from session storage instead.
 */
export function applySharedLink(): void {
  const pending = readPending();
  if (pending) {
    backup = pending.own;
    sameAsOwn = pending.same;
  }
  const params = readQuery();
  if (!params.has(MARK)) return;
  openedNow = true;
  // A second link before choosing: the own settings are still the ones the first link set aside.
  backup ??= readKeys();
  savePending();
  for (const key of SHARED_KEYS) storage.removeItem(key);
  for (const key of SHARED_KEYS) {
    const raw = params.get(legacyParam(key));
    if (raw === null) continue;
    params.delete(legacyParam(key));
    try {
      JSON.parse(raw);
      storage.setItem(key, raw);
    } catch {
      // not JSON: that setting stays on its default
    }
  }
  writeQuery((p) => {
    p.delete(MARK);
    for (const key of SHARED_KEYS) p.delete(legacyParam(key));
  });
}

/**
 * Runs once after the address is read: were the link's settings the very same as the own ones? A link from
 * before a reload keeps what it said then.
 */
export function finishSharedLink(): void {
  if (backup === null || !openedNow) return;
  sameAsOwn = canonical(readKeys()) === canonical(backup);
  savePending();
}

/**
 * Whether this page load opened a shared link (not one from before a reload, still waiting for a choice): its
 * settings are all in the address, and one it doesn't have is on its default.
 */
export function linkOpenedNow(): boolean {
  return openedNow;
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
  for (const key of SHARED_KEYS) storage.removeItem(key);
  const saved = Object.entries(backup ?? {}).map(([key, raw]) => storage.setItem(key, raw));
  // Refused by the browser, they would be gone after the reload: then they stay set aside.
  if (saved.every((ok) => ok)) settleSharedLink();
  // The reload alone looks like nothing happened: after it, a toast says the own settings are back.
  notifyRestoredAfterReload();
  flushQuery();
  location.reload();
}

/**
 * The viewer chose ("Back to my settings", "Keep the link's", "Close") or reset the app: the own settings set
 * aside are dropped, so a reload no longer brings the banner back.
 */
export function settleSharedLink(): void {
  backup = null;
  sameAsOwn = false;
  try {
    sessionStorage.removeItem(PENDING);
  } catch {
    // no session storage: nothing was kept there
  }
}
