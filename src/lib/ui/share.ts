import { flushQuery, readQuery, readable, writeQuery } from './query';
import { APP_QUERY, PAGE_KEYS, PAGE_QUERY, type Page } from './settingsKeys';
import { storage } from './storage';
import { notifyLater, notifyRestoredAfterReload } from './toast';

/**
 * "Copy link": the address already holds every changed setting (?currencies=…&platform=…&income=…, see
 * urlState.ts), so the link is the address, marked ?share=1, without the viewer's own language and theme.
 * Opening it replaces the page settings for that visit, until the viewer chooses: the own ones are set aside for
 * "Back to my settings" in this tab's session storage, so a reload (the app reloads itself after an update) keeps
 * them, and in the browser's storage, so the next visit puts them back if the tab is closed first.
 */
const SHARED_KEYS = [...PAGE_KEYS.converter, ...PAGE_KEYS.taxes];
const MARK = 'share';
/** Links made before the readable address carried each setting as JSON under its key: ?share=1&fees={…}. */
const legacyParam = (key: string) => key.replace(/^ft\./, '');
/**
 * The own settings set aside while a link waits for a choice, under this key in both storages; not an `ft.` key,
 * so it never counts as a setting. Each copy names the tab the link waits in.
 */
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
/** The name of the tab the link waits in: a copy in the browser's storage with another name is another tab's. */
let tab = '';

interface Pending { own: Record<string, string>; same: boolean; tab?: string }

const isPending = (v: unknown): v is Pending => {
  const p = v as Pending;
  return typeof v === 'object' && v !== null && typeof p.same === 'boolean' &&
    (p.tab === undefined || typeof p.tab === 'string') &&
    typeof p.own === 'object' && p.own !== null && !Array.isArray(p.own) && Object.values(p.own).every((raw) => typeof raw === 'string');
};

const parsePending = (raw: string | null): Pending | null => {
  try {
    const pending: unknown = raw === null ? null : JSON.parse(raw);
    return isPending(pending) ? pending : null;
  } catch {
    return null;
  }
};

/** The link waiting in this tab, from before a reload. */
function readPending(): Pending | null {
  try {
    return parsePending(sessionStorage.getItem(PENDING));
  } catch {
    return null;
  }
}

/** The link waiting in a tab, this one or another, as the browser's storage has it. */
const readLeft = (): Pending | null => parsePending(storage.getItem(PENDING));

/** A name no other tab has (crypto.randomUUID needs https, which a phone test over the local network doesn't use). */
const newTab = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function savePending(): void {
  const pending = JSON.stringify({ own: backup ?? {}, same: sameAsOwn, tab } satisfies Pending);
  try {
    sessionStorage.setItem(PENDING, pending);
  } catch {
    // no session storage: a reload finds only the copy below, and puts the own settings back as a later visit does
  }
  // For the next visit, if the tab is closed before a choice: only own settings the link replaced need to come back.
  if (sharedLinkState().hadOwn) storage.setItem(PENDING, pending);
  else if (readLeft()?.tab === tab) storage.removeItem(PENDING);
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

/** Puts the own settings back in place of the link's, also in the address. False when the browser refused one. */
function putBack(own: Record<string, string>): boolean {
  // The link's settings are in the address too: drop them, or the address would apply them over the own ones.
  writeQuery((params) => [...PAGE_QUERY.converter, ...PAGE_QUERY.taxes].forEach((k) => params.delete(k)));
  for (const key of SHARED_KEYS) storage.removeItem(key);
  return Object.entries(own).map(([key, raw]) => storage.setItem(key, raw)).every((ok) => ok);
}

/**
 * A link that waited in a tab closed before a choice replaced the own settings for that visit only: they come
 * back on this one, as "Back to my settings" would have put them, and its toast says so.
 */
function restoreLeft(left: Pending): void {
  // Refused by the browser, they would be gone after this visit: then they stay set aside for the next one.
  if (putBack(left.own)) storage.removeItem(PENDING);
  notifyLater('restored');
}

/**
 * Runs once before the address is read: on a shared link, the own page settings are set aside and cleared, so
 * the link's (read from the address next) are all that count; a setting the link doesn't have is on its default.
 * The mark leaves the address, so a reload or a reset never treats it as a link again; a link still waiting for
 * a choice comes back from session storage instead. One left waiting in another tab, which may have been closed,
 * gives its own settings back.
 */
export function applySharedLink(): void {
  const params = readQuery();
  const pending = readPending();
  if (pending) {
    backup = pending.own;
    sameAsOwn = pending.same;
    tab = pending.tab ?? newTab();
  }
  const left = pending ? null : readLeft();
  if (!params.has(MARK)) {
    // A reload sets the own settings aside for the next visit again: another tab may have put them back since, and
    // this tab's address brings the link's back, all of them: one it doesn't have is on its default, as when the
    // link opened, not on the own value put back (the update's reload keeps this address, updateReload.ts).
    if (pending) {
      savePending();
      for (const key of SHARED_KEYS) storage.removeItem(key);
    } else if (left) restoreLeft(left);
    return;
  }
  openedNow = true;
  // A second link before choosing: the own settings are still the ones the first link set aside, in this tab or
  // another. Unless that link held the own settings: it set nothing aside, and a change made since is the viewer's.
  if (left) backup = left.own;
  if (backup === null || sameAsOwn) {
    backup = readKeys();
    sameAsOwn = false;
  }
  tab ||= newTab();
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
  // Refused by the browser, they would be gone after the reload: then they stay set aside.
  if (putBack(backup ?? {})) settleSharedLink();
  // The reload alone looks like nothing happened: after it, a toast says the own settings are back.
  notifyRestoredAfterReload();
  flushQuery();
  location.reload();
}

/**
 * The viewer chose ("Back to my settings", "Keep the link's", "Close") or reset the app: the own settings set
 * aside are dropped, so neither a reload nor the next visit brings them back. A link waiting in another tab keeps
 * its own, except on a reset (`everywhere`), which the next visit would otherwise undo.
 */
export function settleSharedLink(everywhere = false): void {
  if (everywhere || readLeft()?.tab === tab) storage.removeItem(PENDING);
  backup = null;
  sameAsOwn = false;
  tab = '';
  try {
    sessionStorage.removeItem(PENDING);
  } catch {
    // no session storage: nothing was kept there
  }
}
