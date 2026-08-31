import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  convertCurrencyToUsdForWrite,
  convertUsdToCurrency,
  normaliseCurrency,
  writeSafeRateForCurrency,
  type UsdFxQuote,
} from "../lib/currency";
import {
  classifyPortfolioAccountingBasis,
  portfolioCurrencyLimitation,
} from "../lib/portfolio-accounting-basis";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

assert(classifyPortfolioAccountingBasis("USD").status === "canonical_usd", "USD was not canonical");
for (const currency of ["GBP", "EUR", "CHF"]) {
  const basis = classifyPortfolioAccountingBasis(currency);
  assert(basis.status === "legacy_currency_ambiguous", `${currency} was treated as canonical`);
  assert(basis.reason === "legacy_non_usd", `${currency} legacy reason is incorrect`);
}
for (const currency of [null, "", "CAD", "unexpected"]) {
  const basis = classifyPortfolioAccountingBasis(currency);
  assert(basis.status === "legacy_currency_ambiguous", "Unknown storage currency defaulted to USD");
  assert(basis.reason === "unknown_storage_currency", "Unknown storage reason is incorrect");
}
assert(normaliseCurrency("unexpected") === "USD", "Display preference fallback changed");
assert(portfolioCurrencyLimitation(null)?.endsWith(":unknown"), "Unknown limitation missing");

const configuredQuote: UsdFxQuote = {
  rates: { USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.88 },
  sources: { USD: "usd_identity", GBP: "configured", EUR: "configured", CHF: "configured" },
};
const fallbackQuote: UsdFxQuote = {
  rates: { USD: 1, GBP: 0.74, EUR: 0.86, CHF: 0.8 },
  sources: { USD: "usd_identity", GBP: "display_fallback", EUR: "display_fallback", CHF: "display_fallback" },
};
assert(writeSafeRateForCurrency("USD", fallbackQuote) === 1, "USD identity is not write-safe");
assert(writeSafeRateForCurrency("GBP", fallbackQuote) === null, "Display fallback became write-safe");
assert(convertCurrencyToUsdForWrite(80, "GBP", configuredQuote) === 100, "Configured write conversion is incorrect");
assert(convertCurrencyToUsdForWrite(80, "GBP", fallbackQuote) === null, "Fallback write conversion was accepted");
assert(convertUsdToCurrency(100, "GBP", fallbackQuote.rates) === 74, "Display fallback stopped working");

const page = source("app/portfolio/modern/page.tsx");
const basisCheck = page.indexOf("classifyPortfolioAccountingBasis(");
assert(basisCheck >= 0, "Portfolio page does not classify accounting basis");
assert(basisCheck < page.indexOf("enrichHoldings(rawHoldings"), "Portfolio accounting runs before basis classification");
assert(page.includes("LegacyPortfolioCurrencyWorkspace"), "Legacy limited Portfolio UI is absent");
const canonicalFallback = page.indexOf('activePortfolio.currency ?? "USD"');
assert(canonicalFallback < 0 || basisCheck < canonicalFallback, "Portfolio storage currency defaults before basis classification");

const chart = source("lib/portfolio-page-chart.ts");
assert(chart.includes("if (!isCanonicalUsdPortfolio(portfolio.currency))"), "Legacy chart write guard is absent");
assert(chart.indexOf("if (!isCanonicalUsdPortfolio") < chart.indexOf("createAdminClient()"), "Chart guard occurs after privileged snapshot setup");

const dashboard = source("lib/dashboard-portfolio.ts");
assert(dashboard.includes("selectedAccountingBasis.status === \"legacy_currency_ambiguous\""), "Dashboard legacy guard missing");
assert(dashboard.includes('valuationState: "unavailable"'), "Dashboard does not suppress legacy valuation");
const ask = source("lib/ask-stockgpt-portfolio-context.ts");
assert(ask.includes("monetaryFactsAvailable"), "Ask context does not suppress legacy money");

for (const path of [
  "app/api/portfolio-cache/warm/route.ts",
  "app/api/portfolio-snapshots/refresh/route.ts",
  "app/api/portfolio-snapshots/backfill/route.ts",
  "app/api/portfolio-snapshots/health/route.ts",
]) {
  const content = source(path);
  assert(
    content.includes("isCanonicalUsdPortfolio"),
    `${path} can derive snapshots without an accounting-basis guard`,
  );
}

for (const path of [
  "components/ManualPortfolioBuilder.tsx",
  "components/portfolio-workspace/PortfolioAddSheet.tsx",
  "components/ManageHoldingDrawer.tsx",
]) {
  const content = source(path);
  assert(content.includes("usdToWriteRate"), `${path} does not require write-safe FX`);
  assert(content.includes("current verified FX rate"), `${path} lacks unavailable-rate refusal`);
}

const migration = source("supabase/migrations/20260831165334_enforce_usd_portfolio_accounting_basis.sql");
assert(migration.includes("new_portfolio_accounting_currency_must_be_usd"), "New non-USD DB guard missing");
assert(migration.includes("legacy_portfolio_financial_state_is_read_only"), "Legacy financial immutability guard missing");
assert(migration.includes("portfolio_holdings_insert_canonical_usd_parent"), "Holding USD-parent RLS missing");
assert(migration.includes("portfolio_transactions_insert_canonical_usd_parent"), "Transaction USD-parent RLS missing");

console.log("Portfolio currency/accounting-basis checks passed.");
