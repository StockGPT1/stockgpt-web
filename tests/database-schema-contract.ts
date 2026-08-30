import type { Database } from "@/lib/database.types";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;
type EmptyObject = { [Key in never]: never };
type IsOptional<Value, Key extends keyof Value> =
  EmptyObject extends Pick<Value, Key> ? true : false;

type ExpectedPublicTables =
  | "affiliate_applications"
  | "alpha_waitlist"
  | "ask_stockgpt_messages"
  | "executive_waitlist"
  | "market_snapshots"
  | "news_articles"
  | "notification_dismissals"
  | "portfolio_holdings"
  | "portfolio_page_snapshots"
  | "portfolio_snapshots"
  | "portfolio_transactions"
  | "premium_waitlist"
  | "pro_waitlist"
  | "profiles"
  | "security_audit_events"
  | "security_rate_limits"
  | "stock_chart_cache"
  | "stock_factor_diagnostics"
  | "stock_factor_diagnostics_history"
  | "stock_rank_snapshots"
  | "stock_rankings"
  | "support_feedback"
  | "technical_level_cache"
  | "user_notification_summaries"
  | "user_portfolios"
  | "watchlist";

type PublicTables = keyof Database["public"]["Tables"];
type PublicFunctions = keyof Database["public"]["Functions"];
type RankingRow = Database["public"]["Tables"]["stock_rankings"]["Row"];
type DiagnosticRow = Database["public"]["Tables"]["stock_factor_diagnostics"]["Row"];
type WatchlistInsert = Database["public"]["Tables"]["watchlist"]["Insert"];
type RankSnapshotInsert = Database["public"]["Tables"]["stock_rank_snapshots"]["Insert"];

export type PublicTableSetIsCanonical = Assert<Equal<PublicTables, ExpectedPublicTables>>;
export type PublicFunctionSetIsCanonical = Assert<
  Equal<
    PublicFunctions,
    | "buy_portfolio_holding"
    | "correct_portfolio_holding"
    | "is_active_subscriber"
    | "log_existing_portfolio_holding"
    | "mutate_portfolio_cash"
    | "remove_portfolio_holding_tracking"
    | "sell_portfolio_holding"
    | "show_limit"
    | "show_trgm"
  >
>;
export type CashMutationArgsAreNarrow = Assert<
  Equal<
    Database["public"]["Functions"]["mutate_portfolio_cash"]["Args"],
    { p_amount: number; p_operation: string; p_portfolio_id: string }
  >
>;
export type UserWatchlistIsAbsent = Assert<
  Equal<Extract<PublicTables, "user_watchlist">, never>
>;
export type UnsupportedRankingColumnsAreAbsent = Assert<
  Equal<Extract<keyof RankingRow, "factor_coverage" | "data_confidence">, never>
>;
export type DiagnosticCoverageIsPresent = Assert<
  Equal<DiagnosticRow["factor_coverage"], number | null>
>;
export type WatchlistIdUsesDatabaseDefault = Assert<
  Equal<IsOptional<WatchlistInsert, "id">, true>
>;
export type WatchlistTickerIsRequired = Assert<
  Equal<IsOptional<WatchlistInsert, "ticker">, false>
>;
export type WatchlistOwnerIsRequired = Assert<
  Equal<IsOptional<WatchlistInsert, "user_id">, false>
>;
export type RankSnapshotTickerIsRequiredAndNonNull = Assert<
  Equal<RankSnapshotInsert["ticker"], string>
>;
