import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildCanonicalNotificationCandidates,
  buildCanonicalNotificationKey,
} from "../lib/canonical-notifications";
import { buildAskStockGPTPortfolioContext } from "../lib/ask-stockgpt-portfolio-context";
import {
  CURRENT_EVENT_LIMITATION,
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentPortfolioIntelligenceFacts,
} from "../lib/current-portfolio-intelligence/index";
import { buildDashboardPortfolioIntelligence } from "../lib/dashboard-portfolio";
import { buildPortfolioIntelligenceView } from "../lib/portfolio-intelligence-presentation";

const ROOT = process.cwd();
const AS_OF = "2026-08-19T12:00:00.000Z";
const FRESH = "2026-08-19T10:00:00.000Z";

function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function facts({
  currentPrice = 25,
  cashBalance = 75,
  score = 100,
  scoreAtEntry = 100,
  rank = 10,
  rankAtEntry = 10,
  savedRisk = null,
  savedTarget = null,
  entryPrice = 25,
  currency = "USD",
}: {
  currentPrice?: number;
  cashBalance?: number;
  score?: number;
  scoreAtEntry?: number;
  rank?: number;
  rankAtEntry?: number;
  savedRisk?: number | null;
  savedTarget?: number | null;
  entryPrice?: number;
  currency?: string;
} = {}): CurrentPortfolioIntelligenceFacts {
  return {
    portfolio: {
      id: "portfolio-synthetic",
      risk_tolerance: "moderate",
      objective: "growth",
      time_horizon: "long_term",
      cash_balance: cashBalance,
      currency,
    },
    holdings: [
      {
        id: "holding-synthetic",
        portfolio_id: "portfolio-synthetic",
        ticker: "TEST",
        shares: 1,
        entry_price: entryPrice,
        score_at_entry: scoreAtEntry,
        rank_at_entry: rankAtEntry,
        allocation_pct: 25,
        source: "manual",
        risk_level_at_entry: savedRisk,
        target_level_at_entry: savedTarget,
      },
    ],
    rankings: [
      {
        ticker: "TEST",
        score,
        rank,
        price: currentPrice,
        last_price_update: FRESH,
        last_ranking_update: FRESH,
      },
    ],
    diagnostics: [],
    rankingUniverseSize: 100,
  };
}

function notifications(inputFacts: CurrentPortfolioIntelligenceFacts) {
  return buildCanonicalNotificationCandidates({
    asOf: AS_OF,
    portfolios: [
      {
        portfolioName: "Synthetic portfolio",
        facts: inputFacts,
        companiesByTicker: { TEST: "Synthetic Company" },
      },
    ],
  });
}

const reviewFacts = facts();
const review = notifications(reviewFacts);
assert.equal(review.length, 1);
assert.equal(review[0].kind, "canonical_review");
assert.equal(review[0].status, "review");
assert.equal(review[0].statusLabel, "Review");
assert.deepEqual(review[0].reasonCodes, ["position_concentration"]);
assert.match(review[0].title, /TEST · Review/);

const urgentFacts = facts({
  currentPrice: 50,
  cashBalance: 150,
  score: 70,
  scoreAtEntry: 100,
  rank: 40,
  rankAtEntry: 1,
  savedRisk: 60,
  entryPrice: 50,
});
const urgent = notifications(urgentFacts);
assert.equal(urgent.length, 1);
assert.equal(urgent[0].status, "urgent_review");
assert.equal(urgent[0].statusLabel, "Urgent review");
assert.ok(urgent[0].reasonCodes.includes("saved_risk_level_breached"));
assert.ok(urgent[0].reasonCodes.includes("ranking_deterioration"));
assert.equal(
  urgent.filter((item) => item.kind === "saved_reference").length,
  0,
  "Saved-risk evidence must not create a duplicate reference notification",
);

const monitor = notifications(facts({ currentPrice: 20, cashBalance: 80 }));
assert.deepEqual(monitor, []);

const onTrackFacts = facts({ currentPrice: 10, cashBalance: 90 });
const onTrack = assessCurrentPortfolioIntelligenceFacts(onTrackFacts, AS_OF);
assert.equal(onTrack.assessment.portfolio.holdingAssessments[0].status, "on_track");
assert.deepEqual(notifications(onTrackFacts), []);

const canonicalUrgent = assessCurrentPortfolioIntelligenceFacts(
  urgentFacts,
  AS_OF,
);
const canonicalUrgentHolding =
  canonicalUrgent.assessment.portfolio.holdingAssessments[0];
assert.equal(urgent[0].status, canonicalUrgentHolding.status);
assert.deepEqual(
  urgent[0].reasonCodes,
  canonicalUrgentHolding.reasons
    .filter((reason) => reason.level === "review")
    .map((reason) => reason.code),
);
const portfolioView = buildPortfolioIntelligenceView({
  result: canonicalUrgent.assessment,
  adapterLimitations: canonicalUrgent.adapterLimitations,
});
const dashboardView = buildDashboardPortfolioIntelligence(urgentFacts, AS_OF);
const askContext = buildAskStockGPTPortfolioContext({
  facts: urgentFacts,
  asOf: AS_OF,
  meta: {
    id: urgentFacts.portfolio.id,
    name: "Synthetic portfolio",
    riskTolerance: urgentFacts.portfolio.risk_tolerance,
    objective: urgentFacts.portfolio.objective,
    timeHorizon: urgentFacts.portfolio.time_horizon,
    currency: urgentFacts.portfolio.currency,
    investmentAmount: null,
    cashDepositedTotal: null,
    createdAt: null,
  },
  holdingMetadata: [
    { ticker: "TEST", company: "Synthetic Company", sector: "Synthetic" },
  ],
});
assert.equal(urgent[0].status, portfolioView.status);
assert.equal(urgent[0].status, dashboardView.status);
assert.equal(
  urgent[0].status,
  askContext.holdings[0].canonical_assessment.status,
);

const changedPnl = notifications(
  facts({
    currentPrice: 25,
    cashBalance: 75,
    entryPrice: 250,
  }),
);
assert.equal(changedPnl[0].status, review[0].status);
assert.deepEqual(changedPnl[0].reasonCodes, review[0].reasonCodes);

const targetReference = notifications(
  facts({ currentPrice: 100, cashBalance: 900, savedTarget: 90, entryPrice: 100 }),
);
assert.equal(targetReference.length, 1);
assert.equal(targetReference[0].kind, "saved_reference");
assert.equal(targetReference[0].status, null);
assert.deepEqual(targetReference[0].reasonCodes, []);
assert.match(targetReference[0].title, /Saved target reference reached/);

const limited = notifications(
  facts({ currentPrice: 25, cashBalance: 75, currency: "GBP" }),
);
assert.deepEqual(limited, []);

const current = assessCurrentPortfolioIntelligenceFacts(reviewFacts, AS_OF);
assert.ok(current.adapterLimitations.includes(CURRENT_EVENT_LIMITATION));
assert.deepEqual(current.input.holdings[0].events, []);

const key = buildCanonicalNotificationKey({
  portfolioId: "portfolio-synthetic",
  instrumentKey: "TEST",
  status: "review",
  reasonCodes: ["ranking_deterioration", "position_concentration"],
  asOf: AS_OF,
});
assert.equal(
  key,
  buildCanonicalNotificationKey({
    portfolioId: "portfolio-synthetic",
    instrumentKey: "test",
    status: "review",
    reasonCodes: ["position_concentration", "ranking_deterioration"],
    asOf: "2026-08-23T23:59:59.000Z",
  }),
);
assert.notEqual(
  key,
  buildCanonicalNotificationKey({
    portfolioId: "portfolio-synthetic",
    instrumentKey: "TEST",
    status: "urgent_review",
    reasonCodes: ["position_concentration", "ranking_deterioration"],
    asOf: AS_OF,
  }),
);
assert.notEqual(
  key,
  buildCanonicalNotificationKey({
    portfolioId: "portfolio-synthetic",
    instrumentKey: "TEST",
    status: "review",
    reasonCodes: ["position_concentration", "ranking_deterioration"],
    asOf: "2026-08-24T00:00:00.000Z",
  }),
);

for (const item of [...review, ...urgent, ...targetReference]) {
  assert.ok(!("recommendation" in item));
  assert.ok(!("severity" in item));
  assert.ok(!("type" in item));
}

const serverSource = source("lib/notifications.ts");
const builderSource = source("lib/canonical-notifications.ts");
const uiSource = source("components/NotificationsList.tsx");
const pageSource = source("app/notifications/page.tsx");
for (const activeSource of [serverSource, builderSource]) {
  assert.doesNotMatch(activeSource, /portfolio-alerts|portfolio-action-engine|portfolio-trim-recommendation/);
  assert.doesNotMatch(activeSource, /\benrichHoldings\s*\(/);
  assert.doesNotMatch(activeSource, /trim_action|sell_action|buy_more_action|review_action/);
}
assert.match(serverSource, /\.eq\("user_id", user\.id\)/);
assert.match(serverSource, /\.in\("portfolio_id", portfolioIds\)/);
assert.match(serverSource, /risk_level_at_entry,target_level_at_entry/);
assert.match(
  serverSource,
  /ticker,company,score,rank,price,last_price_update,last_ranking_update/,
);
assert.match(serverSource, /stock_factor_diagnostics/);
assert.match(serverSource, /ticker,current_score,previous_score,updated_at/);
assert.match(serverSource, /select\("rank", \{ count: "exact", head: true \}\)/);
assert.match(serverSource, /\.not\("rank", "is", null\)/);
assert.match(serverSource, /const asOf = new Date\(\)\.toISOString\(\)/);
assert.doesNotMatch(serverSource, /\b500\b|news_articles|eventAlerts|actionAlerts/);
assert.doesNotMatch(builderSource, /recommendation\s*:/);
assert.doesNotMatch(uiSource, /notification\.recommendation|StockGPTView/);
assert.doesNotMatch(uiSource, /\bResolved\b|\bresolved\b/);
assert.match(uiSource, /Mark as read/);
assert.match(uiSource, /Restore to unread/);
assert.match(uiSource, /No current Review or Urgent review prompts/);
assert.doesNotMatch(uiSource, /look stable|all news|news is included/i);
assert.match(uiSource, /Urgent review/);
assert.match(uiSource, /Saved reference/);
assert.doesNotMatch(pageSource, /ranking moves|relevant news|portfolio changes/i);

console.log("Canonical notification checks passed.");
