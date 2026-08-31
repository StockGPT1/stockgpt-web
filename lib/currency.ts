export const SUPPORTED_CURRENCIES = ["USD", "GBP", "EUR", "CHF"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type UsdFxRates = Record<SupportedCurrency, number>;

export type FxRateSource =
  | "usd_identity"
  | "configured"
  | "fetched_current"
  | "display_fallback";

export type UsdFxQuote = {
  rates: UsdFxRates;
  sources: Record<SupportedCurrency, FxRateSource>;
};

export const DEFAULT_USD_FX_RATES: UsdFxRates = {
  USD: 1,
  GBP: 0.74,
  EUR: 0.86,
  CHF: 0.8,
};

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

export function normaliseCurrency(value: unknown): SupportedCurrency {
  const currency = String(value ?? "").trim().toUpperCase();
  return SUPPORTED_CURRENCY_SET.has(currency) ? (currency as SupportedCurrency) : "USD";
}

export function rateForCurrency(
  currency: SupportedCurrency,
  rates: Partial<Record<SupportedCurrency, number>> | null | undefined,
) {
  const rate = Number(rates?.[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_FX_RATES[currency];
}

export function convertUsdToCurrency(
  value: number,
  currency: SupportedCurrency,
  rates: Partial<Record<SupportedCurrency, number>> | null | undefined,
) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe * rateForCurrency(currency, rates);
}

export function convertCurrencyToUsd(
  value: number,
  currency: SupportedCurrency,
  rates: Partial<Record<SupportedCurrency, number>> | null | undefined,
) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe / rateForCurrency(currency, rates);
}

export function writeSafeRateForCurrency(
  currency: SupportedCurrency,
  quote: UsdFxQuote,
): number | null {
  const source = quote.sources[currency];
  if (
    source !== "usd_identity" &&
    source !== "configured" &&
    source !== "fetched_current"
  ) {
    return null;
  }
  const rate = Number(quote.rates[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function convertCurrencyToUsdForWrite(
  value: number,
  currency: SupportedCurrency,
  quote: UsdFxQuote,
): number | null {
  if (!Number.isFinite(value)) return null;
  const rate = writeSafeRateForCurrency(currency, quote);
  return rate == null ? null : value / rate;
}

export function formatCurrencyValue(value: number, currency: SupportedCurrency) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(safe) >= 1000 ? 0 : 2,
  }).format(safe);
}

