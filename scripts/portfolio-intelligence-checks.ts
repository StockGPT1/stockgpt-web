import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assessPortfolioIntelligence,
  type HoldingAssessment,
  type HoldingIntelligenceInput,
  type PortfolioIntelligenceInput,
  type PortfolioIntelligenceResult,
  type ReasonCode,
} from "../lib/portfolio-intelligence/index";

const AS_OF = "2026-08-19T12:00:00.000Z";
const FRESH = "2026-08-19T10:00:00.000Z";
const EXACTLY_96_HOURS = "2026-08-15T12:00:00.000Z";
const OVER_96_HOURS = "2026-08-15T11:59:59.999Z";
const EXACTLY_14_DAYS = "2026-08-05T12:00:00.000Z";
const OVER_14_DAYS = "2026-08-05T11:59:59.999Z";

type RankingInput = NonNullable<HoldingIntelligenceInput["ranking"]>;
type DiagnosticInput = NonNullable<HoldingIntelligenceInput["diagnostics"]>;
type HoldingOverrides = Partial<
  Omit<HoldingIntelligenceInput, "market" | "ranking" | "diagnostics">
> & {
  market?: Partial<HoldingIntelligenceInput["market"]>;
  ranking?: Partial<RankingInput> | null;
  diagnostics?: Partial<DiagnosticInput> | null;
};

function holding(
  instrumentKey: string,
  overrides: HoldingOverrides = {},
): HoldingIntelligenceInput {
  const base: HoldingIntelligenceInput = {
    instrumentKey,
    ticker: instrumentKey,
    coverage: "ranked",
    provenance: "manual",
    currentValue: 100,
    costBasis: 100,
    shares: 1,
    unrealisedPnlPct: 0,
    market: {
      currentPrice: 100,
      savedRiskLevel: null,
      priceAsOf: FRESH,
    },
    ranking: {
      currentScore: 100,
      scoreAtEntry: 100,
      currentRank: 10,
      rankAtEntry: 10,
      universeSize: 101,
      asOf: FRESH,
    },
    diagnostics: null,
    events: [],
  };

  return {
    ...base,
    ...overrides,
    market: { ...base.market, ...overrides.market },
    ranking:
      overrides.ranking === null
        ? null
        : { ...base.ranking, ...overrides.ranking } as RankingInput,
    diagnostics:
      overrides.diagnostics === null || overrides.diagnostics === undefined
        ? overrides.diagnostics ?? base.diagnostics
        : {
            currentScore: 100,
            previousScore: 100,
            asOf: FRESH,
            ...overrides.diagnostics,
          },
    events: overrides.events ?? base.events,
  };
}

function assess(
  holdings: HoldingIntelligenceInput[],
  overrides: Partial<PortfolioIntelligenceInput["portfolio"]> & {
    asOf?: string;
  } = {},
): PortfolioIntelligenceResult {
  return assessPortfolioIntelligence({
    asOf: overrides.asOf ?? AS_OF,
    portfolio: {
      id: overrides.id ?? "portfolio-fixture",
      riskTolerance: overrides.riskTolerance ?? "moderate",
      objective: overrides.objective ?? null,
      timeHorizon: overrides.timeHorizon ?? null,
      cashValue: overrides.cashValue ?? 900,
    },
    holdings,
  });
}

function assessment(
  result: PortfolioIntelligenceResult,
  instrumentKey: string,
): HoldingAssessment {
  const match = result.portfolio.holdingAssessments.find(
    (item) => item.instrumentKey === instrumentKey,
  );
  assert.ok(match, `Missing assessment for ${instrumentKey}`);
  return match;
}

function hasReason(
  item: HoldingAssessment | PortfolioIntelligenceResult["portfolio"],
  code: ReasonCode,
) {
  return item.reasons.some((reason) => reason.code === code);
}

function reasonCount(item: HoldingAssessment, code: ReasonCode) {
  return item.reasons.filter((reason) => reason.code === code).length;
}

// 1. Healthy, diversified and fully fresh facts remain on track.
{
  const result = assess(
    ["A", "B", "C", "D"].map((key) => holding(key)),
    { cashValue: 600 },
  );
  assert.equal(result.portfolio.status, "on_track");
  assert.equal(result.portfolio.reasons.length, 0);
}

// 2. An empty portfolio has an explicit monitor reason.
{
  const result = assess([], { cashValue: 0 });
  assert.equal(result.portfolio.status, "monitor");
  assert.equal(result.portfolio.valuation.state, "empty");
  assert.ok(hasReason(result.portfolio, "portfolio_empty"));
}

// 3-7. Concentration boundaries use total portfolio value and never self-escalate.
for (const fixture of [
  { name: "conservative-monitor", risk: "conservative", value: 16, cash: 84, status: "monitor" },
  { name: "conservative-review", risk: "conservative", value: 20, cash: 80, status: "review" },
  { name: "moderate-review", risk: "moderate", value: 25, cash: 75, status: "review" },
  { name: "aggressive-review", risk: "aggressive", value: 30, cash: 70, status: "review" },
  { name: "concentration-only", risk: "conservative", value: 99, cash: 1, status: "review" },
] as const) {
  const item = assessment(
    assess(
      [
        holding(fixture.name, {
          currentValue: fixture.value,
          market: { currentPrice: fixture.value },
        }),
      ],
      { riskTolerance: fixture.risk, cashValue: fixture.cash },
    ),
    fixture.name,
  );
  assert.equal(item.status, fixture.status);
  assert.ok(hasReason(item, "position_concentration"));
  assert.notEqual(item.status, "urgent_review");
}

// 8. Cash changes the concentration denominator.
{
  const withoutCash = assessment(
    assess([holding("CASH-DENOM", { currentValue: 20 })], { cashValue: 0 }),
    "CASH-DENOM",
  );
  const withCash = assessment(
    assess([holding("CASH-DENOM", { currentValue: 20 })], { cashValue: 80 }),
    "CASH-DENOM",
  );
  assert.equal(withoutCash.allocation.pctOfTotalPortfolio, 100);
  assert.equal(withCash.allocation.pctOfTotalPortfolio, 20);
  assert.equal(withoutCash.status, "review");
  assert.equal(withCash.status, "monitor");
}

// 9. Partial valuation never creates concentration from a partial denominator.
{
  const result = assess(
    [
      holding("KNOWN", { currentValue: 100 }),
      holding("UNKNOWN", { currentValue: null }),
    ],
    { cashValue: 100 },
  );
  assert.equal(result.portfolio.valuation.state, "partial");
  assert.equal(
    assessment(result, "KNOWN").allocation.pctOfTotalPortfolio,
    null,
  );
  assert.equal(
    assessment(result, "UNKNOWN").allocation.pctOfTotalPortfolio,
    null,
  );
  assert.equal(hasReason(assessment(result, "KNOWN"), "position_concentration"), false);
  assert.ok(hasReason(assessment(result, "UNKNOWN"), "data_missing"));
}

// 10-15. Ranking and score deterioration use the approved exact boundaries.
for (const fixture of [
  { name: "rank-monitor", currentRank: 9, score: 100, status: "monitor" },
  { name: "rank-review", currentRank: 21, score: 100, status: "review" },
  { name: "score-monitor", currentRank: 1, score: 92, status: "monitor" },
  { name: "score-review", currentRank: 1, score: 80, status: "review" },
  { name: "combined-review", currentRank: 13, score: 90, status: "review" },
] as const) {
  const item = assessment(
    assess([
      holding(fixture.name, {
        ranking: {
          currentRank: fixture.currentRank,
          rankAtEntry: 1,
          universeSize: 101,
          currentScore: fixture.score,
          scoreAtEntry: 100,
        },
      }),
    ]),
    fixture.name,
  );
  assert.equal(item.status, fixture.status);
  assert.ok(hasReason(item, "ranking_deterioration"));
}
{
  const improving = assessment(
    assess([
      holding("IMPROVING", {
        ranking: {
          currentRank: 1,
          rankAtEntry: 21,
          currentScore: 110,
          scoreAtEntry: 100,
        },
      }),
    ]),
    "IMPROVING",
  );
  assert.equal(improving.status, "on_track");
  assert.equal(hasReason(improving, "ranking_deterioration"), false);
}

// 16. Stale rankings cannot create a deterioration reason.
{
  const item = assessment(
    assess([
      holding("STALE-RANKING", {
        ranking: {
          currentRank: 80,
          rankAtEntry: 1,
          currentScore: 40,
          scoreAtEntry: 100,
          asOf: OVER_96_HOURS,
        },
      }),
    ]),
    "STALE-RANKING",
  );
  assert.equal(item.status, "monitor");
  assert.ok(hasReason(item, "data_stale"));
  assert.equal(hasReason(item, "ranking_deterioration"), false);
}

// 17-20. Diagnostics are supplementary and respect freshness.
for (const fixture of [
  { name: "DIAG-MONITOR", currentScore: 92, status: "monitor" },
  { name: "DIAG-REVIEW", currentScore: 85, status: "review" },
] as const) {
  const item = assessment(
    assess([
      holding(fixture.name, {
        diagnostics: { currentScore: fixture.currentScore, previousScore: 100 },
      }),
    ]),
    fixture.name,
  );
  assert.equal(item.status, fixture.status);
  assert.ok(hasReason(item, "diagnostic_deterioration"));
}
{
  const missing = assessment(assess([holding("NO-DIAGNOSTICS")]), "NO-DIAGNOSTICS");
  assert.equal(missing.status, "on_track");
  assert.equal(hasReason(missing, "data_missing"), false);

  const stale = assessment(
    assess([
      holding("STALE-DIAGNOSTICS", {
        diagnostics: {
          currentScore: 70,
          previousScore: 100,
          asOf: OVER_96_HOURS,
        },
      }),
    ]),
    "STALE-DIAGNOSTICS",
  );
  assert.equal(stale.status, "on_track");
  assert.deepEqual(stale.dataLimitations, ["diagnostics_stale"]);
  assert.equal(hasReason(stale, "diagnostic_deterioration"), false);
}

// 21-24. Events use structured severity and the exact 14-day window.
{
  const medium = assessment(
    assess([
      holding("MEDIUM-EVENT", {
        events: [{ kind: "earnings", severity: "medium", occurredAt: FRESH, source: "fixture" }],
      }),
    ]),
    "MEDIUM-EVENT",
  );
  assert.equal(medium.status, "monitor");
  assert.ok(hasReason(medium, "event_risk"));

  const high = assessment(
    assess([
      holding("HIGH-EVENT", {
        events: [{ kind: "filing", severity: "high", occurredAt: FRESH, source: "fixture" }],
      }),
    ]),
    "HIGH-EVENT",
  );
  assert.equal(high.status, "review");

  const repeated = assessment(
    assess([
      holding("REPEATED-EVENT", {
        events: [
          { kind: "news-a", severity: "medium", occurredAt: FRESH, source: "fixture" },
          { kind: "news-b", severity: "medium", occurredAt: FRESH, source: "fixture" },
          { kind: "news-c", severity: "medium", occurredAt: FRESH, source: "fixture" },
        ],
      }),
    ]),
    "REPEATED-EVENT",
  );
  assert.equal(repeated.status, "monitor");
  assert.equal(reasonCount(repeated, "event_risk"), 1);

  const expired = assessment(
    assess([
      holding("EXPIRED-EVENT", {
        events: [{ kind: "old", severity: "high", occurredAt: OVER_14_DAYS, source: "fixture" }],
      }),
    ]),
    "EXPIRED-EVENT",
  );
  assert.equal(expired.status, "on_track");
  assert.equal(hasReason(expired, "event_risk"), false);
}

// 25-26. Limited coverage never fabricates ranking weakness.
for (const coverage of ["tracked_only", "unsupported"] as const) {
  const item = assessment(
    assess([holding(coverage, { coverage, ranking: null })]),
    coverage,
  );
  assert.equal(item.status, "monitor");
  assert.ok(hasReason(item, "instrument_coverage_limited"));
  assert.equal(hasReason(item, "ranking_deterioration"), false);
}

// 27-28. Performance context alone never affects status.
for (const [key, pnl] of [["POSITIVE-PNL", 85], ["NEGATIVE-PNL", -85]] as const) {
  const item = assessment(
    assess([holding(key, { unrealisedPnlPct: pnl })]),
    key,
  );
  assert.equal(item.status, "on_track");
  assert.equal(item.reasons.length, 0);
}

// 29-33. Urgent review requires the approved independent corroboration.
{
  const savedOnly = assessment(
    assess([
      holding("SAVED-ONLY", {
        currentValue: 90,
        market: { currentPrice: 90, savedRiskLevel: 100 },
      }),
    ]),
    "SAVED-ONLY",
  );
  assert.equal(savedOnly.status, "review");

  const savedAndRanking = assessment(
    assess([
      holding("SAVED-AND-RANKING", {
        currentValue: 90,
        market: { currentPrice: 90, savedRiskLevel: 100 },
        ranking: { currentRank: 21, rankAtEntry: 1 },
      }),
    ]),
    "SAVED-AND-RANKING",
  );
  assert.equal(savedAndRanking.status, "urgent_review");

  const threeCategories = assessment(
    assess([
      holding("THREE-CATEGORIES", {
        ranking: { currentRank: 21, rankAtEntry: 1 },
        diagnostics: { currentScore: 85, previousScore: 100 },
        events: [{ kind: "filing", severity: "high", occurredAt: FRESH, source: "fixture" }],
      }),
    ]),
    "THREE-CATEGORIES",
  );
  assert.equal(threeCategories.status, "urgent_review");

  const twoCategories = assessment(
    assess([
      holding("TWO-CATEGORIES", {
        ranking: { currentRank: 21, rankAtEntry: 1 },
        diagnostics: { currentScore: 85, previousScore: 100 },
      }),
    ]),
    "TWO-CATEGORIES",
  );
  assert.equal(twoCategories.status, "review");

  const concentrationWithLimitations = assessment(
    assess(
      [
        holding("LIMITED-CONCENTRATION", {
          coverage: "tracked_only",
          ranking: null,
          currentValue: 90,
          market: { currentPrice: 90, priceAsOf: OVER_96_HOURS },
        }),
      ],
      { riskTolerance: "conservative", cashValue: 10 },
    ),
    "LIMITED-CONCENTRATION",
  );
  assert.equal(concentrationWithLimitations.status, "review");
  assert.equal(hasReason(concentrationWithLimitations, "position_concentration"), true);
  assert.equal(hasReason(concentrationWithLimitations, "data_stale"), true);
  assert.equal(hasReason(concentrationWithLimitations, "instrument_coverage_limited"), true);
}

// 34. Stale market evidence blocks a saved-risk comparison.
{
  const item = assessment(
    assess([
      holding("STALE-MARKET", {
        currentValue: 90,
        market: {
          currentPrice: 90,
          savedRiskLevel: 100,
          priceAsOf: OVER_96_HOURS,
        },
      }),
    ]),
    "STALE-MARKET",
  );
  assert.equal(item.status, "monitor");
  assert.ok(hasReason(item, "data_stale"));
  assert.equal(hasReason(item, "saved_risk_level_breached"), false);
}

// 35. Exactly 96 hours is fresh; anything older is stale.
{
  const exact = assessment(
    assess([
      holding("EXACT-96", {
        market: { priceAsOf: EXACTLY_96_HOURS },
        ranking: { asOf: EXACTLY_96_HOURS },
      }),
    ]),
    "EXACT-96",
  );
  assert.equal(exact.freshness.marketPrice, "fresh");
  assert.equal(exact.freshness.ranking, "fresh");

  const over = assessment(
    assess([
      holding("OVER-96", { market: { priceAsOf: OVER_96_HOURS } }),
    ]),
    "OVER-96",
  );
  assert.equal(over.freshness.marketPrice, "stale");
}

// 36. Exactly 14 days is current; anything older is expired.
{
  const exact = assessment(
    assess([
      holding("EXACT-14", {
        events: [{ kind: "current", severity: "medium", occurredAt: EXACTLY_14_DAYS, source: "fixture" }],
      }),
    ]),
    "EXACT-14",
  );
  assert.ok(hasReason(exact, "event_risk"));

  const over = assessment(
    assess([
      holding("OVER-14", {
        events: [{ kind: "expired", severity: "high", occurredAt: OVER_14_DAYS, source: "fixture" }],
      }),
    ]),
    "OVER-14",
  );
  assert.equal(hasReason(over, "event_risk"), false);
}

// 37. Unknown risk tolerance uses the moderate cap and records the default.
{
  const result = assess(
    [holding("DEFAULT-RISK", { currentValue: 25, market: { currentPrice: 25 } })],
    { riskTolerance: "not-configured", cashValue: 75 },
  );
  assert.equal(assessment(result, "DEFAULT-RISK").status, "review");
  assert.ok(result.portfolio.dataLimitations.includes("risk_tolerance_defaulted"));
}

// 38. Provenance does not alter assessment semantics.
{
  const results = (["manual", "csv", "broker"] as const).map((provenance) =>
    assess([holding("PROVIDER-NEUTRAL", { provenance })]),
  );
  assert.equal(JSON.stringify(results[0]), JSON.stringify(results[1]));
  assert.equal(JSON.stringify(results[1]), JSON.stringify(results[2]));
}

// 39. Attention ordering follows severity, reason counts and instrument key.
{
  const result = assess(
    [
      holding("ON-TRACK"),
      holding("MON-B", { coverage: "tracked_only", ranking: null }),
      holding("MON-A", {
        events: [{ kind: "news", severity: "medium", occurredAt: FRESH, source: "fixture" }],
      }),
      holding("REVIEW", {
        events: [{ kind: "filing", severity: "high", occurredAt: FRESH, source: "fixture" }],
      }),
      holding("URGENT", {
        currentValue: 90,
        market: { currentPrice: 90, savedRiskLevel: 100 },
        ranking: { currentRank: 21, rankAtEntry: 1 },
      }),
    ],
    { cashValue: 2000 },
  );
  assert.deepEqual(result.portfolio.attentionOrder, [
    "URGENT",
    "REVIEW",
    "MON-A",
    "MON-B",
    "ON-TRACK",
  ]);
  assert.deepEqual(
    result.portfolio.holdingAssessments.map((item) => item.attentionRank),
    [1, 2, 3, 4, 5],
  );
}

// 40-41. Portfolio aggregation follows the maximum holding status only.
for (const [key, expected] of [
  ["AGG-ON", "on_track"],
  ["AGG-MON", "monitor"],
  ["AGG-REV", "review"],
  ["AGG-URG", "urgent_review"],
] as const) {
  const item =
    expected === "on_track"
      ? holding(key)
      : expected === "monitor"
        ? holding(key, { coverage: "tracked_only", ranking: null })
        : expected === "review"
          ? holding(key, {
              events: [{ kind: "filing", severity: "high", occurredAt: FRESH, source: "fixture" }],
            })
          : holding(key, {
              currentValue: 90,
              market: { currentPrice: 90, savedRiskLevel: 100 },
              ranking: { currentRank: 21, rankAtEntry: 1 },
            });
  assert.equal(assess([item]).portfolio.status, expected);
}
{
  const result = assess(
    ["REVIEW-A", "REVIEW-B", "REVIEW-C"].map((key) =>
      holding(key, {
        events: [{ kind: "filing", severity: "high", occurredAt: FRESH, source: "fixture" }],
      }),
    ),
    { cashValue: 1000 },
  );
  assert.equal(result.portfolio.status, "review");
}

// 42. The complete result is byte-for-byte deterministic.
{
  const input = [
    holding("DETERMINISTIC-B", {
      events: [
        { id: "2", kind: "zeta", severity: "medium", occurredAt: FRESH, source: "fixture" },
        { id: "1", kind: "alpha", severity: "medium", occurredAt: FRESH, source: "fixture" },
      ],
    }),
    holding("DETERMINISTIC-A"),
  ];
  assert.equal(JSON.stringify(assess(input)), JSON.stringify(assess(input)));
}

// Supplemental normalization boundaries keep incomplete external facts honest.
{
  const unavailable = assess([
    holding("UNAVAILABLE-A", { currentValue: null }),
    holding("UNAVAILABLE-B", { currentValue: null }),
  ]);
  assert.equal(unavailable.portfolio.valuation.state, "unavailable");
  assert.equal(unavailable.portfolio.valuation.holdingsValue, null);
  assert.equal(unavailable.portfolio.valuation.totalValue, null);

  const invalidCash = assess([holding("INVALID-CASH")], {
    cashValue: Number.NaN,
  });
  assert.equal(invalidCash.portfolio.valuation.cashValue, 0);
  assert.ok(invalidCash.portfolio.dataLimitations.includes("cash_value_normalized"));

  const missingRanking = assessment(
    assess([holding("MISSING-RANKING", { ranking: null })]),
    "MISSING-RANKING",
  );
  assert.equal(missingRanking.status, "monitor");
  assert.ok(hasReason(missingRanking, "data_missing"));

  const staleSources = assessment(
    assess([
      holding("STALE-SOURCES", {
        market: { priceAsOf: OVER_96_HOURS },
        ranking: { asOf: OVER_96_HOURS },
      }),
    ]),
    "STALE-SOURCES",
  );
  assert.equal(reasonCount(staleSources, "data_stale"), 1);
  assert.equal(
    staleSources.reasons.find((reason) => reason.code === "data_stale")?.evidence.length,
    2,
  );

  const noEntryComparison = assessment(
    assess([
      holding("NO-ENTRY-COMPARISON", {
        ranking: { rankAtEntry: null, scoreAtEntry: null },
      }),
    ]),
    "NO-ENTRY-COMPARISON",
  );
  assert.equal(noEntryComparison.status, "on_track");
  assert.equal(hasReason(noEntryComparison, "ranking_deterioration"), false);
}

// 43-44. Source guards protect the pure contract and explicit-clock boundary.
{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const domainDir = path.join(root, "lib", "portfolio-intelligence");
  const source = fs
    .readdirSync(domainDir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => fs.readFileSync(path.join(domainDir, name), "utf8"))
    .join("\n");

  assert.doesNotMatch(
    source,
    /from\s+["'][^"']*(?:supabase|yahoo|portfolio-action-engine|portfolio-trim-recommendation)[^"']*["']/i,
  );
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /\bDate\.now\s*\(/);
  assert.doesNotMatch(source, /\bnew\s+Date\s*\(\s*\)/);
  assert.doesNotMatch(
    source,
    /\b(?:buy|buy_more|sell|exit|trim|reinvest|execute|suggestedTrimRange|suggestedBuyAmount|replacementCandidate)\b/i,
  );

  const publicResult = JSON.stringify(assess([holding("CONTRACT")]))
  assert.doesNotMatch(
    publicResult,
    /\b(?:buy_more|suggestedTrimRange|suggestedBuyAmount|reinvestment|replacementCandidate)\b/i,
  );
}

console.log(
  "Portfolio intelligence checks passed (44 required cases plus supplemental normalization boundaries).",
);
