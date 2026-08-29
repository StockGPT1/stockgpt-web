import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const notifications = source("lib/notifications.ts");
const notificationBuilder = source("lib/canonical-notifications.ts");
const notificationUi = source("components/NotificationsList.tsx");
const portfolioPage = source("app/portfolio/modern/page.tsx");
const dashboard = source("lib/dashboard-portfolio.ts");
const dashboardPage = source("app/dashboard/page.tsx");
const askRoute = source("app/api/ask-stockgpt/route.ts");
const askContext = source("lib/ask-stockgpt-portfolio-context.ts");
const cacheWarm = source("app/api/portfolio-cache/warm/route.ts");
const portfolioWorkspace = source("components/portfolio-workspace/PortfolioModernWorkspace.tsx");
const canonicalConstants = source("lib/portfolio-intelligence/constants.ts");

assert.doesNotMatch(
  `${notifications}\n${notificationBuilder}`,
  /portfolio-alerts|portfolio-action-engine|portfolio-trim-recommendation|\benrichHoldings\s*\(/,
);
assert.match(notificationBuilder, /assessCurrentPortfolioIntelligenceFacts/);
assert.match(notificationBuilder, /buildPortfolioIntelligenceView/);
assert.doesNotMatch(notificationBuilder, /events:\s*\[[^\]]/);
assert.doesNotMatch(notificationBuilder, /recommendation\s*:/);
assert.doesNotMatch(notificationUi, /notification\.recommendation|StockGPTView/);

assert.doesNotMatch(
  `${portfolioPage}\n${portfolioWorkspace}`,
  /portfolio-action-engine|portfolio-trim-recommendation|buildPortfolioTrimRecommendation|derivePortfolioHoldingAction/,
);
assert.doesNotMatch(
  dashboardPage,
  /DashboardPortfolioOpportunity|buildPortfolioOpportunities|derivePortfolioHoldingAction/,
);
assert.doesNotMatch(
  `${askRoute}\n${askContext}`,
  /portfolio-alerts|portfolio-action-engine|portfolio-trim-recommendation|\benrichHoldings\s*\(/,
);

for (const activeCanonicalSource of [
  portfolioPage,
  dashboard,
  askContext,
  notificationBuilder,
]) {
  assert.match(activeCanonicalSource, /assessCurrentPortfolioIntelligenceFacts/);
}

const activeStatusSources = [
  source("components/portfolio-workspace/PortfolioStage.tsx"),
  source("components/portfolio-workspace/PortfolioOverview.tsx"),
  source("components/DesktopDashboardExperience.tsx"),
  source("components/MobileDashboardExperience.tsx"),
  notificationUi,
  askContext,
].join("\n");
for (const competingStatus of ["Strong contributor", "Under pressure", "Oversized", "Review size", "High risk"]) {
  assert.doesNotMatch(activeStatusSources, new RegExp(competingStatus));
}

assert.match(cacheWarm, /savePortfolioPageSnapshot/);
assert.match(cacheWarm, /enrichHoldingsAdmin/);
for (const canonicalConsumer of [portfolioPage, dashboard, askRoute, notifications]) {
  assert.doesNotMatch(
    canonicalConsumer,
    /getPortfolioPageSnapshot|portfolio_page_snapshots|portfolio-speed-cache/,
  );
}

assert.match(canonicalConstants, /conservative: 20/);
assert.match(canonicalConstants, /moderate: 25/);
assert.match(canonicalConstants, /aggressive: 30/);
assert.match(canonicalConstants, /reviewRankPercentilePoints: 20/);
assert.match(canonicalConstants, /reviewScoreDeclinePct: 20/);
assert.match(canonicalConstants, /reviewDeclinePct: 15/);

assert.match(portfolioPage, /buildPortfolioIntelligenceView/);
assert.match(dashboard, /buildDashboardPortfolioIntelligence/);
assert.match(askContext, /canonical_assessment/);
assert.match(notificationBuilder, /canonical_review/);
assert.doesNotMatch(notificationUi, /look stable|all news is included/i);
assert.match(notificationUi, /temporarily unavailable/);
assert.match(notificationUi, /not been replaced or presented as all clear/);

const deferredLegacySources = [
  "lib/portfolio-alerts.ts",
  "lib/portfolio-action-engine.ts",
  "lib/portfolio-trim-recommendation.ts",
  "app/api/portfolio-cache/warm/route.ts",
];
for (const deferred of deferredLegacySources) {
  assert.ok(fs.existsSync(path.join(ROOT, deferred)), `${deferred} must remain explicitly accounted for`);
}

console.log("Stage 04 acceptance source-contract checks passed.");
