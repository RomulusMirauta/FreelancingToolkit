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
    sessionStorage.setItem(KEY, JSON.stringify({ search: location.search, saved } satisfies Snapshot));
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
    location.replace(location.pathname + search + location.hash);
  } catch {
    // storage unavailable or the snapshot is broken: the reset stays
  }
}
