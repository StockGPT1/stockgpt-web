import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildActivityItems } from "../components/portfolio-workspace/utils";
import type { PortfolioTransaction } from "../components/portfolio-workspace/types";
import type { PortfolioIntelligenceResult } from "../lib/portfolio-intelligence/index";
import { buildPortfolioIntelligenceView } from "../lib/portfolio-intelligence-presentation";

const ROOT = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const canonicalResult: PortfolioIntelligenceResult = {
  version: "1",
  asOf: "2026-01-16T12:00:00.000Z",
  portfolio: {
    status: "review",
    reasons: [
      {
        code: "position_concentration",
        level: "review",
        evidence: [
          {
            instrumentKey: "AAPL",
            source: "holding",
            metric: "allocation_pct_of_total_portfolio",
            observed: 42,
            unit: "percent",
            comparison: "gte",
            threshold: 35,
          },
        ],
      },
      {
        code: "data_stale",
        level: "monitor",
        evidence: [
          {
            instrumentKey: "AAPL",
            source: "market_price",
            metric: "age_hours",
            observed: 72,
            unit: "hours",
            comparison: "stale",
          },
        ],
      },
    ],
    holdingAssessments: [
      {
        instrumentKey: "AAPL",
        ticker: "AAPL",
        status: "review",
        reasons: [
          {
            code: "position_concentration",
            level: "review",
            evidence: [
              {
                source: "holding",
                metric: "allocation_pct_of_total_portfolio",
                observed: 42,
                unit: "percent",
                comparison: "gte",
                threshold: 35,
              },
            ],
          },
        ],
        attentionRank: 1,
        allocation: {
          pctOfInvestedAssets: 42,
          pctOfTotalPortfolio: 42,
        },
        ranking: {
          scoreDeclinePct: null,
          rankPercentileDeclinePp: null,
        },
        freshness: {
          ranking: "fresh",
          marketPrice: "fresh",
          diagnostics: "fresh",
        },
        dataLimitations: [],
      },
    ],
    holdingsByStatus: {
      on_track: [],
      monitor: [],
      review: ["AAPL"],
      urgent_review: [],
    },
    countsByStatus: {
      on_track: 0,
      monitor: 0,
      review: 1,
      urgent_review: 0,
    },
    attentionOrder: ["AAPL"],
    valuation: {
      state: "exact",
      holdingsValue: 100,
      cashValue: 20,
      totalValue: 120,
    },
    concentration: { largestPositionPctOfTotalPortfolio: 42 },
    dataLimitations: [],
  },
};

const readyView = buildPortfolioIntelligenceView({
  result: canonicalResult,
  adapterLimitations: ["canonical_event_severity_source_unmapped"],
});
assert.equal(readyView.statusLabel, "Review");
assert.equal(readyView.reasons[0].title, "Position concentration");
assert.deepEqual(readyView.reasons[0].affectedInstrumentKeys, ["AAPL"]);
assert.equal(
  readyView.holdingAssessments.AAPL.reasons[0].code,
  "position_concentration",
);
assert.doesNotMatch(
  JSON.stringify(readyView.reasons),
  /\b(?:buy|sell|trim|exit|reinvest|replacement|trade)\b/i,
  "Canonical reason presentation must remain investigative rather than transactional",
);

const limitedView = buildPortfolioIntelligenceView({
  result: canonicalResult,
  adapterLimitations: [
    "canonical_event_severity_source_unmapped",
    "portfolio_currency_basis_unresolved:GBP",
  ],
});
assert.equal(limitedView.statusLabel, "Analysis limited");
assert.deepEqual(limitedView.reasons, []);
assert.deepEqual(limitedView.holdingAssessments.AAPL.reasons, []);

const transactions: PortfolioTransaction[] = [
  {
    id: "buy-1",
    portfolioId: "portfolio-1",
    ticker: "AAPL",
    type: "buy",
    shares: 1,
    price: 100,
    amount: 100,
    realisedPnl: null,
    currency: "USD",
    notes: null,
    createdAt: "2026-01-16T10:00:00.000Z",
  },
  {
    id: "sell-1",
    portfolioId: "portfolio-1",
    ticker: "MSFT",
    type: "sell",
    shares: 1,
    price: 90,
    amount: 90,
    realisedPnl: 5,
    currency: "USD",
    notes: null,
    createdAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: "cash-1",
    portfolioId: "portfolio-1",
    ticker: null,
    type: "deposit",
    shares: null,
    price: null,
    amount: 250,
    realisedPnl: null,
    currency: "USD",
    notes: null,
    createdAt: "2026-01-16T08:00:00.000Z",
  },
  {
    id: "other-1",
    portfolioId: "portfolio-1",
    ticker: "NVDA",
    type: "log_existing",
    shares: 1,
    price: 50,
    amount: 50,
    realisedPnl: null,
    currency: "USD",
    notes: null,
    createdAt: "2026-01-16T07:00:00.000Z",
  },
];
assert.deepEqual(
  buildActivityItems(transactions, "USD").map((item) => item.kind),
  ["purchase", "sale", "cash", "other"],
);

const workspaceSource = source(
  "components/portfolio-workspace/PortfolioModernWorkspace.tsx",
);
const drawerSource = source("components/ManageHoldingDrawer.tsx");
const pageSource = source("app/portfolio/modern/page.tsx");
const overviewSource = source(
  "components/portfolio-workspace/PortfolioOverview.tsx",
);
const analysisSource = source(
  "components/portfolio-workspace/PortfolioAnalysisSheet.tsx",
);
const activitySource = source(
  "components/portfolio-workspace/PortfolioActivity.tsx",
);
const utilitySource = source("components/portfolio-workspace/utils.ts");
const typesSource = source("components/portfolio-workspace/types.ts");
const presentationSource = source("lib/portfolio-intelligence-presentation.ts");

for (const activeSource of [workspaceSource, drawerSource]) {
  assert.doesNotMatch(activeSource, /portfolio-action-engine/);
  assert.doesNotMatch(activeSource, /portfolio-trim-recommendation/);
}
assert.doesNotMatch(workspaceSource, /selectedRecommendation|selectedAction/);
assert.match(
  workspaceSource,
  /selectedHolding && selectedAssessment && selectedReferenceLevels/,
);
assert.match(workspaceSource, /assessment=\{selectedAssessment\}/);
assert.doesNotMatch(workspaceSource, /holding\.(?:actionAlerts|eventAlerts)/);
assert.match(
  workspaceSource,
  /const values = transactions\.map\(\(transaction\) => transaction\.createdAt\)/,
);

assert.match(drawerSource, /assessment: HoldingIntelligenceView/);
assert.match(drawerSource, /referenceLevels: HoldingReferenceLevels/);
assert.doesNotMatch(drawerSource, /recommendation:/);
assert.doesNotMatch(drawerSource, /action:/);
assert.doesNotMatch(drawerSource, /targetAllocationPct/);
assert.doesNotMatch(drawerSource, /Prefill|suggestedTrimRange|recommendation\.pct/);
assert.doesNotMatch(drawerSource, /holding-trade-levels/);
assert.doesNotMatch(drawerSource, /\bfetch\s*\(/);
assert.match(drawerSource, /assessment\.statusLabel/);
assert.match(drawerSource, /assessment\.reasons\.map/);
assert.match(drawerSource, /Record additional purchase/);
assert.match(drawerSource, /Record reduction \/ sale/);
assert.match(drawerSource, /Remove holding/);
assert.match(
  drawerSource,
  /This updates your StockGPT portfolio record\. It does not place a broker order\./,
);
assert.match(drawerSource, /savedRiskLevel/);
assert.match(drawerSource, /savedTargetLevel/);
assert.match(drawerSource, /Missing levels are not calculated/);
assert.match(drawerSource, /const \[trimValue, setTrimValue\] = useState\(""\)/);
assert.match(drawerSource, /const \[trimShares, setTrimShares\] = useState\(""\)/);
assert.match(drawerSource, /const \[buyValue, setBuyValue\] = useState\(""\)/);
assert.match(drawerSource, /const \[buyShares, setBuyShares\] = useState\(""\)/);

assert.doesNotMatch(pageSource, /buildPortfolioOpportunities/);
assert.doesNotMatch(pageSource, /opportunities=\{/);
assert.match(pageSource, /holdingReferenceLevels/);
assert.match(pageSource, /risk_level_at_entry/);
assert.match(pageSource, /target_level_at_entry/);
assert.doesNotMatch(overviewSource, /DashboardPortfolioOpportunity/);
assert.doesNotMatch(overviewSource, /StockGPT opportunities|Portfolio-fit ideas/);
assert.doesNotMatch(typesSource, /DashboardPortfolioOpportunity|opportunities:/);

assert.match(analysisSource, /intelligence\.statusLabel/);
assert.match(analysisSource, /intelligence\.summary/);
assert.match(analysisSource, /intelligence\.reasons\.map/);
assert.match(analysisSource, /Health score/);
assert.doesNotMatch(analysisSource, /summary\.(?:label|explanation|actionAlerts|eventAlerts)/);
assert.match(
  analysisSource,
  /News\/event severity is not yet part of the canonical portfolio status model/,
);

assert.doesNotMatch(utilitySource, /actionAlerts|eventAlerts|HoldingAlert/);
assert.doesNotMatch(activitySource, /AI events|holding reviews|item\.kind === "ai"|item\.kind === "review"/);
assert.match(activitySource, /Purchases/);
assert.match(activitySource, /Sales/);
assert.match(activitySource, /Cash/);
assert.match(activitySource, /Other/);
assert.match(
  activitySource,
  /StockGPT assessment status is shown separately and is not reconstructed as historical activity/,
);

assert.match(presentationSource, /IntelligenceReasonView/);
assert.match(presentationSource, /affectedInstrumentKeys/);
assert.doesNotMatch(
  presentationSource.replaceAll(".trim()", ""),
  /\b(?:buy|sell|trim|exit|reinvest|replacement|trade)\b/i,
);
assert.doesNotMatch(
  [drawerSource, analysisSource, overviewSource].join("\n"),
  /canonical_event_severity_source_unmapped|portfolio_currency_basis_unresolved/,
  "Raw adapter limitation codes must not be rendered to customers",
);

console.log("Portfolio canonical cleanup checks passed.");
