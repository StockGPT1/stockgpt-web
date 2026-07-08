"use client";

import { useState } from "react";
import {
  SUPPORTED_CURRENCIES,
  normaliseCurrency,
  type SupportedCurrency,
} from "@/lib/currency";

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: "USD · US dollars",
  GBP: "GBP · British pounds",
  EUR: "EUR · Euros",
  CHF: "CHF · Swiss francs",
};

export function CurrencyPreferenceSelect({
  initialCurrency,
}: {
  initialCurrency: SupportedCurrency;
}) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(nextCurrency: SupportedCurrency) {
    const previous = currency;
    setCurrency(nextCurrency);
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: nextCurrency }),
      });

      if (!response.ok) {
        setCurrency(previous);
        setMessage("Could not save currency. Please try again.");
        return;
      }

      setMessage("Currency saved. Refresh open pages to apply it everywhere.");
    } catch {
      setCurrency(previous);
      setMessage("Could not connect. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <select
        value={currency}
        disabled={saving}
        onChange={(event) => void save(normaliseCurrency(event.target.value))}
        className="h-11 w-full rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-black text-[#072116] outline-none transition focus:border-[#ddb159] disabled:opacity-65"
      >
        {SUPPORTED_CURRENCIES.map((option) => (
          <option key={option} value={option}>
            {CURRENCY_LABELS[option]}
          </option>
        ))}
      </select>

      <div className="min-h-5">
        {message ? (
          <p
            className={[
              "text-[10px] font-bold",
              message.includes("Could not") ? "text-red-600" : "text-emerald-700",
            ].join(" ")}
          >
            {message}
          </p>
        ) : (
          <p className="text-[10px] font-semibold leading-5 text-[#072116]/45">
            Portfolio data stays stored in USD; StockGPT converts display values using
            cached FX rates.
          </p>
        )}
      </div>
    </div>
  );
}

