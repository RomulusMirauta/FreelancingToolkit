import { describe as group, expect, it, vi } from 'vitest';
import type { ClipboardEvent } from 'react';
import { en, ro } from '../i18n/strings';
import { insertedAt } from './numbers';
import { addNote, describe, insertedText, refuseNonNumberPaste, refuseWord, spokenText, type Note, type ToastId } from './toast';

const ALL: ToastId[] = [
  'tooBig', 'restored', 'badLink', 'copyBlocked', 'offline', 'online', 'ratesUpdated', 'updated', 'installed', 'pageReset', 'notNumber',
];

group('toast messages', () => {
  it('every message has a title and a hint in both languages', () => {
    for (const t of [ro, en]) {
      for (const id of ALL) {
        const shown = describe({ id, arg: id === 'pageReset' ? 'taxes' : id === 'notNumber' ? 'treizeci' : undefined }, t);
        expect(shown.title, id).not.toBe('');
        expect(shown.hint, id).not.toBe('');
      }
    }
  });

  it('the edge colour says the kind: warnings in amber, information in teal, the rest in lime', () => {
    const tone = (id: ToastId) => describe({ id }, ro).tone;
    expect(['badLink', 'copyBlocked', 'notNumber'].map((id) => tone(id as ToastId))).toEqual(['warn', 'warn', 'warn']);
    expect(['offline', 'updated', 'restored'].map((id) => tone(id as ToastId))).toEqual(['info', 'info', 'info']);
    expect(['online', 'installed', 'pageReset', 'ratesUpdated', 'tooBig'].map((id) => tone(id as ToastId))).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('only "Reset tab" (Undo) and "updated" (What\'s new) have a button', () => {
    const withButton = ALL.filter((id) => describe({ id }, ro).action);
    expect(withButton).toEqual(['updated', 'pageReset']);
    expect(describe({ id: 'pageReset', arg: 'converter' }, ro).action!.label).toBe('Anulează');
    expect(describe({ id: 'updated', arg: '1.1.0' }, ro)).toMatchObject({ title: 'Aplicația s-a actualizat la v1.1.0.' });
  });

  it('"Reset tab" names the page that was reset', () => {
    expect(describe({ id: 'pageReset', arg: 'converter' }, ro).title).toBe('Convertorul a revenit la valorile implicite.');
    expect(describe({ id: 'pageReset', arg: 'taxes' }, ro).title).toBe('Pagina Taxe a revenit la valorile implicite.');
  });

  it('a pasted word is quoted back', () => {
    expect(describe({ id: 'notNumber', arg: 'treizeci' }, ro).title).toBe('„treizeci” nu e un număr.');
    expect(describe({ id: 'notNumber', arg: 'thirty' }, en).title).toBe('“thirty” isn’t a number.');
  });

  it('screen readers hear the text, and for a toast with a button, the button and where it is', () => {
    // They heard only the title and the hint: after "Reset tab", nothing said it could be undone.
    expect(spokenText(describe({ id: 'pageReset', arg: 'converter' }, en), en)).toBe(
      'The converter is back to its defaults. Currencies, custom rates, working time and fees. The “Undo” button is at the end of the page.');
    expect(spokenText(describe({ id: 'pageReset', arg: 'taxes' }, ro), ro)).toBe(
      'Pagina Taxe a revenit la valorile implicite. Venitul, opțiunile cardurilor, referința, venitul secundar și netul dorit. Butonul „Anulează” e la sfârșitul paginii.');
    for (const t of [ro, en]) {
      for (const note of [...ALL.map((id): Note => ({ id, arg: id === 'notNumber' ? 'treizeci' : undefined })), { id: 'pageReset', arg: 'taxes' } as Note]) {
        const shown = describe(note, t);
        const spoken = spokenText(shown, t);
        if (!shown.action) expect(spoken, note.id).toBe(`${shown.title} ${shown.hint}`);
        else expect(spoken, note.id).toBe(`${shown.title} ${shown.hint} ${t.app.toasts.buttonAtEnd(shown.action.label)}`);
      }
      expect(spokenText(describe({ id: 'pageReset', arg: 'converter' }, t), t)).toContain(t.app.toasts.undo);
      expect(spokenText(describe({ id: 'updated', arg: '1.2.0' }, t), t)).toContain(t.app.toasts.whatsNew);
    }
  });
});

group('the queue', () => {
  const a: Note = { id: 'tooBig' };
  const b: Note = { id: 'offline' };
  it('adds a new message at the end', () => {
    expect(addNote([a], b)).toEqual([a, b]);
  });
  it('the message on screen again restarts it (a new object), without a copy', () => {
    const again = { id: 'tooBig' } as Note;
    const q = addNote([a, b], again);
    expect(q).toHaveLength(2);
    expect(q[0]).toBe(again);
  });
  it('a message already waiting is not queued twice', () => {
    expect(addNote([a, b], { id: 'offline' })).toEqual([a, b]);
  });
  it('the same kind with another detail is a different message', () => {
    expect(addNote([{ id: 'notNumber', arg: 'x' }], { id: 'notNumber', arg: 'y' })).toHaveLength(2);
  });
});

group('pasting into an amount', () => {
  const paste = (text: string) => {
    const e = { clipboardData: { getData: () => text }, preventDefault: vi.fn() };
    const events: Note[] = [];
    vi.stubGlobal('window', { dispatchEvent: (ev: CustomEvent<Note>) => events.push(ev.detail) });
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: { detail: Note }) {} get detail() { return this.init.detail; } });
    refuseNonNumberPaste(e as unknown as ClipboardEvent<HTMLInputElement>);
    vi.unstubAllGlobals();
    return { refused: e.preventDefault.mock.calls.length > 0, events };
  };
  it('a word without a digit is refused, with a toast that quotes it', () => {
    const r = paste('  treizeci ');
    expect(r.refused).toBe(true);
    expect(r.events).toEqual([{ id: 'notNumber', arg: 'treizeci' }]);
  });
  it('anything with a digit goes through (the field shows it as invalid if it is)', () => {
    for (const text of ['30', '1.250,50', '30 lei', '€25']) expect(paste(text).refused, text).toBe(false);
  });
  it('an empty paste does nothing', () => {
    expect(paste('').refused).toBe(false);
  });
  it('a long text is cut in the toast', () => {
    const r = paste('a'.repeat(40));
    expect(r.events[0]!.arg).toBe(`${'a'.repeat(23)}…`);
  });
});

group("a word put into an amount at once (the keyboard's clipboard strip types it, without a paste event)", () => {
  const run = (before: string, after: string, inserted?: string) => {
    const events: Note[] = [];
    vi.stubGlobal('window', { dispatchEvent: (ev: CustomEvent<Note>) => events.push(ev.detail) });
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: { detail: Note }) {} get detail() { return this.init.detail; } });
    const refused = refuseWord(before, after, inserted);
    vi.unstubAllGlobals();
    return { refused, events };
  };
  it('finds what a change put in', () => {
    expect(insertedText('30,00', 'treizeci')).toBe('treizeci');
    expect(insertedText('30', '3x0')).toBe('x');
    expect(insertedText('1250', '1250 lei')).toBe(' lei');
    expect(insertedText('30', '3')).toBe('');
  });
  it('a whole word replacing the amount is refused, with the toast', () => {
    expect(run('30,00', 'treizeci')).toEqual({ refused: true, events: [{ id: 'notNumber', arg: 'treizeci' }] });
  });
  it('a word added after the amount is refused too', () => {
    expect(run('1.250', '1.250 lei').refused).toBe(true);
  });
  it('typing one letter, deleting, or anything with a digit goes through', () => {
    for (const [a, b] of [['30', '30x'], ['30', '3'], ['', '45'], ['30', '30 €5']]) expect(run(a!, b!).refused, `${a} → ${b}`).toBe(false);
  });
  it('the amount shown, pasted over itself with its unit, is no word: what went in is read by the selection it replaced', () => {
    // The texts differ only by " lei" and " EUR", which were refused.
    const over = (before: string, after: string, selected: [number, number]) => run(before, after, insertedAt(before, after, selected).added);
    expect(over('27.772,16', '27.772,16 lei', [0, 9])).toEqual({ refused: false, events: [] });
    expect(over('30', '30 EUR', [0, 2]).refused).toBe(false);
    // A word over the selected amount, or put in after it, still is one.
    expect(over('30', 'thirty', [0, 2])).toEqual({ refused: true, events: [{ id: 'notNumber', arg: 'thirty' }] });
    expect(over('1.250', '1.250 lei', [5, 5]).refused).toBe(true);
    // No selection noted: the texts decide, as before.
    expect(run('1.250', '1.250 lei', insertedAt('1.250', '1.250 lei', null).added).refused).toBe(true);
  });
});

group('"updated" when the app starts', () => {
  // One localStorage for the browser, and a session storage for each tab.
  const over = (m: Map<string, string>) => ({
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  /** The app starting in a tab: fresh modules (storage.ts keeps nothing from before), then its "updated" message. */
  async function start(browser: Map<string, string>, tab: Map<string, string>) {
    vi.stubGlobal('localStorage', over(browser));
    vi.stubGlobal('sessionStorage', over(tab));
    vi.resetModules();
    const notes = (await import('./toast')).startNotes();
    vi.unstubAllGlobals();
    return notes.filter((n) => n.id === 'updated');
  }
  const OLD = '0.9.0';
  const UPDATED = [{ id: 'updated', arg: __APP_VERSION__ }];

  it('comes in each tab that ran an older version, also after another window started the new one', async () => {
    const browser = new Map([['ft-version', OLD]]);
    const a = new Map([['ft-tab-version', OLD]]);
    const b = new Map([['ft-tab-version', OLD]]);
    expect(await start(browser, a)).toEqual(UPDATED);
    expect(await start(browser, b)).toEqual(UPDATED);
    // Once in each.
    expect(await start(browser, a)).toEqual([]);
    expect(await start(browser, b)).toEqual([]);
  });

  it('not in a tab opened after another one started the new version, nor on a first visit', async () => {
    const browser = new Map([['ft-version', OLD]]);
    expect(await start(browser, new Map())).toEqual(UPDATED);
    expect(await start(browser, new Map())).toEqual([]);
    expect(await start(new Map(), new Map())).toEqual([]);
  });
});

group('the toasts a start shows', () => {
  it('what the user did comes before the update: the Undo after "Reset tab" is not left to run out behind "What\'s new"', async () => {
    // "Reset tab" while an update waited: its reload opens the new version.
    const map = (entries: [string, string][]) => {
      const m = new Map(entries);
      return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    };
    vi.stubGlobal('localStorage', map([['ft-version', '0.9.0']]));
    vi.stubGlobal('sessionStorage', map([['ft-tab-version', '0.9.0'], ['ft-toast-after-reload', '[{"id":"pageReset","arg":"taxes"},{"id":"restored"}]']]));
    vi.resetModules();
    const queue = (await import('./toast')).startQueue();
    vi.unstubAllGlobals();
    expect(queue.map((n) => n.id)).toEqual(['pageReset', 'restored', 'updated']);
  });
});
