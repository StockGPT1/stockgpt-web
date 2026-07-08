export const SUPPORTED_CURRENCIES = ["USD", "GBP", "EUR", "CHF"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type UsdFxRates = Record<SupportedCurrency, number>;

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

export function formatCurrencyValue(value: number, currency: SupportedCurrency) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(safe) >= 1000 ? 0 : 2,
  }).format(safe);
}

