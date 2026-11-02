# Changelog

All notable changes to FreelancingToolkit. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

First version of the app, not yet published.

### Added

**Rate converter**
- A grid of periods (hour, day, week, month, 3/6/9 months, year) by currencies. Every cell is editable and the rest follow; the default is 30 EUR/hour.
- Editable cells are marked in lime, the Hour row is tagged "start here", and a brace beside Day → Year explains you can type a goal there instead.
- National Bank of Romania (BNR) reference rates, bundled at build time and refreshed every banking day. The rate date is shown, with a warning when rates are more than a few days old.
- Currency chips EUR, RON, USD, GBP, PLN and CHF; EUR, RON, USD and GBP are shown by default, and columns follow chip order. A searchable "+ Add currency" list covers about 160 currencies, and an added currency gets its own chip to show or hide it.
- Currencies BNR doesn't publish use market rates from ExchangeRate-API, marked "market rate" in the list, the rates and the tax page, with the source credited. BNR always wins where it has a rate.
- A custom rate per currency, marked "custom".
- Working-time settings (hours per day, days per week, weeks off), open by default.
- A "Taxes for this income →" button that opens the tax page with the converter's amount.

**Romanian taxes 2026**
- Six cards side by side, in two rows of three: CIM Employee, PFA - Real system, PFA - Income norm, SRL - Micro-enterprise, SRL - Profit tax with salary, SRL - Profit tax without salary.
- One gross-income field in any currency and for any period. The default is the converter's 30 EUR/hour in lei per month. Amounts group thousands as you type (27.781,52).
- Each card shows:
  - the monthly take-home;
  - the difference from a reference regime (green +, red −, grey =); CIM is the default reference, and the "○ Reference" toggle in a card's header changes it;
  - yearly figures and the tax share;
  - its own options (dependants, under 26, monthly expenses, income norm, pensioner, owner paid by CIM or mandate contract, and more);
  - notices, a list of disadvantages, and a line-by-line breakdown with links to the law.
- The card with the most money is highlighted in lime. An income norm the revenue is too high for doesn't count.
- PFA: an optional sick-leave insurance (1% of the minimum wage a month), plus a note that an II and the liberal professions are taxed the same way.
- SRL: the owner can be paid by a mandate contract instead of a CIM.
- "Income on top of a job": CIM + PFA and CIM + copyright, compared with the salary alone.
- "Other types of income": copyright income, shown apart because it only applies to real creative works.
- "How much do I want to earn? (net to gross)": the gross income each regime needs for a target monthly take-home, using each card's options. It handles cliffs at contribution thresholds.
- Every 2026 parameter comes from `data/params-2026.json`, with its legal basis and source. The engine is tested against an independent Python implementation (`data/golden-2026.json`).

**App**
- Light/dark theme switch (automatic by default) in the top-right corner.
- Romanian by default, with English one click away (RO | EN, top-left corner). Numbers follow the language (1.234,56 / 1,234.56), and amounts can be typed either way.
- Settings stay on the device. Floating "Reset tab" and "Reset app" buttons restore the defaults of the open page or of everything; each is disabled while it has nothing to reset.
- Installable and works offline (PWA). The deploy workflow for GitHub Pages runs on every push and on banking days after BNR publishes.

### To confirm
- The PFA sick-leave contribution (1%, base 1–3 minimum wages) comes from 2026 tax guides, not from the consolidated text of OUG 158/2005.
- Whether CAM (2.25%) is due on mandate contracts: sources disagree, and the app includes it.

## Development history

Every change since development of the app started, in the order it was made. Later entries can change or undo earlier ones; the summary above describes the current state.

### Before 2026-11-01
- 2026 tax parameters (`data/params-2026.json`) with legal basis and sources, plus an independent Python reference implementation and its expected results (`data/golden-2026.json`). Both also feed a private 2026 Excel workbook.

### 2026-11-01
1. Project set up: Vite, React and TypeScript (strict), Vitest, PWA plugin.
2. BNR rate download script. The parser handles both namespaces of the BNR feed, and the first snapshot holds the rates of 30 Oct 2026 (EUR 5.3426).
3. Rate converter: a periods × currencies grid where every cell is editable, EUR and RON columns, a default of 30 EUR/hour, working-time settings, the rate date with a staleness warning, and a custom rate per currency.
4. Main-currency chips (USD, GBP, CHF), a search to add any BNR currency, and a remove button on each column.
5. Phone layout fixes: the grid scrolls inside its card, with narrower cells.
6. TypeScript tax engine for 2026 (employee, PFA, SRL, copyright), tested against the Python reference.
7. "What do I need to earn?" solver, made to find the best amount just below contribution cliffs.
8. Tax screen with tabs (Compare, PFA, SRL, Employee, Copyright), a § source link on each line, and a disclaimer. Converter and Taxes became separate views, with a "Taxes for this income →" button.
9. README, GitHub Pages deploy workflow, `.gitignore`.
10. Floating "Reset app" button, bottom right, with a browser confirmation.
11. "Reset app" disabled while nothing has changed. Settings equal to their defaults are no longer stored.
12. UI pass:
    - lime marks editable cells, and the Hour row gets a "start here" tag;
    - "+ Add currency" became a dropdown, and an added currency gets a show/hide chip;
    - CHF removed from the default chips, and columns follow chip order;
    - Working time open by default;
    - the reset confirmation moved into the page.
13. Brace beside Day → Year: "Or work backwards" (type a goal and get the hourly rate). On narrow screens a one-line hint replaces it.
14. Reset made instant (the confirmation is kept in the code, commented out).
15. Column order changed to EUR, RON, USD, GBP.
16. "+ Add currency" became a search box: by code or by name, ignoring diacritics, with keyboard support.

### 2026-11-02
17. Romanian version, now the default, with an RO | EN switch:
    - numbers follow the language, and amounts can be typed either way;
    - currency names in Romanian, searchable in both languages.
18. Tax screen redesigned as a board instead of tabs:
    - one gross-income field, with every regime visible at once;
    - each card shows its monthly take-home and a green/red/grey difference from a reference regime (CIM by default, changeable);
    - options on each card;
    - "Most money" highlight.
19. New card: PFA - Income norm. Regimes renamed: CIM (angajat), PFA - Sistem real, SRL micro-întreprindere, SRL - Impozit pe profit, cu salariu / fără salariu.
20. Disadvantage lists on every card.
21. Optional PFA sick-leave insurance (1% × minimum wage a month), added to the 2026 parameters as "to confirm".
22. The "most money" highlight skips the income norm when revenue is too high for it.
23. Language switch moved to the page's top-right corner.
24. Renamed "SRL micro-întreprindere" to "SRL - Micro-întreprindere".
25. CIM, PFA and SRL shown as pills. The pills were then made larger, set in Space Grotesk (bundled, works offline) and aligned with the text.
26. Card header kept on one line; the "most money" badge moved under the amount, then back into the header as a small star.
27. One neutral colour for all cards. Only the "most money" card is lime, and the reference card gets a grey outline.
28. Copyright income moved off the board into "Other types of income": it can't be the best option or the reference.
29. Tax income defaults to the converter's 30 EUR/hour. The star was removed, since the lime card is enough.
30. Cards in two rows of three: CIM, PFA, PFA, then SRL ×3.
31. "Income on top of a job" section with CIM + PFA and CIM + copyright, compared with the salary alone. Rules checked against 2026 tax guides.
32. Note on the PFA card: an II and the liberal professions are taxed the same way.
33. Gross-income field:
    - label updated;
    - defaults to lei per month;
    - currency chosen from the searchable list of all BNR currencies;
    - every period available, from hour to year.
34. SRL owner can be paid by CIM or by mandate contract. A mandate paid at least the minimum wage meets the micro-enterprise employee condition. CAM on mandates is marked "to confirm".
35. More spacing around the lower sections. Even spacing around the "+" between pills.
36. The currency button shows the code in capitals (RON instead of "lei"), then only the code.
37. "What do I need to earn?" spaced like the other sections.
38. This changelog.
39. The Converter and Taxes pages have the same width (1200 px), so the header and the Convertor | Taxe switch stay in place when switching. The converter shows USD by default (EUR, RON, USD). Both switch buttons now use the same font weight, so the active one no longer changes width.
40. More visible Convertor | Taxe switch: the active section is filled with the app's green, the buttons are larger with a border around the switch, and each has a small icon (⇄ converter, receipt with % for taxes).
41. The currency code on the tax page's currency button is no longer bold.
42. The intro text under "Income on top of a job" and "Other types of income" now uses the full width.
43. "What do I need to earn?" renamed to "How much do I want to earn? (net to gross)" (RO: "Cât vreau să câștig? (de la net la brut)").
44. The desired take-home in "How much do I want to earn?" has the same currency (searchable) and period choices as the gross-income field, and the answer is shown in that currency and period plus per year. The target is saved.
45. "How much do I want to earn?" always shows the chosen period plus month and year (e.g. hour · month · year).
46. Fix: SRL cards with the owner on salary no longer show a take-home when revenue doesn't cover the salary and its taxes. The loss now comes out of the owner's pocket, so small targets no longer need "0 lei" revenue. Applied in the Python reference too; the golden results are unchanged.
47. "CIM (angajat)" renamed to "CIM Angajat" (EN: "CIM Employee").
48. Cards in a row have the same height: the options area fills the difference, so disadvantages and details line up at the bottom. The reference card keeps the space of the "Compare against this" link, so amounts and options start at the same line.
49. Choosing the reference moved from a "Compare against this" link to a "○ Reference" toggle in each card's header ("◉ Reference" on the chosen card), working like a radio button. Its label reads "Use as reference". The reference card shows "= the comparison base" instead of a difference. Card headers leave room for a name on two lines, so cards in a row stay aligned.
50. The "Owner paid by: CIM | Mandate contract" switch is only as wide as its buttons, instead of the whole card.
51. Card options are compact: the label on the left and a right-sized input on the right (narrow for counts such as dependants, wider for amounts in lei), instead of full-width fields.
52. Theme switch in the top-right corner, next to RO | EN: ◐ automatic (follows the system, the default), ☀ light, ☾ dark. The choice is saved and applied before the page appears, and "Reset app" returns to automatic. The corner switches sit in their own strip above the header, so they never cover the Convertor | Taxe switch.
53. The RO | EN language switch moved to the top-left corner; the theme switch stays top-right.
54. Every field of the income rows (gross income and "How much do I want to earn?") has the lime "editable" box: amount, currency and period. The currency button and the period list use the same drawn arrow, and the period box is as wide as the chosen period (short for "oră", longer for "săptămână"; Chrome/Edge, other browsers keep a fixed width).
55. Fix: the open period list was light text on a light background in dark mode. The options now use the theme's colours.
56. Amounts on the tax page group thousands as you type (27.781,52 in Romanian, 27,781.52 in English). The thousands marks are added automatically: they can't be typed or deleted, and Backspace or Delete next to one removes the digit beyond it. In Romanian the "." key types the decimal comma, pasted amounts in either convention are read whole, and the field regroups when the language changes.
57. The "Working time" fields have the lime "editable" box.
58. The period choice (gross income and "How much do I want to earn?") is a list like the currency one instead of the browser's select: same button and arrow, a rounded panel with the current period ticked, keyboard support (↑ ↓ Enter Esc). The button is as wide as the chosen period in every browser.
59. "Dependants" on the CIM card is a list with 0 (default), 1, 2, 3 and 4+, using the same list as the period choice, instead of a number field. "4+" counts as 4, since the deduction stops growing at four people. The label drops "(0–4)".
60. "Children in school" on the CIM card is a list too, with exact counts 0 to 10 and no "N+": the deduction is 100 lei a month for every child, with no ceiling. Tax cards no longer clip their content, so an open list can reach past the card's edge.
61. The gross-income explanation ("Gross salary for CIM, revenue for PFA and SRL.") moved from the label to its own line under the fields, above the per-month and per-year total. The label is just "Gross income", so the currency and period sit next to the amount.
62. The amount boxes ("Gross income" and "How much do I want to earn?") grow with the amount, between a minimum and a maximum. Beside the gross income, the currency and period boxes match the amount box: same 2 px lime border, height, text size and bold text. Their labels (Gross income, Currency, Period) are larger and semi-bold to match.
63. The converter shows GBP by default too (EUR, RON, USD, GBP), so the grid looks less empty. PLN (Polish złoty) is a new main chip, off by default, as Poland is a frequent source of freelance offers in the region.
64. CHF is back as a main chip, after PLN and off by default: Switzerland is a well-paying client market for Romanian freelancers.
65. The converter's Per column stays frozen while the currencies scroll sideways, with a light shadow on its edge once they pass under it.
66. "Reset page" button next to "Reset app": it resets only the open page (Converter: currencies, custom rates, working time; Taxes: income, card options, reference, income on top of a job, net-to-gross target) and stays on that page. Language and theme are reset only by "Reset app".
67. The page reset button is named after the page ("Reset Converter" / "Reset Taxes"; RO "Resetează Convertorul" / "Resetează Taxele") and sits above "Reset app", both the same width.
68. The page reset button reads "Reset tab" (RO "Resetează tab-ul") on both pages, so its width no longer changes when switching between Converter and Taxes. Its tooltip still names the page.
69. "RON" everywhere instead of "lei" (amounts on the cards, lei/month and lei/year suffixes, totals, notices, disadvantages, the "Taxes for this income" button), in both languages, to see whether it reads well.
70. Every currency in the world in "+ Add currency" (about 160 instead of 36). Currencies BNR doesn't publish use market rates from ExchangeRate-API (free, no key), bundled at build time like BNR's and refreshed by the same workflow; names in Romanian and English come from the standard Unicode data. They are marked "market rate" in the list, next to the rate, and on the tax page ("market rate, not BNR"), and the source is credited with a link. BNR always wins where it has a rate.
71. Currency symbols as a small, faded hint after the ISO code ("EUR €", "GBP £", "PLN zł") on the chips, the converter's column headers, the "+ Add currency" list and the tax page's currency buttons. Only symbols that point to one currency are shown (20 of them): "$" is USD only, and shared ones such as "kr" or "¥" are left out. RON has none for now, as the app writes RON everywhere.
72. Currency symbols are more visible (stronger and less faded). The "+ Add currency" list is wider (400 px), so most names fit on one line next to the code, symbol and market tag. Lists opened near the right edge (such as the tax page's currency on a phone) slide back inside the screen, and their search box is no longer right-aligned on the tax page.
73. Currency symbols come from the standard Unicode data for every currency that has one (about 100, not just 20): shared symbols such as "$" or "kr" are shown too, since the code beside them tells them apart. RON stays without one (its symbol is "lei"). In the "+ Add currency" list the symbol has its own column, in a small key-like box, so names line up.
74. RON gets its symbol, "lei", as a hint like the others ("RON lei"); amounts are still written with RON. On the currency chips the symbol sits in its own small pill inside the chip, set apart from the code.
75. Currency symbols come from a fixed table (`src/data/currency-symbols.json`, made by `scripts/gen-currency-symbols.mjs`) instead of the browser's own data, which differs between browsers and versions, so everyone sees the same symbol. KGS's new som sign is left out, as most fonts lack it.
76. Tests:
    - currency symbols: the expected symbol for 34 currencies, no symbol paired with the wrong currency, never another currency's code as a symbol;
    - "Reset tab": every saved setting belongs to a tab or to the whole app;
    - the downloaded rate files: a real date, EUR and USD present, only positive rates, names for every market currency. A broken download now fails the tests before anything is deployed.
77. Deploy workflow: fresh rates are committed only after the tests and the build pass, so broken data never reaches the repo and the site keeps its last good version. Rebases before pushing, configures Pages, and has time limits.
78. `.gitignore` also covers Excel files, `.env` files, logs and editor/OS files.
79. Amounts in the card options (deductible expenses, income norm) and in "Income on top of a job" group thousands like the gross income (8.000, 48.600). An emptied amount field counts as 0 instead of keeping the old value.
80. On phones the floating reset buttons shrink to "↺ Tab" and "↺ Tot" (EN "All"), so they cover less of the page; the full names stay as tooltips and for screen readers.
81. The footer credits the market rates as well as BNR's.
82. MIT license. The scripts for the private Excel workbook moved out of the public repo, next to the workbook.
