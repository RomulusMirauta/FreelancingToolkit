import market from '../../data/market-rates.json';
import symbolTable from '../../data/currency-symbols.json';
import { isMarketRate } from './rates';

export interface CurrencyInfo {
  code: string;
  /** English name. */
  name: string;
  /** Romanian name. */
  ro: string;
  /** Rate from the market source, not BNR. */
  market?: boolean;
}

// Every currency in the BNR feed, plus RON. XAU (gold, per gram) and XDR (IMF SDR)
// are in the feed but are not currencies people get paid in, so they are hidden.
const BNR_CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro', ro: 'Euro' },
  { code: 'RON', name: 'Romanian leu', ro: 'Leu românesc' },
  { code: 'USD', name: 'US dollar', ro: 'Dolar american' },
  { code: 'GBP', name: 'Pound sterling', ro: 'Liră sterlină' },
  { code: 'CHF', name: 'Swiss franc', ro: 'Franc elvețian' },
  { code: 'AED', name: 'UAE dirham', ro: 'Dirham (Emiratele Arabe Unite)' },
  { code: 'AUD', name: 'Australian dollar', ro: 'Dolar australian' },
  { code: 'BRL', name: 'Brazilian real', ro: 'Real brazilian' },
  { code: 'CAD', name: 'Canadian dollar', ro: 'Dolar canadian' },
  { code: 'CNY', name: 'Chinese yuan', ro: 'Yuan chinezesc' },
  { code: 'CZK', name: 'Czech koruna', ro: 'Coroană cehă' },
  { code: 'DKK', name: 'Danish krone', ro: 'Coroană daneză' },
  { code: 'EGP', name: 'Egyptian pound', ro: 'Liră egipteană' },
  { code: 'HKD', name: 'Hong Kong dollar', ro: 'Dolar Hong Kong' },
  { code: 'HUF', name: 'Hungarian forint', ro: 'Forint maghiar' },
  { code: 'IDR', name: 'Indonesian rupiah', ro: 'Rupie indoneziană' },
  { code: 'ILS', name: 'Israeli shekel', ro: 'Shekel israelian' },
  { code: 'INR', name: 'Indian rupee', ro: 'Rupie indiană' },
  { code: 'ISK', name: 'Icelandic króna', ro: 'Coroană islandeză' },
  { code: 'JPY', name: 'Japanese yen', ro: 'Yen japonez' },
  { code: 'KRW', name: 'South Korean won', ro: 'Won sud-coreean' },
  { code: 'MDL', name: 'Moldovan leu', ro: 'Leu moldovenesc' },
  { code: 'MXN', name: 'Mexican peso', ro: 'Peso mexican' },
  { code: 'MYR', name: 'Malaysian ringgit', ro: 'Ringgit malaiezian' },
  { code: 'NOK', name: 'Norwegian krone', ro: 'Coroană norvegiană' },
  { code: 'NZD', name: 'New Zealand dollar', ro: 'Dolar neozeelandez' },
  { code: 'PHP', name: 'Philippine peso', ro: 'Peso filipinez' },
  { code: 'PLN', name: 'Polish złoty', ro: 'Zlot polonez' },
  { code: 'RSD', name: 'Serbian dinar', ro: 'Dinar sârbesc' },
  { code: 'RUB', name: 'Russian ruble', ro: 'Rublă rusească' },
  { code: 'SEK', name: 'Swedish krona', ro: 'Coroană suedeză' },
  { code: 'SGD', name: 'Singapore dollar', ro: 'Dolar singaporez' },
  { code: 'THB', name: 'Thai baht', ro: 'Baht thailandez' },
  { code: 'TRY', name: 'Turkish lira', ro: 'Liră turcească' },
  { code: 'UAH', name: 'Ukrainian hryvnia', ro: 'Grivnă ucraineană' },
  { code: 'ZAR', name: 'South African rand', ro: 'Rand sud-african' },
];

export const HIDDEN_CODES = ['XAU', 'XDR'];

const BNR_CODES = new Set(BNR_CURRENCIES.map((c) => c.code));
const MARKET_NAMES: Record<string, { en: string; ro: string }> = market.names;

/**
 * BNR's currencies first, then every other currency in the world, priced with market rates. The market mark follows
 * the rates, as `isMarketRate` does, so a currency BNR starts or stops publishing is marked right without a change here.
 */
export const CURRENCIES: CurrencyInfo[] = [
  ...BNR_CURRENCIES,
  ...Object.entries(MARKET_NAMES)
    .filter(([code]) => !BNR_CODES.has(code) && !HIDDEN_CODES.includes(code))
    .map(([code, n]) => ({ code, name: n.en, ro: n.ro })),
].map((c) => (isMarketRate(c.code) ? { ...c, market: true } : c));

const SYMBOLS: Record<string, string> = symbolTable;

/**
 * The currency's symbol ("€", "zł", "lei", "$" for CAD too), as a hint next to the code: shared symbols such as "$" or
 * "kr" are told apart by the code beside them. Undefined when there is none besides the code (CHF, AED).
 * From a fixed table (scripts/gen-currency-symbols.mjs), so every browser shows the same symbol.
 */
export const currencySymbol = (code: string): string | undefined => SYMBOLS[code];

/** The main currencies, always offered as chips, in column order. Others are added from the dropdown. */
export const MAIN_CODES = ['EUR', 'RON', 'USD', 'GBP', 'PLN', 'CHF'];
