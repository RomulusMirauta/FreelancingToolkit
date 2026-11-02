# FreelancingToolkit

A small installable web app (PWA) for freelancers paid in one currency and taxed in Romania.

- **Rate converter**: type an amount in any cell (for example 30 EUR per hour) and see it per hour, day, week, month, 3/6/9 months and year, in as many currencies as you like. It uses the National Bank of Romania (BNR) reference rates, refreshed every banking day. Currencies BNR does not publish (about 160 in all) use market rates from [ExchangeRate-API](https://www.exchangerate-api.com), marked as such. You can override any rate.
- **Romanian taxes 2026**: compare take-home pay as an employee, PFA (real system or income norm), SRL (micro-enterprise or profit tax, with dividends) and copyright income. It can also solve the reverse: what you need to earn to take home a given amount each month. Every line links to the law it comes from.

The app is in Romanian by default, with an English version one click away (RO | EN, top right). Numbers follow the language: 1.234,56 in Romanian, 1,234.56 in English.

Everything runs in the browser and works offline. Your settings stay on your device.

> Estimates only, not tax advice. Check with an accountant before deciding.

## Development

Requires Node 24+.

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests, including the tax golden cases
npm run build      # type-check and build to dist/
npm run rates      # refresh src/data/rates.json (curs.bnr.ro) and src/data/market-rates.json (open.er-api.com)
```

## How it fits together

| Path | What it is |
| --- | --- |
| `data/params-2026.json` | Every 2026 tax parameter with its legal basis, source link and date checked. This is the single source of truth. |
| `data/golden-2026.json` | Expected results from an independent Python implementation (`scripts/tax2026_reference.py`). The TypeScript engine is tested against it. |
| `src/lib/tax/` | The tax engine: pure functions, calculated annually. |
| `src/lib/i18n/` | Every user-visible text in Romanian and English. A key missing from either language is a type error. |
| `src/lib/currency/`, `src/lib/time/` | Currency conversion and working-time periods. |
| `scripts/fetch-bnr-rates.mjs` | Downloads the BNR feed. The feed has no CORS header, so rates are bundled at build time. If the download fails, the committed snapshot is kept. |
| `scripts/fetch-market-rates.mjs` | Downloads market rates and currency names (EN/RO) for the currencies BNR does not publish. BNR always wins where it has a rate. Same fallback as above. |
| `scripts/gen-currency-symbols.mjs` | Writes the fixed currency-symbol table (`npm run symbols`); rerun it when the currency list grows. |
| `.github/workflows/deploy.yml` | Runs on push and on banking days after BNR publishes: refresh rates → test → build → GitHub Pages. |

## Updating for a new tax year

1. Add `data/params-<year>.json` with the verified values and their sources.
2. Update `scripts/tax2026_reference.py` for any rule changes and regenerate the golden file.
3. Make the tests pass against the new golden file.

## License

[MIT](LICENSE)
