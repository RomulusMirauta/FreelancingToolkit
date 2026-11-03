import { describe, expect, it } from 'vitest';
import { analyticsOn, countUrl } from './analytics';

describe('analytics', () => {
  it('counts only the live site, with a GoatCounter code', () => {
    expect(analyticsOn('freelancingtoolkit', 'romulusmirauta.github.io', true)).toBe(true);
    expect(analyticsOn('', 'romulusmirauta.github.io', true)).toBe(false);
    expect(analyticsOn('freelancingtoolkit', 'romulusmirauta.github.io', false)).toBe(false);
    expect(analyticsOn('freelancingtoolkit', 'localhost', true)).toBe(false);
    expect(analyticsOn('freelancingtoolkit', '127.0.0.1', true)).toBe(false);
  });

  const env = { origin: 'https://romulusmirauta.github.io', width: 1280, code: 'x' };

  it('sends the page, never the settings in the address or in the referrer', () => {
    const url = new URL(countUrl({ path: '/taxes', title: 'Taxes' }, { ...env, referrer: 'https://www.google.com/search?q=pfa+30+eur' }));
    expect(url.origin).toBe('https://x.goatcounter.com');
    expect(url.searchParams.get('p')).toBe('/taxes');
    expect(url.searchParams.get('r')).toBe('https://www.google.com');
    expect(url.searchParams.has('q')).toBe(false);
    expect([...url.searchParams.keys()].sort()).toEqual(['b', 'p', 'r', 'rnd', 's', 't']);
  });

  it('leaves out its own site as referrer, and events carry no referrer', () => {
    const own = new URL(countUrl({ path: '/', title: 'Converter' }, { ...env, referrer: 'https://romulusmirauta.github.io/FreelancingToolkit/?amount=40' }));
    expect(own.searchParams.has('r')).toBe(false);
    const ev = new URL(countUrl({ path: 'copy-link', title: 'copy-link', event: true }, { ...env, referrer: 'https://www.google.com/' }));
    expect(ev.searchParams.get('e')).toBe('true');
    expect(ev.searchParams.has('r')).toBe(false);
  });
});
