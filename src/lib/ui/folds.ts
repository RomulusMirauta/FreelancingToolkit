import { useEffect, useSyncExternalStore } from 'react';
import { writeQuery } from './query';

/**
 * Which sections are folded, kept in the address as ?fold=converter,fees so a reload, a bookmark or a
 * shared link opens them the same way. Sections are open unless listed. Other query parameters and
 * the #taxes hash are left alone.
 */
const PARAM = 'fold';

let closed: Set<string> | null = null;
/** Sections on screen now, for "fold all / unfold all". */
const mounted = new Set<string>();
const listeners = new Set<() => void>();

function current(): Set<string> {
  // Read lazily: a shared link is applied (and the address rewritten) before the first render.
  closed ??= new Set((new URLSearchParams(location.search).get(PARAM) ?? '').split(',').filter(Boolean));
  return closed;
}

function save(next: Set<string>) {
  closed = next;
  writeQuery((params) => {
    if (next.size) params.set(PARAM, [...next].join(','));
    else params.delete(PARAM);
  });
  version++;
  listeners.forEach((l) => l());
}

let version = 0;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

/** Whether section `id` is open, and a setter that records it in the address. */
export function useFold(id: string): [boolean, (open: boolean) => void] {
  useSyncExternalStore(subscribe, getVersion);
  useEffect(() => {
    mounted.add(id);
    version++;
    listeners.forEach((l) => l());
    return () => {
      mounted.delete(id);
      version++;
      listeners.forEach((l) => l());
    };
  }, [id]);
  const open = !current().has(id);
  const setOpen = (o: boolean) => {
    if (o === open) return;
    const next = new Set(current());
    if (o) next.delete(id);
    else next.add(id);
    save(next);
  };
  return [open, setOpen];
}

/** For the "fold all / unfold all" button: whether any section on screen is open, and the action. */
export function useFoldAll(): { anyOpen: boolean; toggleAll: () => void } {
  useSyncExternalStore(subscribe, getVersion);
  const anyOpen = [...mounted].some((id) => !current().has(id));
  const toggleAll = () => {
    const next = new Set(current());
    for (const id of mounted) {
      if (anyOpen) next.add(id);
      else next.delete(id);
    }
    save(next);
  };
  return { anyOpen, toggleAll };
}

/** The folded sections, kept up to date (for the reset buttons). */
export function useClosedFolds(): ReadonlySet<string> {
  useSyncExternalStore(subscribe, getVersion);
  return current();
}

/** Unfolds the given sections (all of them without `ids`). */
export function clearFolds(ids?: readonly string[]): void {
  save(ids ? new Set([...current()].filter((id) => !ids.includes(id))) : new Set());
}

/** The fold parameter as it is now, to carry over when the address is rewritten. */
export function foldParam(): string | null {
  return new URLSearchParams(location.search).get(PARAM);
}
