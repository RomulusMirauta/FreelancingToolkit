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
- Working-time settings (hours per day, days per week, days off, holidays, billable share), open by default.
- Every section of both pages folds (chevron and a one-line summary), each in its own card; folded sections stay in the address, and a floating button folds or unfolds them all.
- Working-time quick picks: Full-time (8 h × 5 days), Part-time (4 h × 5 days), 4-day week (8 h × 4 days) and Weekends only (8 h × 2 days). They keep the days off, holidays and billable share, and the one matching the current values is highlighted. The defaults are shown as plain text instead of a reset link.
- Working time in days: days off per year (leave, sick days), an option to take off the Romanian public holidays (worked out for the current year, Orthodox Easter included: 11 working days in 2026) and the share of billable hours (%). The hourly rate stays, the day, month and year amounts follow.
- "Fees and currency exchange", its own collapsible card under Working time (its header sums it up: "You keep 89.55% · Upwork 10% · Wise 0.5%"). Two numbered steps, each a list with an editable % and a one-line explanation of the choice: 1 · Platform (Upwork, Fiverr, Freelancer.com, Malt, Guru, Toptal, Braintrust, Arc.dev, Contra, Freelancermap, or custom), 2 · Exchange and transfer (Wise, Revolut, Payoneer, bank, or custom). Then the path of one hour's pay: You invoice → Platform → Exchange → You keep, and the same per month in RON. By default it shows the common case, Upwork (10%) and a Romanian bank exchange (2%): you keep 88.2%.
- The tax page's gross income follows the converter: changing the rate, the working time or a custom rate updates it.
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
- "VAT: what to watch": the 21% rate, the 395,000 RON exemption threshold against the page's income (a meter that turns amber near it and red over it), and what changes for clients in Romania, in the EU and outside it.
- "Payment calendar": the deadlines of the next 12 months (tax return, quarterly micro/profit tax, D101, annual accounts, the 3% discount), moved off weekends and holidays, the next one outlined, filterable by PFA or SRL, plus the monthly ones on the 25th.
- Every 2026 parameter comes from `data/params-2026.json`, with its legal basis and source. The engine is tested against an independent Python implementation (`data/golden-2026.json`).

**App**
- Light/dark theme switch (automatic by default) in the top-right corner.
- Romanian by default, with English one click away (RO | EN, top-left corner). Numbers follow the language (1.234,56 / 1,234.56), and amounts can be typed either way.
- Settings stay on the device. Floating "Reset tab" and "Reset app" buttons restore the defaults of the open page or of everything; each is disabled while it has nothing to reset.
- "Copy link" (Advanced options, top right): a link with the page settings as query parameters (language and theme stay the viewer's). Opening it replaces the settings for that visit, with "Back to my settings"; the query string is removed at once, so reloads and resets never apply it again.
- "Install the app" (Advanced options, top right): Chrome and Edge's install dialog, or plain step-by-step instructions for computer, Android and iPhone, this device first. Hidden once installed.
- Installable and works offline (PWA). The deploy workflow for GitHub Pages runs on every push and on banking days after BNR publishes.

### To confirm
- The PFA sick-leave contribution (1%, base 1–3 minimum wages) comes from 2026 tax guides, not from the consolidated text of OUG 158/2005.
- Whether CAM (2.25%) is due on mandate contracts: sources disagree, and the app includes it.
- The VAT rate and threshold come from 2026 tax guides; whether services for clients abroad count towards the threshold is open.
- Whether the 3% tax-return discount is given again in 2027 (it was in 2026, by OUG 8/2026).
- Platform and exchange fees are typical 2026 values from secondary sources (Upwork's varies per contract).

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
83. Published on GitHub Pages: <https://romulusmirauta.github.io/FreelancingToolkit/>.
84. Installing as an app: PNG icons (192 and 512 px, a maskable one for Android, and an Apple touch icon, since iOS ignores SVG icons on the home screen) next to the SVG one, all available offline. Link previews (Open Graph) for sharing the app's link.
85. README: the app's link, what a PWA is and how to install it on desktop, Android and iPhone, privacy, data sources and update times, deploying your own copy, and how to regenerate the tax golden file. `package.json` has the description, homepage and repository.
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

