"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Portfolio } from "@/lib/portfolio";
import { invalidatePortfolioPageSnapshot } from "@/lib/portfolio-speed-cache";
import {
  buildCurrentPortfolioSnapshotPoint,
  buildMinimalCurrentChartData,
  saveLatestPortfolioSnapshotFromChartData,
} from "@/lib/portfolio-snapshots";

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type PortfolioRecord = {
  id: string;
  name?: string | null;
  cash_balance?: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  currency?: string | null;
};

type PortfolioBalanceRow = Pick<
  PortfolioRecord,
  "cash_balance" | "cash_deposited_total"
>;

type PortfolioHoldingTradeRow = {
  shares?: number | null;
  entry_price?: number | null;
  purchase_date?: string | null;
  notes?: string | null;
};

type ParsedCsvRow = Record<string, string>;

type ParsedHolding = {
  ticker: string;
  shares: number;
  entryPrice: number;
  value: number;
  purchaseDate: string | null;
};

type Trading212ImportOptions = {
  portfolioId?: string | null;
  replaceExisting?: boolean;
};

type Trading212ImportSummary = {
  imported: number;
  skipped: number;
  totalValue: number;
  skippedTickers: string[];
};

type Trading212PreviewSummary = Trading212ImportSummary & {
  matchedTickers: string[];
  replaceWarning?: string | null;
};

type Trading212PortfolioCreateInput = {
  name: string;
  csvText: string;
  currency?: "USD";
};

type Trading212PortfolioCreateSummary = Trading212ImportSummary & {
  portfolioId: string;
  portfolioName: string;
  currency: "USD";
  matchedTickers: string[];
};

type StockMatch = {
  ticker: string;
  price: number;
  score: number | null;
  rank: number | null;
};

type PreparedImportHolding = {
  portfolio_id: string;
  ticker: string;
  entry_price: number;
  shares: number;
  allocation_pct: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  last_reviewed_at: string;
  purchase_date: string | null;
  source: string;
  notes: string | null;
};

type SavePortfolioOptions = {
  name?: string;
  mode?: "create_new" | "replace_current";
  portfolioId?: string | null;
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
  currency: "GBP" | "USD" | "EUR";
  startingCash: number;
  goal: "growth" | "income" | "balanced" | "watchlist" | "long-term";
  holdings: ManualPortfolioHoldingInput[];
};

type AddCashInput = {
  portfolioId?: string | null;
  amount: number;
};

type RenamePortfolioInput = {
  portfolioId: string;
  name: string;
};

type LogExistingHoldingInput = {
  portfolioId?: string | null;
  ticker: string;
  shares: number;
  entryPrice?: number | null;
  purchaseDate?: string | null;
  notes?: string | null;
};

type BuyHoldingWithCashInput = {
  portfolioId?: string | null;
  ticker: string;
  dollarAmount: number;
  entryPrice?: number | null;
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
  percentage: number;
};

type RemoveHoldingInput = {
  portfolioId: string;
  ticker: string;
  creditCash?: boolean;
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

function cleanBrokerTicker(ticker: string) {
  return cleanTicker(ticker)
    .replace(/\s.*$/, "")
    .replace(/:US$/, "")
    .replace(/\.US$/, "")
    .replace(/-US$/, "")
    .replace(/_US$/, "");
}

function tickerVariants(ticker: string) {
  const base = cleanBrokerTicker(ticker);
  const variants = new Set<string>();

  if (!base) return [];

  variants.add(base);
  variants.add(base.replace(/\./g, "-"));
  variants.add(base.replace(/-/g, "."));

  if (base.includes(".")) {
    variants.add(base.split(".")[0]);
  }

  return Array.from(variants).filter(Boolean);
}

function moneyNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundShares(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normaliseHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(csvText: string): ParsedCsvRow[] {
  const cleaned = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!cleaned) return [];

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normaliseHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: ParsedCsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function getFirstValue(row: ParsedCsvRow, possibleHeaders: string[]) {
  for (const header of possibleHeaders) {
    const value = row[normaliseHeader(header)];

    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function parseFlexibleNumber(value: string) {
  const cleaned = value
    .replace(/[£$€,%]/g, "")
    .replace(/\s/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/,/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parsePossibleDate(value: string) {
  const raw = value.trim();

  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${month}-${day}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return null;
}

function parseTrading212Holdings(csvText: string): ParsedHolding[] {
  const rows = parseCsv(csvText);
  const holdingsByTicker = new Map<string, ParsedHolding>();

  for (const row of rows) {
    const tickerRaw = getFirstValue(row, [
      "Ticker",
      "Symbol",
      "Instrument ticker",
      "Instrument",
      "ISIN ticker",
    ]);

    const ticker = cleanBrokerTicker(tickerRaw);

    if (!ticker || ticker.length > 16) continue;

    const action = getFirstValue(row, [
      "Action",
      "Type",
      "Transaction type",
      "Event",
    ]).toLowerCase();

    if (
      action &&
      ![
        "buy",
        "market buy",
        "limit buy",
        "sell",
        "market sell",
        "limit sell",
      ].some((allowed) => action.includes(allowed))
    ) {
      continue;
    }

    const shareValue = getFirstValue(row, [
      "No. of shares",
      "No of shares",
      "Shares",
      "Quantity",
      "Qty",
      "Number of shares",
      "Filled quantity",
    ]);

    const priceValue = getFirstValue(row, [
      "Price / share",
      "Price per share",
      "Price",
      "Average price",
      "Avg price",
      "Avg. price",
      "Execution price",
    ]);

    const totalValue = getFirstValue(row, [
      "Total",
      "Total value",
      "Value",
      "Amount",
      "Result",
      "Order value",
    ]);

    const dateValue = getFirstValue(row, [
      "Date",
      "Time",
      "Created",
      "Execution time",
      "Trading time",
      "Transaction date",
    ]);

    let shares = Math.abs(parseFlexibleNumber(shareValue));
    const price = Math.abs(parseFlexibleNumber(priceValue));
    const value = Math.abs(parseFlexibleNumber(totalValue));
    const purchaseDate = parsePossibleDate(dateValue);

    if (shares <= 0 && price > 0 && value > 0) {
      shares = value / price;
    }

    if (shares <= 0) continue;

    const isSell = action.includes("sell");
    const signedShares = isSell ? -shares : shares;
    const signedValue = isSell
      ? -Math.abs(value || shares * price)
      : Math.abs(value || shares * price);

    const existing = holdingsByTicker.get(ticker);

    if (!existing) {
      holdingsByTicker.set(ticker, {
        ticker,
        shares: signedShares,
        entryPrice: price > 0 ? price : 0,
        value: signedValue,
        purchaseDate,
      });
      continue;
    }

    const oldCost = existing.entryPrice * existing.shares;
    const newShares = existing.shares + signedShares;
    const newCost = oldCost + signedValue;

    holdingsByTicker.set(ticker, {
      ticker,
      shares: newShares,
      entryPrice:
        newShares > 0 && newCost > 0 ? newCost / newShares : existing.entryPrice,
      value: Math.max(0, newCost),
      purchaseDate: existing.purchaseDate ?? purchaseDate,
    });
  }

  return Array.from(holdingsByTicker.values())
    .filter((holding) => holding.shares > 0)
    .map((holding) => ({
      ...holding,
      shares: roundShares(holding.shares),
      entryPrice: Math.round(holding.entryPrice * 10_000) / 10_000,
      value: roundMoney(holding.value),
    }));
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

async function recordTransaction(
  supabase: SupabaseClient,
  input: {
    portfolioId: string;
    userId: string;
    ticker?: string | null;
    type:
      | "deposit"
      | "withdrawal"
      | "buy"
      | "sell"
      | "import"
      | "log_existing"
      | "adjustment"
      | "cash_adjustment";
    shares?: number | null;
    price?: number | null;
    amount?: number | null;
    realisedPnl?: number | null;
    currency?: string | null;
    notes?: string | null;
  },
) {
  const { error } = await supabase.from("portfolio_transactions").insert({
    portfolio_id: input.portfolioId,
    user_id: input.userId,
    ticker: input.ticker ?? null,
    type: input.type,
    shares: input.shares ?? null,
    price: input.price ?? null,
    amount: roundMoney(input.amount ?? 0),
    realised_pnl:
      input.realisedPnl == null ? null : roundMoney(Number(input.realisedPnl)),
    currency: input.currency ?? "USD",
    notes: input.notes ?? null,
  });

  if (error) {
    console.error("Failed to record portfolio transaction:", error.message);
  }
}

async function recalculatePortfolioTotals(
  supabase: SupabaseClient,
  portfolioId: string,
  options: {
    ensureDepositedCoversCurrentValue?: boolean;
  } = {},
) {
  const [{ data: holdings }, { data: portfolio }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("entry_price,shares")
      .eq("portfolio_id", portfolioId),

    supabase
      .from("user_portfolios")
      .select("cash_balance,cash_deposited_total")
      .eq("id", portfolioId)
      .maybeSingle(),
  ]);

  const holdingsCost = ((holdings ?? []) as Array<{
    entry_price: number | null;
    shares: number | null;
  }>).reduce(
    (sum, holding) =>
      sum + moneyNumber(holding.entry_price) * moneyNumber(holding.shares),
    0,
  );

  const balance = portfolio as PortfolioBalanceRow | null;
  const currentCash = moneyNumber(balance?.cash_balance);
  const currentDeposited = moneyNumber(balance?.cash_deposited_total);
  const minimumDeposited = currentCash + holdingsCost;

  const nextDeposited = options.ensureDepositedCoversCurrentValue
    ? Math.max(currentDeposited, minimumDeposited)
    : currentDeposited;

  await supabase
    .from("user_portfolios")
    .update({
      investment_amount: roundMoney(holdingsCost),
      cash_deposited_total: roundMoney(nextDeposited),
    })
    .eq("id", portfolioId);
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
      chartData: buildMinimalCurrentChartData(point),
      source: "page_current_value",
    });
  } catch (error) {
    console.warn("[portfolio-chart-repair] mutation current snapshot failed", error);
  }
}

async function prepareTrading212Import(
  supabase: SupabaseClient,
  portfolioId: string,
  parsedHoldings: ParsedHolding[],
): Promise<{
  holdingsToInsert: PreparedImportHolding[];
  skippedTickers: string[];
  matchedTickers: string[];
  importedValue: number;
}> {
  const queryTickers = Array.from(
    new Set(parsedHoldings.flatMap((holding) => tickerVariants(holding.ticker))),
  );

  const { data: stocks, error: stockError } = await supabase
    .from("stock_rankings")
    .select("ticker, price, score, rank")
    .in("ticker", queryTickers);

  if (stockError) throw new Error(stockError.message);

  const stockMap = new Map<string, StockMatch>();

  ((stocks ?? []) as Array<{
    ticker: string | null;
    price: number | null;
    score: number | null;
    rank: number | null;
  }>).forEach((stock) => {
    if (!stock.ticker) return;

    stockMap.set(cleanTicker(stock.ticker), {
      ticker: cleanTicker(stock.ticker),
      price: moneyNumber(stock.price),
      score: nullableNumber(stock.score),
      rank: nullableNumber(stock.rank),
    });
  });

  function findMatch(ticker: string) {
    for (const variant of tickerVariants(ticker)) {
      const match = stockMap.get(variant);
      if (match) return match;
    }

    return null;
  }

  const byCanonicalTicker = new Map<
    string,
    {
      ticker: string;
      shares: number;
      entryPrice: number;
      purchaseDate: string | null;
      stock: StockMatch;
    }
  >();

  const skippedTickers: string[] = [];

  for (const holding of parsedHoldings) {
    const match = findMatch(holding.ticker);

    if (!match) {
      skippedTickers.push(holding.ticker);
      continue;
    }

    const canonical = match.ticker;
    const entryPrice = holding.entryPrice > 0 ? holding.entryPrice : match.price;
    const existing = byCanonicalTicker.get(canonical);

    if (!existing) {
      byCanonicalTicker.set(canonical, {
        ticker: canonical,
        shares: holding.shares,
        entryPrice,
        purchaseDate: holding.purchaseDate,
        stock: match,
      });
      continue;
    }

    const oldCost = existing.entryPrice * existing.shares;
    const newCost = entryPrice * holding.shares;
    const nextShares = existing.shares + holding.shares;

    byCanonicalTicker.set(canonical, {
      ticker: canonical,
      shares: roundShares(nextShares),
      entryPrice: nextShares > 0 ? (oldCost + newCost) / nextShares : entryPrice,
      purchaseDate: existing.purchaseDate ?? holding.purchaseDate,
      stock: match,
    });
  }

  const now = new Date().toISOString();

  const holdingsToInsert = Array.from(byCanonicalTicker.values()).map((holding) => ({
    portfolio_id: portfolioId,
    ticker: holding.ticker,
    entry_price: Math.round(holding.entryPrice * 10_000) / 10_000,
    shares: roundShares(holding.shares),
    allocation_pct: null,
    score_at_entry: holding.stock.score,
    rank_at_entry: holding.stock.rank,
    last_reviewed_at: now,
    purchase_date: holding.purchaseDate,
    source: "trading212",
    notes: "Imported from Trading 212 CSV.",
  }));

  const importedValue = holdingsToInsert.reduce(
    (sum, holding) => sum + moneyNumber(holding.entry_price) * moneyNumber(holding.shares),
    0,
  );

  return {
    holdingsToInsert,
    skippedTickers: Array.from(new Set(skippedTickers)),
    matchedTickers: holdingsToInsert.map((holding) => holding.ticker),
    importedValue: roundMoney(importedValue),
  };
}

export async function previewTrading212Csv(
  csvText: string,
  options: Trading212ImportOptions = {},
): Promise<ActionResult<Trading212PreviewSummary>> {
  if (!csvText || csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  if (!options.portfolioId) {
    return {
      success: false,
      error: "Choose a portfolio before importing.",
    };
  }

  const parsedHoldings = parseTrading212Holdings(csvText);

  if (parsedHoldings.length === 0) {
    return {
      success: false,
      error:
        "No holdings could be found. Export your Trading 212 Invest/ISA history as CSV and make sure it includes ticker, shares and price/value columns.",
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

  try {
    const prepared = await prepareTrading212Import(
      supabase,
      portfolio.id,
      parsedHoldings,
    );

    const { count } = await supabase
      .from("portfolio_holdings")
      .select("ticker", { count: "exact", head: true })
      .eq("portfolio_id", portfolio.id);

    return {
      success: true,
      data: {
        imported: prepared.holdingsToInsert.length,
        skipped: prepared.skippedTickers.length,
        totalValue: prepared.importedValue,
        skippedTickers: prepared.skippedTickers,
        matchedTickers: prepared.matchedTickers,
        replaceWarning:
          options.replaceExisting && (count ?? 0) > 0
            ? `This will replace ${count} current holding${
                count === 1 ? "" : "s"
              } inside this selected portfolio only.`
            : null,
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

  const parsedHoldings = parseTrading212Holdings(csvText);

  if (parsedHoldings.length === 0) {
    return {
      success: false,
      error:
        "No holdings could be found. Export your Trading 212 Invest/ISA history as CSV and make sure it includes ticker, shares and price/value columns.",
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  try {
    const prepared = await prepareTrading212Import(
      supabase,
      "new-portfolio-preview",
      parsedHoldings,
    );

    return {
      success: true,
      data: {
        imported: prepared.holdingsToInsert.length,
        skipped: prepared.skippedTickers.length,
        totalValue: prepared.importedValue,
        skippedTickers: prepared.skippedTickers,
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
  const currency = input.currency ?? "USD";

  if (!name) {
    return { success: false, error: "Portfolio name is required." };
  }

  if (currency !== "USD") {
    return {
      success: false,
      error:
        "Trading 212 import currently uses StockGPT's USD ranked-stock price feed. Create the portfolio in USD for this import.",
    };
  }

  if (!input.csvText || input.csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  const parsedHoldings = parseTrading212Holdings(input.csvText);

  if (parsedHoldings.length === 0) {
    return {
      success: false,
      error:
        "No holdings could be found. Export your Trading 212 Invest/ISA history as CSV and make sure it includes ticker, shares and price/value columns.",
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  try {
    const prepared = await prepareTrading212Import(
      supabase,
      "new-portfolio",
      parsedHoldings,
    );

    if (prepared.holdingsToInsert.length === 0) {
      return {
        success: false,
        error:
          "None of the CSV tickers matched StockGPT rankings. Check that the export contains supported US stock tickers rather than only names/ISINs.",
      };
    }

    const { data: created, error: createError } = await supabase
      .from("user_portfolios")
      .insert({
        user_id: user.id,
        name,
        risk_tolerance: "moderate",
        time_horizon: "medium",
        investment_amount: prepared.importedValue,
        cash_balance: 0,
        cash_deposited_total: prepared.importedValue,
        currency,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return {
        success: false,
        error: createError?.message ?? "Could not create the portfolio.",
      };
    }

    const portfolioId = String(created.id);
    const holdingsToInsert = prepared.holdingsToInsert.map((holding) => ({
      ...holding,
      portfolio_id: portfolioId,
    }));

    const { error: holdingsError } = await supabase
      .from("portfolio_holdings")
      .insert(holdingsToInsert);

    if (holdingsError) {
      await supabase
        .from("user_portfolios")
        .delete()
        .eq("id", portfolioId)
        .eq("user_id", user.id);

      return { success: false, error: holdingsError.message };
    }

    await recordTransaction(supabase, {
      portfolioId,
      userId: user.id,
      type: "import",
      amount: prepared.importedValue,
      currency,
      notes: `Created normal portfolio from Trading 212 CSV with ${holdingsToInsert.length} imported holding${
        holdingsToInsert.length === 1 ? "" : "s"
      }.`,
    });

    await markPortfolioChartInputsChanged({ supabase, portfolioId, userId: user.id });
    revalidatePortfolio(portfolioId);

    for (const holding of holdingsToInsert) {
      revalidateStock(holding.ticker);
    }

    return {
      success: true,
      data: {
        portfolioId,
        portfolioName: name,
        currency,
        imported: prepared.holdingsToInsert.length,
        skipped: prepared.skippedTickers.length,
        totalValue: prepared.importedValue,
        skippedTickers: prepared.skippedTickers,
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
  options: Trading212ImportOptions = {},
): Promise<ActionResult<Trading212ImportSummary>> {
  if (!csvText || csvText.length > 2_000_000) {
    return {
      success: false,
      error: "Upload a valid Trading 212 CSV under 2MB.",
    };
  }

  if (!options.portfolioId) {
    return {
      success: false,
      error: "Choose a portfolio before importing.",
    };
  }

  const parsedHoldings = parseTrading212Holdings(csvText);

  if (parsedHoldings.length === 0) {
    return {
      success: false,
      error:
        "No holdings could be found. Export your Trading 212 Invest/ISA history as CSV and make sure it includes ticker, shares and price/value columns.",
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

  try {
    const prepared = await prepareTrading212Import(
      supabase,
      portfolio.id,
      parsedHoldings,
    );

    if (prepared.holdingsToInsert.length === 0) {
      return {
        success: false,
        error:
          "None of the CSV tickers matched StockGPT rankings. Check that the export contains US stock tickers rather than only names/ISINs.",
      };
    }

    if (options.replaceExisting) {
      const { error: deleteError } = await supabase
        .from("portfolio_holdings")
        .delete()
        .eq("portfolio_id", portfolio.id);

      if (deleteError) {
        return {
          success: false,
          error: deleteError.message,
        };
      }
    }

    const { error: upsertError } = await supabase
      .from("portfolio_holdings")
      .upsert(prepared.holdingsToInsert, {
        onConflict: "portfolio_id,ticker",
      });

    if (upsertError) {
      return {
        success: false,
        error: upsertError.message,
      };
    }

    await recordTransaction(supabase, {
      portfolioId: portfolio.id,
      userId: user.id,
      type: "import",
      amount: prepared.importedValue,
      currency: portfolio.currency ?? "USD",
      notes: `Imported ${prepared.holdingsToInsert.length} holding${
        prepared.holdingsToInsert.length === 1 ? "" : "s"
      } from Trading 212 CSV${
        options.replaceExisting ? " using replace mode" : ""
      }.`,
    });

    await recalculatePortfolioTotals(supabase, portfolio.id, {
      ensureDepositedCoversCurrentValue: true,
    });

    await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
    revalidatePortfolio(portfolio.id);

    for (const holding of prepared.holdingsToInsert) {
      revalidateStock(holding.ticker);
    }

    return {
      success: true,
      data: {
        imported: prepared.holdingsToInsert.length,
        skipped: prepared.skippedTickers.length,
        totalValue: prepared.importedValue,
        skippedTickers: prepared.skippedTickers,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not import CSV.",
    };
  }
}

export async function addCash(
  input: AddCashInput | number,
): Promise<ActionResult> {
  const amount = typeof input === "number" ? input : input.amount;
  const portfolioId = typeof input === "number" ? null : input.portfolioId ?? null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a positive cash amount." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(supabase, user.id, portfolioId);

  if (!portfolio) {
    return {
      success: false,
      error: portfolioId ? "Portfolio not found." : "Could not create portfolio.",
    };
  }

  const currentCash = moneyNumber(portfolio.cash_balance);
  const currentDeposited = moneyNumber(portfolio.cash_deposited_total);

  const { error } = await supabase
    .from("user_portfolios")
    .update({
      cash_balance: roundMoney(currentCash + amount),
      cash_deposited_total: roundMoney(currentDeposited + amount),
    })
    .eq("id", portfolio.id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  await recordTransaction(supabase, {
    portfolioId: portfolio.id,
    userId: user.id,
    type: "deposit",
    amount,
    currency: portfolio.currency ?? "USD",
    notes: "Cash added manually.",
  });

  await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
  revalidatePortfolio(portfolio.id);
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

  const replacing =
    options.mode === "replace_current" && options.portfolioId
      ? await requireOwnedPortfolio(supabase, user.id, options.portfolioId)
      : null;

  let portfolioId = replacing?.id ?? null;

  if (replacing) {
    const { error: updateError } = await supabase
      .from("user_portfolios")
      .update({
        name: cleanName,
        risk_tolerance: portfolio.riskTolerance,
        time_horizon: portfolio.timeHorizon,
        investment_amount: portfolio.totalInvested,
        cash_balance: 0,
        cash_deposited_total: portfolio.totalInvested,
        currency: "USD",
      })
      .eq("id", replacing.id)
      .eq("user_id", user.id);

    if (updateError) return { success: false, error: updateError.message };

    const { error: deleteError } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("portfolio_id", replacing.id);

    if (deleteError) return { success: false, error: deleteError.message };
  } else {
    const { data: created, error: createError } = await supabase
      .from("user_portfolios")
      .insert({
        user_id: user.id,
        name: cleanName,
        risk_tolerance: portfolio.riskTolerance,
        time_horizon: portfolio.timeHorizon,
        investment_amount: portfolio.totalInvested,
        cash_balance: 0,
        cash_deposited_total: portfolio.totalInvested,
        currency: "USD",
      })
      .select("id")
      .single();

    if (createError || !created) {
      return {
        success: false,
        error: createError?.message ?? "Could not save portfolio.",
      };
    }

    portfolioId = created.id;
  }

  if (!portfolioId) {
    return {
      success: false,
      error: "Could not save portfolio.",
    };
  }

  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const holdingsToInsert = portfolio.holdings.map((holding) => ({
    portfolio_id: portfolioId,
    ticker: holding.ticker,
    entry_price: holding.price,
    allocation_pct: holding.allocationPct,
    shares: holding.shares,
    score_at_entry: holding.score,
    rank_at_entry: holding.rank,
    last_reviewed_at: now,
    purchase_date: today,
    source: "ai_builder",
    notes: "Created by StockGPT AI Portfolio Builder.",
  }));

  const { error: holdingsError } = await supabase
    .from("portfolio_holdings")
    .insert(holdingsToInsert);

  if (holdingsError) return { success: false, error: holdingsError.message };

  await recordTransaction(supabase, {
    portfolioId,
    userId: user.id,
    type: "import",
    amount: portfolio.totalInvested,
    currency: "USD",
    notes: replacing
      ? "AI portfolio replaced this selected portfolio."
      : "New AI portfolio created.",
  });

  await markPortfolioChartInputsChanged({ supabase, portfolioId, userId: user.id });
  revalidatePortfolio(portfolioId);

  for (const holding of portfolio.holdings) {
    revalidateStock(holding.ticker);
  }

  return { success: true, data: { portfolioId } };
}

export async function createManualPortfolio(
  input: ManualPortfolioInput,
): Promise<ActionResult<{ portfolioId: string }>> {
  const name = input.name.trim().slice(0, 80);
  const allowedCurrencies = new Set(["GBP", "USD", "EUR"]);
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

  if (!allowedCurrencies.has(input.currency)) {
    return { success: false, error: "Choose a supported portfolio currency." };
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
    if (!Number.isFinite(holding.averagePrice) || holding.averagePrice < 0) {
      return {
        success: false,
        error: `${holding.ticker} needs a non-negative average price.`,
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

  if (stockError) return { success: false, error: stockError.message };

  const stocks = new Map(
    ((stockRows ?? []) as Array<{
      ticker: string | null;
      price: number | null;
      score: number | null;
      rank: number | null;
    }>).map((stock) => [String(stock.ticker ?? "").toUpperCase(), stock]),
  );

  const missingTicker = tickers.find((ticker) => !stocks.has(ticker));

  if (missingTicker) {
    return {
      success: false,
      error: `${missingTicker} is not available in the StockGPT stock universe.`,
    };
  }

  const costBasis = cleanedHoldings.reduce(
    (sum, holding) => sum + holding.shares * holding.averagePrice,
    0,
  );
  const estimatedHoldingsValue = cleanedHoldings.reduce((sum, holding) => {
    const currentPrice = moneyNumber(stocks.get(holding.ticker)?.price);
    return sum + holding.shares * (currentPrice || holding.averagePrice);
  }, 0);
  const estimatedTotalValue = input.startingCash + estimatedHoldingsValue;
  const goal = goalMap[input.goal];

  const { data: created, error: createError } = await supabase
    .from("user_portfolios")
    .insert({
      user_id: user.id,
      name,
      risk_tolerance: goal.riskTolerance,
      time_horizon: goal.timeHorizon,
      investment_amount: roundMoney(costBasis),
      cash_balance: roundMoney(input.startingCash),
      cash_deposited_total: roundMoney(input.startingCash + costBasis),
      currency: input.currency,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return {
      success: false,
      error: createError?.message ?? "Could not create the portfolio.",
    };
  }

  const portfolioId = String(created.id);
  const now = new Date().toISOString();

  if (cleanedHoldings.length > 0) {
    const holdingsToInsert = cleanedHoldings.map((holding) => {
      const stock = stocks.get(holding.ticker);
      const currentPrice = moneyNumber(stock?.price) || holding.averagePrice;
      const estimatedValue = holding.shares * currentPrice;

      return {
        portfolio_id: portfolioId,
        ticker: holding.ticker,
        entry_price: roundMoney(holding.averagePrice),
        shares: roundShares(holding.shares),
        allocation_pct:
          estimatedTotalValue > 0
            ? Math.round((estimatedValue / estimatedTotalValue) * 10_000) / 100
            : null,
        score_at_entry: stock?.score ?? null,
        rank_at_entry: stock?.rank ?? null,
        last_reviewed_at: now,
        purchase_date: holding.purchaseDate,
        source: "manual_builder",
        notes: holding.notes,
      };
    });

    const { error: holdingsError } = await supabase
      .from("portfolio_holdings")
      .insert(holdingsToInsert);

    if (holdingsError) {
      await supabase
        .from("user_portfolios")
        .delete()
        .eq("id", portfolioId)
        .eq("user_id", user.id);

      return { success: false, error: holdingsError.message };
    }
  }

  if (input.startingCash > 0) {
    await recordTransaction(supabase, {
      portfolioId,
      userId: user.id,
      type: "deposit",
      amount: input.startingCash,
      currency: input.currency,
      notes: "Starting cash added during manual portfolio creation.",
    });
  }

  for (const holding of cleanedHoldings) {
    await recordTransaction(supabase, {
      portfolioId,
      userId: user.id,
      ticker: holding.ticker,
      type: "log_existing",
      shares: holding.shares,
      price: holding.averagePrice,
      amount: holding.shares * holding.averagePrice,
      currency: input.currency,
      notes: holding.notes ?? "Added during manual portfolio creation.",
    });
    revalidateStock(holding.ticker);
  }

  revalidatePortfolio(portfolioId);

  return { success: true, data: { portfolioId } };
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

export async function logExistingHolding(
  input: LogExistingHoldingInput,
): Promise<ActionResult<{ portfolioId: string; updatedExisting: boolean }>> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  if (!Number.isFinite(input.shares) || input.shares <= 0) {
    return { success: false, error: "Enter the number of shares you own." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(
    supabase,
    user.id,
    input.portfolioId ?? null,
  );

  if (!portfolio) {
    return {
      success: false,
      error: input.portfolioId ? "Portfolio not found." : "Could not create portfolio.",
    };
  }

  const stock = await getStock(supabase, upperTicker);

  if (!stock) return { success: false, error: "Stock not found in rankings." };

  const finalEntryPrice =
    input.entryPrice && Number.isFinite(input.entryPrice) && input.entryPrice > 0
      ? input.entryPrice
      : moneyNumber(stock.price);

  if (!Number.isFinite(finalEntryPrice) || finalEntryPrice <= 0) {
    return { success: false, error: "Could not find a valid stock price." };
  }

  const now = new Date().toISOString();

  const { data: existingHolding } = await supabase
    .from("portfolio_holdings")
    .select("ticker")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_holdings").upsert(
    {
      portfolio_id: portfolio.id,
      ticker: upperTicker,
      entry_price: finalEntryPrice,
      shares: roundShares(input.shares),
      allocation_pct: null,
      score_at_entry: stock.score,
      rank_at_entry: stock.rank,
      last_reviewed_at: now,
      purchase_date: input.purchaseDate ?? null,
      source: "manual",
      notes: input.notes ?? null,
    },
    { onConflict: "portfolio_id,ticker" },
  );

  if (error) return { success: false, error: error.message };

  await recordTransaction(supabase, {
    portfolioId: portfolio.id,
    userId: user.id,
    ticker: upperTicker,
    type: existingHolding ? "adjustment" : "log_existing",
    shares: roundShares(input.shares),
    price: finalEntryPrice,
    amount: finalEntryPrice * input.shares,
    currency: portfolio.currency ?? "USD",
    notes: input.notes ?? "Manual holding logged.",
  });

  await recalculatePortfolioTotals(supabase, portfolio.id, {
    ensureDepositedCoversCurrentValue: true,
  });

  await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
  revalidatePortfolio(portfolio.id);
  revalidateStock(upperTicker);

  return {
    success: true,
    data: { portfolioId: portfolio.id, updatedExisting: Boolean(existingHolding) },
  };
}

export async function buyHoldingWithCash(
  input: BuyHoldingWithCashInput,
): Promise<ActionResult<{ portfolioId: string; updatedExisting: boolean }>> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  if (!Number.isFinite(input.dollarAmount) || input.dollarAmount <= 0) {
    return { success: false, error: "Enter a positive investment amount." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(
    supabase,
    user.id,
    input.portfolioId ?? null,
  );

  if (!portfolio) {
    return {
      success: false,
      error: input.portfolioId ? "Portfolio not found." : "Could not create portfolio.",
    };
  }

  const stock = await getStock(supabase, upperTicker);

  if (!stock) return { success: false, error: "Stock not found in rankings." };

  const finalEntryPrice =
    input.entryPrice && Number.isFinite(input.entryPrice) && input.entryPrice > 0
      ? input.entryPrice
      : moneyNumber(stock.price);

  if (!Number.isFinite(finalEntryPrice) || finalEntryPrice <= 0) {
    return { success: false, error: "Could not find a valid stock price." };
  }

  const currentCash = moneyNumber(portfolio.cash_balance);

  if (input.dollarAmount > currentCash + 0.001) {
    return {
      success: false,
      error: `Not enough available cash. Add $${(
        input.dollarAmount - currentCash
      ).toFixed(2)} cash or reduce the amount.`,
    };
  }

  const boughtShares = roundShares(input.dollarAmount / finalEntryPrice);

  if (boughtShares <= 0) {
    return { success: false, error: "Investment amount is too small." };
  }

  const { data: existingHolding } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price,purchase_date,notes")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  const existingTrade = existingHolding as PortfolioHoldingTradeRow | null;
  const oldShares = moneyNumber(existingTrade?.shares);
  const oldEntryPrice = moneyNumber(existingTrade?.entry_price);
  const oldCost = oldShares * oldEntryPrice;
  const newCost = input.dollarAmount;
  const nextShares = roundShares(oldShares + boughtShares);
  const nextEntryPrice = nextShares > 0 ? (oldCost + newCost) / nextShares : finalEntryPrice;

  const now = new Date().toISOString();

  const { error: upsertError } = await supabase.from("portfolio_holdings").upsert(
    {
      portfolio_id: portfolio.id,
      ticker: upperTicker,
      entry_price: Math.round(nextEntryPrice * 10_000) / 10_000,
      shares: nextShares,
      allocation_pct: null,
      score_at_entry: stock.score,
      rank_at_entry: stock.rank,
      last_reviewed_at: now,
      purchase_date:
        existingTrade?.purchase_date ?? input.purchaseDate ?? null,
      source: "cash",
      notes: input.notes ?? existingTrade?.notes ?? null,
    },
    { onConflict: "portfolio_id,ticker" },
  );

  if (upsertError) return { success: false, error: upsertError.message };

  const { error: cashError } = await supabase
    .from("user_portfolios")
    .update({
      cash_balance: roundMoney(currentCash - input.dollarAmount),
    })
    .eq("id", portfolio.id)
    .eq("user_id", user.id);

  if (cashError) return { success: false, error: cashError.message };

  await recordTransaction(supabase, {
    portfolioId: portfolio.id,
    userId: user.id,
    ticker: upperTicker,
    type: "buy",
    shares: boughtShares,
    price: finalEntryPrice,
    amount: input.dollarAmount,
    currency: portfolio.currency ?? "USD",
    notes: input.notes ?? "Bought using portfolio cash.",
  });

  await recalculatePortfolioTotals(supabase, portfolio.id);

  await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
  revalidatePortfolio(portfolio.id);
  revalidateStock(upperTicker);

  return {
    success: true,
    data: { portfolioId: portfolio.id, updatedExisting: Boolean(existingHolding) },
  };
}

export async function updateHoldingDetails(
  input: UpdateHoldingDetailsInput,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  if (!Number.isFinite(input.shares) || input.shares < 0) {
    return { success: false, error: "Invalid share count." };
  }

  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
    return { success: false, error: "Invalid entry price." };
  }

  if (input.shares === 0) {
    return removeHolding({
      portfolioId: input.portfolioId,
      ticker: upperTicker,
      creditCash: false,
    });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await requireOwnedPortfolio(supabase, user.id, input.portfolioId);

  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({
      shares: roundShares(input.shares),
      entry_price: input.entryPrice,
      purchase_date: input.purchaseDate ?? null,
      notes: input.notes ?? null,
    })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  await recordTransaction(supabase, {
    portfolioId: portfolio.id,
    userId: user.id,
    ticker: upperTicker,
    type: "adjustment",
    shares: roundShares(input.shares),
    price: input.entryPrice,
    amount: input.entryPrice * input.shares,
    currency: portfolio.currency ?? "USD",
    notes: input.notes ?? "Holding details adjusted.",
  });

  await recalculatePortfolioTotals(supabase, portfolio.id, {
    ensureDepositedCoversCurrentValue: true,
  });

  await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
  revalidatePortfolio(portfolio.id);
  revalidateStock(upperTicker);

  return { success: true };
}

export async function trimHolding(
  input: TrimHoldingInput,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(input.ticker);
  const percentage = Number(input.percentage);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    return { success: false, error: "Trim percentage must be between 1 and 100." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await requireOwnedPortfolio(supabase, user.id, input.portfolioId);

  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const { data: holding } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!holding) return { success: false, error: "Holding not found." };

  const stock = await getStock(supabase, upperTicker);

  const tradeHolding = holding as PortfolioHoldingTradeRow;
  const currentShares = moneyNumber(tradeHolding.shares);
  const entryPrice = moneyNumber(tradeHolding.entry_price);
  const sellPrice = moneyNumber(stock?.price, entryPrice);

  if (currentShares <= 0 || sellPrice <= 0) {
    return { success: false, error: "Could not calculate sell value." };
  }

  const sharesToSell =
    percentage >= 100 ? currentShares : roundShares(currentShares * (percentage / 100));

  const remainingShares = roundShares(currentShares - sharesToSell);
  const proceeds = roundMoney(sharesToSell * sellPrice);
  const realisedPnl = roundMoney((sellPrice - entryPrice) * sharesToSell);

  if (remainingShares <= 0.000001) {
    const { error: deleteError } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("portfolio_id", portfolio.id)
      .eq("ticker", upperTicker);

    if (deleteError) return { success: false, error: deleteError.message };
  } else {
    const { error: updateError } = await supabase
      .from("portfolio_holdings")
      .update({ shares: remainingShares })
      .eq("portfolio_id", portfolio.id)
      .eq("ticker", upperTicker);

    if (updateError) return { success: false, error: updateError.message };
  }

  const currentCash = moneyNumber(portfolio.cash_balance);

  const { error: cashError } = await supabase
    .from("user_portfolios")
    .update({
      cash_balance: roundMoney(currentCash + proceeds),
    })
    .eq("id", portfolio.id)
    .eq("user_id", user.id);

  if (cashError) return { success: false, error: cashError.message };

  await recordTransaction(supabase, {
    portfolioId: portfolio.id,
    userId: user.id,
    ticker: upperTicker,
    type: "sell",
    shares: sharesToSell,
    price: sellPrice,
    amount: proceeds,
    realisedPnl,
    currency: portfolio.currency ?? "USD",
    notes:
      percentage >= 100
        ? "Position sold/removed."
        : `Trimmed ${percentage.toFixed(0)}% of the position.`,
  });

  await recalculatePortfolioTotals(supabase, portfolio.id);

  await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
  revalidatePortfolio(portfolio.id);
  revalidateStock(upperTicker);

  return { success: true };
}

export async function removeHolding(
  input: RemoveHoldingInput | string,
): Promise<ActionResult> {
  if (typeof input === "string") {
    const supabase = await createClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) return { success: false, error: "not_authenticated" };

    const portfolio = await getOrCreatePortfolio(supabase, user.id, null);
    if (!portfolio) return { success: false, error: "No portfolio found." };

    return removeHolding({
      portfolioId: portfolio.id,
      ticker: input,
      creditCash: true,
    });
  }

  const upperTicker = cleanTicker(input.ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker." };

  if (input.creditCash) {
    return trimHolding({
      portfolioId: input.portfolioId,
      ticker: upperTicker,
      percentage: 100,
    });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await requireOwnedPortfolio(supabase, user.id, input.portfolioId);

  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const { error } = await supabase
    .from("portfolio_holdings")
    .delete()
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  await recordTransaction(supabase, {
    portfolioId: portfolio.id,
    userId: user.id,
    ticker: upperTicker,
    type: "adjustment",
    amount: 0,
    currency: portfolio.currency ?? "USD",
    notes: "Holding removed without crediting cash.",
  });

  await recalculatePortfolioTotals(supabase, portfolio.id);

  await markPortfolioChartInputsChanged({ supabase, portfolioId: portfolio.id, userId: user.id });
  revalidatePortfolio(portfolio.id);
  revalidateStock(upperTicker);

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
  input?: DeletePortfolioInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = input?.portfolioId
    ? await requireOwnedPortfolio(supabase, user.id, input.portfolioId)
    : await getOrCreatePortfolio(supabase, user.id, null);

  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const { data: holdings } = await supabase
    .from("portfolio_holdings")
    .select("ticker")
    .eq("portfolio_id", portfolio.id);

  const tickers = ((holdings ?? []) as Array<{ ticker: string | null }>)
    .map((holding) => cleanTicker(holding.ticker ?? ""))
    .filter(Boolean);

  const { error } = await supabase
    .from("user_portfolios")
    .delete()
    .eq("id", portfolio.id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  await markPortfolioChartInputsChanged({
    supabase,
    portfolioId: portfolio.id,
    userId: user.id,
    writeCurrentSnapshot: false,
  });
  revalidatePortfolio();

  for (const ticker of tickers) {
    revalidateStock(ticker);
  }

  return { success: true };
}

/**
 * Backwards-compatible wrappers for older components/routes.
 * New UI should call logExistingHolding / buyHoldingWithCash directly.
 */

export async function addHolding(
  ticker: string,
  entryPrice?: number,
  shares?: number,
): Promise<ActionResult<{ portfolioId: string; updatedExisting: boolean }>> {
  return logExistingHolding({
    ticker,
    entryPrice,
    shares: shares && shares > 0 ? shares : 1,
    portfolioId: null,
    purchaseDate: null,
  });
}

export async function addHoldingByAmount(
  ticker: string,
  dollarAmount: number,
  entryPrice?: number,
): Promise<ActionResult<{ portfolioId: string; updatedExisting: boolean }>> {
  return buyHoldingWithCash({
    portfolioId: null,
    ticker,
    dollarAmount,
    entryPrice,
    purchaseDate: null,
  });
}

export async function updateEntryPrice(
  ticker: string,
  newPrice: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { success: false, error: "Invalid price." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(supabase, user.id, null);
  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const upperTicker = cleanTicker(ticker);

  const { data: holding } = await supabase
    .from("portfolio_holdings")
    .select("shares,purchase_date,notes")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!holding) return { success: false, error: "Holding not found." };

  const tradeHolding = holding as PortfolioHoldingTradeRow;
  return updateHoldingDetails({
    portfolioId: portfolio.id,
    ticker: upperTicker,
    shares: moneyNumber(tradeHolding.shares),
    entryPrice: newPrice,
    purchaseDate: tradeHolding.purchase_date ?? null,
    notes: tradeHolding.notes ?? null,
  });
}

export async function updateShares(
  ticker: string,
  newShares: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newShares) || newShares < 0) {
    return { success: false, error: "Invalid share count." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(supabase, user.id, null);
  if (!portfolio) return { success: false, error: "Portfolio not found." };

  const upperTicker = cleanTicker(ticker);

  const { data: holding } = await supabase
    .from("portfolio_holdings")
    .select("entry_price,purchase_date,notes")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!holding) return { success: false, error: "Holding not found." };

  const tradeHolding = holding as PortfolioHoldingTradeRow;
  return updateHoldingDetails({
    portfolioId: portfolio.id,
    ticker: upperTicker,
    shares: newShares,
    entryPrice: moneyNumber(tradeHolding.entry_price),
    purchaseDate: tradeHolding.purchase_date ?? null,
    notes: tradeHolding.notes ?? null,
  });
}
