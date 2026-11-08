import { useEffect, useState } from 'react';
import { storage } from './storage';

/** All app keys share this prefix, so "is anything saved?" means "is the app modified?". */
export const STORAGE_PREFIX = 'ft.';
const CHANGE_EVENT = 'ft-storage';

/**
 * useState backed by the app's storage (storage.ts: localStorage, or this page's memory where the browser refuses
 * it). A value equal to its default is removed rather than stored. `upgrade` turns a value saved by an older
 * version into the current shape (null if it can't).
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  isValid: (v: unknown) => v is T,
  upgrade?: (v: unknown) => T | null,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
        const upgraded = upgrade?.(parsed);
        if (upgraded) return upgraded;
      }
    } catch {
      // fall through to the default
    }
    return initial;
  });

  const json = JSON.stringify(value);
  const initialJson = JSON.stringify(initial);
  useEffect(() => {
    if (json === initialJson) storage.removeItem(key);
    else storage.setItem(key, json);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key, json, initialJson]);

  return [value, setValue];
}

function hasSavedState(keys?: readonly string[]): boolean {
  return storage.keys().some((k) => (keys ? keys.includes(k) : k.startsWith(STORAGE_PREFIX)));
}

/** True while any setting differs from its default; with `keys`, only those settings count. */
export function useIsModified(keys?: readonly string[]): boolean {
  const [modified, setModified] = useState(() => hasSavedState(keys));
  useEffect(() => {
    const update = () => setModified(hasSavedState(keys));
    update(); // the keys may have changed (another page)
    window.addEventListener(CHANGE_EVENT, update);
    window.addEventListener('storage', update); // other tabs
    return () => {
      window.removeEventListener(CHANGE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, [keys]);
  return modified;
}
