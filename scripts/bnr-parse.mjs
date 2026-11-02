// Parses a BNR rates XML file (curs.bnr.ro). Namespaces differ between the
// daily and yearly files, so the parser matches on local element names only.

/**
 * @param {string} xml
 * @returns {{ date: string, publishingDate: string | null, rates: Record<string, number> }[]}
 *   one entry per <Cube>, newest first; rates are RON per 1 unit (multiplier applied)
 */
export function parseBnrXml(xml) {
  const publishing = /<(?:\w+:)?PublishingDate>\s*([\d-]+)\s*</.exec(xml);
  const cubes = [];
  const cubeRe = /<(?:\w+:)?Cube\s+date="([\d-]+)"\s*>([\s\S]*?)<\/(?:\w+:)?Cube>/g;
  const rateRe = /<(?:\w+:)?Rate\s+([^>]*)>\s*([\d.]+)\s*<\/(?:\w+:)?Rate>/g;
  for (const [, date, body] of xml.matchAll(cubeRe)) {
    const rates = {};
    for (const [, attrs, value] of body.matchAll(rateRe)) {
      const currency = /currency="([A-Z]{3})"/.exec(attrs)?.[1];
      if (!currency) continue;
      const multiplier = Number(/multiplier="(\d+)"/.exec(attrs)?.[1] ?? 1);
      rates[currency] = round(Number(value) / multiplier, 8);
    }
    cubes.push({ date, publishingDate: publishing?.[1] ?? null, rates });
  }
  if (cubes.length === 0) throw new Error('No <Cube> elements found in BNR XML');
  return cubes.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function round(x, digits) {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
