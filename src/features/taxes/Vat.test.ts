import { describe, expect, it } from 'vitest';
import { paramInfo } from '../../lib/tax/params';
import { vatReading } from './Vat';

describe('the VAT meter', () => {
  it('never reads 100% under the threshold: from 393,025 RON a year it did, next to "close to the threshold"', () => {
    expect(vatReading(393_024)).toEqual({ pct: 99, state: 'near' });
    expect(vatReading(393_025)).toEqual({ pct: 99, state: 'near' });
    expect(vatReading(394_999.99)).toEqual({ pct: 99, state: 'near' });
  });

  it('exactly on the threshold is still within it; over it starts a ban later and never reads 100%', () => {
    expect(vatReading(395_000)).toEqual({ pct: 100, state: 'near' });
    expect(vatReading(395_000.01)).toEqual({ pct: 101, state: 'over' });
    expect(vatReading(396_975)).toEqual({ pct: 101, state: 'over' });
    expect(vatReading(790_000)).toEqual({ pct: 200, state: 'over' });
  });

  it('turns amber at 80%, and reads 80% only from there', () => {
    expect(vatReading(315_999.99)).toEqual({ pct: 79, state: 'under' });
    expect(vatReading(316_000)).toEqual({ pct: 80, state: 'near' });
  });

  it('a whole percentage stays whole', () => {
    // 225,150 is 57% of the threshold, and 0.57 × 100 is 56.99999999999999.
    expect(vatReading(225_150)).toEqual({ pct: 57, state: 'under' });
    const off: number[] = [];
    for (let p = 0; p <= 300; p++) if (vatReading(p * 3_950).pct !== p) off.push(p);
    expect(off).toEqual([]);
    expect(vatReading(0)).toEqual({ pct: 0, state: 'under' });
  });
});

describe('the VAT sources', () => {
  it('the 21% rate cites art. 291 alin. (1), a single sentence with no letters, as amended by Legea 141/2025', () => {
    expect(paramInfo('CotaTVA')!.legal).toBe('Cod fiscal art. 291 alin. (1), modificat prin Legea 141/2025 art. II pct. 42');
  });
});
