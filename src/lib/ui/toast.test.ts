import { describe as group, expect, it, vi } from 'vitest';
import type { ClipboardEvent } from 'react';
import { en, ro } from '../i18n/strings';
import { addNote, describe, insertedText, refuseNonNumberPaste, refuseWord, type Note, type ToastId } from './toast';

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
  const run = (before: string, after: string) => {
    const events: Note[] = [];
    vi.stubGlobal('window', { dispatchEvent: (ev: CustomEvent<Note>) => events.push(ev.detail) });
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: { detail: Note }) {} get detail() { return this.init.detail; } });
    const refused = refuseWord(before, after);
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
});
