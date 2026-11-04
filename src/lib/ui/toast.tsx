import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { useT } from '../i18n';
import type { Strings } from '../i18n/strings';
import { BNR_RATES } from '../currency/rates';
import { formatMoney, MAX_AMOUNT } from './numbers';
import { undoPageReset } from './undoReset';

const EVENT = 'ft:toast';
/** Toasts to show when the page next starts (session only, so they are not saved settings): after a reload, or
    for something found before the first render (a broken link). */
const LATER = 'ft-toast-after-reload';
/** BNR's rate date before an update check, so the next start can say the rates got newer. */
const RATES_BEFORE = 'ft-rates-before';
/** The last app version this browser ran; not an `ft.` key, so it never counts as a changed setting. */
const SEEN_VERSION = 'ft-version';
/** How long a toast takes to go out (the .toast.leaving animation). */
const OUT_MS = 220;
/** Where "What's new" leads. */
const RELEASES = 'https://github.com/RomulusMirauta/FreelancingToolkit/releases';

export type ToastId =
  | 'tooBig' | 'restored' | 'badLink' | 'copyBlocked' | 'offline' | 'online' | 'ratesUpdated'
  | 'updated' | 'installed' | 'pageReset' | 'notNumber';
export interface Note { id: ToastId; arg?: string }

/** Lime: something was done. Amber: a warning. Teal: for your information. */
type Tone = 'done' | 'warn' | 'info';
interface Shown { tone: Tone; title: string; hint: string; action?: { label: string; run: () => void } }

export function notify(id: ToastId, arg?: string): void {
  window.dispatchEvent(new CustomEvent<Note>(EVENT, { detail: { id, arg } }));
}

/** Shown when the page next starts: after the reload that follows, or right away if nothing reloads. */
export function notifyLater(id: ToastId, arg?: string): void {
  try {
    sessionStorage.setItem(LATER, JSON.stringify([...readLater(), { id, arg }]));
  } catch {
    // no session storage: the toast is skipped
  }
}

function readLater(): Note[] {
  try {
    const raw = sessionStorage.getItem(LATER);
    if (raw === null) return [];
    if (raw === 'restored') return [{ id: 'restored' }]; // saved by an older version
    const notes: unknown = JSON.parse(raw);
    return Array.isArray(notes) ? (notes as Note[]) : [];
  } catch {
    return [];
  }
}

/** Someone typed (or pasted) an amount above the limit: say so, with a smile, in the bottom-left corner. */
export function notifyTooBig(): void {
  notify('tooBig');
}

/** Own settings put back after a shared link: the page reloads, then says so. */
export function notifyRestoredAfterReload(): void {
  notifyLater('restored');
}

const cut = (text: string) => (text.length > 24 ? `${text.slice(0, 23)}…` : text);

/** A paste with no digit at all into an amount ("thirty"): refused, with a word in the corner. */
export function refuseNonNumberPaste(e: ClipboardEvent<HTMLInputElement>): void {
  const text = e.clipboardData.getData('text').trim();
  if (text === '' || /\d/.test(text)) return;
  e.preventDefault();
  notify('notNumber', cut(text));
}

/** What a change put into a field: the part of `after` that isn't in `before` (same start and end trimmed off). */
export function insertedText(before: string, after: string): string {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before.at(-1 - end) === after.at(-1 - end)) end++;
  return after.slice(start, after.length - end);
}

/**
 * A word (two or more characters, no digit) put into an amount in one go. Phone keyboards paste from their
 * clipboard strip by typing the text, with no paste event, so the change itself is checked. Typing letters one by
 * one is not caught: the field shows them as invalid instead. True when refused (the toast is shown).
 */
export function refuseWord(before: string, after: string): boolean {
  const added = insertedText(before, after).trim();
  if (added.length < 2 || /\d/.test(added)) return false;
  notify('notNumber', cut(added));
  return true;
}

/** The same for a field the page doesn't hold the text of: it remembers its last accepted text, and goes back to it. */
export function refuseWordIn(input: HTMLInputElement): boolean {
  const before = input.dataset.accepted ?? input.defaultValue;
  if (refuseWord(before, input.value)) {
    input.value = before;
    return true;
  }
  input.dataset.accepted = input.value;
  return false;
}

/** What the toast says for each case, in the current language. */
export function describe(note: Note, t: Strings): Shown {
  const a = t.app.toasts;
  const date = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  switch (note.id) {
    case 'tooBig': return { tone: 'done', title: t.app.tooBig, hint: t.app.tooBigHint(formatMoney(MAX_AMOUNT)) };
    case 'restored': return { tone: 'info', title: t.app.restored, hint: t.app.restoredHint };
    case 'badLink': return { tone: 'warn', title: a.badLink, hint: a.badLinkHint };
    case 'copyBlocked': return { tone: 'warn', title: a.copyBlocked, hint: a.copyBlockedHint };
    case 'offline': return { tone: 'info', title: a.offline, hint: a.offlineHint(date(BNR_RATES.date)) };
    case 'online': return { tone: 'done', title: a.online, hint: a.onlineHint };
    case 'ratesUpdated': return { tone: 'done', title: a.ratesUpdated(date(BNR_RATES.date)), hint: a.ratesUpdatedHint };
    case 'updated':
      return {
        tone: 'info', title: a.updated(note.arg ?? __APP_VERSION__), hint: a.updatedHint,
        action: { label: a.whatsNew, run: () => window.open(`${RELEASES}/tag/v${note.arg ?? __APP_VERSION__}`, '_blank', 'noopener') },
      };
    case 'installed': return { tone: 'done', title: a.installed, hint: a.installedHint };
    case 'pageReset': {
      const page = note.arg === 'taxes' ? 'taxes' : 'converter';
      return { tone: 'done', title: a.pageReset[page], hint: a.pageResetHint[page], action: { label: a.undo, run: undoPageReset } };
    }
    case 'notNumber': return { tone: 'warn', title: a.notNumber(note.arg ?? ''), hint: a.notNumberHint };
  }
}

/** On start: a new app version since the last visit, or newer rates after coming back online. */
function startNotes(): Note[] {
  const notes: Note[] = [];
  try {
    const seen = localStorage.getItem(SEEN_VERSION);
    if (seen !== null && seen !== __APP_VERSION__) notes.push({ id: 'updated', arg: __APP_VERSION__ });
    localStorage.setItem(SEEN_VERSION, __APP_VERSION__);
  } catch {
    // no storage: no "updated" toast
  }
  try {
    const before = sessionStorage.getItem(RATES_BEFORE);
    if (before !== null && BNR_RATES.date > before) notes.push({ id: 'ratesUpdated' });
    sessionStorage.removeItem(RATES_BEFORE);
  } catch {
    // no session storage
  }
  return notes;
}

/** Back online: look for a newer version (new BNR rates come with it). The app updates and reloads by itself. */
function checkForUpdate(): void {
  try {
    sessionStorage.setItem(RATES_BEFORE, BNR_RATES.date);
  } catch {
    // no session storage: the update still happens, without the toast
  }
  void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => undefined);
}

/**
 * The queue after a new message: the same message again (another keystroke over the limit) restarts the one on
 * screen, or is dropped if it is already waiting, instead of queueing a copy.
 */
export function addNote(queue: Note[], note: Note): Note[] {
  const same = (x: Note) => x.id === note.id && x.arg === note.arg;
  if (queue[0] && same(queue[0])) return [note, ...queue.slice(1)];
  return queue.some(same) ? queue : [...queue, note];
}

/** The bottom-left toast. One at a time, in order; each hides itself after a few seconds, × closes it sooner. */
export function Toast() {
  const t = useT();
  const [queue, setQueue] = useState<Note[]>([]);
  /** Counts the toasts that have gone, so the next one is a new element and comes in with its animation. */
  const [gone, setGone] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const outTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const add = (n: Note) => setQueue((q) => addNote(q, n));
    const onEvent = (e: Event) => add((e as CustomEvent<Note>).detail);
    const onOffline = () => add({ id: 'offline' });
    const onOnline = () => {
      add({ id: 'online' });
      checkForUpdate();
    };
    window.addEventListener(EVENT, onEvent);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const pending = [...startNotes(), ...readLater()];
    try {
      sessionStorage.removeItem(LATER);
    } catch {
      // no session storage
    }
    if (pending.length) setQueue(pending);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const current = queue[0];
  const shown = current && describe(current, t);
  // It goes out downwards, the way it came in reversed (.toast.leaving, as long as OUT_MS), then the next one comes.
  const close = () => {
    window.clearTimeout(timer.current);
    setLeaving(true);
    window.clearTimeout(outTimer.current);
    outTimer.current = window.setTimeout(() => {
      setLeaving(false);
      setQueue((q) => q.slice(1));
      setGone((n) => n + 1);
    }, OUT_MS);
  };

  // A toast with a button stays longer, so there is time to press it. The same message again restarts it, even
  // while it is going out.
  const hasAction = Boolean(shown?.action);
  useEffect(() => {
    if (!current) return;
    window.clearTimeout(outTimer.current);
    setLeaving(false);
    timer.current = window.setTimeout(close, hasAction ? 10_000 : 6000);
    return () => window.clearTimeout(timer.current);
    // close only uses refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, hasAction]);
  useEffect(() => () => window.clearTimeout(outTimer.current), []);

  if (!shown) return null;
  return (
    <div className={`toast ${shown.tone}${leaving ? ' leaving' : ''}`} role="status" key={gone}>
      <div>
        <strong>{shown.title}</strong>
        <span className="muted small">{shown.hint}</span>
      </div>
      {shown.action && (
        <button type="button" className="toast-action" onClick={() => { close(); shown.action!.run(); }}>{shown.action.label}</button>
      )}
      <button type="button" className="toast-close" aria-label={t.app.close} title={t.app.close} onClick={close}>×</button>
    </div>
  );
}
