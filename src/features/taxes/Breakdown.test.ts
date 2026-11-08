import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TAX_OPTIONS, computeRegime, computeSideJob, type LineKey, type ResultLine } from '../../lib/tax/regimes';
import { setNumberLocale } from '../../lib/ui/numbers';
import { lineAmount } from './Breakdown';

const line = (lines: ResultLine[], key: LineKey) => lines.find((l) => l.key === key)!;
/** A line as the details show it: per month, per year. */
const shown = (l: ResultLine) => [lineAmount(l.kind, l.annual / 12), lineAmount(l.kind, l.annual)];

describe('the amounts in the calculation details', () => {
  beforeAll(() => setNumberLocale('en'));

  it('a line taken off shows a minus; any other keeps its own sign', () => {
    expect(lineAmount('minus', 12_150)).toBe('−12,150.00');
    expect(lineAmount('total', 3_870)).toBe('3,870.00');
    expect(lineAmount('total', -3_870)).toBe('−3,870.00');
    expect(lineAmount('info', -15_672)).toBe('−15,672.00');
    expect(lineAmount(undefined, 48_600)).toBe('48,600.00');
  });

  it('nothing, or under half a ban, is 0.00 without a sign', () => {
    expect(lineAmount(undefined, 0)).toBe('0.00');
    expect(lineAmount('minus', 0)).toBe('0.00');
    expect(lineAmount('total', -0.004)).toBe('0.00');
    expect(lineAmount('minus', 0.004)).toBe('0.00');
  });

  it('a negative take-home, a loss and a negative extra income read as on the card', () => {
    // 1,500 a month on the income norm: its taxes are more than that, −322.50 a month (the details said 322.50).
    expect(shown(line(computeRegime('pfaNorm', 18_000, DEFAULT_TAX_OPTIONS).lines, 'takeHome'))).toEqual(['−322.50', '−3,870.00']);
    // SRL micro at 3,000 a month: the owner's minimum wage costs more than that, a loss of 15,672 a year.
    expect(shown(line(computeRegime('srlMicro', 36_000, DEFAULT_TAX_OPTIONS).lines, 'profit'))).toEqual(['−1,306.00', '−15,672.00']);
    // A PFA of 100 a month on top of a small salary: the CASS minimum is more than it brings in.
    expect(shown(line(computeSideJob('pfa', { salaryMonthly: 2000, sideMonthly: 100 }).lines, 'sideNet'))).toEqual(['−111.50', '−1,338.00']);
  });
});
