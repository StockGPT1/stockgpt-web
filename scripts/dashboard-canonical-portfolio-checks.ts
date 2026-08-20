import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CURRENT_EVENT_LIMITATION,
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentPortfolioIntelligenceFacts,
} from "../lib/current-portfolio-intelligence/index";
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
      cash_balance: 20,
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
        source: "manual",
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

function portfolioPathView(inputFacts: CurrentPortfolioIntelligenceFacts) {
  const current = assessCurrentPortfolioIntelligenceFacts(inputFacts, AS_OF);
  return {
    current,
    view: buildPortfolioIntelligenceView({
      result: current.assessment,
      adapterLimitations: current.adapterLimitations,
    }),
  };
}

const portfolio = portfolioPathView(facts());
const dashboard = buildDashboardPortfolioIntelligence(facts(), AS_OF);
assert.equal(dashboard.status, portfolio.view.status);
assert.deepEqual(
  dashboard.reasons.map((reason) => reason.code),
  portfolio.view.reasons.map((reason) => reason.code),
);
assert.deepEqual(dashboard.countsByStatus, portfolio.view.countsByStatus);
assert.deepEqual(dashboard.attentionOrder, portfolio.view.attentionOrder);
assert.equal(dashboard.availability, portfolio.view.availability);
assert.equal(dashboard.statusLabel, portfolio.view.statusLabel);
assert.ok(
  portfolio.current.adapterLimitations.includes(CURRENT_EVENT_LIMITATION),
);
assert.deepEqual(portfolio.current.input.holdings[0].events, []);

const limitedPortfolio = portfolioPathView(facts("GBP"));
const limitedDashboard = buildDashboardPortfolioIntelligence(
  facts("GBP"),
  AS_OF,
);
assert.equal(limitedDashboard.availability, "limited");
assert.equal(limitedDashboard.status, null);
assert.equal(limitedDashboard.statusLabel, "Analysis limited");
assert.deepEqual(limitedDashboard, limitedPortfolio.view);

const changedEntryPrices = facts();
changedEntryPrices.holdings = changedEntryPrices.holdings.map((holding) => ({
  ...holding,
  entry_price: holding.entry_price === 80 ? 200 : 25,
}));
const pnlChanged = buildDashboardPortfolioIntelligence(
  changedEntryPrices,
  AS_OF,
);
assert.equal(pnlChanged.status, dashboard.status);
assert.deepEqual(pnlChanged.countsByStatus, dashboard.countsByStatus);
assert.deepEqual(pnlChanged.attentionOrder, dashboard.attentionOrder);

const helperSource = source("lib/dashboard-portfolio.ts");
const getMainSource = helperSource.slice(
  helperSource.indexOf("export async function getDashboardMainPortfolio"),
);
const pageSource = source("app/dashboard/page.tsx");
const mobileSource = source("components/MobileDashboardExperience.tsx");
const desktopSource = source("components/DesktopDashboardExperience.tsx");
const hoverSource = source("components/DashboardPortfolioHoverWidget.tsx");
const activeDashboardSource = [pageSource, mobileSource, desktopSource, hoverSource].join("\n");

assert.match(getMainSource, /\.eq\("user_id", userId\)/);
assert.match(getMainSource, /risk_level_at_entry,target_level_at_entry/);
assert.match(
  getMainSource,
  /ticker,score,rank,price,last_price_update,last_ranking_update/,
);
assert.match(getMainSource, /stock_factor_diagnostics/);
assert.match(getMainSource, /ticker,current_score,previous_score,updated_at/);
assert.match(
  getMainSource,
  /select\("rank", \{ count: "exact", head: true \}\)/,
);
assert.match(getMainSource, /\.not\("rank", "is", null\)/);
assert.match(getMainSource, /buildDashboardPortfolioIntelligence/);
assert.doesNotMatch(getMainSource, /buildPortfolioOpportunities\(/);
assert.doesNotMatch(getMainSource, /\b500\b/);
assert.doesNotMatch(getMainSource, /news_articles|worldNews|eventAlerts/);

assert.match(pageSource, /const intelligenceAsOf = new Date\(\)\.toISOString\(\)/);
assert.match(
  pageSource,
  /getDashboardMainPortfolio\([\s\S]*?intelligenceAsOf,[\s\S]*?\)/,
);
assert.match(pageSource, /portfolioIntelligence/);
assert.doesNotMatch(pageSource, /DashboardPortfolioOpportunity|opportunities=/);

for (const migratedSource of [mobileSource, desktopSource, hoverSource]) {
  assert.doesNotMatch(
    migratedSource,
    /summary\.(?:label|actionAlerts|eventAlerts|explanation)/,
  );
  assert.doesNotMatch(migratedSource, /assessPortfolioIntelligence\(/);
}
assert.doesNotMatch(
  activeDashboardSource.replaceAll(".trim()", ""),
  /DashboardPortfolioOpportunity|buildPortfolioOpportunities|derivePortfolioHoldingAction/,
);
for (const legacyCategory of [
  "Add-more candidate",
  "Alternative to review",
  "Review existing holding",
]) {
  assert.doesNotMatch(activeDashboardSource, new RegExp(legacyCategory));
}

assert.match(mobileSource, /Portfolio status: \$\{intelligence\.statusLabel\}/);
assert.match(mobileSource, /countsByStatus\.review/);
assert.match(mobileSource, /countsByStatus\.urgent_review/);
assert.match(mobileSource, /countsByStatus\.monitor/);
assert.match(mobileSource, /const PANELS = \["Portfolio", "Current signals"\]/);
assert.match(mobileSource, /aria-label=\{`1 of \$\{PANELS\.length\}, Portfolio`\}/);
assert.match(mobileSource, /aria-label=\{`2 of \$\{PANELS\.length\}, Current signals`\}/);
assert.doesNotMatch(mobileSource, /What changed|became active|none is marked urgent/);
assert.match(mobileSource, /canUsePremium && intelligence/);
assert.match(mobileSource, /Health · \{canUsePremium \?/);

assert.match(desktopSource, /Portfolio status: \$\{intelligence\.statusLabel\}/);
assert.match(desktopSource, /Current portfolio signals/);
assert.match(desktopSource, /Explore the latest rankings/);
assert.match(hoverSource, /Status · \{canUsePremium && intelligence/);
assert.match(
  hoverSource,
  /Health · \{canUsePremium \? `\$\{summary\.score\}\/100` : "Locked"\}/,
);
assert.doesNotMatch(activeDashboardSource, /news.*(?:canonical|portfolio status)/i);
assert.doesNotMatch(
  activeDashboardSource,
  /canonical_event_severity_source_unmapped/,
  "Internal event limitation codes must not be rendered to customers",
);
assert.doesNotMatch(
  activeDashboardSource.replaceAll(".trim()", ""),
  /\b(?:buy|sell|trim|add-more|reinvest)\b/i,
  "Canonical Dashboard presentation must not generate transaction recommendations",
);

console.log("Dashboard canonical portfolio checks passed.");
