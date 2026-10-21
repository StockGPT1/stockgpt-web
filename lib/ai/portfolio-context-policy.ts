import { SANDBOX_FIXTURE_LABEL } from "@/lib/instruments/broker-position-identity";

type Row = Record<string, unknown>;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Projection = Record<string, Json>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown, max = 240): string | null => typeof value === "string" ? value.slice(0, max) : null;
const oneOf = (value: unknown, values: readonly string[]) => typeof value === "string" && values.includes(value) ? value : null;
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const status = (value: unknown) => oneOf(value, ["on_track", "monitor", "review", "urgent_review"]);
const list = (value: unknown, max: number): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error("ai_context_budget_exceeded");
  return value;
};
function numbers(source: Row, fields: readonly string[]): Projection {
  return Object.fromEntries(fields.map((key) => [key, finite(source[key])]));
}
function limitation(value: unknown) {
  // Adapter suffixes may contain source UUIDs. Only the fixed limitation code
  // is relevant to the model; source linkage stays inside StockGPT.
  const code = typeof value === "string" ? value.split(":", 1)[0] : "";
  return /^[a-z][a-z0-9_]{0,95}$/.test(code) ? code : "analysis_evidence_unavailable";
}

/** Final outbound DTO boundary, NOT a financial calculator or ownership loader.
 * Accept only context constructed after session/RLS verification. No spreading
 * input records: future columns cannot silently become AI-provider payloads.
 * References are request-local labels, not stable user/account/instrument IDs.
 * Free-form user questions/history are a separate deliberate user disclosure;
 * this function does not claim to redact arbitrary user-entered secrets.
 */
export function minimizeAskAppContext(input: unknown): Projection {
  const root = row(input);
  const holdingReferences = new Map<string, string>();
  const sourceReferences = new Map<string, string>();
  const reference = (map: Map<string, string>, value: unknown, prefix: string) => {
    if (typeof value !== "string" || !value) return null;
    if (!map.has(value)) map.set(value, `${prefix}-${map.size + 1}`);
    return map.get(value)!;
  };
  const holdingRef = (value: unknown) => reference(holdingReferences, value, "holding");
  const reasons = (value: unknown): Json[] => list(value, 64).map((item) => {
    const reason = row(item);
    return {
      code: limitation(reason.code),
      level: oneOf(reason.level, ["monitor", "review"]),
      // Server-generated canonical copy, not broker descriptions or raw payload.
      title: text(reason.title, 100), detail: text(reason.detail, 600),
      affected_instruments: list(reason.affected_instruments ?? reason.affectedInstrumentKeys, 5000).map(holdingRef),
      evidence: list(reason.evidence, 64).map((entry) => {
        const evidence = row(entry);
        return {
          metric: limitation(evidence.metric),
          observed: typeof evidence.observed === "boolean" ? evidence.observed : finite(evidence.observed)
            ?? oneOf(evidence.observed, ["fresh", "stale", "missing", "unknown", "ranked", "tracked_only", "unsupported"]),
          comparison: oneOf(evidence.comparison, ["gte", "lte", "declined_by", "missing", "stale"]),
          threshold: finite(evidence.threshold),
          unit: oneOf(evidence.unit, ["percent", "percentage_points", "currency", "rank", "score", "count", "hours", "days"]),
          freshness: oneOf(evidence.freshness, ["fresh", "stale", "missing", "unknown"]),
          observed_at: timestamp(evidence.observed_at ?? evidence.observedAt),
        };
      }),
    };
  });
  const assessment = (value: unknown): Projection => {
    const current = row(value);
    return {
      version: text(current.version, 12), as_of: timestamp(current.as_of),
      availability: oneOf(current.availability, ["ready", "limited", "unavailable", "analysis_limited"]),
      status: status(current.status),
      status_label: oneOf(current.status_label, ["On track", "Monitor", "Review", "Urgent review", "Analysis limited"]),
      counts_by_status: numbers(row(current.counts_by_status), ["on_track", "monitor", "review", "urgent_review"]),
      attention_order: list(current.attention_order, 5000).map(holdingRef),
      reasons: reasons(current.reasons),
    };
  };
  const holding = (value: unknown): Projection => {
    const current = row(value);
    const identity = oneOf(current.identity_provenance, ["provider_alias", "persisted", "sandbox_fixture", "unresolved"]);
    const provenance = oneOf(current.provenance, ["manual", "csv", "broker", "unknown"]);
    const synthetic = identity === "sandbox_fixture" || current.test_data_label != null;
    const verified = provenance === "manual" || provenance === "csv"
      || provenance === "broker" && Boolean(current.instrument_id) && ["provider_alias", "persisted"].includes(identity ?? "");
    const ranked = !synthetic && current.coverage === "ranked"
      && verified
      && finite(current.current_rank) !== null && Number(current.current_rank) > 0
      && finite(current.current_score) !== null && timestamp(current.ranking_as_of) !== null;
    const currentAssessment = row(current.canonical_assessment);
    return {
      instrument_key: holdingRef(current.instrument_key), ticker: text(current.ticker, 24),
      company: text(current.company), sector: text(current.sector),
      ...numbers(current, ["shares", "current_price", "entry_price", "current_value", "cost_basis", "unrealised_pnl_percent",
        "current_allocation_pct_of_total_portfolio", "current_allocation_pct_of_invested_assets", "saved_risk_reference", "saved_target_reference"]),
      coverage: oneOf(current.coverage, ["ranked", "tracked_only", "unsupported"]),
      provenance,
      identity_provenance: identity,
      test_data_label: synthetic ? SANDBOX_FIXTURE_LABEL : null,
      investment_research_available: ranked && current.investment_research_available !== false,
      current_rank: ranked ? finite(current.current_rank) : null,
      current_score: ranked ? finite(current.current_score) : null,
      rank_at_entry: ranked ? finite(current.rank_at_entry) : null,
      score_at_entry: ranked ? finite(current.score_at_entry) : null,
      ranking_as_of: ranked ? timestamp(current.ranking_as_of) : null,
      price_as_of: timestamp(current.price_as_of), diagnostics_as_of: ranked ? timestamp(current.diagnostics_as_of) : null,
      canonical_assessment: {
        status: synthetic ? null : status(currentAssessment.status),
        status_label: synthetic ? "Analysis limited" : oneOf(currentAssessment.status_label, ["On track", "Monitor", "Review", "Urgent review", "Analysis limited"]),
        attention_rank: synthetic ? null : finite(currentAssessment.attention_rank),
        reasons: synthetic ? [] : reasons(currentAssessment.reasons),
      },
    };
  };
  const portfolioContext = row(root.portfolio_context);
  const focused = row(portfolioContext.focused_portfolio);
  const meta = row(focused.meta);
  const summary = row(focused.factual_summary);
  const connected = meta.management_source === "connected";
  const safePortfolio: Projection | null = portfolioContext.available === true ? {
    meta: {
      name: meta.id === "all-investments" ? "All Investments" : "Selected Portfolio",
      management_source: oneOf(meta.management_source, ["manual", "connected"]),
      currency: oneOf(meta.currency, ["USD"]),
      risk_tolerance: oneOf(meta.risk_tolerance, ["conservative", "moderate", "aggressive"]),
      objective: oneOf(meta.objective, ["growth", "income", "balanced", "capital_preservation"]),
      time_horizon: oneOf(meta.time_horizon, ["short_term", "medium_term", "long_term"]),
    },
    factual_summary: {
      ...numbers(summary, ["holdings_count", "holdings_value", "cash_balance", "total_value", "total_cost_basis", "unrealised_pnl_dollars", "unrealised_pnl_percent"]),
      valuation_state: oneOf(summary.valuation_state, ["exact", "partial", "unavailable", "empty"]),
      ...(connected ? { total_cost_basis: null, unrealised_pnl_dollars: null, unrealised_pnl_percent: null, aggregate_performance_available: false } : {}),
    },
    holdings: list(focused.holdings, 5000).map(holding),
    canonical_assessment: assessment(focused.canonical_assessment),
    coverage: {
      adapter_limitations: list(row(focused.coverage).adapter_limitations, 10000).map(limitation),
      news_event_severity_in_canonical_status: false,
    },
    limitations: list(focused.limitations, 10000).map(limitation),
    source_portfolios: list(focused.source_portfolios, 1000).map((item) => {
      const source = row(item);
      return { reference: reference(sourceReferences, source.id, "portfolio"), source: oneOf(source.source, ["manual", "connected"]), value_usd: finite(source.value_usd) };
    }),
  } : null;
  const ranking = (value: unknown): Projection => {
    const current = row(value);
    return { ticker: text(current.ticker, 24), company: text(current.company), sector: text(current.sector),
      ...numbers(current, ["rank", "previous_rank", "score", "price", "rank_move"]),
      last_ranking_update: timestamp(current.last_ranking_update), last_price_update: timestamp(current.last_price_update) };
  };
  const news = (value: unknown): Projection => {
    const current = row(value);
    return { title: text(current.title, 300), summary: text(current.summary, 2000), source: text(current.source, 100),
      affected_tickers: list(current.affected_tickers, 200).map((ticker) => text(ticker, 24)),
      impact: text(current.impact, 40), impact_reason: text(current.impact_reason, 500), published_at: timestamp(current.published_at) };
  };
  const page = row(root.page_context);
  const intent = row(root.question_intent);
  const rankings = row(root.rankings_context);
  const articles = row(root.news_context);
  const result: Projection = {
    context_policy: "stockgpt-ai-minimized-v1", data_as_of: timestamp(root.data_as_of),
    question_intent: { possible_tickers: list(intent.possible_tickers, 24).map((ticker) => text(ticker, 24)), membership_question: intent.membership_question === true, learning_question: intent.learning_question === true },
    page_context: root.page_context == null ? null : {
      context_type: oneOf(page.context_type, ["dashboard", "rankings", "stock", "portfolio", "holding"]),
      requested_ticker: text(page.requested_ticker, 24), owns_stock: page.owns_stock === true,
      holdings: list(page.holdings, 8).map(holding),
    },
    portfolio_context: safePortfolio ? { available: true, focused_portfolio: safePortfolio,
      other_portfolios_count: list(portfolioContext.other_portfolios, 1000).length,
      mentioned_holdings: list(portfolioContext.mentioned_holdings, 5000).map(holding) }
      : { available: false, reason: "Portfolio context unavailable." },
    rankings_context: { top_rankings: list(rankings.top_rankings, 60).map(ranking), mentioned_rankings: list(rankings.mentioned_rankings, 60).map(ranking) },
    news_context: { latest_news: list(articles.latest_news, 30).map(news), relevant_news: list(articles.relevant_news, 30).map(news) },
  };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 2 * 1024 * 1024) throw new Error("ai_context_budget_exceeded");
  return result;
}

export function safeAiProviderFailure(status?: unknown) {
  return {
    message: "ai_provider_unavailable",
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
  };
}
