import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CURRENT_EVENT_LIMITATION,
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentPortfolioIntelligenceFacts,
} from "../lib/current-portfolio-intelligence/index";
import { assessPortfolioIntelligence } from "../lib/portfolio-intelligence/index";
import type {
  HoldingIntelligenceInput,
  PortfolioIntelligenceResult,
  PortfolioStatus,
} from "../lib/portfolio-intelligence/index";
import {
  buildPortfolioIntelligenceView,
  holdingIntelligenceForTicker,
} from "../lib/portfolio-intelligence-presentation";

const ROOT = process.cwd();
const AS_OF = "2026-01-16T12:00:00.000Z";
const FRESH = "2026-01-16T10:00:00.000Z";

function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function resultForStatus(status: PortfolioStatus): PortfolioIntelligenceResult {
  return {
    version: "1",
    asOf: AS_OF,
    portfolio: {
      status,
      reasons: [],
      holdingAssessments: [
        {
          instrumentKey: "AAPL",
          ticker: "AAPL",
          status,
          reasons: [],
          attentionRank: 1,
          allocation: {
            pctOfInvestedAssets: 50,
            pctOfTotalPortfolio: 25,
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
        on_track: status === "on_track" ? ["AAPL"] : [],
        monitor: status === "monitor" ? ["AAPL"] : [],
        review: status === "review" ? ["AAPL"] : [],
        urgent_review: status === "urgent_review" ? ["AAPL"] : [],
      },
      countsByStatus: {
        on_track: status === "on_track" ? 1 : 0,
        monitor: status === "monitor" ? 1 : 0,
        review: status === "review" ? 1 : 0,
        urgent_review: status === "urgent_review" ? 1 : 0,
      },
      attentionOrder: ["AAPL"],
      valuation: {
        state: "exact",
        holdingsValue: 100,
        cashValue: 100,
        totalValue: 200,
      },
      concentration: { largestPositionPctOfTotalPortfolio: 50 },
      dataLimitations: [],
    },
  };
}

for (const [status, label, tone] of [
  ["on_track", "On track", "positive"],
  ["monitor", "Monitor", "caution"],
  ["review", "Review", "warning"],
  ["urgent_review", "Urgent review", "risk"],
] as const) {
  const view = buildPortfolioIntelligenceView({
    result: resultForStatus(status),
    adapterLimitations: [CURRENT_EVENT_LIMITATION],
  });
  assert.equal(view.status, status);
  assert.equal(view.statusLabel, label);
  assert.equal(view.tone, tone);
  assert.equal(holdingIntelligenceForTicker(view, "aapl").statusLabel, label);
}

const limitedView = buildPortfolioIntelligenceView({
  result: resultForStatus("urgent_review"),
  adapterLimitations: [
    CURRENT_EVENT_LIMITATION,
    "portfolio_currency_basis_unresolved:GBP",
  ],
});
assert.equal(limitedView.availability, "limited");
assert.equal(limitedView.status, null);
assert.equal(limitedView.statusLabel, "Analysis limited");
assert.equal(holdingIntelligenceForTicker(limitedView, "AAPL").status, null);
assert.deepEqual(
  holdingIntelligenceForTicker(limitedView, "AAPL").reasonCodes,
  [],
);
assert.equal(limitedView.countsByStatus.urgent_review, 0);

function holding(
  instrumentKey: string,
  currentValue: number,
  unrealisedPnlPct: number,
): HoldingIntelligenceInput {
  return {
    instrumentKey,
    ticker: instrumentKey,
    coverage: "ranked",
    provenance: "manual",
    currentValue,
    costBasis: currentValue,
    shares: 1,
    unrealisedPnlPct,
    market: { currentPrice: currentValue, savedRiskLevel: null, priceAsOf: FRESH },
    ranking: {
      currentScore: 90,
      scoreAtEntry: 90,
      currentRank: instrumentKey === "AAPL" ? 5 : 10,
      rankAtEntry: instrumentKey === "AAPL" ? 5 : 10,
      universeSize: 100,
      asOf: FRESH,
    },
    diagnostics: { currentScore: 90, previousScore: 90, asOf: FRESH },
    events: [],
  };
}

function semanticResult(result: PortfolioIntelligenceResult) {
  return {
    status: result.portfolio.status,
    reasons: result.portfolio.reasons.map((reason) => reason.code),
    attentionOrder: result.portfolio.attentionOrder,
    holdings: result.portfolio.holdingAssessments.map((assessment) => ({
      instrumentKey: assessment.instrumentKey,
      status: assessment.status,
      reasons: assessment.reasons.map((reason) => reason.code),
    })),
  };
}

const baseInput = {
  asOf: AS_OF,
  portfolio: {
    id: "portfolio-1",
    riskTolerance: "moderate",
    cashValue: 60,
  },
  holdings: [holding("AAPL", 20, 35), holding("MSFT", 20, -40)],
};
const scaledInput = {
  ...baseInput,
  portfolio: { ...baseInput.portfolio, cashValue: 120 },
  holdings: baseInput.holdings.map((item) => ({
    ...item,
    currentValue: item.currentValue === null ? null : item.currentValue * 2,
    costBasis: item.costBasis == null ? null : item.costBasis * 2,
    market: {
      ...item.market,
      currentPrice:
        item.market.currentPrice === null ? null : item.market.currentPrice * 2,
    },
  })),
};
assert.deepEqual(
  semanticResult(assessPortfolioIntelligence(baseInput)),
  semanticResult(assessPortfolioIntelligence(scaledInput)),
  "A uniform display FX multiplier must not change canonical status or ordering",
);

const pnlOnlyChanged = {
  ...baseInput,
  holdings: baseInput.holdings.map((item) => ({
    ...item,
    unrealisedPnlPct: item.unrealisedPnlPct === 35 ? -80 : 120,
  })),
};
assert.deepEqual(
  semanticResult(assessPortfolioIntelligence(baseInput)),
  semanticResult(assessPortfolioIntelligence(pnlOnlyChanged)),
  "P&L must not change canonical status presentation",
);

const currentFacts: CurrentPortfolioIntelligenceFacts = {
  portfolio: {
    id: "portfolio-1",
    risk_tolerance: "moderate",
    objective: "growth",
    time_horizon: "long_term",
    cash_balance: 100,
    currency: "USD",
  },
  holdings: [
    {
      id: "holding-1",
      portfolio_id: "portfolio-1",
      ticker: "AAPL",
      shares: 1,
      entry_price: 90,
      score_at_entry: 90,
      rank_at_entry: 5,
      allocation_pct: 10,
      source: "manual",
      risk_level_at_entry: null,
      target_level_at_entry: null,
    },
  ],
  rankings: [
    {
      ticker: "AAPL",
      score: 90,
      rank: 5,
      price: 100,
      last_price_update: FRESH,
      last_ranking_update: FRESH,
    },
  ],
  diagnostics: [
    {
      ticker: "AAPL",
      current_score: 90,
      previous_score: 90,
      updated_at: FRESH,
    },
  ],
  rankingUniverseSize: 100,
};
const currentResult = assessCurrentPortfolioIntelligenceFacts(
  currentFacts,
  AS_OF,
);
assert.ok(currentResult.adapterLimitations.includes(CURRENT_EVENT_LIMITATION));
assert.deepEqual(currentResult.input.holdings[0].events, []);

const stageSource = source("components/portfolio-workspace/PortfolioStage.tsx");
const overviewSource = source("components/portfolio-workspace/PortfolioOverview.tsx");
const holdingsSource = source("components/portfolio-workspace/PortfolioHoldings.tsx");
const visualsSource = source(
  "components/portfolio-workspace/PortfolioHoldingsVisuals.tsx",
);
const workspaceSource = source(
  "components/portfolio-workspace/PortfolioModernWorkspace.tsx",
);
const pageSource = source("app/portfolio/modern/page.tsx");
const presentationSource = source("lib/portfolio-intelligence-presentation.ts");
const migratedStatusSources = [
  stageSource,
  overviewSource,
  holdingsSource,
  visualsSource,
].join("\n");

assert.match(stageSource, /Portfolio status \$\{intelligence\.statusLabel\}/);
assert.match(stageSource, /Portfolio health \$\{summary\.score\} out of 100/);
assert.doesNotMatch(stageSource, /summary\.label/);
assert.match(overviewSource, /intelligence\.summary/);
assert.match(overviewSource, /countsByStatus\.review/);
assert.match(overviewSource, /countsByStatus\.urgent_review/);
assert.doesNotMatch(overviewSource, /summary\.(?:label|actionAlerts|eventAlerts)/);
assert.match(visualsSource, /assessment\.statusLabel/);
assert.match(visualsSource, /assessment\.status === "urgent_review"/);
assert.match(holdingsSource, /attentionRank/);
assert.match(holdingsSource, /position_concentration/);
assert.doesNotMatch(
  migratedStatusSources,
  /statusForHolding|summary\.label|summary\.actionAlerts|summary\.eventAlerts/,
);
for (const legacyLabel of [
  "Healthy",
  "Strong contributor",
  "Under pressure",
  "Oversized",
  "Review size",
]) {
  assert.doesNotMatch(migratedStatusSources, new RegExp(legacyLabel));
}

assert.match(pageSource, /last_price_update,last_ranking_update/);
assert.match(pageSource, /select\("rank", \{ count: "exact", head: true \}\)/);
assert.match(pageSource, /stock_factor_diagnostics/);
assert.match(pageSource, /assessCurrentPortfolioIntelligenceFacts/);
assert.match(pageSource, /buildPortfolioIntelligenceView/);
assert.doesNotMatch(pageSource, /loadCurrentPortfolioIntelligence\(/);
assert.ok(
  pageSource.indexOf('if (params.builder === "1" || portfolios.length === 0)') <
    pageSource.indexOf(
      "const currentIntelligence = assessCurrentPortfolioIntelligenceFacts",
    ),
  "The no-portfolio builder path must render before canonical status presentation",
);
assert.ok(
  pageSource.indexOf(
    "const currentIntelligence = assessCurrentPortfolioIntelligenceFacts",
  ) <
    pageSource.indexOf("const totalValueDisplay = convertUsdToCurrency"),
  "Canonical assessment must be assembled before display conversion",
);

assert.doesNotMatch(workspaceSource, /assessPortfolioIntelligence\(/);
assert.doesNotMatch(migratedStatusSources, /assessPortfolioIntelligence\(/);
assert.doesNotMatch(
  migratedStatusSources,
  new RegExp(CURRENT_EVENT_LIMITATION),
  "Internal event coverage limitations must not be exposed as customer copy",
);
assert.doesNotMatch(
  presentationSource.replaceAll(".trim()", ""),
  /\b(?:buy|sell|trim|reinvest)\b/i,
  "Canonical presentation must not add transaction recommendations",
);
assert.doesNotMatch(
  presentationSource,
  /news|event severity|all current news/i,
  "Canonical presentation must not claim news coverage",
);

console.log("Portfolio canonical surface checks passed.");
