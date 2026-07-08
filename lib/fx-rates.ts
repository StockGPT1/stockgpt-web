import { unstable_cache } from "next/cache";
import {
  DEFAULT_USD_FX_RATES,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  type UsdFxRates,
} from "@/lib/currency";

const FX_REVALIDATE_SECONDS = Math.max(
  60 * 30,
  Number(process.env.STOCKGPT_FX_REVALIDATE_SECONDS ?? 6 * 60 * 60),
);
const FX_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.STOCKGPT_FX_TIMEOUT_MS ?? 1_500),
);
const FX_URL = "https://api.frankfurter.app/latest?from=USD&to=GBP,EUR,CHF";

function validRate(value: unknown) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function ratesFromEnv() {
  const raw = process.env.STOCKGPT_USD_FX_RATES_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<SupportedCurrency, unknown>>;
    const rates = { ...DEFAULT_USD_FX_RATES };
    for (const currency of SUPPORTED_CURRENCIES) {
      const rate = validRate(parsed[currency]);
      if (rate) rates[currency] = rate;
    }
    return rates;
  } catch {
    return null;
  }
}

async function fetchRatesUncached(): Promise<UsdFxRates> {
  const envRates = ratesFromEnv();
  if (envRates) return envRates;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);

  try {
    const response = await fetch(FX_URL, {
      signal: controller.signal,
      next: { revalidate: FX_REVALIDATE_SECONDS },
    });
    if (!response.ok) return DEFAULT_USD_FX_RATES;

    const json = (await response.json()) as {
      rates?: Partial<Record<SupportedCurrency, unknown>>;
    };
    return {
      USD: 1,
      GBP: validRate(json.rates?.GBP) ?? DEFAULT_USD_FX_RATES.GBP,
      EUR: validRate(json.rates?.EUR) ?? DEFAULT_USD_FX_RATES.EUR,
      CHF: validRate(json.rates?.CHF) ?? DEFAULT_USD_FX_RATES.CHF,
    };
  } catch {
    return DEFAULT_USD_FX_RATES;
  } finally {
    clearTimeout(timeout);
  }
}

export const getUsdFxRates = unstable_cache(fetchRatesUncached, ["stockgpt-usd-fx-rates-v1"], {
  revalidate: FX_REVALIDATE_SECONDS,
});

