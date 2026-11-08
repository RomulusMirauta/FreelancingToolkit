import { useEffect } from 'react';
import { isSaneAmount } from './numbers';
import { readQuery, writeQuery } from './query';

/**
 * A saved setting that also lives in the address (?lang=en, ?income=12000&income_currency=EUR&income_per=month,
 * ?platform=fiverr), so a reload, a bookmark or a shared address shows the app the same way. Only a changed value
 * is written; the default has none. Names and values are in English, so an address works in both languages.
 */
export interface UrlQuery<T> {
  /** The localStorage key the value is saved under. */
  key: string;
  /** The address parameters, in the order `toParams` returns their values. */
  names: readonly string[];
  toParams: (value: T) => string[];
  /**
   * Builds a value from the parameters (null when one is broken); `isValid` checks it. `saved` is what is
   * stored now, for values that hold more than the address carries (the cards' options).
   */
  fromParams: (values: string[], saved: unknown) => unknown;
  isValid: (value: unknown) => value is T;
  /**
   * What can still be used of a value that isn't valid as it is (a list naming a currency the rates no longer have
   * keeps the others), or null. usePersistentState takes the same for the saved value.
   */
  upgrade?: (value: unknown) => T | null;
  defaults: T;
  /** Whether the whole value is the default (then nothing is stored). Default: its parameters are the defaults'. */
  isDefault?: (value: T) => boolean;
  /** Each parameter stands alone: only the changed ones are written, a missing one means its default. */
  sparse?: boolean;
}

const same = <T,>(q: UrlQuery<T>, a: T, b: T) => q.toParams(a).join('|') === q.toParams(b).join('|');

/** Writes the value into the address, or removes it when it is the default. */
export function writeUrlQuery<T>(q: UrlQuery<T>, value: T): void {
  const base = q.toParams(q.defaults);
  writeQuery((params) => {
    if (same(q, value, q.defaults)) q.names.forEach((n) => params.delete(n));
    else q.toParams(value).forEach((v, i) => {
      if (q.sparse && v === base[i]) params.delete(q.names[i]!);
      else params.set(q.names[i]!, v);
    });
  });
}

/** Address parameters dropped as broken while the page started, for the "some settings weren't valid" toast. */
const dropped: string[] = [];
export const droppedParams = (): readonly string[] => dropped;
export function noteDropped(names: readonly string[]): void {
  dropped.push(...names);
}

/**
 * Runs once before the first render. A valid value in the address wins over the saved one (and is saved);
 * a broken one is dropped from the address, and so is the part of one that `upgrade` leaves out. Without one,
 * a saved value is written into the address.
 */
export function applyUrlQuery<T>(q: UrlQuery<T>): void {
  const params = readQuery();
  const present = q.names.some((n) => params.has(n));
  let saved: unknown = null;
  try {
    const raw = localStorage.getItem(q.key);
    saved = raw === null ? null : JSON.parse(raw);
  } catch {
    // storage unavailable or broken: treated as nothing saved
  }
  const base = q.toParams(q.defaults);
  const complete = q.sparse || q.names.every((n) => params.has(n));
  const read = present && complete ? q.fromParams(q.names.map((n, i) => params.get(n) ?? base[i]!), saved) : null;
  const fromUrl = read === null || q.isValid(read) ? read : (q.upgrade?.(read) ?? null);
  if (fromUrl !== null && q.isValid(fromUrl)) {
    // Kept in part: what was left out is noted for the toast, and the address keeps the rest.
    if (fromUrl !== read) {
      noteDropped(q.names.filter((n) => params.has(n)));
      writeUrlQuery(q, fromUrl);
    }
    if (!(q.isValid(saved) && same(q, saved, fromUrl))) {
      try {
        if (q.isDefault ? q.isDefault(fromUrl) : same(q, fromUrl, q.defaults)) localStorage.removeItem(q.key);
        else localStorage.setItem(q.key, JSON.stringify(fromUrl));
      } catch {
        // storage unavailable: the address still shows the value
      }
    }
    return;
  }
  if (present) {
    noteDropped(q.names.filter((n) => params.has(n)));
    writeQuery((p) => q.names.forEach((n) => p.delete(n)));
  }
  const usable = q.isValid(saved) ? saved : (q.upgrade?.(saved) ?? null);
  if (usable !== null) writeUrlQuery(q, usable);
}

/** Keeps the address in step with the value while the page that edits it is open. */
export function useUrlQuery<T>(q: UrlQuery<T>, value: T): void {
  useEffect(() => writeUrlQuery(q, value), [q, value]);
}

/** A number as written in the address (dot decimals), within the amount limit, or null. */
export const numberParam = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return isSaneAmount(n) ? n : null;
};
