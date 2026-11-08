# FreelancingToolkit

### <br>Open the app: <https://romulusmirauta.github.io/FreelancingToolkit/>

<p><br><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fromulusmirauta.goatcounter.com%2Fcounter%2FTOTAL.json%3Fstart%3Dweek&amp;query=%24.count&amp;label=Views%20per%20week&amp;color=1f6f5c&amp;labelColor=232826&amp;cacheSeconds=600" alt="Views per week" width="174"> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fromulusmirauta.goatcounter.com%2Fcounter%2FTOTAL.json%3Fstart%3Dmonth&amp;query=%24.count&amp;label=per%20month&amp;color=1f6f5c&amp;labelColor=232826&amp;cacheSeconds=600" alt="per month" width="130"> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fromulusmirauta.goatcounter.com%2Fcounter%2FTOTAL.json%3Fstart%3Dyear&amp;query=%24.count&amp;label=per%20year&amp;color=1f6f5c&amp;labelColor=232826&amp;cacheSeconds=600" alt="per year" width="116"> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fromulusmirauta.goatcounter.com%2Fcounter%2FTOTAL.json&amp;query=%24.count&amp;label=total&amp;color=1f6f5c&amp;labelColor=232826&amp;cacheSeconds=600" alt="total" width="84"><br><br></p>

A small installable web app (a PWA, Progressive Web App) for freelancers paid in one currency and taxed in Romania.

- **Rate converter**: type an amount in any cell (for example 30 EUR per hour) and see it per hour, day, week, month, 3/6/9 months and year, in as many currencies as you like. It uses the National Bank of Romania (BNR) reference rates, refreshed every banking day. Currencies BNR does not publish (about 160 in all) use market rates from [ExchangeRate-API](https://www.exchangerate-api.com), marked as such. You can override any rate. Working time counts days off, public holidays and the share of billable hours, and a fees panel shows what you keep after a platform (Upwork, Fiverr, …) and the currency exchange.
- **Romanian taxes 2026**: compare take-home pay as an employee, PFA (real system or income norm), SRL (micro-enterprise or profit tax, with dividends) and copyright income, side by side. It also covers income on top of a job (CIM + PFA, CIM + copyright) and solves the reverse: what you need to earn to take home a given amount. Every line links to the law it comes from. It also shows where you stand against the VAT threshold and a calendar of the next tax deadlines.

The app is in Romanian by default, with an English version in **Settings & options** (top right). Numbers follow the language: 1.234,56 in Romanian, 1,234.56 in English. The same menu has the light, dark or automatic theme.

> Estimates only, not tax advice. Check with an accountant before deciding.

## Install it and use it offline

As a PWA, the app can be installed like a regular app and keeps working without internet once opened. It is free, takes about a minute, and **Settings & options → Install the app** (top right) shows the same steps:

- **Computer (Chrome or Edge)**
  1. Open the link above.
  2. In the address bar, on the right, click the install icon (a small screen with a down arrow), then **Install**.
  3. The app opens in its own window and is in the Start menu and on the desktop.
  No icon? Chrome: menu ⋮ → *Cast, save and share* → *Install page as app*. Edge: menu … → *More tools* → *Apps* → *Install this site as an app*. Firefox on Windows (version 143 or later): the *Add tab to taskbar* button at the right of the address bar. On Mac or Linux, Firefox can't install apps: use Chrome or Edge.
- **Android (Chrome)**
  1. Open the link in Chrome and tap the three dots ⋮ at the top right.
  2. Tap *Install app* (or *Add to Home screen*), then *Install*.
- **iPhone or iPad (Safari)**
  1. Open the link in Safari.
  2. Tap Share (the square with an arrow pointing up: on iPhone at the bottom of the screen, on iPad at the top, otherwise in the ⋯ menu), then *Add to Home Screen* → *Add*.

It updates itself when a new version is published. Offline, it uses the exchange rates it last downloaded.

## Privacy

Everything runs in your browser: no account, no cookies. Your settings are saved on your device (browser storage) and in the page address, which holds every setting you change, amounts included (`?income=12000&income_currency=EUR&income_per=month&fold=fees`), so a reload or a bookmark opens the app the same way. Like any address, it stays in your browser history, and in a synced history on your other devices. "Reset tab" and "Reset app" (under **Tools**, bottom right) clear your settings from the device and from the address, not from the history. "Copy link" copies the address without your language and theme, so your settings go wherever you send it.

Two services see your visits:

- **GitHub Pages** hosts the app and logs visitors' IP addresses ([GitHub's note](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)). It receives the page address, settings included, whenever the app loads from the internet: on a first visit, or when a link is opened in another browser. Once opened, the app loads from your device.
- **[GoatCounter](https://www.goatcounter.com)** (open source, no cookies) counts the visits to the live site. The app sends which page was opened (Converter or Taxes), three actions (link copied, app installed, currency added, with its code), the screen width and the site you came from (its name only), never your settings or amounts. Like any web request, a count also carries your IP address, browser and language. From them GoatCounter keeps totals of browsers, operating systems, locations and languages; it doesn't store IP addresses, and keeps them in memory for up to 8 hours only, to recognise repeat visits ([its privacy policy](https://www.goatcounter.com/help/privacy)).

## Data sources

| What | Source | Updated |
| --- | --- | --- |
| Exchange rates | [BNR reference rates](https://curs.bnr.ro/nbrfxrates.xml) | every banking day, after BNR publishes (about 13:00 Romanian time) |
| Other currencies | [Rates By Exchange Rate API](https://www.exchangerate-api.com) (market rates, not BNR) | with the BNR rates |
| 2026 tax rules | `data/params-2026.json`: each value with its legal basis, source link and date checked | by hand, per tax year |

Rates are downloaded when the app is built, not by your browser, so the app always opens with a known set of rates and shows their date.

## Development

Requires Node 24.2+ (the deploy workflow uses Node 26).

```sh
npm install
npm run dev        # local dev server on http://localhost:5173
npm test           # unit tests, including the tax golden cases and data checks
npm run build      # type-check and build to dist/
npm run preview    # serve the built app on http://localhost:4173
npm run rates      # refresh src/data/rates.json (curs.bnr.ro) and src/data/market-rates.json (open.er-api.com)
npm run symbols    # rewrite src/data/currency-symbols.json
npm run lint       # Oxlint for the code, Stylelint for the CSS (also runs when code is deployed, not on the daily rates update)
npm run test:visual         # on demand: compare both tabs on phones, a tablet and desktops with reference screenshots
npm run test:visual:update  # save new reference screenshots, after checking that a change looks right
npm run test:browsers       # on demand: the exact layout checks in WebKit (close to Safari) and Firefox
npm run release:check       # before a release: lint, unit tests, build and the visual tests
```

The visual tests (Playwright, with the installed Chrome) build the app with fixed rates (`tests/visual/fixtures`) and a fixed date, then compare whole pages pixel by pixel. `tests/visual/layout.pw.ts` also measures specific layout decisions, so a failure there says what moved, and `tests/visual/contrast.pw.ts` checks text contrast in both themes, including rare states it forces. A failure leaves the expected, actual and diff images in `tests/visual/results` and an HTML report you can open directly, with no server: `tests/visual/report/index.html`. The reference screenshots stay on the machine that made them, since another system renders text differently: on a new machine, run `test:visual:update` first. When the BNR or market rates gain a currency, copy `src/data/*rates.json` into the fixtures and update the screenshots. `test:browsers` needs the engines once: `npx playwright install webkit firefox`; it has no reference screenshots, since each engine draws text its own way.

## How it fits together

| Path | What it is |
| --- | --- |
| `data/params-2026.json` | Every 2026 tax parameter with its legal basis, source link and date checked. This is the single source of truth. |
| `data/golden-2026.json` | Expected results from an independent Python implementation (`scripts/tax2026_reference.py`). The TypeScript engine is tested against it. |
| `src/lib/tax/` | The tax engine: pure functions, calculated annually. |
| `src/lib/i18n/` | Every user-visible text in Romanian and English. A key missing from either language is a type error. |
| `src/lib/currency/`, `src/lib/time/` | Currency conversion, currency names and symbols, working-time periods. |
| `src/data/` | Rate snapshots and the currency-symbol table, committed so every build is reproducible. |
| `scripts/fetch-bnr-rates.mjs` | Downloads the BNR feed. The feed has no CORS header, so rates are bundled at build time. Only a later fixing replaces the committed snapshot, and only if it passes the checks below; otherwise, or if the download fails, the snapshot is kept and the deploy run says why. |
| `scripts/fetch-market-rates.mjs` | Downloads market rates and currency names (EN/RO) for the currencies BNR does not publish. BNR always wins where it has a rate. Same rules as above. |
| `scripts/rates-snapshot.mjs` | What the two share. New rates must stay within 3 times of the other source's, and within 5 times of the saved ones and of the previous banking day's, so a lost multiplier or a glitch at the provider never reaches the app. A real jump past those factors that keeps the currency's code, such as a redenomination, is held back too. In a currency only the market rates have, delete `src/data/market-rates.json` and run `npm run rates` to take it. In one BNR publishes, both files stay held back until the jump has left BNR's 10-day file, from its tenth fixing at the new rate: then delete both and run `npm run rates`. A saved file that can't be read, after a merge conflict say, is replaced; each file is written in one step. The data tests run the same checks on the committed files. |
| `scripts/check-rates-age.mjs` | Runs after each deploy. The rate scripts keep the saved file without failing, so this is what reports a source that moved or stopped answering: it fails the run, and GitHub emails you, when the BNR rates are more than 5 days old (two holidays next to a weekend keep a fixing that long) or the market rates more than 3. |
| `scripts/gen-currency-symbols.mjs` | Writes the fixed currency-symbol table, so every browser shows the same symbols; rerun it when the currency list grows. |
| `.github/workflows/checks.yml` | Runs on every pull request to `main`: lint → test → build. |
| `.github/workflows/deploy.yml` | Runs on every push to `main` and on banking days after BNR publishes: refresh rates → test → build → commit the new rates → GitHub Pages → check the rates' age. If tests or build fail, nothing is committed or deployed and the site keeps its last good version. Each job gets only the access it needs: only the deploy job can publish the site, and the token that pushes the new rates is kept out of `.git/config` and out of the environment of npm, the tests and the build. It still belongs to their job, so a package that read the runner's memory could use it. |

## Deploying your own copy

1. Fork the repository.
2. In the fork: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the *Deploy* workflow by hand from the Actions tab).

The app is built with relative paths, so it works under any repository name. Visits are counted only on the original site, so a copy counts none: to count yours, set `GOATCOUNTER` and `LIVE_HOST` in `src/lib/analytics.ts` to your GoatCounter code and your site's host (`you.github.io`). Link previews (`og:url` and `og:image` in `index.html`) and the "What's new" link (`RELEASES` in `src/lib/ui/toast.tsx`) point to the original until you change them.

## Updating for a new tax year

1. Add `data/params-<year>.json` with the verified values and their sources, and point `src/lib/tax/params.ts` to it. Rename the keys named after a year (`CursEURMediu2025`, the previous year's average euro rate) there, in the JSON and in `src/lib/tax/regimes.ts`.
2. Copy `scripts/tax2026_reference.py` to `scripts/tax<year>_reference.py`, point it to the new parameters and golden file (`load_params` and the file it writes), update it for any rule changes, then run it to write `data/golden-<year>.json`: `python scripts/tax<year>_reference.py`.
3. Point `src/lib/tax/golden.test.ts`, `regimes.test.ts` and `solve.test.ts` to the new golden file, and change the engine in `src/lib/tax/` for the same rule changes, until `npm test` passes.
4. Update what names the year: the texts in `src/lib/i18n/strings.ts` (both languages; search for the old year and the one before it), the descriptions in `index.html` and `package.json`, the manifest's description and screenshot labels in `vite.config.ts`, the install dialog's screenshots in `public/screenshots/`, and this README.
5. Run `npm run test:visual`: change the checks in `tests/visual/layout.pw.ts` that use the old figures, and once the changed pages look right, run `npm run test:visual:update`.

## Changes

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
