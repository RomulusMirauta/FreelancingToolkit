import { flushQuery, readQuery, readable } from './query';
import { STORAGE_PREFIX } from './usePersistentState';

/** The settings and the address just before "Reset tab", so its toast can undo it (this tab only). */
const KEY = 'ft-undo-reset';

interface Snapshot { search: string; saved: Record<string, string> }

/** Called right before "Reset tab" clears anything. */
export function saveBeforeReset(): void {
  try {
    const saved: Record<string, string> = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) saved[key] = localStorage.getItem(key)!;
    }
    // The query as the app has it: the address may be a moment behind (see query.ts).
    const query = readable(readQuery());
    sessionStorage.setItem(KEY, JSON.stringify({ search: query ? `?${query}` : '', saved } satisfies Snapshot));
  } catch {
    // no storage: the reset can't be undone, the toast's button does nothing
  }
}

/** Puts back every setting and the address as they were before "Reset tab", then reloads. */
export function undoPageReset(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return;
    const { search, saved } = JSON.parse(raw) as Snapshot;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
    sessionStorage.removeItem(KEY);
    flushQuery();
    // A whole address: at …github.io//FreelancingToolkit/ the path alone would lead to another site.
    location.replace(location.origin + location.pathname + search + location.hash);
  } catch {
    // storage unavailable or the snapshot is broken: the reset stays
  }
}
