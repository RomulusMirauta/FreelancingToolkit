/**
 * Where the app keeps what it saves: localStorage, or, where the browser refuses it (site data blocked, storage
 * full), a map that lasts as long as the page. A link and the address are applied through it before the first
 * render, and every setting is read back from it, so they still show for the visit when nothing can be saved.
 */
const memory = new Map<string, string>();

export const storage = {
  getItem(key: string): string | null {
    const kept = memory.get(key);
    if (kept !== undefined) return kept;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /** False when the browser refused the value: only this page has it, and a reload loses it. */
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      memory.delete(key);
      return true;
    } catch {
      memory.set(key, value);
      return false;
    }
  },

  removeItem(key: string): void {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // blocked: nothing is saved there
    }
  },

  /** Every key saved, in the browser or for this page. */
  keys(): string[] {
    let saved: string[] = [];
    try {
      saved = Object.keys(localStorage);
    } catch {
      // blocked: only this page's
    }
    return [...new Set([...saved, ...memory.keys()])];
  },
};
