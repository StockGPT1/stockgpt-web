import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CURRENT_EVENT_LIMITATION,
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentPortfolioIntelligenceFacts,
} from "../lib/current-portfolio-intelligence/index";
import {
  ASK_STOCKGPT_SYSTEM_PROMPT,
  buildAskStockGPTPortfolioContext,
} from "../lib/ask-stockgpt-portfolio-context";
import { buildDashboardPortfolioIntelligence } from "../lib/dashboard-portfolio";
import { buildPortfolioIntelligenceView } from "../lib/portfolio-intelligence-presentation";

const ROOT = process.cwd();
const AS_OF = "2026-01-16T12:00:00.000Z";
const FRESH = "2026-01-16T10:00:00.000Z";

function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function facts(currency = "USD"): CurrentPortfolioIntelligenceFacts {
  return {
    portfolio: {
      id: "portfolio-1",
      risk_tolerance: "moderate",
      objective: "growth",
      time_horizon: "long_term",
      cash_balance: 100,
      currency,
    },
    holdings: [
      {
        id: "holding-aapl",
        portfolio_id: "portfolio-1",
        ticker: "AAPL",
        shares: 8,
        entry_price: 80,
        score_at_entry: 95,
        rank_at_entry: 2,
        allocation_pct: 40,
        source: "manual",
        risk_level_at_entry: 70,
        target_level_at_entry: 130,
      },
      {
        id: "holding-msft",
        portfolio_id: "portfolio-1",
        ticker: "MSFT",
        shares: 1,
        entry_price: 100,
        score_at_entry: 90,
        rank_at_entry: 4,
        allocation_pct: 20,
        source: "manual_builder",
        risk_level_at_entry: null,
        target_level_at_entry: null,
      },
    ],
    rankings: [
      {
        ticker: "AAPL",
        score: 70,
        rank: 40,
        price: 100,
        last_price_update: FRESH,
        last_ranking_update: FRESH,
      },
      {
        ticker: "MSFT",
        score: 90,
        rank: 4,
        price: 100,
        last_price_update: FRESH,
        last_ranking_update: FRESH,
      },
    ],
    diagnostics: [
      {
        ticker: "AAPL",
        current_score: 60,
        previous_score: 90,
        updated_at: FRESH,
      },
      {
        ticker: "MSFT",
        current_score: 90,
        previous_score: 90,
        updated_at: FRESH,
      },
    ],
    rankingUniverseSize: 100,
  };
}

function askContext(inputFacts: CurrentPortfolioIntelligenceFacts) {
  return buildAskStockGPTPortfolioContext({
    facts: inputFacts,
    asOf: AS_OF,
    meta: {
      id: inputFacts.portfolio.id,
      name: "Synthetic portfolio",
      riskTolerance: inputFacts.portfolio.risk_tolerance,
      objective: inputFacts.portfolio.objective,
      timeHorizon: inputFacts.portfolio.time_horizon,
      currency: inputFacts.portfolio.currency,
      investmentAmount: 1000,
      cashDepositedTotal: 1000,
      createdAt: "2025-01-01T00:00:00.000Z",
    },
    holdingMetadata: [
      { ticker: "AAPL", company: "Synthetic Apple", sector: "Technology" },
      { ticker: "MSFT", company: "Synthetic Microsoft", sector: "Technology" },
    ],
  });
}

const baselineFacts = facts();
const ask = askContext(baselineFacts);
const portfolioCurrent = assessCurrentPortfolioIntelligenceFacts(
  baselineFacts,
  AS_OF,
);
const portfolio = buildPortfolioIntelligenceView({
  result: portfolioCurrent.assessment,
  adapterLimitations: portfolioCurrent.adapterLimitations,
});
const dashboard = buildDashboardPortfolioIntelligence(baselineFacts, AS_OF);

assert.equal(ask.canonical_assessment.as_of, AS_OF);
assert.equal(ask.canonical_assessment.status, portfolio.status);
assert.equal(ask.canonical_assessment.status, dashboard.status);
assert.equal(ask.canonical_assessment.status_label, portfolio.statusLabel);
assert.deepEqual(ask.canonical_assessment.counts_by_status, portfolio.countsByStatus);
assert.deepEqual(ask.canonical_assessment.counts_by_status, dashboard.countsByStatus);
assert.deepEqual(ask.canonical_assessment.attention_order, portfolio.attentionOrder);
assert.deepEqual(ask.canonical_assessment.attention_order, dashboard.attentionOrder);
assert.deepEqual(
  ask.canonical_assessment.reasons.map((reason) => reason.code),
  portfolio.reasons.map((reason) => reason.code),
);
assert.deepEqual(
  ask.canonical_assessment.reasons.map((reason) => reason.code),
  dashboard.reasons.map((reason) => reason.code),
);
assert.ok(ask.canonical_assessment.reasons.some((reason) => reason.evidence.length > 0));
assert.ok(ask.holdings.every((holding) => holding.canonical_assessment.status));
assert.ok(
  ask.coverage.adapter_limitations.includes(CURRENT_EVENT_LIMITATION),
);
assert.equal(ask.coverage.news_event_severity_in_canonical_status, false);

const forbiddenContextKeys = new Set([
  "recommendation",
  "action_alerts",
  "event_alerts",
  "ai_summary",
  "action_plan",
  "target_allocation_pct",
  "stop_or_exit",
  "take_profit",
  "suggestedTrimRange",
  "suggestedBuyAmount",
  "buy_more",
  "health_label",
]);
function assertNoForbiddenKeys(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!forbiddenContextKeys.has(key), `Forbidden Ask context key: ${key}`);
    assertNoForbiddenKeys(item);
  }
}
assertNoForbiddenKeys(ask);
assert.equal(ask.holdings[0].saved_target_reference, 130);
assert.equal(ask.holdings[0].saved_risk_reference, 70);

const changedPnlFacts = facts();
changedPnlFacts.holdings = changedPnlFacts.holdings.map((holding) => ({
  ...holding,
  entry_price: holding.ticker === "AAPL" ? 250 : 20,
}));
const changedPnl = askContext(changedPnlFacts);
assert.equal(changedPnl.canonical_assessment.status, ask.canonical_assessment.status);
assert.deepEqual(
  changedPnl.canonical_assessment.attention_order,
  ask.canonical_assessment.attention_order,
);
assert.notEqual(
  changedPnl.factual_summary.unrealised_pnl_percent,
  ask.factual_summary.unrealised_pnl_percent,
);

const partialFacts = facts();
partialFacts.rankings = partialFacts.rankings.map((ranking) =>
  ranking.ticker === "MSFT" ? { ...ranking, price: null } : ranking,
);
const partial = askContext(partialFacts);
const partialMsft = partial.holdings.find((holding) => holding.ticker === "MSFT");
assert.equal(partial.factual_summary.valuation_state, "partial");
assert.equal(partial.factual_summary.total_value, null);
assert.equal(partialMsft?.current_value, null);

const unsupportedFacts = facts();
unsupportedFacts.rankings = unsupportedFacts.rankings.filter(
  (ranking) => ranking.ticker !== "MSFT",
);
const unsupported = askContext(unsupportedFacts);
const unsupportedMsft = unsupported.holdings.find(
  (holding) => holding.ticker === "MSFT",
);
assert.equal(unsupportedMsft?.coverage, "unsupported");
assert.equal(unsupportedMsft?.current_rank, null);
assert.equal(unsupportedMsft?.current_score, null);

const limited = askContext(facts("GBP"));
assert.equal(limited.canonical_assessment.availability, "limited");
assert.equal(limited.canonical_assessment.status, null);
assert.equal(limited.canonical_assessment.status_label, "Analysis limited");
assert.deepEqual(limited.canonical_assessment.reasons, []);
assert.ok(
  limited.holdings.every(
    (holding) =>
      holding.canonical_assessment.status === null &&
      holding.canonical_assessment.reasons.length === 0,
  ),
);
assert.equal(limited.factual_summary.total_value, null);

const routeSource = source("app/api/ask-stockgpt/route.ts");
const helperSource = source("lib/ask-stockgpt-portfolio-context.ts");
const askUiSource = source("components/AskStockGPTWorkspace.tsx");
const activeAskSource = `${routeSource}\n${helperSource}`;
const buildContextSource = getFunctionSource(routeSource, "buildAppContext");

assert.doesNotMatch(
  activeAskSource,
  /from\s+["'][^"']*(?:portfolio-alerts|portfolio-action-engine|portfolio-trim-recommendation)[^"']*["']/,
);
assert.doesNotMatch(routeSource, /\benrichHoldings\s*\(/);
assert.match(routeSource, /assessCurrentPortfolioIntelligenceFacts|buildAskStockGPTPortfolioContext/);
assert.match(buildContextSource, /\.eq\("user_id", userId\)/);
assert.match(buildContextSource, /risk_level_at_entry,target_level_at_entry/);
assert.match(
  buildContextSource,
  /ticker,company,sector,score,rank,price,last_price_update,last_ranking_update/,
);
assert.match(buildContextSource, /stock_factor_diagnostics/);
assert.match(buildContextSource, /ticker,current_score,previous_score,updated_at/);
assert.match(buildContextSource, /select\("rank", \{ count: "exact", head: true \}\)/);
assert.match(buildContextSource, /\.not\("rank", "is", null\)/);
assert.doesNotMatch(buildContextSource, /\b500\b/);
assert.match(routeSource, /const contextAsOf = new Date\(\)\.toISOString\(\)/);
assert.match(
  routeSource,
  /buildAppContext\([\s\S]*?requestedContext,[\s\S]*?contextAsOf,[\s\S]*?\)/,
);
assert.match(routeSource, /data_as_of: asOf/);
assert.match(
  routeSource,
  /server-verified; source freshness is included in the data/,
);
assert.doesNotMatch(routeSource, /context \(live, server-verified\)/);
assert.doesNotMatch(routeSource, /console\.(?:log|info|debug)\([^\n]*(?:context|focusedContext)/);
assert.doesNotMatch(routeSource, /\.select\([^\n]*notes/);
assert.match(routeSource, /owns_stock: verifiedHoldings\.length > 0/);
assert.doesNotMatch(routeSource, /requestedContext\?\.ownsStock/);
assert.match(
  routeSource,
  /other_portfolios:[\s\S]*?\.map\(\(portfolio, index\) => \(\{ name:/,
);
assert.match(routeSource, /news_context:/);
assert.doesNotMatch(buildContextSource, /events:\s*\[[^\]]/);

function getFunctionSource(contents: string, name: string) {
  const start = contents.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = contents.indexOf("\nasync function ", start + 1);
  return contents.slice(start, next === -1 ? contents.length : next);
}

for (const label of ["On track", "Monitor", "Review", "Urgent review"]) {
  assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, new RegExp(label));
}
assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, /authoritative assessment/i);
assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, /P&L alone is not a canonical review reason/);
assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, /news is separate research context/i);
assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, /do not make that transaction decision/i);
assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, /Do not recommend a transaction amount or percentage/i);
assert.match(ASK_STOCKGPT_SYSTEM_PROMPT, /general educational terms/i);
assert.doesNotMatch(ASK_STOCKGPT_SYSTEM_PROMPT, /Action alerts outrank event alerts/i);
assert.doesNotMatch(ASK_STOCKGPT_SYSTEM_PROMPT, /distinguish hold, review, trim, sell/i);
assert.doesNotMatch(askUiSource, /Portfolio coach|StockGPT Coach|portfolio coaching/i);

console.log("Ask canonical portfolio checks passed.");
