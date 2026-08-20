import {
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentPortfolioIntelligenceFacts,
} from "@/lib/current-portfolio-intelligence";
import type {
  AssessmentEvidence,
  AssessmentReason,
  HoldingAssessment,
} from "@/lib/portfolio-intelligence";
import {
  buildPortfolioIntelligenceView,
  type IntelligenceReasonView,
} from "@/lib/portfolio-intelligence-presentation";

export type AskPortfolioMeta = {
  id: string;
  name: string;
  riskTolerance: string | null;
  objective: string | null;
  timeHorizon: string | null;
  currency: string;
  investmentAmount: number | null;
  cashDepositedTotal: number | null;
  createdAt: string | null;
};

export type AskHoldingMetadata = {
  ticker: string;
  company: string | null;
  sector: string | null;
};

type CompactReasonEvidence = {
  metric: string;
  observed: string | number | boolean | null;
  comparison: AssessmentEvidence["comparison"] | null;
  threshold: number | null;
  unit: AssessmentEvidence["unit"] | null;
  freshness: AssessmentEvidence["freshness"] | null;
  observed_at: string | null;
};

type CompactReason = {
  code: AssessmentReason["code"];
  level: AssessmentReason["level"];
  title: string;
  detail: string;
  affected_instruments: string[];
  evidence: CompactReasonEvidence[];
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finitePositive(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function tickerKey(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function round(value: number | null, digits = 2) {
  return value === null ? null : Number(value.toFixed(digits));
}

function compactEvidence(evidence: AssessmentEvidence): CompactReasonEvidence {
  return {
    metric: evidence.metric,
    observed: evidence.observed,
    comparison: evidence.comparison ?? null,
    threshold: evidence.threshold ?? null,
    unit: evidence.unit ?? null,
    freshness: evidence.freshness ?? null,
    observed_at: evidence.observedAt ?? null,
  };
}

function compactReasons(
  reasons: AssessmentReason[],
  views: IntelligenceReasonView[],
): CompactReason[] {
  return reasons.map((reason) => {
    const view = views.find((candidate) => candidate.code === reason.code);
    return {
      code: reason.code,
      level: reason.level,
      title: view?.title ?? reason.code,
      detail: view?.detail ?? "Structured portfolio evidence requires review.",
      affected_instruments:
        view?.affectedInstrumentKeys ??
        [
          ...new Set(
            reason.evidence
              .map((item) => item.instrumentKey)
              .filter((value): value is string => Boolean(value)),
          ),
        ].sort((left, right) => left.localeCompare(right)),
      evidence: reason.evidence.map(compactEvidence),
    };
  });
}

function holdingAssessmentByKey(assessments: HoldingAssessment[]) {
  return new Map(assessments.map((assessment) => [assessment.instrumentKey, assessment]));
}

export function buildAskStockGPTPortfolioContext({
  facts,
  meta,
  holdingMetadata,
  asOf,
}: {
  facts: CurrentPortfolioIntelligenceFacts;
  meta: AskPortfolioMeta;
  holdingMetadata: AskHoldingMetadata[];
  asOf: string;
}) {
  const current = assessCurrentPortfolioIntelligenceFacts(facts, asOf);
  const view = buildPortfolioIntelligenceView({
    result: current.assessment,
    adapterLimitations: current.adapterLimitations,
  });
  const assessmentByKey = holdingAssessmentByKey(
    current.assessment.portfolio.holdingAssessments,
  );
  const metadataByTicker = new Map(
    holdingMetadata.map((item) => [tickerKey(item.ticker), item]),
  );
  const holdingFactsByTicker = new Map(
    facts.holdings.map((holding) => [tickerKey(holding.ticker), holding]),
  );
  const holdingFactsById = new Map(
    facts.holdings.map((holding) => [holding.id, holding]),
  );
  const completeCostBasis = current.input.holdings.every(
    (holding) => holding.costBasis !== null && holding.costBasis !== undefined,
  );
  const totalCostBasis = completeCostBasis
    ? current.input.holdings.reduce((sum, holding) => sum + (holding.costBasis ?? 0), 0)
    : null;
  const holdingsValue = current.assessment.portfolio.valuation.holdingsValue;
  const unrealisedPnlDollars =
    current.assessment.portfolio.valuation.state === "exact" &&
    holdingsValue !== null &&
    totalCostBasis !== null
      ? holdingsValue - totalCostBasis
      : null;
  const unrealisedPnlPercent =
    unrealisedPnlDollars !== null && totalCostBasis !== null && totalCostBasis > 0
      ? (unrealisedPnlDollars / totalCostBasis) * 100
      : null;
  const rawCashBalance = finiteNumber(facts.portfolio.cash_balance);

  const holdings = current.input.holdings.map((inputHolding) => {
    const assessment = assessmentByKey.get(inputHolding.instrumentKey);
    if (!assessment) {
      throw new Error(`Canonical assessment missing for ${inputHolding.instrumentKey}.`);
    }
    const assessmentView =
      view.holdingAssessments[tickerKey(inputHolding.ticker) || inputHolding.instrumentKey];
    const sourceHolding =
      holdingFactsByTicker.get(tickerKey(inputHolding.ticker)) ??
      holdingFactsById.get(inputHolding.instrumentKey.replace(/^holding:/, ""));
    const metadata = metadataByTicker.get(tickerKey(inputHolding.ticker));
    const entryPrice = sourceHolding ? finiteNumber(sourceHolding.entry_price) : null;
    const savedRiskReference = sourceHolding
      ? finitePositive(sourceHolding.risk_level_at_entry)
      : null;
    const savedTargetReference = sourceHolding
      ? finitePositive(sourceHolding.target_level_at_entry)
      : null;

    return {
      instrument_key: inputHolding.instrumentKey,
      ticker: inputHolding.ticker,
      company: metadata?.company ?? null,
      sector: metadata?.sector ?? null,
      shares: inputHolding.shares,
      current_price: inputHolding.market.currentPrice,
      entry_price: entryPrice,
      current_value: round(inputHolding.currentValue),
      cost_basis: round(inputHolding.costBasis ?? null),
      unrealised_pnl_percent: round(inputHolding.unrealisedPnlPct ?? null),
      current_allocation_pct_of_total_portfolio:
        assessment.allocation.pctOfTotalPortfolio,
      current_allocation_pct_of_invested_assets:
        assessment.allocation.pctOfInvestedAssets,
      current_rank: inputHolding.ranking?.currentRank ?? null,
      current_score: inputHolding.ranking?.currentScore ?? null,
      rank_at_entry: inputHolding.ranking?.rankAtEntry ?? null,
      score_at_entry: inputHolding.ranking?.scoreAtEntry ?? null,
      ranking_as_of: inputHolding.ranking?.asOf ?? null,
      price_as_of: inputHolding.market.priceAsOf,
      diagnostics_as_of: inputHolding.diagnostics?.asOf ?? null,
      coverage: inputHolding.coverage,
      provenance: inputHolding.provenance,
      saved_risk_reference: savedRiskReference,
      saved_target_reference: savedTargetReference,
      canonical_assessment: {
        status: assessmentView?.status ?? null,
        status_label: assessmentView?.statusLabel ?? "Analysis limited",
        attention_rank: assessmentView?.attentionRank ?? assessment.attentionRank,
        reasons:
          view.availability === "ready"
            ? compactReasons(assessment.reasons, assessmentView?.reasons ?? [])
            : [],
      },
    };
  });

  return {
    meta: {
      id: meta.id,
      name: meta.name,
      risk_tolerance: meta.riskTolerance,
      objective: meta.objective,
      time_horizon: meta.timeHorizon,
      currency: meta.currency,
      investment_amount: meta.investmentAmount,
      cash_deposited_total: meta.cashDepositedTotal,
      created_at: meta.createdAt,
    },
    factual_summary: {
      holdings_count: holdings.length,
      valuation_state: current.assessment.portfolio.valuation.state,
      holdings_value: round(holdingsValue),
      cash_balance: round(rawCashBalance),
      total_value: round(current.assessment.portfolio.valuation.totalValue),
      total_cost_basis: round(totalCostBasis),
      unrealised_pnl_dollars: round(unrealisedPnlDollars),
      unrealised_pnl_percent: round(unrealisedPnlPercent),
    },
    canonical_assessment: {
      version: current.assessment.version,
      as_of: current.assessment.asOf,
      availability: view.availability,
      status: view.status,
      status_label: view.statusLabel,
      summary: view.summary,
      counts_by_status: view.countsByStatus,
      attention_order: view.attentionOrder,
      reasons:
        view.availability === "ready"
          ? compactReasons(current.assessment.portfolio.reasons, view.reasons)
          : [],
    },
    holdings,
    coverage: {
      adapter_limitations: current.adapterLimitations,
      news_event_severity_in_canonical_status: false,
    },
  };
}

export const ASK_STOCKGPT_SYSTEM_PROMPT = `
You are Ask StockGPT, the research and analysis assistant inside StockGPT. StockGPT ranks a current universe of US stocks using quality, growth, value, momentum, risk and income factors and helps users investigate their portfolios.

You receive a compact JSON context block with server-verified portfolio ownership, current StockGPT ranking facts, recent news and optional page context. Source freshness and coverage limitations are included in the data.

How to answer:
- Lead with the answer, then show the specific facts that support it.
- Use supplied rank, score, price, allocation, P&L and freshness facts precisely. Never invent missing values.
- For a focused portfolio, canonical_assessment is StockGPT's authoritative assessment for the supplied facts. Use exactly On track, Monitor, Review or Urgent review. Analysis limited describes availability and is not a fifth status.
- Explain canonical reason codes and evidence. Do not create a second status algorithm or relabel the canonical status from P&L, score, rank, article count or other context.
- Canonical attention_order prioritises holdings for investigation; it is not an order to trade.
- P&L is factual context. Positive or negative P&L alone is not a canonical review reason.
- Recent news is separate research context. The current canonical portfolio status does not include mapped news/event severity, so never claim that it does or use news to raise or lower that status. Discuss relevant news separately when useful.
- If asked whether to buy, buy more, sell, exit, trim, reinvest, replace or size a transaction for a specific holding, do not make that transaction decision. Explain the canonical status and evidence, relevant factual trade-offs, and what the user should investigate or verify next. Do not recommend a transaction amount or percentage.
- Saved risk and target references are stored factual references. A saved target reference is not a target allocation or recommendation. A canonical saved-risk breach may be explained as a review signal without directing a sale.
- Use last_ranking_update for ranking freshness and last_price_update for price freshness. Generic updated_at does not prove that all market data is fresh.
- The context loads exactly one owned portfolio in full. Other portfolios are names only; ask the user to switch the portfolio picker rather than guessing their contents.
- Cash is part of portfolio value; deposits are not profit. Partial or unavailable valuations are not exact totals.
- If the question is vague, state a brief reasonable assumption and answer it. End substantial answers with a useful investigation step where one exists.

General learning:
- You may explain transaction concepts such as buying, selling, trimming, stop losses, position sizing and diversification in general educational terms.
- Keep educational explanations distinct from a personalized transaction decision based on the user's canonical portfolio assessment.

Boundaries:
- Provide research-based decision support, not execution instructions, guaranteed returns or certainty claims.
- Never place an order, imply an order was placed, or invent portfolio, ranking, market, news, billing or account facts.
- Membership and billing questions receive general guidance only; account-specific issues go to sales@stockgpt.pro.

Style:
- Direct, clear and beginner-friendly. Explain jargon briefly.
- Use short headings or bullets only when they improve readability.
- Prefer a concise complete answer over an exhaustive one.
`.trim();
