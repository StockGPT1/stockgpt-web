import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPortfolioHealthSummary } from "../lib/portfolio-health";
import {
  assessPortfolioPerformanceAvailability,
  PORTFOLIO_PERFORMANCE_UNAVAILABLE_MESSAGE,
} from "../lib/portfolio-performance-availability";
import { applyPortfolioPerformanceAvailabilityToChart } from "../lib/portfolio-page-chart";

const ordinaryActivity = [
  { type: "deposit", notes: "Current cash deposit." },
  { type: "withdrawal", notes: "Current cash withdrawal." },
  { type: "buy", notes: "Portfolio-cash purchase." },
  { type: "sell", notes: "Partial holding sale." },
  { type: "log_existing", notes: "External holding added." },
  { type: "import", notes: "Trading 212 current holdings state initialized; cash and historical executions were not imported." },
];
assert.deepEqual(assessPortfolioPerformanceAvailability(ordinaryActivity), {
  status: "available",
  limitations: [],
});

const continuityCases = [
  [{ type: "adjustment", notes: "Holding facts corrected." }, "holding_correction"],
  [{ type: "adjustment", notes: "Holding removed from tracking; no sale recorded." }, "holding_removed_from_tracking"],
  [{
    type: "import",
    notes: "Tracked holdings replaced from Trading 212 CSV; cash, net contribution and prior ledger history were preserved.",
  }, "trading212_holdings_replacement"],
] as const;

for (const [transaction, expectedReason] of continuityCases) {
  const availability = assessPortfolioPerformanceAvailability([transaction]);
  assert.equal(availability.status, "unavailable");
  assert(availability.limitations.includes(expectedReason));
}

const corrected = buildPortfolioHealthSummary({
  name: "Corrected synthetic Portfolio",
  holdings: [],
  cashBalance: 250,
  cashDepositedTotal: 410,
  transactions: [
    { type: "sell", realisedPnl: 80 },
    { type: "adjustment", notes: "Holding facts corrected." },
  ],
});
assert.equal(corrected.totalPnl, null, "Aggregate Total P&L must be unavailable after continuity breaks");
assert.equal(corrected.totalPnlPct, null, "Aggregate return must be unavailable after continuity breaks");
assert.equal(corrected.realisedPnl, 80, "Recorded realised P&L remains a separate fact");

const normal = buildPortfolioHealthSummary({
  name: "Continuous synthetic Portfolio",
  holdings: [],
  cashBalance: 120,
  cashDepositedTotal: 100,
  transactions: [{ type: "sell", realisedPnl: 20 }],
});
assert.equal(normal.performanceAvailability.status, "available");
assert.equal(normal.totalPnl, 20);
assert.equal(normal.totalPnlPct, 20);

const valueChart = applyPortfolioPerformanceAvailabilityToChart({
  MAX: [{ date: "2026-09-07T12:00:00.000Z", close: 250, basis: 410, pnl: -160, pnlPct: -39.0244 }],
}, corrected.performanceAvailability);
assert.equal(valueChart.MAX?.[0]?.close, 250, "Current Portfolio value must remain chartable");
assert.equal(valueChart.MAX?.[0]?.pnl, undefined, "Chart performance must be suppressed after continuity breaks");
assert.equal(valueChart.MAX?.[0]?.pnlPct, undefined, "Chart return percentage must be suppressed after continuity breaks");

for (const file of [
  "components/portfolio-workspace/PortfolioStage.tsx",
  "components/portfolio-workspace/PortfolioOverview.tsx",
  "components/DashboardPortfolioHoverWidget.tsx",
  "components/DesktopDashboardExperience.tsx",
  "components/MobileDashboardExperience.tsx",
]) {
  const source = readFileSync(file, "utf8");
  assert(source.includes("performanceAvailability"), `${file} must honor aggregate-performance availability`);
}
assert(PORTFOLIO_PERFORMANCE_UNAVAILABLE_MESSAGE.includes("reliable since-inception return"));
const domainSource = readFileSync("lib/portfolio-performance-availability.ts", "utf8");
for (const canonicalStatus of ["on_track", "monitor", "review", "urgent_review"]) {
  assert(!domainSource.includes(canonicalStatus), "Performance availability must not become a fifth canonical status");
}

console.log("Stage 05 performance-continuity availability checks passed.");
