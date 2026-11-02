# FreelancingToolkit

**Open the app: <https://romulusmirauta.github.io/FreelancingToolkit/>**

A small installable web app (a PWA, Progressive Web App) for freelancers paid in one currency and taxed in Romania.

- **Rate converter**: type an amount in any cell (for example 30 EUR per hour) and see it per hour, day, week, month, 3/6/9 months and year, in as many currencies as you like. It uses the National Bank of Romania (BNR) reference rates, refreshed every banking day. Currencies BNR does not publish (about 160 in all) use market rates from [ExchangeRate-API](https://www.exchangerate-api.com), marked as such. You can override any rate.
- **Romanian taxes 2026**: compare take-home pay as an employee, PFA (real system or income norm), SRL (micro-enterprise or profit tax, with dividends) and copyright income, side by side. It also covers income on top of a job (CIM + PFA, CIM + copyright) and solves the reverse: what you need to earn to take home a given amount. Every line links to the law it comes from.

The app is in Romanian by default, with an English version one click away (RO | EN, top left). Numbers follow the language: 1.234,56 in Romanian, 1,234.56 in English. A light, dark or automatic theme is in the top right.

> Estimates only, not tax advice. Check with an accountant before deciding.

## Install it and use it offline

As a PWA, the app can be installed like a regular app and keeps working without internet once opened:

- **Desktop (Chrome, Edge)**: open the link above and click the install icon in the address bar.
- **Android (Chrome)**: menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone, iPad (Safari)**: Share → *Add to Home Screen*.

It updates itself when a new version is published. Offline, it uses the exchange rates it last downloaded.

## Privacy

Everything runs in your browser: no account, no cookies, no analytics, nothing is sent anywhere. Your settings are saved only on your device (browser storage). "Reset tab" and "Reset app" (bottom right) clear them.

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
