export type PortfolioAccountingBasis =
  | { status: "canonical_usd"; accountingCurrency: "USD" }
  | {
      status: "legacy_currency_ambiguous";
      storedCurrency: string | null;
      reason: "legacy_non_usd" | "unknown_storage_currency";
    };

export function classifyPortfolioAccountingBasis(
  value: unknown,
): PortfolioAccountingBasis {
  const storedCurrency = String(value ?? "").trim().toUpperCase();
  if (storedCurrency === "USD") {
    return { status: "canonical_usd", accountingCurrency: "USD" };
  }

  return {
    status: "legacy_currency_ambiguous",
    storedCurrency: storedCurrency || null,
    reason: ["GBP", "EUR", "CHF"].includes(storedCurrency)
      ? "legacy_non_usd"
      : "unknown_storage_currency",
  };
}

export function isCanonicalUsdPortfolio(value: unknown): boolean {
  return classifyPortfolioAccountingBasis(value).status === "canonical_usd";
}

export function portfolioCurrencyLimitation(value: unknown): string | null {
  const basis = classifyPortfolioAccountingBasis(value);
  return basis.status === "canonical_usd"
    ? null
    : `portfolio_currency_basis_unresolved:${basis.storedCurrency ?? "unknown"}`;
}
