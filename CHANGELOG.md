# Changelog

All notable changes to FreelancingToolkit. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/): 0.x are the development versions, 1.0.0 the first stable one. Each version lists its steps of the [development history](#development-history) below.

## [Unreleased]

Steps 155– of the development history.

### Added
- Visit counts with GoatCounter (free, no cookies): page views and three events, never the settings or amounts. The README shows them as badges (per week, month, year and total).
- Screenshots in the app's manifest, so Chrome's install dialog shows the app on desktop and on phones.

### Changed
- Tools: on phones only the pulsing dot, bigger and easy to tap, so it no longer covers the page; no chevron on any screen.
- Phones: the settings button is just the gear, on the title's row, and the Converter | Taxes switch sits in the middle.
- Phones: the converter starts with EUR and RON, which fit on the screen; USD and GBP are one tap away. Desktop still starts with four.
- Phones: the brace beside Day → Year stays, slim, with "or type your goal here" turned sideways; on screens too narrow for it, the line under the grid remains.
- Phones: "start here" is an arrow after Hour, so the row is as tall as the others.
- Phones: the Converter | Taxes switch is centred under the app's name, and the button to the tax page reads "See the taxes for this income" on one line and the amount on the next.
- The grid's header shows each currency symbol in a small pill, like the chips and the rate cards.

### Fixed
- Phones: a tap that slides a little, or a long press, on a button, chip, section title, list option or switch no longer selects its text.
- Employee card: the "net in Jan–Jun, net in Jul–Dec" note shows only when the two differ; above a low salary they are the same, and it repeated one amount twice.
- On phones, the Tools wrench (and the settings gear) turns back when its menu closes; before, it stayed turned until you tapped somewhere else.
- With many currencies, "+ Add currency" no longer drops alone onto a row of its own: it follows the last currency and wraps together with it.
- The × of the one-line "Or work backwards" hint sits right after the text, not at the card's far edge.
- Every form field has a name, so Chrome's DevTools no longer lists 50 issues.

## [1.0.0] - 2026-11-03

The first stable version. Steps 113–154 of the development history.

### New since 0.3.0
- Every setting is in the address, only the changed ones: language, theme, currencies, custom rates, working time, fees, every tick and pick on the tax cards, the reference card, the amounts and the folded sections. A reload, a bookmark or a link opens the app the same way; a broken or out-of-range value is ignored.
- "Copy link" is the address itself, without the viewer's language and theme. A link with your own settings says nothing changed; "Back to my settings" confirms with a toast after the reload.
- BNR rates as one card per currency: the change against the previous banking day, a chart of the last 10 banking days, and the custom rate with "applied" or "BNR rate in use". A custom rate field starts from BNR's rate, so you can change a digit or two.
- The tax page's gross income and the converter follow each other both ways.
- "Settings & options" menu with a gear icon: the theme and language switches, "Copy link" and "Install the app".
- New app icon: two coins with a drawn €.
- Amounts are limited to 999,999,999.99; going past it shows a toast.
- Design pass: design tokens (spacing, radii, shadows, motion), a "kept" bar with the net per year and the effective tax rate on every tax card, the converter grid works from the keyboard like a spreadsheet, sections open and close with a slide, tidy notes and figures in Working time and Fees, payment-calendar cards, a clearer VAT meter, and "Reset app" asks first.
- 299 unit tests, including every setting's round trip through the address.

### Fixed since 0.3.0
- An income read from the address no longer looks changed when it is the default.
- "Reset tab" on the converter also resets the tax page's income when that income only followed the converter.
- An income norm card the income is too high for says "Over the limit" instead of looking like it beat the "Most money" card.

### Everything in this version

**Rate converter**
- A grid of periods (hour, day, week, month, 3/6/9 months, year) by currencies. Every cell is editable and the rest follow; the default is 30 EUR/hour. It works like a spreadsheet from the keyboard: arrows move between cells, Enter goes down, Esc undoes the cell.
- Editable cells are marked in lime, the Hour row is tagged "start here", and a brace beside Day → Year explains you can type a goal there instead.
- National Bank of Romania (BNR) reference rates, bundled at build time and refreshed every banking day. The rate date is shown, with a warning when rates are more than a few days old.
- Currency chips EUR, RON, USD, GBP, PLN and CHF; EUR, RON, USD and GBP are shown by default, and columns follow chip order. A searchable "+ Add currency" list covers about 160 currencies, and an added currency gets its own chip to show or hide it.
- Currencies BNR doesn't publish use market rates from ExchangeRate-API, marked "market rate" in the list, the rates and the tax page, with the source credited. BNR always wins where it has a rate.
- The rates as one card per currency: the rate in large type, its change against the previous banking day (▲ green: more lei for the same invoice, ▼ red: fewer) and a small chart of the last 10 banking days, then the custom rate.
- A custom rate per currency, marked "custom".
- Working-time settings (hours per day, days per week, days off, holidays, billable share), open by default.
- Every section of both pages folds (chevron and a one-line summary), each in its own card; folded sections stay in the address, and the floating "Tools" menu hides or shows them all.
- Working-time quick picks: Full-time (8 h × 5 days), Part-time (4 h × 5 days), 4-day week (8 h × 4 days) and Weekends only (8 h × 2 days). They keep the days off, holidays and billable share, and the one matching the current values is highlighted. The defaults are shown as plain text instead of a reset link.
- Working time in days: days off per year (leave, sick days), an option to take off the Romanian public holidays (worked out for the current year, Orthodox Easter included: 11 working days in 2026) and the share of billable hours (%). The hourly rate stays, the day, month and year amounts follow.
- "Fees and currency exchange", its own collapsible card under Working time (its header sums it up: "You keep 89.55% · Upwork 10% · Wise 0.5%"). Two numbered steps, each a list with an editable % and a one-line explanation of the choice: 1 · Platform (Upwork, Fiverr, Freelancer.com, Malt, Guru, Toptal, Braintrust, Arc.dev, Contra, Freelancermap, or custom), 2 · Exchange and transfer (Wise, Revolut, Payoneer, bank, or custom). Then the path of one hour's pay: You invoice → Platform → Exchange → You keep, and the same per month in RON. By default it shows the common case, Upwork (10%) and a Romanian bank exchange (2%): you keep 88.2%.
- The tax page's gross income and the converter follow each other: changing the rate, the working time or a custom rate updates the income, and an income typed on the tax page becomes the converter's amount.
- A "Taxes for this income →" button that opens the tax page with the converter's amount.

**Romanian taxes 2026**
- Six cards side by side, in two rows of three: CIM Employee, PFA - Real system, PFA - Income norm, SRL - Micro-enterprise, SRL - Profit tax with salary, SRL - Profit tax without salary.
- One gross-income field in any currency and for any period. The default is the converter's 30 EUR/hour in lei per month. Amounts group thousands as you type (27.781,52).
- Each card shows:
  - the monthly take-home;
  - the difference from a reference regime (green +, red −, grey =); CIM is the default reference, and the "○ Reference" toggle in a card's header changes it;
  - a thin bar with the share of the gross you keep, then the net per year and the effective tax rate, in the same two rows on every card;
  - its own options (dependants, under 26, monthly expenses, income norm, pensioner, owner paid by CIM or mandate contract, and more);
  - notices, a list of disadvantages, and a line-by-line breakdown with links to the law.
- The card with the most money is highlighted in the app's teal, with a "Most money" tag (lime is kept for what can be edited). An income norm the revenue is too high for doesn't count, and its card says "Over the limit" where the tag would be.
- PFA: an optional sick-leave insurance (1% of the minimum wage a month), plus a note that an II and the liberal professions are taxed the same way.
- SRL: the owner can be paid by a mandate contract instead of a CIM.
- "Income on top of a job": CIM + PFA and CIM + copyright, compared with the salary alone.
- "Other types of income": copyright income, shown apart because it only applies to real creative works.
- "How much do I want to earn? (net to gross)": the gross income each regime needs for a target monthly take-home, using each card's options. It handles cliffs at contribution thresholds.
- "VAT: what to watch": the 21% rate, the 395,000 RON exemption threshold against the page's income (a meter that turns amber near it and red over it), and what changes for clients in Romania, in the EU and outside it.
- "Payment calendar": the deadlines of the next 12 months (tax return, quarterly micro/profit tax, D101, annual accounts, the 3% discount), moved off weekends and holidays, filterable by PFA or SRL, plus the monthly ones on the 25th. The next three are cards with the day in large type and the form to file (D212, D100, D101); the rest are grouped by month.
- Every 2026 parameter comes from `data/params-2026.json`, with its legal basis and source. The engine is tested against an independent Python implementation (`data/golden-2026.json`).

**App**
- Light/dark theme switch (automatic by default), first in the "Settings & options" menu (gear icon, top-right corner).
- Romanian by default, with English in "Settings & options" (Română | English). Numbers follow the language (1.234,56 / 1,234.56), and amounts can be typed either way.
- Settings stay on the device, and every changed one is in the address too (?lang=en&currencies=EUR,RON,PLN&platform=fiverr…), so a reload or a bookmark opens the app the same way. A broken or out-of-range value in the address is ignored.
- The floating "Tools" menu (bottom right) hides or shows the sections and holds "Reset tab" and "Reset app", which restore the defaults of the open page or of everything; each is disabled while it has nothing to reset. "Reset tab" is instant; "Reset app" asks first.
- "Copy link" (Settings & options): the address, marked as a shared link, without the viewer's language and theme. Opening it replaces the page settings for that visit, with "Back to my settings".
- "Install the app" (Settings & options): Chrome and Edge's install dialog, or plain step-by-step instructions for computer, Android and iPhone, this device first. Hidden once installed.
- Amounts go up to 999,999,999.99; past that a toast says so.
- Installable and works offline (PWA). The deploy workflow for GitHub Pages runs on every push and on banking days after BNR publishes.

### To confirm
- The PFA sick-leave contribution (1%, base 1–3 minimum wages) comes from 2026 tax guides, not from the consolidated text of OUG 158/2005.
- Whether CAM (2.25%) is due on mandate contracts: sources disagree, and the app includes it.
- The VAT rate and threshold come from 2026 tax guides; whether services for clients abroad count towards the threshold is open.
- Whether the 3% tax-return discount is given again in 2027 (it was in 2026, by OUG 8/2026).
- Platform and exchange fees are typical 2026 values from secondary sources (Upwork's varies per contract).

## [0.3.0] - 2026-11-02

Development version. Steps 86–112.

### Added
- Working time in days: days off, the Romanian public holidays (Orthodox Easter computed per year) and the share of billable hours, with quick picks for full-time, part-time, a 4-day week and weekends.
- "Fees and currency exchange" card: platform and transfer lists with search, the path of an hour's pay and what reaches you per month (Upwork 10% and a bank exchange of 2% by default).
- "VAT: what to watch" and the "Payment calendar" on the tax page.
- "Copy link" with the settings, and "Install the app" with step-by-step instructions.
- Every section folds, remembered in the address, with a "Tools" menu to hide or show them all and to reset.
- Sliding switches for theme, language and Convertor | Taxe; the converter's amount in the address.

### Fixed
- The tax page's gross income follows every change of the converter, not only the "Taxes for this income" button.
- Folded sections count as something to reset.

## [0.2.0] - 2026-11-02

Development version, the first on GitHub Pages. Steps 83–85.

### Added
- Published at <https://romulusmirauta.github.io/FreelancingToolkit/>.
- PNG icons for installing on Android and iPhone, and link previews.
- README with the live link, what a PWA is and how to install it.

## [0.1.0] - 2026-11-02

The first development version. Steps 1–82.

### Added
- Rate converter: a periods × currencies grid where every cell is editable, BNR rates refreshed every banking day, market rates for about 160 more currencies, currency chips with symbols, custom rates and working time.
- Romanian taxes 2026: CIM, PFA (real system and income norm) and SRL (micro-enterprise, profit tax with and without salary) side by side, each with its options, a reference regime, "Most money", disadvantages and a line-by-line breakdown with links to the law; "Income on top of a job", copyright income and "How much do I want to earn? (net to gross)".
- Romanian by default with English, an automatic/light/dark theme, "Reset tab" and "Reset app".
- Installable and works offline (PWA); deploy workflow for GitHub Pages; MIT license.

## Development history

Every change since development of the app started, in the order it was made, grouped by the version it shipped in. Later entries can change or undo earlier ones; the version notes above describe each version as released.

### Before 0.1.0 (before 2026-11-01)
- 2026 tax parameters (`data/params-2026.json`) with legal basis and sources, plus an independent Python reference implementation and its expected results (`data/golden-2026.json`). Both also feed a private 2026 Excel workbook.

### 0.1.0 (2026-11-01 to 2026-11-02)

*2026-11-01*

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

*2026-11-02*

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

### 0.2.0 (2026-11-02)

83. Published on GitHub Pages: <https://romulusmirauta.github.io/FreelancingToolkit/>.
84. Installing as an app: PNG icons (192 and 512 px, a maskable one for Android, and an Apple touch icon, since iOS ignores SVG icons on the home screen) next to the SVG one, all available offline. Link previews (Open Graph) for sharing the app's link.
85. README: the app's link, what a PWA is and how to install it on desktop, Android and iPhone, privacy, data sources and update times, deploying your own copy, and how to regenerate the tax golden file. `package.json` has the description, homepage and repository.

### 0.3.0 (2026-11-02)

86. Working-time quick picks above the fields: Full-time (8 h × 5 days), Part-time (4 h × 5 days), 4-day week (8 h × 4 days), Weekends only (8 h × 2 days). A pick keeps the weeks off, and the one matching the current values is highlighted. The "Reset to 8 h × 5 days × 52 weeks" link became plain text ("Default: 8 h × 5 days × 52 weeks").
87. The hours × days on the working-time quick picks ("8 h × 5 days") stand out: full-strength text in its own small pill inside the button, like the currency symbol on a currency chip.
88. Working time counts days, not weeks: "Days off per year" replaces "Weeks off per year" (a saved value is converted: weeks × days per week), a "Take off the public holidays" option counts the Romanian public holidays on your working days (Codul muncii art. 139, Orthodox Easter and Pentecost computed per year; 11 working days in 2026, scaled for shorter weeks), and "Billable hours (%)" lowers the hours you invoice. The summary shows working days and billable hours per year.
89. "Fees and currency exchange" under the converter's grid: platform chips (None, Upwork 10%, Fiverr 20%, Freelancer.com 10%, Malt 10%, Toptal 0%) and exchange/transfer chips (None, Wise 0.5%, Revolut 0%, Payoneer 2%, Bank 2%), each with an editable % (typing makes it "Custom"), and what you keep per hour and per month, with the monthly fees. The tax page still gets the gross; the note points to PFA's deductible expenses.
90. Fix: the tax page's gross income no longer stays behind when the converter changes. It used to be set only by the "Taxes for this income →" button; now any change of the converter's monthly amount (rate, working time, custom rate) updates it, in RON per month.
91. "VAT: what to watch" section on the tax page, with the VAT rate (21%) and exemption threshold (395,000 RON) added to `data/params-2026.json` as "to confirm", and links to their legal basis.
92. "Payment calendar" section on the tax page (`src/lib/tax/calendar.ts`, tested), using the public-holiday calendar (`src/lib/time/holidays.ts`, tested) to move deadlines to the next working day.
93. "Copy link" button: the settings travel in the address (`?share=1&source=…&work=…`), are applied before the app renders and removed from the address straight away. "Reset app" no longer keeps the query string. A banner says a link's settings are shown and offers "Back to my settings".
94. "Install" button with step-by-step instructions in plain words for computer (Chrome/Edge), Android and iPhone/iPad; on Chrome and Edge it opens their install dialog directly. Phones show the two top buttons as icons only.
95. Installing: the SVG icon has a width and height (Chrome reported it as "failed to load" without them) and the manifest has a fixed `id`.
96. More platforms in "Fees and currency exchange": Guru (9%), and Braintrust, Arc.dev, Contra and Freelancermap at 0% (the client pays, or a subscription), explained in the note. Each row now has its label and % on one line and the chips across the full width below, so no chip is left alone on a second line next to a floating % field.
97. "Fees and currency exchange" redesigned and moved into its own collapsible card under Working time, with a one-line summary in its header. The 16 chips became two numbered steps (Platform, Exchange and transfer), each a list showing the name and % ("Upwork · 10%", "Custom (type the %)") next to an editable % field, with a short explanation of the chosen option instead of one long paragraph. The result is a path of four tiles (You invoice → Platform −3.00 → Exchange −0.14 → You keep 26.87 EUR/h, the last in lime), then the monthly amount and fees in RON. Side by side on wide screens, stacked on phones.
98. Fees start on the most common real case instead of none: Upwork (10%) and a Romanian bank changing the money into RON (2%), so a fresh app shows 88.2% kept (26.46 EUR of 30 EUR an hour). A line under the card says so and points to "None" for direct clients. These defaults aren't stored, so the reset buttons stay off until something is changed.
99. The platform list opens with a search box (diacritics ignored, ↑ ↓ Enter Esc) and shows its 12 entries in two columns read downwards, so it is half as long. Lists open upwards when there is no room below and slide back inside the screen on phones, so they never lengthen the page. These are options of the shared list (`ListPicker`); the period and dependants lists are unchanged.
100. Every section folds, with a chevron and a one-line summary that stays readable while folded (shared `Fold` card). Converter: "Rate converter" (30.00 EUR/hour · 27,769.56 RON/month), Working time, Fees. Taxes: the single big card became separate cards, "Romanian taxes 2026" (gross income), "Income on top of a job", "Other types of income", "How much do I want to earn?" (the take-home wanted), "VAT" (share of the threshold) and "Payment calendar" (the next deadline), with the disclaimer under them. The chevron is drawn, the same size folded and open, and turns when opened.
101. Folded sections are remembered in the address (`?fold=converter,fees`), so a reload, a bookmark or a shared link ("Copy link" carries it) opens them the same way; "Reset app" clears it with everything else. A "Fold all sections" / "Unfold all sections" button joins the floating stack above "Reset tab" ("Strânge" / "Deschide" on phones), acting on the open page only; its chevron points the way it will fold.
102. Header and corner controls tidied (prototype C, chosen from four variants built on the real app):
    - top right, together: RO | EN, the theme switch and an "Advanced options" button whose menu holds "Copy link" and "Install the app", each with a one-line explanation; the top-left corner is empty now;
    - the theme switch is a slider: a green thumb glides between ◐ ☀ ☾ with a small bounce, can be dragged with the mouse or a finger and settles on the nearest stop, and moves with the arrow keys; the chosen icon spins in;
    - bottom right, the fold and reset buttons hide behind one "Actions" button (later "Tools"), with a green dot while something can be reset; they open upwards one after another;
    - both menus open on hover with a mouse and on click or tap, wait a moment before closing so the mouse can reach them, close on Esc or a click outside, and fade and slide in; their chevrons turn. All animations are off for people who ask their system for reduced motion.
103. The bottom-right button is called "Tools" (RO "Unelte") instead of "Actions", with a wrench icon: it holds fold-all, Reset tab and Reset app.
104. "Tools": its green dot with a halo is always there now, and the halo pulses gently while something can be reset (still for people who ask for reduced motion).
105. The "Tools" button has no hover tooltip any more; it still opens on hover (and on click or tap).
106. The RO | EN switch is a slider like the theme one (one shared component): the green thumb glides with a small bounce, can be dragged and settles on the nearest language, moves with the arrow keys, and the chosen letters pop in. Each language is named in its own language on hover (Română, English).
107. The Convertor | Taxe switch slides too: the green thumb glides and stretches to the open section (the two buttons differ in width, and it measures them again when the language changes), can be dragged and lands on the nearest section, and the section's icon pops in. Keyboard use is unchanged.
108. Fix: folded sections now count as something to reset. "Reset tab" turns on when a section of the open page is folded and unfolds that page's sections (the other page's stay as they are); "Reset app" turns on when any section is folded and unfolds all. The "Tools" dot pulses for folded sections too. A test checks that every foldable section belongs to a tab.
109. The converter's amount lives in the address: the cell you typed into, as ?amount=40&currency=EUR&per=hour (or ?amount=150000&currency=RON&per=year), English names so a link works in both languages; the default amount has none. Opening an address with an amount uses it over the saved one and sets the tax page's income from it, so a link straight to #taxes is right too; a reload doesn't touch an income typed on the tax page. "Reset tab" on the converter and "Reset app" clear it from the address. Fix along the way: "Back to my settings" after opening a shared link no longer lets the link's amount win.
110. The "Or work backwards" note beside the grid has a small × on its title line, which hides the brace and the text (and the one-line hint on narrow screens). It stays hidden; "Reset tab" on the converter brings it back.
111. Colours: "You keep" in the fees card is the app's teal accent instead of lime, since lime marks what can be edited; the platform and bank lists get the lime box, as they can be changed.
112. The BNR rates are a small table with the headings Currency, Rate, Against EUR and Custom rate, instead of "Custom rate" repeated on every row; the custom-rate fields get the lime editable box, and one line under the table says what a custom rate does. On phones the Against EUR column is hidden.

### 1.0.0 (2026-11-02 to 2026-11-03)

113. Design pass (from a study of Wise, XE, Harvest, Stripe, Linear, Vercel Geist, Radix, Material 3, GOV.UK and NN/g): one set of design tokens in the stylesheet: a 4-pt spacing scale, three corner radii, two shadow levels, Material 3 motion durations and easings (menus open a little slower than they close), a short type scale and one numeric style (same-width digits on every figure that updates). Cards are rounder with a soft shadow and a little more room between them; the header gets the app icon and "Toolkit" in the accent colour.
114. Tax board: the card with the most money is teal with a "★ Most money" tag instead of lime, since lime marks what can be edited. Each card adds a thin bar with the share of the gross you keep, and shows the net per year and the effective tax rate as two labelled figures, in the same place on every card so they compare line by line. Cards lift slightly on hover.
115. Converter grid keyboard: arrows move between cells (left and right only at the edge of the text, or when it is all selected), Enter goes down and Shift+Enter up, Esc puts back the value from before the cell was entered.
116. Number fields in Working time and Fees are text fields with a numeric keypad instead of number fields (GOV.UK): no spinners, no accidental scroll-wheel changes, and a comma works as the decimal mark. Up and down still step the value; a value out of range gets the red border and is not used. They line up on the right.
117. Working time shows what the settings come to, as read-only figures: billable hours per week, per month and per year, and working days per year. Its summary now writes numbers the language's way (7,5 h; 2.080 h).
118. Fees: the answer comes first (Wise style): what reaches you per month, what goes on fees per month and the share you keep, as figures above the two steps; the sentence under the tiles is gone.
119. Payment calendar: the next three deadlines as cards with the day in large type, the month and the form to file (D212, D100, D101); the rest grouped under month headings, each row with its form code. The codes left the sentences.
120. VAT: the meter has its label and percentage above, a mark at 80%, its scale (0 to 395,000 RON) below, and an icon beside the reading (✓ under, ! near or over) besides the colour; the "near" bar is amber instead of brown.
121. Sections open and close with a short slide (the body's height is measured, so any content works), and the folding rows inside cards (disadvantages, calculation details, install steps) get the same drawn chevron as the sections. No motion for people who ask for reduced motion.
122. "Reset app" asks first, in a small panel where the Tools menu was: what goes back to the defaults (both pages, folded sections; language and theme stay), with Cancel (focused, so Enter is safe) and Reset. Esc or a click outside closes it. "Reset tab" stays instant.
123. The rates script reads BNR's 10-day file (falling back to the daily one, added to the saved days) and keeps the last 10 banking days in `src/data/rates.json` (about 10 KB), so the app still works offline. Tests check the history: newest first, starting at the rate date, at most 10 days, positive rates.
124. BNR rates as one card per currency (prototype C, chosen from three): the rate in large type; a pill with the change against the previous banking day (Monday against Friday), ▲ green when the leu weakened (more lei for the same invoice), ▼ red when it strengthened; the change in lei and a small chart of the last 10 banking days (its range on hover); the cross rate against the grid's first currency; the custom rate field at the bottom of each card, lined up across cards. The change and the chart stay BNR's while a custom rate is in use; market-rate currencies have neither. One note under the cards explains the colours.
125. The currency button on the tax page shows the symbol in a small pill ("RON [lei]"), like the converter's chips.
126. Tax board: a card left out of "Most money" because the income is over its limit (the income norm above 25,000 EUR a year) now says "Over the limit" where the star would be, with the reason on hover; the legend explains the star counts only regimes this income is allowed in. Before, a norm card with more money than the starred card looked like a bug.
127. The Tools wrench turns like a real one: around the nut in its open jaw, not around the icon's centre. Hovering or opening the menu tightens it (a 35° clockwise turn), closing loosens it back; no turn for people who ask for reduced motion. The reset buttons' ↺ keeps its own turn.
128. The "Over the limit" tag is a filled amber pill with more contrast: white on dark amber in the light theme (5:1), near-black on bright amber in the dark theme.
129. The Tools wrench swings further around the nut (60° instead of 35°), at the same speed.
130. Custom rate fields: an empty field shows BNR's rate in grey; clicking it puts that rate in as text with the caret where you clicked (at the end when reached with Tab), so you can change a digit or two instead of typing it all. Left unchanged, the field goes back to empty and BNR's rate stays in use.
131. A custom rate in use is marked "applied" in a small teal tag under the "Custom rate" label, instead of a "custom" badge squeezed beside it.
132. The Tools button that folds every section is called "Hide the sections" / "Show the sections" (RO "Ascunde secțiunile" / "Arată secțiunile"; "Ascunde" / "Arată" on phones), instead of fold / unfold.
133. The theme switch moved into "Advanced options" (prototype B, chosen from four), first in the menu above "Copy link" and "Install the app": the same sliding switch with its animations (the thumb glides and can be dragged, the icon spins in, arrow keys work), wider, each stop with its name (◐ Automatic, ☀ Light, ☾ Dark). The top-right corner keeps only RO | EN and the menu; the menu stays open while you change the theme.
134. New app icon (chosen from three rounds of prototypes): two coins on the teal background, a lime one behind and a white one with a drawn € in front. It is drawn with shapes, not text, so it looks the same on every device (the old "€⇄" depended on the system font). Used for the favicon, the installed app (192 and 512 px, a full-square maskable version for Android, the 180 px Apple touch icon) and the header mark beside the name, which used to be text.
135. Clearer hints in Advanced options: "Copy link" says "With your settings, so someone else sees the changes you made" (RO "Cu setările tale, ca altcineva să vadă modificările făcute de tine"), and "Install the app" says "Works without internet too" (RO "Funcționează și fără internet").
136. Rate cards: the currency symbol in a small pill beside the code, as on the chips and the tax page's currency button; the change in lei on one line and what it is measured against on the next, with the weekday ("vs Fri, 30 Oct"), so a Monday rate compared with Friday's reads as the previous banking day. A custom rate typed back to BNR's own rate is no longer kept as custom: the "applied" tag goes and the field shows BNR's rate in grey again. A little more room between "Custom rate" and "applied".
137. Rate cards: under "Custom rate", every card says which rate is in use: "BNR rate in use" in small grey text, or the teal "applied" tag. The two lines form one block centred beside the field, the same on every card, so nothing moves when you set or clear a custom rate.
138. Fees: the last choice in the platform and bank lists reads like the others, "Custom · x%" (RO "Personalizat · x%"), instead of "Custom (type the %)" on two lines; once chosen, it shows the % you typed ("Custom · 7%").
139. The notes at the end of Working time and Fees are one tidy box: one idea per row, each with a short bold lead (Billable hours, Days off, Default; The percentages, On the Taxes page, Default) in its own column, instead of grey paragraphs run together.
140. The tax page's amounts live in the address too, like the converter's: the gross income (?income=12000&income_currency=EUR&income_per=month), the take-home wanted (?net=…&net_currency=…&net_per=…), "Income on top of a job" (?salary=…&side=…) and the amounts typed on the cards (?expenses_pfa=, norm=, expenses_micro=, expenses_profit_salary=, expenses_profit=; only the changed ones). Only changed values are written; an address value wins over the saved one, a broken one is dropped. "Reset tab" on Taxes clears them. Tested (9 new tests).
141. Amounts have a limit: 999,999,999.99, far above any freelancer's income. A field won't take a tenth digit before the decimal mark (it can still be shortened), the converter's cells and custom rates refuse a larger number, and saved or linked amounts above it are ignored (the default is used). Trying it shows a toast in the bottom-left corner: "Looks like I'm not the only one testing the app! 😂" (RO "Se pare că nu sunt singurul care testează aplicația! 😂"), with the limit under it; it closes by itself or with ×. Long figures also wrap inside their cards instead of running out of them.
142. Fix: "Reset tab" on the converter also resets the tax page's income when that income was only following the converter, so the two pages agree again (30 EUR/hour and its 27,769.56 RON a month). An income typed on the tax page is kept.
143. The amount toast: the message stays on one line (it may wrap on a phone), and the line under it reads "The app accepts numbers up to 999,999,999.99" (RO "Aplicația acceptă numere până la 999.999.999,99").
144. The amount toast stands out more: inverse colours (whitish with dark text on the dark theme, near-black with light text on the light one), a lime edge, a deeper shadow, and it comes in from below with a small bounce (no motion for people who ask for less).
145. The tax page's gross income and the converter now follow each other both ways: an income typed on the tax page (amount, currency and period) becomes the converter's amount, in the converter and in the address, so both pages show the same money; back on the default income, the converter is back on 30 EUR/hour. Fix along the way: "Taxes for this income" rounds the income to the ban (not to the leu), like the income that follows the converter. "Reset tab" on the tax page resets the converter's amount too when it only came from the tax page's income.
146. The shared-link banner has real buttons instead of underlined links: "↺ Back to my settings" as the main, filled one and "Close" outlined beside it, plus a link icon on the left; the banner is framed like the other notices.
147. The language switch moved into "Advanced options" too, right under the theme: the same sliding switch with its animations, now with the full names (Română | English), under the label "Language" (RO "Limbă"). The top-right corner keeps only the menu button.
148. The converter's button to the tax page reads "See the taxes for this income (… RON/month) →" (RO "Află taxele pentru acest venit (… RON/lună) →").
149. The top-right menu is called "Settings & options" (RO "Setări și opțiuni") instead of "Advanced options".
150. Shared links, clearer: opening a link with exactly your own settings (your link, in the same browser) now says "they are the same as yours, nothing changed" with only Close, instead of offering to go back to identical settings. When a link did replace yours, the second button says what it does, "Keep the link's" (RO "Păstrează-le pe cele din link"), and "Back to my settings" is followed, after the reload, by a toast: "Your own settings are back." The toast is now one component for all messages, and can carry one over a reload (session only).
151. Every setting is in the address now, not only the amounts and the folded sections: language (?lang=en), theme (?theme=dark), the currencies shown and added (?currencies=EUR,RON,PLN&added=PLN), custom rates (?rates=USD:4.8), working time (?hours=6&days=4&days_off=20&holidays=1&billable=70), fees (?platform=fiverr&transfer=wise&transfer_pct=0.5), the closed "Or work backwards" note (?goal_note=0), every tick and pick on the tax cards (?dependants=2&under26=1&pfa_pensioner=1&micro_pay=mandate, and the rest) and the reference card (?ref=pfaReal). Only changed values are written; an address value wins over the saved one, a broken or out-of-range one is not used. The theme is read from the address before the page paints, so it never flashes. "Reset tab" clears its page's parameters; language and theme stay until "Reset app".
152. "Copy link" is now the address itself, marked ?share=1 and without your language and theme (they stay the viewer's own); links made the old way (settings as JSON) still open. Opening one still sets your own settings aside, with "Back to my settings".
153. Tests: every saved setting must have address parameters, every page's reset must clear exactly its parameters, no name may be used twice, every setting must read back the same from the address and its default write nothing, and broken values must be refused (22 new tests). They caught a real bug: an income read from the address had its fields in another order than the default, so the default income looked changed (the Tools dot lit up).
154. "Settings & options" has a gear icon, which turns a little when the menu opens.

### Unreleased

155. Visit counts with GoatCounter (free, open source, no cookies, so no consent banner), in `src/lib/analytics.ts`, sent to romulusmirauta.goatcounter.com: a view of each page (/ and /taxes) and three events (copy-link, install-app, add-currency/<code>), never the address's settings or amounts, and nothing in development or on localhost. Offline visits aren't counted. The README's Privacy section says so. Tested.
156. The × that hides the one-line "Or work backwards" hint (shown when the brace doesn't fit beside the grid) follows the text instead of sitting at the card's far right edge, so it reads as part of the hint.
157. "+ Add currency" sits right after the last currency chip, inside the same row, and wraps onto the next row only together with that chip (prototype C, chosen from six). Before, it was outside the chips: as soon as they took two rows, it dropped alone onto a third, even with room beside the last chip.
158. Fix: GoatCounter's own script (count.js) sent the whole address with every count (`q=?amount=42&platform=fiverr…`), so amounts and settings reached GoatCounter, against the Privacy note. Found by checking the live site's requests. The app now sends the count itself, without the script: the page, its title, the screen width and the referring site's origin (never its path or query), and nothing from automated browsers. Tested: the counting address has only those fields.
159. The README shows the visit counts under the app's link, as a row of badges in the app's colours (prototype A, chosen from five): "Views per week | per month | per year | total", read live from GoatCounter's public counter by shields.io. GoatCounter has no "today" for a static page, so there is no per-day badge.
160. Install dialog: four screenshots in the manifest (dark theme, the top of each page): the converter and the tax page at 1280×800 for desktop (`form_factor: wide`) and at 824×1784 for phones (`narrow`), each with a label. They are in `public/screenshots/` and stay out of the offline cache, since they're only for installing. Chrome no longer warns that the richer install dialog is unavailable.
161. Every form field has a `name` (grid cells by period and currency, custom rates by currency, the working-time fields by setting, fees by step, the searches, the card options and the copied link). Chrome's DevTools listed 50 "A form field element should have an id or name attribute" issues; now none. The manifest has no errors and the app is installable; the "icon.svg failed to load" seen in DevTools could not be reproduced on the live site, where the icon loads at 512×512 with the right type.
162. Hover effects on the floating Tools button and the settings gear run only on devices with a mouse (`@media (hover: hover)`). On touch screens `:hover` stays on after a tap, so closing the menu left the wrench turned until the next tap elsewhere.
163. Phone rules moved to `src/mobile.css`, loaded after `styles.css`. Screenshots at 360, 390, 520, 600, 700 and 1280 px, both tabs, were pixel-identical before and after the move. Two rules written after the phone blocks had been overriding them (the page's top and bottom padding, and the smaller Tools button), so only what actually applied was kept.
164. Phone layout from prototype 08 (picks 1A, 2C, 3A, 4A): the gear-only settings button on the title's row with the tabs centred; `DEFAULT_COLUMNS` is EUR and RON when the screen is 600 px or narrower at load; a third brace mode, `slim` (44 px: the brace and a sideways label), between the full note and the line under the grid, with grid cells 5.9rem wide on phones so it fits at 390 px; "start here" drawn as an arrow (the words stay for screen readers); symbol pills in the grid's header on every screen. Also fixed the field names from step 161: the grid cells, custom rates and fees had lost their period, currency and step in the name (`-`, `rate-`, `fee-`).
165. `.gitignore` ignored every folder named `screenshots`, so the manifest's screenshots in `public/screenshots/` had not been committed (the install dialog would have asked for missing files). Now only the local record in the top-level `/screenshots/` is ignored.
166. The employee card's half-year note (`employeeHalves`) appears only when July's minimum wage changes the net, i.e. for salaries near the minimum where the non-taxable amount or the personal deduction apply. At 27,776 RON/month both halves were 16,249.32 and the note said so twice. Test added.
167. Tools button from prototype 09 (pick C): on phones the trigger is a 48 px transparent touch area with only the dot, 16 px with a 4 px ring and a wider pulse (`dot-halo-big`); the wrench and the word are hidden (the button keeps its `aria-label`). The chevron is gone on every screen.
168. `user-select: none` (and `-webkit-touch-callout: none`) on every control: buttons, `summary`, list options, radio switches, menu items and checkbox labels. Only the Converter | Taxes switch and the sliders had it, so on phones a tap that moved, e.g. on "+ Add currency", selected the label. Inputs are set back to `text` explicitly, since iOS won't type into a field whose parent is unselectable. Page text and figures stay selectable for copying.

[Unreleased]: https://github.com/RomulusMirauta/FreelancingToolkit/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/RomulusMirauta/FreelancingToolkit/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/RomulusMirauta/FreelancingToolkit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/RomulusMirauta/FreelancingToolkit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/RomulusMirauta/FreelancingToolkit/releases/tag/v0.1.0
