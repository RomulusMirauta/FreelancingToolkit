import { describe, expect, it } from 'vitest';
import { en, ro, type ConsFacts } from './strings';
import stringsSource from './strings.ts?raw';

describe('texts on the tax cards', () => {
  it('the PFA note no longer counts lawyers among the professions taxed alike: they owe no CAS', () => {
    // Lawyers are insured in their own pension system (CAA), and art. 150 alin. (1) waives CAS for them.
    expect(en.notices.pfaAlso).not.toMatch(/\(lawyer/);
    expect(ro.notices.pfaAlso).not.toMatch(/\(avocat/);
    expect(en.notices.pfaAlso).toContain('Lawyers owe no CAS: they pay into their own pension fund (CAA) instead.');
    expect(ro.notices.pfaAlso).toContain('Avocații nu datorează CAS: contribuie la casa lor de pensii (CAA).');
  });

  it('the extra deduction is for people under 26, in English as in Romanian ("până în 26 de ani")', () => {
    expect(en.opts.under26).toBe('Under 26');
  });

  it('"Also employed" says the salary counts over a year, as the CASS rule does', () => {
    expect(en.opts.hasSalary).toBe('Also employed (salary ≥ 6 minimum wages a year)');
    expect(en.opts.hasSalaryHint).toMatch(/ a year$/);
    expect(ro.opts.hasSalary).toBe('Are și salariu (≥ 6 salarii minime pe an)');
    expect(ro.opts.hasSalaryHint).toMatch(/ pe an$/);
  });

  it('sick-leave insurance: the RON range is the 1%, and sick pay waits for 6 months of contributions', () => {
    const facts: ConsFacts = { sickMin: '40.50', sickMax: '129.75', ownerSalaryTaxes: '', dividendRate: '', microCeilingEur: '', normLimitEur: '' };
    const enText = en.cons.pfa[0]!(facts);
    const roText = ro.cons.pfa[0]!({ ...facts, sickMin: '40,50', sickMax: '129,75' });
    // In brackets right after "1 and 3 minimum wages", the range read as what those wages come to.
    expect(enText).not.toMatch(/minimum wages \(/);
    expect(enText).toContain('counted between 1 and 3 minimum wages, so 40.50–129.75 RON a month; sick pay only after 6 months of contributions;');
    expect(roText).not.toMatch(/salarii minime \(/);
    expect(roText).toContain('luat între 1 și 3 salarii minime, adică 40,50–129,75 RON pe lună, cu drept la indemnizație abia după 6 luni de contribuție;');
    expect(en.opts.sickLeave).toBe('Also pay sick-leave insurance (1% of income, within limits)');
    expect(ro.opts.sickLeave).toBe('Plătesc și asigurarea pentru concediu medical (1% din venit, în anumite limite)');
  });

  it('Romanian spells "microîntreprindere" as one word everywhere, as the Fiscal Code does', () => {
    // The card name keeps a soft hyphen, shown only where the name has to wrap.
    expect(ro.regimes.srlMicro).toBe('SRL - Micro\u00adîntreprindere');
    expect(ro.regimes.srlMicro.replace('\u00ad', '')).toBe('SRL - Microîntreprindere');
    // Read as source text, so the texts built by functions (from figures) are checked too.
    expect(stringsSource).not.toMatch(/[Mm]icro-întreprindere/);
    expect(ro.notices.mandate).toContain('îndeplinește condiția de angajat pentru microîntreprindere.');
  });
});

describe('the working time summary', () => {
  it('Romanian puts "de" after a whole number of days ending in 20–99 or 00, as shown', () => {
    const days = (shown: string) => ro.settings.summary('8', '5', shown, '2.080');
    expect(days('260')).toBe('8 h/zi · 5 zile/săpt. · 260 de zile lucrate/an · 2.080\u00a0h facturabile/an');
    expect(days('100')).toContain(' 100 de zile lucrate/an');
    expect(days('120')).toContain(' 120 de zile lucrate/an');
    expect(days('245')).toContain(' 245 de zile lucrate/an');
    expect(days('208')).toContain(' 208 zile lucrate/an');
    expect(days('101')).toContain(' 101 zile lucrate/an');
    expect(days('119')).toContain(' 119 zile lucrate/an');
    expect(days('26')).toContain(' 26 de zile lucrate/an');
    // A decimal is read last, so no "de": a 4-day week with the public holidays off.
    expect(days('197,6')).toContain(' 197,6 zile lucrate/an');
  });

  it('one day a week is a day, not days', () => {
    expect(en.settings.summary('8', '1', '52', '416')).toBe('8 h/day · 1 day/week · 52 working days/year · 416 billable h/year');
    expect(ro.settings.summary('8', '1', '52', '416')).toBe('8 h/zi · 1 zi/săpt. · 52 de zile lucrate/an · 416\u00a0h facturabile/an');
    expect(en.settings.summary('8', '0.5', '26', '208')).toContain(' 0.5 days/week ');
    expect(ro.settings.summary('8', '1,5', '78', '624')).toContain(' 1,5 zile/săpt. ');
  });
});

describe('install steps', () => {
  it('Edge gets its own menu path, and Firefox on Windows is told where its install button is', () => {
    const [enLast, roLast] = [en.app.steps.desktop[3], ro.app.steps.desktop[3]];
    expect(enLast).toContain('Edge: menu … (top right) → "More tools" → "Apps" → "Install this site as an app".');
    expect(enLast).toContain('Firefox on Windows (version 143 or later): the "Add tab to taskbar" button at the right of the address bar.');
    expect(enLast).toContain('On Mac or Linux, Firefox cannot install apps: use Chrome or Edge.');
    expect(roLast).toContain('Edge: meniul … (dreapta sus) → „Mai multe instrumente” → „Aplicații” → „Instalați acest site ca aplicație”.');
    expect(roLast).toContain('Firefox pe Windows (versiunea 143 sau mai nouă): butonul „Adaugă fila în bara de activități” din dreapta barei de adrese.');
    expect(roLast).toContain('Pe Mac sau Linux, Firefox nu poate instala aplicații: folosește Chrome sau Edge.');
  });

  it('Safari on Mac is pointed to File → Add to Dock (macOS Sonoma or later)', () => {
    expect(en.app.steps.desktop.at(-1)).toContain('Safari on Mac (macOS Sonoma or later): File → "Add to Dock".');
    expect(ro.app.steps.desktop.at(-1)).toContain('Safari pe Mac (macOS Sonoma sau mai nou): Fișier → „Adăugați în Dock”.');
  });

  it('Share is placed for iPhone and for iPad, with the ⋯ menu when it is not in sight', () => {
    expect(en.app.steps.ios[1]).toBe('Tap the Share button (the square with an arrow pointing up): on iPhone at the bottom of the screen, on iPad at the top. Not there? It is in the ⋯ menu.');
    expect(ro.app.steps.ios[1]).toBe('Apasă butonul Partajează (pătratul cu o săgeată în sus): pe iPhone e în partea de jos a ecranului, pe iPad în partea de sus. Nu-l vezi? E în meniul ⋯.');
  });
});
