import { unstable_cache } from "next/cache";
import {
  DEFAULT_USD_FX_RATES,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  type UsdFxQuote,
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

function fallbackQuote(): UsdFxQuote {
  return {
    rates: { ...DEFAULT_USD_FX_RATES },
    sources: {
      USD: "usd_identity",
      GBP: "display_fallback",
      EUR: "display_fallback",
      CHF: "display_fallback",
    },
  };
}

function ratesFromEnv(): UsdFxQuote | null {
  const raw = process.env.STOCKGPT_USD_FX_RATES_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<SupportedCurrency, unknown>>;
    const quote = fallbackQuote();
    for (const currency of SUPPORTED_CURRENCIES) {
      const rate = validRate(parsed[currency]);
      if (rate) {
        quote.rates[currency] = rate;
        quote.sources[currency] =
          currency === "USD" ? "usd_identity" : "configured";
      }
    }
    return quote;
  } catch {
    return null;
  }
}

async function fetchRatesUncached(): Promise<UsdFxQuote> {
  const envRates = ratesFromEnv();
  if (envRates) return envRates;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);

  try {
    const response = await fetch(FX_URL, {
      signal: controller.signal,
      next: { revalidate: FX_REVALIDATE_SECONDS },
    });
    if (!response.ok) return fallbackQuote();

    const json = (await response.json()) as {
      rates?: Partial<Record<SupportedCurrency, unknown>>;
    };
    const quote = fallbackQuote();
    for (const currency of ["GBP", "EUR", "CHF"] as const) {
      const rate = validRate(json.rates?.[currency]);
      if (rate) {
        quote.rates[currency] = rate;
        quote.sources[currency] = "fetched_current";
      }
    }
    return quote;
  } catch {
    return fallbackQuote();
  } finally {
    clearTimeout(timeout);
  }
}

export const getUsdFxQuote = unstable_cache(fetchRatesUncached, ["stockgpt-usd-fx-quote-v2"], {
  revalidate: FX_REVALIDATE_SECONDS,
});

export async function getUsdFxRates(): Promise<UsdFxRates> {
  return (await getUsdFxQuote()).rates;
}

