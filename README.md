# FreelancingToolkit

**Open the app: <https://romulusmirauta.github.io/FreelancingToolkit/>**

A small installable web app (a PWA, Progressive Web App) for freelancers paid in one currency and taxed in Romania.

- **Rate converter**: type an amount in any cell (for example 30 EUR per hour) and see it per hour, day, week, month, 3/6/9 months and year, in as many currencies as you like. It uses the National Bank of Romania (BNR) reference rates, refreshed every banking day. Currencies BNR does not publish (about 160 in all) use market rates from [ExchangeRate-API](https://www.exchangerate-api.com), marked as such. You can override any rate. Working time counts days off, public holidays and the share of billable hours, and a fees panel shows what you keep after a platform (Upwork, Fiverr, …) and the currency exchange.
- **Romanian taxes 2026**: compare take-home pay as an employee, PFA (real system or income norm), SRL (micro-enterprise or profit tax, with dividends) and copyright income, side by side. It also covers income on top of a job (CIM + PFA, CIM + copyright) and solves the reverse: what you need to earn to take home a given amount. Every line links to the law it comes from. It also shows where you stand against the VAT threshold and a calendar of the next tax deadlines.

The app is in Romanian by default, with an English version one click away (RO | EN, top right). Numbers follow the language: 1.234,56 in Romanian, 1,234.56 in English. A light, dark or automatic theme is in the top right, next to the language and **Advanced options**.

> Estimates only, not tax advice. Check with an accountant before deciding.

## Install it and use it offline

As a PWA, the app can be installed like a regular app and keeps working without internet once opened. It is free, takes about a minute, and **Advanced options → Install the app** (top right) shows the same steps:

- **Computer (Chrome or Edge)**
  1. Open the link above.
  2. In the address bar, on the right, click the install icon (a small screen with a down arrow), then **Install**.
  3. The app opens in its own window and is in the Start menu and on the desktop.
  No icon? Menu ⋮ → *Cast, save and share* → *Install page as app*. Firefox can't install apps: use Chrome or Edge.
- **Android (Chrome)**
  1. Open the link in Chrome and tap the three dots ⋮ at the top right.
  2. Tap *Install app* (or *Add to Home screen*), then *Install*.
- **iPhone or iPad (Safari)**
  1. Open the link in Safari.
  2. Tap Share (the square with an arrow pointing up), then *Add to Home Screen* → *Add*.

It updates itself when a new version is published. Offline, it uses the exchange rates it last downloaded.

## Privacy

Everything runs in your browser: no account, no cookies, no analytics, nothing is sent anywhere. Your settings are saved only on your device (browser storage). "Reset tab" and "Reset app" (under **Tools**, bottom right) clear them. "Copy link" puts your page settings (not language or theme) in the link itself, so they go wherever you send it. The address also keeps the converter amount you typed and the sections you folded (`?amount=40&currency=EUR&per=hour&fold=fees`), so a bookmark opens the app the same way.

## Data sources

| What | Source | Updated |
| --- | --- | --- |
| Exchange rates | [BNR reference rates](https://curs.bnr.ro/nbrfxrates.xml) | every banking day, after BNR publishes (about 13:00 Romanian time) |
| Other currencies | [Rates by Exchange Rate API](https://www.exchangerate-api.com) (market rates, not BNR) | with the BNR rates |
| 2026 tax rules | `data/params-2026.json`: each value with its legal basis, source link and date checked | by hand, per tax year |

Rates are downloaded when the app is built, not by your browser, so the app always opens with a known set of rates and shows their date.

## Development

Requires Node 24+ (the deploy workflow uses Node 26).

```sh
npm install
npm run dev        # local dev server on http://localhost:5173
npm test           # unit tests, including the tax golden cases and data checks
npm run build      # type-check and build to dist/
npm run preview    # serve the built app on http://localhost:4173
npm run rates      # refresh src/data/rates.json (curs.bnr.ro) and src/data/market-rates.json (open.er-api.com)
npm run symbols    # rewrite src/data/currency-symbols.json
```

## How it fits together

| Path | What it is |
| --- | --- |
| `data/params-2026.json` | Every 2026 tax parameter with its legal basis, source link and date checked. This is the single source of truth. |
| `data/golden-2026.json` | Expected results from an independent Python implementation (`scripts/tax2026_reference.py`). The TypeScript engine is tested against it. |
| `src/lib/tax/` | The tax engine: pure functions, calculated annually. |
| `src/lib/i18n/` | Every user-visible text in Romanian and English. A key missing from either language is a type error. |
| `src/lib/currency/`, `src/lib/time/` | Currency conversion, currency names and symbols, working-time periods. |
| `src/data/` | Rate snapshots and the currency-symbol table, committed so every build is reproducible. |
| `scripts/fetch-bnr-rates.mjs` | Downloads the BNR feed. The feed has no CORS header, so rates are bundled at build time. If the download fails, the committed snapshot is kept. |
| `scripts/fetch-market-rates.mjs` | Downloads market rates and currency names (EN/RO) for the currencies BNR does not publish. BNR always wins where it has a rate. Same fallback as above. |
| `scripts/gen-currency-symbols.mjs` | Writes the fixed currency-symbol table, so every browser shows the same symbols; rerun it when the currency list grows. |
| `.github/workflows/deploy.yml` | Runs on every push to `main` and on banking days after BNR publishes: refresh rates → test → build → commit the new rates → GitHub Pages. If tests or build fail, nothing is committed or deployed and the site keeps its last good version. |

## Deploying your own copy

1. Fork the repository.
2. In the fork: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the *Deploy* workflow by hand from the Actions tab).

The app is built with relative paths, so it works under any repository name.

## Updating for a new tax year

1. Add `data/params-<year>.json` with the verified values and their sources.
2. Update `scripts/tax2026_reference.py` for any rule changes and regenerate the golden file: `python scripts/tax2026_reference.py`.
3. Make the tests pass against the new golden file.

## Changes

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
