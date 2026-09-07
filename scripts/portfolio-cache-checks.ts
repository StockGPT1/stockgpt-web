import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  buildPortfolioChartInputFingerprint,
  getLatestPortfolioChart,
  isPortfolioChartCachePayload,
  PORTFOLIO_CHART_CACHE_VERSION,
  saveLatestPortfolioChart,
} from "../lib/portfolio-chart-cache";
import {
  appendCurrentPointToPortfolioChartData,
  buildCurrentPortfolioSnapshotPoint,
  latestPortfolioInputChangeMs,
} from "../lib/portfolio-snapshots";

async function main() {
const at = new Date("2026-09-01T12:00:00.000Z");

function currentPoint(contribution: unknown, price: unknown = 125) {
  return buildCurrentPortfolioSnapshotPoint({
    portfolio: { cash_balance: 50, cash_deposited_total: contribution },
    holdings: [{ ticker: "AAA", shares: 2, entry_price: 100 }],
    currentPrices: { AAA: price },
    snapshotAt: at,
  });
}

assert.equal(currentPoint(1000)?.basis, 1000);
assert.equal(currentPoint(0)?.basis, 0);
assert.equal(currentPoint(0)?.pnlPct, undefined);
assert.equal(currentPoint(-30)?.basis, -30);
assert.equal(currentPoint(-30)?.close, 300);
assert.equal(currentPoint(-30)?.pnl, 330);
assert.equal(currentPoint(-30)?.pnlPct, undefined);
assert.equal(currentPoint(null), null);
assert.equal(currentPoint(1000, null), null);
assert.equal(currentPoint(1000, 0), null);

const cashOnly = buildCurrentPortfolioSnapshotPoint({
  portfolio: { cash_balance: 500, cash_deposited_total: 500 },
  holdings: [],
  snapshotAt: at,
});
assert.deepEqual(cashOnly, {
  date: at.toISOString(),
  close: 500,
  cash: 500,
  basis: 500,
  pnl: 0,
  pnlPct: 0,
});

const gapFilled = appendCurrentPointToPortfolioChartData({
  chartData: {
    "1M": [{ date: "2026-08-03T21:00:00.000Z", close: 275 }],
  },
  currentPoint: {
    date: at.toISOString(),
    close: 300,
    cash: 50,
    basis: -30,
    pnl: 330,
  },
  portfolioCreatedAt: "2026-08-01T00:00:00.000Z",
  nowMs: at.getTime(),
});
const syntheticGapPoints = (gapFilled["1M"] ?? []).filter((point) => point.synthetic);
assert(syntheticGapPoints.length > 0, "expected a deterministic gap-fill fixture");
for (const point of syntheticGapPoints) {
  assert.equal(point.cash, undefined);
  assert.equal(point.basis, undefined);
  assert.equal(point.pnl, undefined);
  assert.equal(point.pnlPct, undefined);
}

const baseFingerprintInput = {
  ownerId: "11111111-1111-4111-8111-111111111111",
  portfolioId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  accountingBasis: "canonical_usd" as const,
  portfolioCreatedAt: "2026-01-01T00:00:00.000Z",
  cashBalance: 100,
  netContributedCapital: -30,
  holdings: [
    {
      ticker: "BBB",
      shares: 1,
      entryPrice: 100,
      purchaseDate: null,
      addedAt: "2026-01-02T00:00:00.000Z",
      currentPrice: 150,
      currentPriceUpdatedAt: "2026-09-01T11:55:00.000Z",
    },
    {
      ticker: "AAA",
      shares: 2,
      entryPrice: 50,
      purchaseDate: null,
      addedAt: "2026-01-03T00:00:00.000Z",
      currentPrice: 75,
      currentPriceUpdatedAt: "2026-09-01T11:55:00.000Z",
    },
  ],
  transactions: [
    {
      id: "t1",
      createdAt: "2026-09-01T10:00:00.000Z",
      ticker: "AAA",
      type: "buy",
      shares: 2,
      price: 50,
      amount: 100,
      realisedPnl: null,
      currency: "USD",
    },
  ],
};

const fingerprint = buildPortfolioChartInputFingerprint(baseFingerprintInput);
assert.equal(
  fingerprint,
  buildPortfolioChartInputFingerprint({
    ...baseFingerprintInput,
    holdings: [...baseFingerprintInput.holdings].reverse(),
  }),
  "holding input order must not alter the deterministic fingerprint",
);
assert.notEqual(
  fingerprint,
  buildPortfolioChartInputFingerprint({ ...baseFingerprintInput, ownerId: "other-owner" }),
);
assert.notEqual(
  fingerprint,
  buildPortfolioChartInputFingerprint({ ...baseFingerprintInput, portfolioId: "other-portfolio" }),
);
assert.notEqual(
  fingerprint,
  buildPortfolioChartInputFingerprint({
    ...baseFingerprintInput,
    holdings: baseFingerprintInput.holdings.map((holding, index) =>
      index === 0 ? { ...holding, ticker: "CCC" } : holding,
    ),
  }),
  "same-summary composition changes must invalidate the cache",
);
assert.notEqual(
  fingerprint,
  buildPortfolioChartInputFingerprint({
    ...baseFingerprintInput,
    holdings: baseFingerprintInput.holdings.map((holding, index) =>
      index === 0 ? { ...holding, currentPrice: 151 } : holding,
    ),
  }),
  "current-price changes must invalidate the cache",
);
assert.notEqual(
  fingerprint,
  buildPortfolioChartInputFingerprint({
    ...baseFingerprintInput,
    transactions: baseFingerprintInput.transactions.map((transaction) => ({
      ...transaction,
      createdAt: "2026-09-01T12:00:00.000Z",
    })),
  }),
  "recorded transaction time must invalidate the cache",
);

const recordedMs = latestPortfolioInputChangeMs({
  portfolioCreatedAt: "2025-01-01T00:00:00.000Z",
  holdings: [],
  transactions: [{
    created_at: "2026-09-01T12:00:00.000Z",
    occurred_at: "2025-02-01T12:00:00.000Z",
  }],
});
assert.equal(recordedMs, Date.parse("2026-09-01T12:00:00.000Z"));

const expected = {
  ownerId: baseFingerprintInput.ownerId,
  portfolioId: baseFingerprintInput.portfolioId,
  inputFingerprint: fingerprint,
};
const validPayload = {
  version: PORTFOLIO_CHART_CACHE_VERSION,
  ...expected,
  generatedAt: at.toISOString(),
  chartData: {
    "1D": [
      { date: "2026-09-01T09:00:00.000Z", close: 295, basis: -30, pnl: 325 },
      { date: "2026-09-01T10:00:00.000Z", close: 297, basis: -30, pnl: 327 },
      { date: "2026-09-01T11:00:00.000Z", close: 299, basis: -30, pnl: 329 },
      { date: "2026-09-01T12:00:00.000Z", close: 300, basis: -30, pnl: 330 },
    ],
  },
};
assert.equal(isPortfolioChartCachePayload(validPayload, expected), true);
assert.equal(isPortfolioChartCachePayload({ ...validPayload, ownerId: "other" }, expected), false);
assert.equal(isPortfolioChartCachePayload({ ...validPayload, version: "v10" }, expected), false);
assert.equal(
  isPortfolioChartCachePayload({
    ...validPayload,
    chartData: { "1D": [{ date: at.toISOString(), close: "not-a-number" }] },
  }, expected),
  false,
);

// With Redis deliberately unconfigured in this source/pure test, read/write
// degradation must be a cache miss/successful no-op rather than an exception.
await assert.doesNotReject(() => saveLatestPortfolioChart({
  ...expected,
  chartData: validPayload.chartData,
  generatedAt: at.toISOString(),
}));
assert.equal(await getLatestPortfolioChart({ ...expected, nowMs: at.getTime() }), null);

const pageChart = readFileSync("lib/portfolio-page-chart.ts", "utf8");
const chartRoute = readFileSync("app/api/portfolio-chart/route.ts", "utf8");
const management = readFileSync("lib/actions/portfolio-management.ts", "utf8");
const cashAction = readFileSync("lib/actions/portfolio-cash.ts", "utf8");
const portfolioPage = readFileSync("app/portfolio/modern/page.tsx", "utf8");
const warmer = readFileSync("app/api/portfolio-cache/warm/route.ts", "utf8");

assert.equal(existsSync("lib/portfolio-speed-cache.ts"), false);
assert.equal(existsSync("scripts/portfolio-cache-speed-pass.mjs"), false);
for (const source of [pageChart, chartRoute, management, cashAction, portfolioPage]) {
  assert.doesNotMatch(source, /portfolio-speed-cache|portfolio_page_snapshots/u);
}
assert.doesNotMatch(pageChart, /saveLatestPortfolioSnapshotFromChartData|page_current_value/u);
assert.doesNotMatch(chartRoute, /saveLatestPortfolioSnapshotFromChartData|source:\s*["']page["']/u);
assert.doesNotMatch(management, /saveLatestPortfolioSnapshotFromChartData|page_current_value/u);
assert.match(warmer, /retired:\s*true/u);
assert.doesNotMatch(warmer, /savePortfolioPageSnapshot|buildPortfolioPageChart/u);
assert.match(portfolioPage, /legacy_currency_ambiguous[\s\S]*return \(/u);
assert.match(pageChart, /buildPortfolioChartInputFingerprint/u);
assert.match(pageChart, /currentPriceUpdatedAt/u);
assert.match(pageChart, /netContributedCapital:\s*portfolio\.cash_deposited_total/u);
assert.match(portfolioPage, /cash_deposited_total:\s*activePortfolio\.cash_deposited_total/u);
assert.doesNotMatch(
  pageChart.slice(pageChart.indexOf("buildPortfolioChartInputFingerprint")),
  /investment_amount:\s*portfolio\.investment_amount/u,
);

console.log("Portfolio cache/current-point checks passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
