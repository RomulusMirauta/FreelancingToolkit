import { describe, expect, it } from 'vitest';
import { analyticsOn } from './analytics';

describe('analytics', () => {
  it('counts only the live site, with a GoatCounter code', () => {
    expect(analyticsOn('freelancingtoolkit', 'romulusmirauta.github.io', true)).toBe(true);
    expect(analyticsOn('', 'romulusmirauta.github.io', true)).toBe(false);
    expect(analyticsOn('freelancingtoolkit', 'romulusmirauta.github.io', false)).toBe(false);
    expect(analyticsOn('freelancingtoolkit', 'localhost', true)).toBe(false);
    expect(analyticsOn('freelancingtoolkit', '127.0.0.1', true)).toBe(false);
  });
});
