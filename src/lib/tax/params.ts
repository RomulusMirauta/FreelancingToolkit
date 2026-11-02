import data from '../../../data/params-2026.json';

/** One verified 2026 parameter, with its legal basis (see data/params-2026.json). */
export interface ParamInfo {
  key: string;
  group: string;
  value: number | string;
  unit: string;
  ro: string;
  en: string;
  valid?: string;
  legal: string;
  source: string;
  status: string;
  note?: string;
}

export const PARAMS_YEAR: number = data.year;
export const PARAMS_CHECKED_ON: string = data.checkedOn;
export const PARAM_INFO: ParamInfo[] = data.params;

const byKey = new Map(PARAM_INFO.map((p) => [p.key, p]));

function num(key: string): number {
  const v = byKey.get(key)?.value;
  if (typeof v !== 'number') throw new Error(`Parameter ${key} is missing or not a number`);
  return v;
}

export function paramInfo(key: string): ParamInfo | undefined {
  return byKey.get(key);
}

/** Numeric parameters used by the engine, read once from the JSON. */
export const P = {
  SalMin: num('SalMin'),
  SalMinIul: num('SalMinIul'),
  SalMinRef: num('SalMinRef'),
  CotaCAS: num('CotaCAS'),
  CotaCASS: num('CotaCASS'),
  CotaImpozit: num('CotaImpozit'),
  CotaCAM: num('CotaCAM'),
  SumaNetax1: num('SumaNetax1'),
  PlafonNetax1: num('PlafonNetax1'),
  SumaNetax2: num('SumaNetax2'),
  PlafonNetax2: num('PlafonNetax2'),
  DedPlafon: num('DedPlafon'),
  DedU26: num('DedU26'),
  DedCopil: num('DedCopil'),
  PragCAS1: num('PragCAS1'),
  PragCAS2: num('PragCAS2'),
  CASSMinPFA: num('CASSMinPFA'),
  CASSMaxPFA: num('CASSMaxPFA'),
  CASSPrag1: num('CASSPrag1'),
  CASSPrag2: num('CASSPrag2'),
  CASSPrag3: num('CASSPrag3'),
  PFADeduceCASCASS: byKey.get('PFADeduceCASCASS')?.value === 'Da',
  NormaMin: num('NormaMin'),
  PlafonNormaEUR: num('PlafonNormaEUR'),
  CursEURMediu2025: num('CursEURMediu2025'),
  CotaForfetaraDA: num('CotaForfetaraDA'),
  CotaMicro: num('CotaMicro'),
  PlafonMicroEUR: num('PlafonMicroEUR'),
  CursEURPlafon: num('CursEURPlafon'),
  CotaProfit: num('CotaProfit'),
  CotaDividende: num('CotaDividende'),
  CotaConcediiPFA: num('CotaConcediiPFA'),
  BazaConcediiMaxSM: num('BazaConcediiMaxSM'),
  CotaTVA: num('CotaTVA'),
  PlafonTVA: num('PlafonTVA'),
};

/** n reference minimum wages (annual thresholds for income year 2026). */
export function mw(n: number): number {
  return n * P.SalMinRef;
}

/** Round to whole lei, half up, ignoring binary noise such as 992.2499999999. */
export function rnd(x: number): number {
  return Math.round(Number(x.toFixed(6)));
}
