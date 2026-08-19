import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  CURRENT_EVENT_LIMITATION,
  assessCurrentPortfolioIntelligenceFacts,
  buildCurrentPortfolioIntelligenceInput,
  mapCurrentHoldingProvenance,
  type CurrentHoldingFact,
  type CurrentPortfolioIntelligenceFacts,
} from "../lib/current-portfolio-intelligence/index";

const AS_OF = "2026-01-16T12:00:00.000Z";
const FRESH_RANKING = "2026-01-16T10:00:00.000Z";
const FRESH_PRICE = "2026-01-16T11:00:00.000Z";
const FRESH_DIAGNOSTICS = "2026-01-16T09:00:00.000Z";

function fixture(
  holdingOverrides: Partial<CurrentHoldingFact> = {},
): CurrentPortfolioIntelligenceFacts {
  const holding: CurrentHoldingFact = {
    id: "holding-1",
    portfolio_id: "portfolio-1",
    ticker: "AAPL",
    shares: 1,
    entry_price: 90,
    score_at_entry: 90,
    rank_at_entry: 10,
    allocation_pct: 12.5,
    source: "manual",
    risk_level_at_entry: 80,
    target_level_at_entry: 140,
    ...holdingOverrides,
  };

  return {
    portfolio: {
      id: "portfolio-1",
      risk_tolerance: "moderate",
      objective: "growth",
      time_horizon: "long_term",
      cash_balance: 900,
      currency: "USD",
    },
    holdings: [holding],
    rankings: [
      {
        ticker: "AAPL",
        score: 90,
        rank: 10,
        price: 100,
        last_price_update: FRESH_PRICE,
        last_ranking_update: FRESH_RANKING,
      },
    ],
    diagnostics: [
      {
        ticker: "AAPL",
        current_score: 90,
        previous_score: 90,
        updated_at: FRESH_DIAGNOSTICS,
      },
    ],
    rankingUniverseSize: 100,
  };
}

function semanticResult(
  result: ReturnType<typeof assessCurrentPortfolioIntelligenceFacts>,
) {
  return {
    portfolioStatus: result.assessment.portfolio.status,
    portfolioReasons: result.assessment.portfolio.reasons.map((reason) => ({
      code: reason.code,
      level: reason.level,
    })),
    holdings: result.assessment.portfolio.holdingAssessments.map((holding) => ({
      instrumentKey: holding.instrumentKey,
      status: holding.status,
      reasons: holding.reasons.map((reason) => ({
        code: reason.code,
        level: reason.level,
      })),
    })),
  };
}

// Current source labels map deterministically and do not affect assessment semantics.
for (const [source, expected] of [
  ["manual", "manual"],
  ["manual_builder", "manual"],
  ["trading212", "csv"],
  ["import", "csv"],
  ["broker", "broker"],
  ["broker:future-provider", "broker"],
  ["ai_builder", "unknown"],
  ["unrecognised", "unknown"],
] as const) {
  assert.equal(mapCurrentHoldingProvenance(source), expected);
}
{
  const assessments = [
    "manual",
    "manual_builder",
    "trading212",
    "import",
    "broker:future-provider",
    "ai_builder",
  ].map((source) =>
    semanticResult(
      assessCurrentPortfolioIntelligenceFacts(fixture({ source }), AS_OF),
    ),
  );
  for (const assessment of assessments.slice(1)) {
    assert.deepEqual(assessment, assessments[0]);
  }
}

// A missing ranking is unsupported and never fabricates score, rank or value zero.
{
  const facts = fixture();
  facts.rankings = [];
  const result = assessCurrentPortfolioIntelligenceFacts(facts, AS_OF);
  const holding = result.input.holdings[0];
  assert.equal(holding.coverage, "unsupported");
  assert.equal(holding.ranking, null);
  assert.equal(holding.market.currentPrice, null);
  assert.equal(holding.currentValue, null);
  assert.equal(result.assessment.portfolio.status, "monitor");
}

// Values and basis come only from valid source facts.
{
  const mapped = buildCurrentPortfolioIntelligenceInput(fixture(), AS_OF).input
    .holdings[0];
  assert.equal(mapped.currentValue, 100);
  assert.equal(mapped.costBasis, 90);
  assert.equal(mapped.unrealisedPnlPct, (10 / 90) * 100);

  for (const price of [null, 0, -1, Number.NaN]) {
    const facts = fixture();
    facts.rankings[0].price = price;
    const invalid = buildCurrentPortfolioIntelligenceInput(facts, AS_OF);
    assert.equal(invalid.input.holdings[0].currentValue, null);
    assert.equal(invalid.input.holdings[0].market.currentPrice, null);
    assert.ok(
      invalid.adapterLimitations.includes(
        "AAPL:current_price_missing_or_invalid",
      ),
    );
  }

  const missingEntry = fixture({ entry_price: null });
  assert.equal(
    buildCurrentPortfolioIntelligenceInput(missingEntry, AS_OF).input.holdings[0]
      .costBasis,
    null,
  );
}

// Legacy allocation remains reference-only and never becomes a target.
{
  const holding = buildCurrentPortfolioIntelligenceInput(fixture(), AS_OF).input
    .holdings[0];
  assert.equal(holding.legacyReferenceAllocationPct, 12.5);
  assert.equal("targetAllocationPct" in holding, false);
}

// Only a stored positive risk level is mapped; stored target levels are ignored.
{
  const base = fixture();
  const changedTarget = fixture({ target_level_at_entry: 1 });
  const baseResult = assessCurrentPortfolioIntelligenceFacts(base, AS_OF);
  const changedResult = assessCurrentPortfolioIntelligenceFacts(
    changedTarget,
    AS_OF,
  );
  assert.equal(baseResult.input.holdings[0].market.savedRiskLevel, 80);
  assert.deepEqual(changedResult, baseResult);

  for (const risk of [null, 0, -5, Number.NaN]) {
    const mapped = buildCurrentPortfolioIntelligenceInput(
      fixture({ risk_level_at_entry: risk }),
      AS_OF,
    );
    assert.equal(mapped.input.holdings[0].market.savedRiskLevel, null);
  }
}

// Freshness is source-specific; one source cannot make another look current.
{
  const mapped = buildCurrentPortfolioIntelligenceInput(fixture(), AS_OF).input
    .holdings[0];
  assert.equal(mapped.ranking?.asOf, FRESH_RANKING);
  assert.equal(mapped.market.priceAsOf, FRESH_PRICE);
  assert.equal(mapped.diagnostics?.asOf, FRESH_DIAGNOSTICS);

  const missingPriceTimestamp = fixture();
  missingPriceTimestamp.rankings[0].last_price_update = null;
  assert.equal(
    buildCurrentPortfolioIntelligenceInput(missingPriceTimestamp, AS_OF).input
      .holdings[0].market.priceAsOf,
    null,
  );
  assert.equal(
    buildCurrentPortfolioIntelligenceInput(missingPriceTimestamp, AS_OF).input
      .holdings[0].ranking?.asOf,
    FRESH_RANKING,
  );

  const missingRankingTimestamp = fixture();
  missingRankingTimestamp.rankings[0].last_ranking_update = null;
  assert.equal(
    buildCurrentPortfolioIntelligenceInput(missingRankingTimestamp, AS_OF).input
      .holdings[0].ranking?.asOf,
    null,
  );
  assert.equal(
    buildCurrentPortfolioIntelligenceInput(missingRankingTimestamp, AS_OF).input
      .holdings[0].market.priceAsOf,
    FRESH_PRICE,
  );
}

// Universe size is supplied by the factual count rather than a fixed S&P value.
{
  const facts = fixture();
  facts.rankingUniverseSize = 37;
  const mapped = buildCurrentPortfolioIntelligenceInput(facts, AS_OF);
  assert.equal(mapped.input.holdings[0].ranking?.universeSize, 37);
}

// Current news cannot yet satisfy the canonical structured severity contract.
{
  const mapped = buildCurrentPortfolioIntelligenceInput(fixture(), AS_OF);
  assert.deepEqual(mapped.input.holdings[0].events, []);
  assert.ok(mapped.adapterLimitations.includes(CURRENT_EVENT_LIMITATION));
}

// A coherent currency conversion leaves status and reason semantics invariant.
{
  const base = fixture();
  const scaled = structuredClone(base);
  const rate = 0.8;
  scaled.portfolio.cash_balance *= rate;
  scaled.holdings[0].entry_price =
    Number(scaled.holdings[0].entry_price) * rate;
  scaled.holdings[0].risk_level_at_entry =
    Number(scaled.holdings[0].risk_level_at_entry) * rate;
  scaled.holdings[0].target_level_at_entry =
    Number(scaled.holdings[0].target_level_at_entry) * rate;
  scaled.rankings[0].price = Number(scaled.rankings[0].price) * rate;

  assert.deepEqual(
    semanticResult(assessCurrentPortfolioIntelligenceFacts(scaled, AS_OF)),
    semanticResult(assessCurrentPortfolioIntelligenceFacts(base, AS_OF)),
  );
}

// Mixed stored portfolio currency and USD ranking prices never create valuation claims.
{
  const facts = fixture();
  facts.portfolio.currency = "GBP";
  const result = assessCurrentPortfolioIntelligenceFacts(facts, AS_OF);
  assert.equal(result.input.portfolio.cashValue, 0);
  assert.equal(result.input.holdings[0].currentValue, null);
  assert.equal(result.input.holdings[0].costBasis, null);
  assert.equal(result.input.holdings[0].unrealisedPnlPct, null);
  assert.equal(result.input.holdings[0].market.savedRiskLevel, null);
  assert.equal(result.assessment.portfolio.valuation.state, "unavailable");
  assert.ok(
    result.adapterLimitations.includes(
      "portfolio_currency_basis_unresolved:GBP",
    ),
  );
}

// The adapter package may consume facts and the canonical engine, never legacy assessments.
{
  const root = path.resolve("lib/current-portfolio-intelligence");
  const sources = fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => fs.readFileSync(path.join(root, name), "utf8"))
    .join("\n");
  for (const forbidden of [
    "portfolio-action-engine",
    "portfolio-trim-recommendation",
    "PortfolioActionRecommendation",
    "PortfolioHealthSummary",
    "buildPortfolioHealthSummary",
    "recommendation",
    "EnrichedHolding",
    "actionAlerts",
    "eventAlerts",
    "aiSummary",
    "triggers",
    "calculateTradeLevels",
    "holding-trade-levels",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    assert.equal(
      sources.includes(forbidden),
      false,
      `Current factual adapter must not contain ${forbidden}`,
    );
  }
  assert.doesNotMatch(sources, /\.\s*(?:insert|update|upsert|delete|rpc)\s*\(/u);
  assert.doesNotMatch(sources, /console\.(?:log|info|warn|error)/u);
  assert.doesNotMatch(sources, /\b500\b/u);
}

console.log("Current portfolio intelligence adapter checks passed.");
