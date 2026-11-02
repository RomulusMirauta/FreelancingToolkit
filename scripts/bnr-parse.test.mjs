import { describe, expect, it } from 'vitest';
import { parseBnrXml } from './bnr-parse.mjs';

// Trimmed copies of the real feeds: the daily file and the yearly file use different namespaces.
const daily = `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header><Publisher>National Bank of Romania</Publisher><PublishingDate>2026-10-30</PublishingDate></Header>
  <Body><Subject>Reference rates</Subject><OrigCurrency>RON</OrigCurrency>
    <Cube date="2026-10-30">
      <Rate currency="EUR">5.3426</Rate>
      <Rate currency="HUF" multiplier="100">1.4602</Rate>
      <Rate currency="USD">4.7698</Rate>
    </Cube>
  </Body>
</DataSet>`;

const yearly = `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="https://www.bnr.ro/xsd">
  <Header><PublishingDate>2025-12-31</PublishingDate></Header>
  <Body>
    <Cube date="2025-12-30"><Rate currency="EUR">5.0970</Rate></Cube>
    <Cube date="2025-12-31"><Rate currency="EUR">5.0985</Rate><Rate currency="JPY" multiplier="100">2.7810</Rate></Cube>
  </Body>
</DataSet>`;

describe('parseBnrXml', () => {
  it('parses the daily file and applies multipliers', () => {
    const [cube] = parseBnrXml(daily);
    expect(cube.date).toBe('2026-10-30');
    expect(cube.rates).toEqual({ EUR: 5.3426, HUF: 0.014602, USD: 4.7698 });
  });
  it('parses the yearly file (https namespace), newest first', () => {
    const cubes = parseBnrXml(yearly);
    expect(cubes.map((c) => c.date)).toEqual(['2025-12-31', '2025-12-30']);
    expect(cubes[0].rates.EUR).toBe(5.0985);
    expect(cubes[0].rates.JPY).toBe(0.02781);
  });
  it('rejects a page that is not the feed', () => {
    expect(() => parseBnrXml('<html><body>BNR</body></html>')).toThrow();
  });
});
