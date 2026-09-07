import assert from "node:assert/strict";
import { buildPortfolioHealthSummary } from "../lib/portfolio-health";
import { signedPct } from "../components/portfolio-workspace/utils";
import { portfolioSaleOrderInput } from "../lib/portfolio-sale-order";
import { resolveTradeOrder } from "../lib/trade-calculator";
import { readFileSync } from "node:fs";

for (const contribution of [0, -30, null]) {
  const summary = buildPortfolioHealthSummary({
    name: "Synthetic read regression", holdings: [], cashBalance: 50,
    cashDepositedTotal: contribution, transactions: [{ realisedPnl: 10 }],
  });
  assert.equal(summary.totalPnlPct, null, "unknown/non-positive contribution must not invent a return denominator");
}
assert.equal(signedPct(null), "Unavailable");
for (const quote of [null, undefined, 0, -1, Number.NaN]) {
  assert(resolveTradeOrder(portfolioSaleOrderInput({ percentage: 100 }, 2, quote)).error);
  const explicit = resolveTradeOrder(portfolioSaleOrderInput({ shares: 2, price: 150 }, 2, quote));
  assert.equal(explicit.error, null);
  assert.equal(explicit.value, 300);
  assert.equal(resolveTradeOrder(portfolioSaleOrderInput({ shares: 2, value: 240 }, 2, quote)).price, 120);
}
assert.equal(resolveTradeOrder(portfolioSaleOrderInput({ percentage: 100 }, 2, 150)).value, 300);
const management = readFileSync("lib/actions/portfolio-management.ts", "utf8");
const sale = management.slice(management.indexOf("export async function trimHolding("), management.indexOf("export async function removeHolding("));
assert(sale.includes("portfolioSaleOrderInput(input, currentShares, stock?.price)"));
assert(!sale.includes("tradeHolding.entry_price"));
const levelRoute = readFileSync("app/api/portfolio/holding-trade-levels/route.ts", "utf8");
assert(levelRoute.includes("isCanonicalUsdPortfolio(portfolio.currency)"));
assert(levelRoute.indexOf("portfolio_currency_basis_unresolved") < levelRoute.indexOf("const { data: rankingData }"));
assert(!levelRoute.includes('currency: portfolio?.currency ?? "USD"'));
for (const file of ["app/portfolio/modern/page.tsx", "lib/dashboard-portfolio.ts", "app/api/portfolio-chart/route.ts"]) {
  const source = readFileSync(file, "utf8");
  assert(source.includes("readPortfolioLedger("), `${file} must use the complete exact-Portfolio ledger reader`);
  assert(!source.includes('.from("portfolio_transactions")'), `${file} must not reintroduce a truncated ledger query`);
}
console.log("Stage 05 financial read regressions passed.");
