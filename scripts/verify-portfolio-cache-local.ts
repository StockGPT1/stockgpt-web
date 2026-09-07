import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

const portfolioId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ownerId = "11111111-1111-4111-8111-111111111111";

function runSupabase(args: string[]) {
  return execFileSync(
    process.execPath,
    [resolve("node_modules", "supabase", "dist", "supabase.js"), ...args],
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function localStatus() {
  return Object.fromEntries(
    runSupabase(["status", "-o", "env"])
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [
        match[1],
        match[2].startsWith('"') ? JSON.parse(match[2]) : match[2],
      ]),
  );
}

async function main() {
const status = localStatus();
assert.ok(status.API_URL && status.SERVICE_ROLE_KEY, "Local Supabase is unavailable");
process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function required<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data == null) throw new Error(`${label}: missing data`);
  return data;
}

async function tableState() {
  const [portfolio, holdings, transactions, snapshots] = await Promise.all([
    required(
      admin.from("user_portfolios").select("*").eq("id", portfolioId).single(),
      "portfolio read",
    ),
    required(
      admin.from("portfolio_holdings").select("*").eq("portfolio_id", portfolioId).order("id"),
      "holdings read",
    ),
    required(
      admin.from("portfolio_transactions").select("*").eq("portfolio_id", portfolioId).order("id"),
      "transactions read",
    ),
    required(
      admin.from("portfolio_snapshots").select("*").eq("portfolio_id", portfolioId).order("id"),
      "snapshots read",
    ),
  ]);
  return { portfolio, holdings, transactions, snapshots };
}

const before = await tableState();
const portfolio = before.portfolio as
  | Database["public"]["Tables"]["user_portfolios"]["Row"]
  | null;
assert.ok(portfolio, "Seeded canonical Portfolio is missing");
const holdingRows = before.holdings;
const tickers = holdingRows.map((holding) => holding.ticker);
const rankings = await required(
  admin
    .from("stock_rankings")
    .select("ticker,price,last_price_update")
    .in("ticker", tickers)
    .order("ticker"),
  "ranking read",
);
const rankingByTicker = new Map(rankings.map((ranking) => [ranking.ticker, ranking]));
const chartHoldings = holdingRows.map((holding) => {
  const ranking = rankingByTicker.get(holding.ticker);
  const shares = Number(holding.shares);
  const currentPrice = Number(ranking?.price);
  return {
    ticker: holding.ticker,
    shares,
    entryPrice: Number(holding.entry_price),
    currentPrice,
    currentValue: shares * currentPrice,
    purchaseDate: holding.purchase_date,
    addedAt: holding.added_at,
  };
});
assert.ok(
  chartHoldings.every((holding) => holding.shares <= 0 || holding.currentPrice > 0),
  "Seeded canonical Portfolio must have defensible current prices",
);

const totalValue =
  Number(portfolio.cash_balance) +
  chartHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
const { buildPortfolioPageChartResult } = await import("../lib/portfolio-page-chart");
await buildPortfolioPageChartResult({
  portfolio: {
    id: portfolio.id,
    name: portfolio.name,
    risk_tolerance: portfolio.risk_tolerance,
    time_horizon: portfolio.time_horizon,
    investment_amount: portfolio.investment_amount,
    cash_balance: portfolio.cash_balance,
    cash_deposited_total: portfolio.cash_deposited_total,
    currency: portfolio.currency,
    created_at: portfolio.created_at,
    user_id: portfolio.user_id,
  },
  enriched: chartHoldings,
  transactions: before.transactions,
  summary: {
    holdingsCount: chartHoldings.length,
    totalValue,
    totalPnl: 0,
    totalPnlPct: 0,
  },
  ownerId,
  marketFacts: rankings.map((ranking) => ({
    ticker: ranking.ticker,
    price: ranking.price,
    last_price_update: ranking.last_price_update,
  })),
});

const after = await tableState();
assert.deepEqual(after, before, "Portfolio chart/page read mutated authoritative or semantic state");

const wrongOwnerResult = await buildPortfolioPageChartResult({
  portfolio: {
    id: portfolio.id,
    name: portfolio.name,
    risk_tolerance: portfolio.risk_tolerance,
    time_horizon: portfolio.time_horizon,
    investment_amount: portfolio.investment_amount,
    cash_balance: portfolio.cash_balance,
    cash_deposited_total: portfolio.cash_deposited_total,
    currency: portfolio.currency,
    created_at: portfolio.created_at,
  },
  enriched: chartHoldings,
  transactions: before.transactions,
  summary: { holdingsCount: chartHoldings.length, totalValue },
  ownerId: "33333333-3333-4333-8333-333333333333",
  marketFacts: rankings,
});
assert.equal(
  wrongOwnerResult.meta.source,
  "building",
  "An unverified owner/Portfolio pair must not read semantic history or cache",
);

console.log("Local Portfolio page/cache side-effect and owner checks passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
