"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Portfolio } from "@/lib/portfolio";
import { invalidatePortfolioPageSnapshot } from "@/lib/portfolio-speed-cache";
import {
  buildCurrentPortfolioSnapshotPoint,
  saveLatestPortfolioSnapshotFromChartData,
} from "@/lib/portfolio-snapshots";
import {
  resolveTradeOrder,
  roundTradeMoney,
  roundTradeShares,
  type TradeOrderInput,
} from "@/lib/trade-calculator";
import { mutatePortfolioCash } from "@/lib/portfolio-cash-mutation";
import {
  buyPortfolioHolding,
  correctPortfolioHolding,
  logExistingPortfolioHolding,
  removePortfolioHoldingTracking,
  sellPortfolioHolding,
} from "@/lib/portfolio-holding-mutation";
import {
  createAiPortfolioDraftAtomically,
  createManualPortfolioAtomically,
  deleteOwnedPortfolioAtomically,
} from "@/lib/portfolio-creation-mutation";
import {
  createTrading212PortfolioAtomically,
  replacePortfolioHoldingsFromTrading212Atomically,
} from "@/lib/portfolio-csv-mutation";
import {
  prepareTrading212Import,
  trading212RefusalMessage,
} from "@/lib/trading212-import";

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type PortfolioRecord = {
  id: string;
  name?: string | null;
  objective?: string | null;
  risk_tolerance?: string | null;
  time_horizon?: string | null;
  cash_balance?: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  currency?: string | null;
};

type PortfolioHoldingTradeRow = {
  shares?: number | null;
  entry_price?: number | null;
  purchase_date?: string | null;
  notes?: string | null;
};

type Trading212ImportOptions = {
  portfolioId: string;
};

type Trading212ImportSummary = {
  imported: number;
  totalValue: number;
  ignoredNonInvestmentRows: number;
  matchedTickers: string[];
};

type Trading212PreviewSummary = Trading212ImportSummary & {
  matchedTickers: string[];
  replaceWarning?: string | null;
};

type Trading212PortfolioCreateInput = {
  name: string;
  csvText: string;
};

type Trading212PortfolioCreateSummary = Trading212ImportSummary & {
  portfolioId: string;
  portfolioName: string;
  currency: "USD";
};

type SavePortfolioOptions = {
  name?: string;
};

export type ManualPortfolioHoldingInput = {
  ticker: string;
  shares: number;
  averagePrice: number;
  purchaseDate?: string | null;
  notes?: string | null;
};

export type ManualPortfolioInput = {
  name: string;
  startingCash: number;
  goal: "growth" | "income" | "balanced" | "watchlist" | "long-term";
  holdings: ManualPortfolioHoldingInput[];
};

type AddCashInput = {
  portfolioId: string;
  amount: number;
};

type RenamePortfolioInput = {
  portfolioId: string;
  name: string;
};

type PortfolioObjective =
  | "growth"
  | "income"
  | "balanced"
  | "capital_preservation"
  | "watchlist";

type PortfolioRiskTolerance = "conservative" | "moderate" | "aggressive";
type PortfolioTimeHorizon = "short" | "medium" | "long";

type UpdatePortfolioPreferencesInput = {
  portfolioId: string;
  objective: PortfolioObjective;
  riskTolerance: PortfolioRiskTolerance;
  timeHorizon: PortfolioTimeHorizon;
};

type LogExistingHoldingInput = {
  portfolioId: string;
  ticker: string;
  shares?: number | null;
  entryPrice?: number | null;
  value?: number | null;
  price?: number | null;
  purchaseDate?: string | null;
  notes?: string | null;
};

type BuyHoldingWithCashInput = {
  portfolioId: string;
  ticker: string;
  dollarAmount?: number | null;
  entryPrice?: number | null;
  value?: number | null;
  price?: number | null;
  shares?: number | null;
  purchaseDate?: string | null;
  notes?: string | null;
};

type UpdateHoldingDetailsInput = {
  portfolioId: string;
  ticker: string;
  shares: number;
  entryPrice: number;
  purchaseDate?: string | null;
  notes?: string | null;
};

type TrimHoldingInput = {
  portfolioId: string;
  ticker: string;
  percentage?: number | null;
  value?: number | null;
  price?: number | null;
  shares?: number | null;
  notes?: string | null;
};

type RemoveHoldingInput = {
  portfolioId: string;
  ticker: string;
};

type MarkReviewedInput = {
  portfolioId: string;
  ticker: string;
};

type DeletePortfolioInput = {
  portfolioId: string;
};

function cleanTicker(ticker: string) {
  return String(ticker ?? "")
    .trim()
    .toUpperCase();
}

function moneyNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundShares(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function resolvedTradeOrError(input: TradeOrderInput) {
  const resolved = resolveTradeOrder(input);
  if (resolved.error || resolved.value == null || resolved.price == null || resolved.shares == null) {
    return { success: false as const, error: resolved.error ?? "Enter a valid value, price and shares combination." };
  }

  if (resolved.value <= 0 || resolved.price <= 0 || resolved.shares <= 0) {
    return { success: false as const, error: "Value, price and shares must all be positive." };
  }

  return {
    success: true as const,
    value: roundTradeMoney(resolved.value),
    price: resolved.price,
    shares: roundTradeShares(resolved.shares),
  };
}

async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

async function getOrCreatePortfolio(
  supabase: SupabaseClient,
  userId: string,
  portfolioId?: string | null,
): Promise<PortfolioRecord | null> {
  if (portfolioId) {
    const { data } = await supabase
      .from("user_portfolios")
      .select(
        "id,name,cash_balance,cash_deposited_total,investment_amount,currency",
      )
      .eq("id", portfolioId)
      .eq("user_id", userId)
      .is("archived_at", null)
      .maybeSingle();

    return data as PortfolioRecord | null;
  }

  const { data: existing } = await supabase
    .from("user_portfolios")
    .select("id,name,cash_balance,cash_deposited_total,investment_amount,currency")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as PortfolioRecord;

  const { data: created, error } = await supabase
    .from("user_portfolios")
    .insert({
      user_id: userId,
      name: "My Portfolio",
      objective: "balanced",
      risk_tolerance: "moderate",
      time_horizon: "medium",
      investment_amount: 0,
      cash_balance: 0,
      cash_deposited_total: 0,
      currency: "USD",
    })
    .select("id,name,cash_balance,cash_deposited_total,investment_amount,currency")
    .single();

  if (error || !created) return null;
  return created as PortfolioRecord;
}

async function requireOwnedPortfolio(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
): Promise<PortfolioRecord | null> {
  const { data } = await supabase
    .from("user_portfolios")
    .select("id,name,cash_balance,cash_deposited_total,investment_amount,currency")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  return data as PortfolioRecord | null;
}

async function getStock(supabase: SupabaseClient, ticker: string) {
  const upperTicker = cleanTicker(ticker);

  const { data } = await supabase
    .from("stock_rankings")
    .select("ticker, price, score, rank")
    .eq("ticker", upperTicker)
    .maybeSingle();

  return data as
    | {
        ticker: string | null;
        price: number | null;
        score: number | null;
        rank: number | null;
      }
    | null;
}

function revalidatePortfolio(portfolioId?: string | null) {
  revalidatePath("/portfolio");

  if (portfolioId) {
    revalidatePath(`/portfolio?portfolio=${portfolioId}`);
  }
}

function revalidateStock(ticker: string) {
  revalidatePath(`/stock/${cleanTicker(ticker)}`);
}

async function markPortfolioChartInputsChanged({
  supabase,
  portfolioId,
  userId,
  writeCurrentSnapshot = true,
}: {
  supabase: SupabaseClient;
  portfolioId: string;
  userId: string;
  writeCurrentSnapshot?: boolean;
}) {
  await invalidatePortfolioPageSnapshot({ portfolioId, ownerId: userId });

  if (!writeCurrentSnapshot) return;

  try {
    const [{ data: portfolio }, { data: holdings }] = await Promise.all([
      supabase
        .from("user_portfolios")
        .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at")
        .eq("id", portfolioId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("portfolio_holdings")
        .select("ticker,shares,entry_price,purchase_date,added_at")
        .eq("portfolio_id", portfolioId)
        .not("ticker", "is", null),
    ]);

    if (!portfolio) return;

    const holdingRows = (holdings ?? []) as Array<{
      ticker: string | null;
      shares: number | null;
      entry_price: number | null;
      purchase_date?: string | null;
      added_at?: string | null;
    }>;
    const tickers = Array.from(new Set(holdingRows.map((holding) => cleanTicker(holding.ticker ?? "")).filter(Boolean)));
    const { data: currentRows } =
      tickers.length > 0
        ? await supabase.from("stock_rankings").select("ticker,price").in("ticker", tickers)
        : { data: [] };
    const currentPrices = Object.fromEntries(
      ((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>)
        .map((row) => [cleanTicker(row.ticker ?? ""), moneyNumber(row.price)] as const)
        .filter(([ticker, price]) => Boolean(ticker) && price > 0),
    );
    const point = buildCurrentPortfolioSnapshotPoint({
      portfolio: portfolio as {
        cash_balance?: number | null;
        cash_deposited_total?: number | null;
        investment_amount?: number | null;
      },
      holdings: holdingRows,
      currentPrices,
    });

    await saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId,
      userId,
      chartData: { "1D": [point] },
      source: "page_current_value",
    });
  } catch (error) {
    console.warn("[portfolio-chart-repair] mutation current snapshot failed", error);
  }
}

async function refreshAfterHoldingMutation({
  supabase,
  portfolioId,
  userId,
  ticker,
}: {
  supabase: SupabaseClient;
  portfolioId: string;
  userId: string;
  ticker: string;
}) {
  try {
    await markPortfolioChartInputsChanged({ supabase, portfolioId, userId });
    revalidatePortfolio(portfolioId);
    revalidateStock(ticker);
  } catch {
    console.warn("[portfolio-holding] Post-commit Portfolio refresh failed.");
  }
}

export async function previewTrading212Csv(
  csvText: string,
  options: Trading212ImportOptions,
): Promise<ActionResult<Trading212PreviewSummary>> {
  if (!csvText || csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  if (!options?.portfolioId) {
    return {
      success: false,
      error: "Choose a portfolio before importing.",
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await requireOwnedPortfolio(
    supabase,
    user.id,
    options.portfolioId,
  );

  if (!portfolio) {
    return {
      success: false,
      error: "Portfolio not found.",
    };
  }
  if (String(portfolio.currency ?? "").trim().toUpperCase() !== "USD") {
    return {
      success: false,
      error: "Trading 212 replacement is available only for a Portfolio stored unambiguously in USD.",
    };
  }

  try {
    const prepared = await prepareTrading212Import(supabase, csvText);
    if (!prepared.accepted) {
      return { success: false, error: trading212RefusalMessage(prepared) };
    }

    const { count } = await supabase
      .from("portfolio_holdings")
      .select("ticker", { count: "exact", head: true })
      .eq("portfolio_id", portfolio.id);

    return {
      success: true,
      data: {
        imported: prepared.holdings.length,
        totalValue: prepared.totalBasis,
        ignoredNonInvestmentRows: prepared.ignoredNonInvestmentRows,
        matchedTickers: prepared.matchedTickers,
        replaceWarning:
          (count ?? 0) > 0
            ? `This will replace ${count} current holding${
                count === 1 ? "" : "s"
              } in this Portfolio. Cash, net contributions and prior activity stay unchanged.`
            : "This will set the holdings in this Portfolio. Cash, net contributions and prior activity stay unchanged.",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not preview CSV.",
    };
  }
}

export async function previewTrading212CsvForNewPortfolio(
  csvText: string,
): Promise<ActionResult<Trading212PreviewSummary>> {
  if (!csvText || csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  try {
    const prepared = await prepareTrading212Import(supabase, csvText);
    if (!prepared.accepted) {
      return { success: false, error: trading212RefusalMessage(prepared) };
    }

    return {
      success: true,
      data: {
        imported: prepared.holdings.length,
        totalValue: prepared.totalBasis,
        ignoredNonInvestmentRows: prepared.ignoredNonInvestmentRows,
        matchedTickers: prepared.matchedTickers,
        replaceWarning: null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not preview CSV.",
    };
  }
}

export async function createPortfolioFromTrading212Csv(
  input: Trading212PortfolioCreateInput,
): Promise<ActionResult<Trading212PortfolioCreateSummary>> {
  const name = input.name.trim().slice(0, 80);

  if (!name) {
    return { success: false, error: "Portfolio name is required." };
  }

  if (!input.csvText || input.csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  try {
    const prepared = await prepareTrading212Import(supabase, input.csvText);
    if (!prepared.accepted) {
      return { success: false, error: trading212RefusalMessage(prepared) };
    }
    const committed = await createTrading212PortfolioAtomically(supabase, {
      name,
      holdings: prepared.holdings,
    });
    if (!committed.success) return committed;
    const portfolioId = committed.data.portfolioId;

    try {
      await markPortfolioChartInputsChanged({ supabase, portfolioId, userId: user.id });
      revalidatePortfolio(portfolioId);
      for (const holding of prepared.holdings) revalidateStock(holding.ticker);
    } catch {
      console.warn("[portfolio-csv] Post-commit CSV Portfolio refresh failed.");
    }

    return {
      success: true,
      data: {
        portfolioId,
        portfolioName: name,
        currency: "USD",
        imported: committed.data.holdingsCount,
        totalValue: committed.data.holdingsBasis,
        ignoredNonInvestmentRows: prepared.ignoredNonInvestmentRows,
        matchedTickers: prepared.matchedTickers,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not create a portfolio from this CSV.",
    };
  }
}

export async function importTrading212Csv(
  csvText: string,
  options: Trading212ImportOptions,
): Promise<ActionResult<Trading212ImportSummary>> {
  if (!csvText || csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  if (!options?.portfolioId) {
    return {
      success: false,
      error: "Choose a portfolio before importing.",
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await requireOwnedPortfolio(
    supabase,
    user.id,
    options.portfolioId,
  );

  if (!portfolio) {
    return {
      success: false,
      error: "Portfolio not found.",
    };
  }
  if (String(portfolio.currency ?? "").trim().toUpperCase() !== "USD") {
    return {
      success: false,
      error: "Trading 212 replacement is available only for a Portfolio stored unambiguously in USD.",
    };
  }

  try {
    const prepared = await prepareTrading212Import(supabase, csvText);
    if (!prepared.accepted) {
      return { success: false, error: trading212RefusalMessage(prepared) };
    }
    const committed = await replacePortfolioHoldingsFromTrading212Atomically(
      supabase,
      { portfolioId: portfolio.id, holdings: prepared.holdings },
    );
    if (!committed.success) return committed;

    try {
      await markPortfolioChartInputsChanged({
        supabase,
        portfolioId: portfolio.id,
        userId: user.id,
      });
      revalidatePortfolio(portfolio.id);
      for (const holding of prepared.holdings) revalidateStock(holding.ticker);
    } catch {
      console.warn("[portfolio-csv] Post-commit CSV replacement refresh failed.");
    }

    return {
      success: true,
      data: {
        imported: committed.data.holdingsCount,
        totalValue: committed.data.holdingsBasis,
        ignoredNonInvestmentRows: prepared.ignoredNonInvestmentRows,
        matchedTickers: prepared.matchedTickers,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not import CSV.",
    };
  }
}

export async function addCash(input: AddCashInput): Promise<ActionResult> {
  if (!input.portfolioId) {
    return { success: false, error: "Choose a portfolio." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Enter a positive cash amount." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const mutation = await mutatePortfolioCash(supabase, {
    portfolioId: input.portfolioId,
    operation: "deposit",
    amount: input.amount,
  });
  if (!mutation.success) return mutation;

  try {
    await markPortfolioChartInputsChanged({
      supabase,
      portfolioId: mutation.data.portfolioId,
      userId: user.id,
    });
    revalidatePortfolio(mutation.data.portfolioId);
  } catch {
    console.warn("[portfolio-cash] Post-commit Portfolio refresh failed.");
  }
  return { success: true };
}
export async function savePortfolio(
  portfolio: Portfolio,
  options: SavePortfolioOptions = {},
): Promise<ActionResult<{ portfolioId: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const cleanName =
    options.name?.trim().slice(0, 80) ||
    `${portfolio.riskTolerance === "aggressive" ? "Growth" : portfolio.riskTolerance === "conservative" ? "Defensive" : "Balanced"} AI Portfolio`;

  const mutation = await createAiPortfolioDraftAtomically(supabase, {
    name: cleanName,
    riskTolerance: portfolio.riskTolerance,
    timeHorizon: portfolio.timeHorizon,
    holdings: portfolio.holdings.map((holding) => ({
      ticker: cleanTicker(holding.ticker),
      shares: Number(holding.shares),
      entry_price: Number(holding.price),
      score_at_entry: Number.isFinite(holding.score) ? holding.score : null,
      rank_at_entry: Number.isInteger(holding.rank) ? holding.rank : null,
      allocation_pct: Number.isFinite(holding.allocationPct)
        ? holding.allocationPct
        : null,
    })),
  });
  if (!mutation.success) return mutation;

  try {
    await markPortfolioChartInputsChanged({
      supabase,
      portfolioId: mutation.data.portfolioId,
      userId: user.id,
    });
    revalidatePortfolio(mutation.data.portfolioId);
    for (const holding of portfolio.holdings) revalidateStock(holding.ticker);
  } catch {
    console.warn("[portfolio-creation] Post-commit AI Portfolio refresh failed.");
  }

  return { success: true, data: { portfolioId: mutation.data.portfolioId } };
}

export async function createManualPortfolio(
  input: ManualPortfolioInput,
): Promise<ActionResult<{ portfolioId: string }>> {
  const name = input.name.trim().slice(0, 80);
  const goalMap = {
    growth: { riskTolerance: "aggressive", timeHorizon: "long" },
    income: { riskTolerance: "moderate", timeHorizon: "medium" },
    balanced: { riskTolerance: "moderate", timeHorizon: "medium" },
    watchlist: { riskTolerance: "conservative", timeHorizon: "medium" },
    "long-term": { riskTolerance: "moderate", timeHorizon: "long" },
  } as const;

  if (!name) {
    return { success: false, error: "Portfolio name is required." };
  }

  if (
    !Number.isFinite(input.startingCash) ||
    input.startingCash < 0 ||
    input.startingCash > 100_000_000
  ) {
    return { success: false, error: "Starting cash must be zero or more." };
  }

  if (!goalMap[input.goal]) {
    return { success: false, error: "Choose a valid portfolio goal." };
  }

  if (input.holdings.length > 100) {
    return { success: false, error: "A manual portfolio can contain up to 100 holdings." };
  }

  if (input.holdings.length === 0 && input.startingCash === 0) {
    return {
      success: false,
      error: "Add at least one holding or enter starting cash.",
    };
  }

  const cleanedHoldings = input.holdings.map((holding) => ({
    ticker: cleanTicker(holding.ticker),
    shares: Number(holding.shares),
    averagePrice: Number(holding.averagePrice),
    purchaseDate: holding.purchaseDate?.trim() || null,
    notes: holding.notes?.trim().slice(0, 500) || null,
  }));

  const seenTickers = new Set<string>();

  for (const holding of cleanedHoldings) {
    if (!holding.ticker || !/^[A-Z][A-Z0-9.-]{0,11}$/.test(holding.ticker)) {
      return { success: false, error: "Every holding needs a valid ticker." };
    }
    if (seenTickers.has(holding.ticker)) {
      return {
        success: false,
        error: `${holding.ticker} appears more than once. Edit the existing row instead.`,
      };
    }
    if (!Number.isFinite(holding.shares) || holding.shares <= 0) {
      return {
        success: false,
        error: `${holding.ticker} needs a positive share quantity.`,
      };
    }
    if (!Number.isFinite(holding.averagePrice) || holding.averagePrice <= 0) {
      return {
        success: false,
        error: `${holding.ticker} needs a positive average price.`,
      };
    }
    seenTickers.add(holding.ticker);
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const tickers = cleanedHoldings.map((holding) => holding.ticker);
  const { data: stockRows, error: stockError } =
    tickers.length > 0
      ? await supabase
          .from("stock_rankings")
          .select("ticker,price,score,rank")
          .in("ticker", tickers)
      : { data: [], error: null };

  const stocks = new Map(
    ((stockRows ?? []) as Array<{
      ticker: string | null;
      price: number | null;
      score: number | null;
      rank: number | null;
    }>).map((stock) => [String(stock.ticker ?? "").toUpperCase(), stock]),
  );

  if (stockError) {
    console.warn("[portfolio-creation] Ranking metadata was unavailable during manual creation.");
  }
  const estimatedHoldingsValue = cleanedHoldings.reduce((sum, holding) => {
    const currentPrice = moneyNumber(stocks.get(holding.ticker)?.price);
    return sum + holding.shares * (currentPrice || holding.averagePrice);
  }, 0);
  const estimatedTotalValue = input.startingCash + estimatedHoldingsValue;
  const goal = goalMap[input.goal];
  const mutation = await createManualPortfolioAtomically(supabase, {
    name,
    objective: input.goal === "long-term" ? "growth" : input.goal,
    riskTolerance: goal.riskTolerance,
    timeHorizon: goal.timeHorizon,
    startingCash: input.startingCash,
    holdings: cleanedHoldings.map((holding) => {
      const stock = stocks.get(holding.ticker);
      const currentPrice = moneyNumber(stock?.price) || holding.averagePrice;
      const estimatedValue = holding.shares * currentPrice;
      return {
        ticker: holding.ticker,
        shares: holding.shares,
        entry_price: holding.averagePrice,
        purchase_date: holding.purchaseDate,
        notes: holding.notes,
        score_at_entry: stock?.score ?? null,
        rank_at_entry: stock?.rank ?? null,
        allocation_pct:
          estimatedTotalValue > 0
            ? Math.round((estimatedValue / estimatedTotalValue) * 10_000) / 100
            : null,
      };
    }),
  });
  if (!mutation.success) return mutation;

  try {
    await markPortfolioChartInputsChanged({
      supabase,
      portfolioId: mutation.data.portfolioId,
      userId: user.id,
    });
    revalidatePortfolio(mutation.data.portfolioId);
    for (const holding of cleanedHoldings) revalidateStock(holding.ticker);
  } catch {
    console.warn("[portfolio-creation] Post-commit manual Portfolio refresh failed.");
  }

  return { success: true, data: { portfolioId: mutation.data.portfolioId } };
}

export async function renamePortfolio(
  input: RenamePortfolioInput,
): Promise<ActionResult> {
  const name = input.name.trim().slice(0, 80);

  if (!name) return { success: false, error: "Portfolio name cannot be empty." };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("user_portfolios")
    .update({ name })
    .eq("id", input.portfolioId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  await markPortfolioChartInputsChanged({
    supabase,
    portfolioId: input.portfolioId,
    userId: user.id,
    writeCurrentSnapshot: false,
  });
  revalidatePortfolio(input.portfolioId);
  return { success: true };
}

export async function updatePortfolioPreferences(
  input: UpdatePortfolioPreferencesInput,
): Promise<ActionResult> {
  const allowedObjectives = new Set<PortfolioObjective>([
    "growth",
    "income",
    "balanced",
    "capital_preservation",
    "watchlist",
  ]);
  const allowedRisk = new Set<PortfolioRiskTolerance>([
    "conservative",
    "moderate",
    "aggressive",
  ]);
  const allowedHorizon = new Set<PortfolioTimeHorizon>(["short", "medium", "long"]);

  if (!allowedObjectives.has(input.objective)) {
    return { success: false, error: "Choose a valid portfolio objective." };
  }
  if (!allowedRisk.has(input.riskTolerance)) {
    return { success: false, error: "Choose a valid risk tolerance." };
  }
  if (!allowedHorizon.has(input.timeHorizon)) {
    return { success: false, error: "Choose a valid time horizon." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("user_portfolios")
    .update({
      objective: input.objective,
      risk_tolerance: input.riskTolerance,
      time_horizon: input.timeHorizon,
    })
    .eq("id", input.portfolioId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  await markPortfolioChartInputsChanged({
    supabase,
    portfolioId: input.portfolioId,
    userId: user.id,
    writeCurrentSnapshot: false,
  });
  revalidatePortfolio(input.portfolioId);
  return { success: true };
}

export async function logExistingHolding(
  input: LogExistingHoldingInput,
): Promise<ActionResult<{ portfolioId: string; updatedExisting: boolean }>> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };
  if (!input.portfolioId) return { success: false, error: "Choose a portfolio." };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const stock = await getStock(supabase, upperTicker);

  const preferredPrice =
    input.price && Number.isFinite(input.price) && input.price > 0
      ? input.price
      : input.entryPrice && Number.isFinite(input.entryPrice) && input.entryPrice > 0
        ? input.entryPrice
        : moneyNumber(stock?.price);
  const trade = resolvedTradeOrError({
    value: input.value,
    price: preferredPrice,
    shares: input.shares,
  });

  if (!trade.success) {
    return { success: false, error: trade.error };
  }

  const mutation = await logExistingPortfolioHolding(supabase, {
    portfolioId: input.portfolioId,
    ticker: upperTicker,
    shares: trade.shares,
    entryPrice: trade.price,
    purchaseDate: input.purchaseDate ?? null,
    notes: input.notes ?? null,
  });
  if (!mutation.success) return mutation;

  await refreshAfterHoldingMutation({
    supabase,
    portfolioId: mutation.data.portfolioId,
    userId: user.id,
    ticker: upperTicker,
  });

  return {
    success: true,
    data: {
      portfolioId: mutation.data.portfolioId,
      updatedExisting: Boolean(mutation.data.updatedExisting),
    },
  };
}

export async function buyHoldingWithCash(
  input: BuyHoldingWithCashInput,
): Promise<ActionResult<{ portfolioId: string; updatedExisting: boolean }>> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };
  if (!input.portfolioId) return { success: false, error: "Choose a portfolio." };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const stock = await getStock(supabase, upperTicker);

  const preferredPrice =
    input.price && Number.isFinite(input.price) && input.price > 0
      ? input.price
      : input.entryPrice && Number.isFinite(input.entryPrice) && input.entryPrice > 0
        ? input.entryPrice
        : moneyNumber(stock?.price);
  const trade = resolvedTradeOrError({
    value: input.value ?? input.dollarAmount,
    price: preferredPrice,
    shares: input.shares,
  });

  if (!trade.success) {
    return { success: false, error: trade.error };
  }

  const mutation = await buyPortfolioHolding(supabase, {
    portfolioId: input.portfolioId,
    ticker: upperTicker,
    shares: trade.shares,
    price: trade.price,
    purchaseDate: input.purchaseDate ?? null,
    notes: input.notes ?? null,
  });
  if (!mutation.success) return mutation;

  await refreshAfterHoldingMutation({
    supabase,
    portfolioId: mutation.data.portfolioId,
    userId: user.id,
    ticker: upperTicker,
  });

  return {
    success: true,
    data: {
      portfolioId: mutation.data.portfolioId,
      updatedExisting: Boolean(mutation.data.updatedExisting),
    },
  };
}

export async function updateHoldingDetails(
  input: UpdateHoldingDetailsInput,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  if (!Number.isFinite(input.shares) || input.shares <= 0) {
    return { success: false, error: "Invalid share count." };
  }

  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
    return { success: false, error: "Invalid entry price." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const mutation = await correctPortfolioHolding(supabase, {
    portfolioId: input.portfolioId,
    ticker: upperTicker,
    shares: input.shares,
    entryPrice: input.entryPrice,
    purchaseDate: input.purchaseDate ?? null,
    notes: input.notes ?? null,
  });
  if (!mutation.success) return mutation;

  await refreshAfterHoldingMutation({
    supabase,
    portfolioId: mutation.data.portfolioId,
    userId: user.id,
    ticker: upperTicker,
  });

  return { success: true };
}

export async function trimHolding(
  input: TrimHoldingInput,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: holding } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price")
    .eq("portfolio_id", input.portfolioId)
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!holding) return { success: false, error: "Holding not found." };

  const stock = await getStock(supabase, upperTicker);

  const tradeHolding = holding as PortfolioHoldingTradeRow;
  const currentShares = moneyNumber(tradeHolding.shares);
  const entryPrice = moneyNumber(tradeHolding.entry_price);
  const fallbackPrice = moneyNumber(stock?.price, entryPrice);

  if (currentShares <= 0 || fallbackPrice <= 0) {
    return { success: false, error: "Could not calculate sell value." };
  }

  const percentage = Number(input.percentage);
  const hasExplicitOrder = input.value != null || input.price != null || input.shares != null;
  const resolvedOrder = hasExplicitOrder
    ? resolvedTradeOrError({
        value: input.value,
        price: input.price ?? fallbackPrice,
        shares: input.shares,
      })
    : Number.isFinite(percentage) && percentage > 0 && percentage <= 100
      ? resolvedTradeOrError({
          value: null,
          price: fallbackPrice,
          shares: percentage >= 100 ? currentShares : roundShares(currentShares * (percentage / 100)),
        })
      : { success: false as const, error: "Enter any two of value, price and shares." };

  if (!resolvedOrder.success) {
    return { success: false, error: resolvedOrder.error };
  }

  const sharesToSell = resolvedOrder.shares;
  const sellPrice = resolvedOrder.price;

  if (sharesToSell > currentShares + 0.000001) {
    return { success: false, error: "You cannot sell more shares than this holding contains." };
  }

  const mutation = await sellPortfolioHolding(supabase, {
    portfolioId: input.portfolioId,
    ticker: upperTicker,
    shares: sharesToSell,
    price: sellPrice,
  });
  if (!mutation.success) return mutation;

  await refreshAfterHoldingMutation({
    supabase,
    portfolioId: mutation.data.portfolioId,
    userId: user.id,
    ticker: upperTicker,
  });

  return { success: true };
}

export async function removeHolding(
  input: RemoveHoldingInput,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const mutation = await removePortfolioHoldingTracking(supabase, {
    portfolioId: input.portfolioId,
    ticker: upperTicker,
  });
  if (!mutation.success) return mutation;

  await refreshAfterHoldingMutation({
    supabase,
    portfolioId: mutation.data.portfolioId,
    userId: user.id,
    ticker: upperTicker,
  });

  return { success: true };
}

export async function markReviewed(
  input: MarkReviewedInput | string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio =
    typeof input === "string"
      ? await getOrCreatePortfolio(supabase, user.id, null)
      : await requireOwnedPortfolio(supabase, user.id, input.portfolioId);

  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const ticker = typeof input === "string" ? input : input.ticker;
  const upperTicker = cleanTicker(ticker);

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  await markPortfolioChartInputsChanged({
    supabase,
    portfolioId: portfolio.id,
    userId: user.id,
    writeCurrentSnapshot: false,
  });
  revalidatePortfolio(portfolio.id);
  revalidateStock(upperTicker);

  return { success: true };
}

export async function deletePortfolio(
  input: DeletePortfolioInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  if (!input.portfolioId) return { success: false, error: "Portfolio not found." };

  const { data: holdings } = await supabase
    .from("portfolio_holdings")
    .select("ticker")
    .eq("portfolio_id", input.portfolioId);

  const tickers = ((holdings ?? []) as Array<{ ticker: string | null }>)
    .map((holding) => cleanTicker(holding.ticker ?? ""))
    .filter(Boolean);

  const mutation = await deleteOwnedPortfolioAtomically(supabase, input.portfolioId);
  if (!mutation.success) return mutation;

  try {
    await markPortfolioChartInputsChanged({
      supabase,
      portfolioId: mutation.data.portfolioId,
      userId: user.id,
      writeCurrentSnapshot: false,
    });
    revalidatePortfolio();
    for (const ticker of tickers) revalidateStock(ticker);
  } catch {
    console.warn("[portfolio-deletion] Post-commit Portfolio refresh failed.");
  }

  return { success: true };
}
