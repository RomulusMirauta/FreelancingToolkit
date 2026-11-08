import { beforeAll, describe, expect, it } from 'vitest';
import { en, ro } from '../../lib/i18n/strings';
import { PARAM_INFO, paramInfo, type ParamInfo } from '../../lib/tax/params';
import { DEFAULT_TAX_OPTIONS, computeRegime, computeSideJob, type LineKey, type ResultLine } from '../../lib/tax/regimes';
import { setNumberLocale } from '../../lib/ui/numbers';
import { legalBasis, lineAmount, sourceLine } from './Breakdown';

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

/** A parameter's § line as the page in that language reads it (the numbers follow the page's language). */
const sourceIn = (lang: 'ro' | 'en', p: ParamInfo) => {
  setNumberLocale(lang);
  return sourceLine(p, lang, (lang === 'en' ? en : ro).taxes);
};
const source = (lang: 'ro' | 'en', key: string) => sourceIn(lang, paramInfo(key)!);

/** What a legal basis says besides its citations (acts, articles, paragraphs, letters, points), which stay in Romanian. */
const wordsBesideCitations = (legal: string) =>
  legal.replace(/Cod fiscal|\b(HG|OUG|OG|Legea|Ordin|Norme|MO|nr|art|alin|lit|pct|[IVX]+|[a-z](?=\)))\b|[\d\s.,;:()/^+-]/g, '');

describe('the § sources', () => {
  it('in English: English units and legal words, numbers written the English way, a yes in words, a percentage with its base', () => {
    expect(source('en', 'SalMin')).toBe('Gross minimum wage, January–June 2026: 4,050 RON/month (HG 1506/2024 art. 1; kept by a Government decision (preamble to OUG 89/2025))');
    expect(source('en', 'PlafonMicroEUR')).toBe('Micro-enterprise revenue ceiling: 100,000 EUR/year (Cod fiscal art. 47 alin. (1) lit. c) and art. 52, amended by OUG 8/2026)');
    expect(source('en', 'CursEURPlafon')).toBe('BNR rate on 31.12.2025 (for the 2026 micro ceiling): 5.0985 RON per EUR (Cod fiscal art. 47 alin. (1) lit. c): the rate in force at the close of the financial year)');
    expect(source('en', 'NormaMin')).toBe('Minimum annual income norm (from 2026): 12 minimum wages/year (Cod fiscal art. 69 alin. (3), amended by Legea 239/2025 art. XII pct. 6)');
    // "Da Da/Nu" before; the percentage lost "of the minimum wage".
    expect(source('en', 'PFADeduceCASCASS')).toBe('PFA real system: CAS and CASS are deducted from the income tax base: Yes (Cod fiscal art. 118 alin. (2)-(2^4); not deducted on an income norm (art. 69^2))');
    expect(source('en', 'DedU26')).toBe('Additional deduction for employees aged up to 26: 15% of the minimum wage (Cod fiscal art. 77 alin. (10) lit. a))');
    expect(source('en', 'CotaCAM')).toBe('Work insurance contribution (CAM), paid by the employer: 2.25% (Cod fiscal art. 220^3)');
  });

  it('in Romanian: numbers written the Romanian way (5.0985 read as 50,985 there), "Da" without "Da/Nu"', () => {
    expect(source('ro', 'CotaCAM')).toBe('Contribuția asiguratorie pentru muncă (CAM), plătită de angajator: 2,25% (Cod fiscal art. 220^3)');
    expect(source('ro', 'SalMin')).toBe('Salariul minim brut pe țară, ianuarie–iunie 2026: 4.050 lei/lună (HG 1506/2024 art. 1; menținut prin decizie a Guvernului (preambulul OUG 89/2025))');
    expect(source('ro', 'PlafonMicroEUR')).toContain(': 100.000 EUR/an (');
    expect(source('ro', 'CursEURPlafon')).toContain(': 5,0985 lei/EUR (');
    expect(source('ro', 'DedU26')).toBe('Deducere suplimentară pentru salariații de până la 26 de ani: 15% din salariul minim (Cod fiscal art. 77 alin. (10) lit. a))');
    expect(source('ro', 'PFADeduceCASCASS')).toBe('PFA sistem real: CAS și CASS se scad din baza impozitului pe venit: Da (Cod fiscal art. 118 alin. (2)-(2^4); la normă de venit nu se scad (art. 69^2))');
  });

  it('in English no parameter reads in Romanian, and the VAT links name their acts in English words', () => {
    const romanian = /[ăâîșțĂÂÎȘȚ]|\b(lei|din|prin|peste|salarii|minime|copil|modificat\w*|cursul|persoane|Da|Nu)\b|\/an\b/;
    expect(PARAM_INFO.map((p) => sourceIn('en', p)).filter((line) => romanian.test(line))).toEqual([]);
    expect(legalBasis(paramInfo('CotaTVA')!, 'en')).toBe('Cod fiscal art. 291 alin. (1) lit. a), amended by Legea 141/2025');
    expect(legalBasis(paramInfo('PlafonTVA')!, 'en')).toBe('Cod fiscal art. 310, amended by OG 22/2025');
    expect(legalBasis(paramInfo('PlafonTVA')!, 'ro')).toBe('Cod fiscal art. 310, modificat prin OG 22/2025');
  });

  it('params-2026.json: every unit, and every legal basis with words beside its citations, has its English version', () => {
    expect(wordsBesideCitations('HG 146/2026 art. 1 (MO nr. 196/13.03.2026)')).toBe('');
    expect(wordsBesideCitations('Cod fiscal art. 170 alin. (2)-(3), art. 174^1')).toBe('');
    expect(wordsBesideCitations('OUG 158/2005 art. 1 alin. (2) și art. 3 alin. (3)')).toBe('și');
    expect(PARAM_INFO.filter((p) => p.unit && !p.unitEn).map((p) => p.key)).toEqual([]);
    expect(PARAM_INFO.filter((p) => wordsBesideCitations(p.legal) && !p.legalEn).map((p) => p.key)).toEqual([]);
  });
});
