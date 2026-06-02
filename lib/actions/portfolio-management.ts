"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Portfolio } from "@/lib/portfolio";

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

type Trading212ImportOptions = {
  replaceExisting?: boolean;
};

type ParsedCsvRow = Record<string, string>;

type ParsedHolding = {
  ticker: string;
  shares: number;
  entryPrice: number;
  value: number;
};

type Trading212ImportSummary = {
  imported: number;
  skipped: number;
  totalValue: number;
  skippedTickers: string[];
};

function cleanTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

function moneyNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

    const ticker = cleanTicker(tickerRaw.replace(/\s.*$/, ""));

    if (!ticker || ticker.length > 12) continue;

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

    let shares = Math.abs(parseFlexibleNumber(shareValue));
    const price = Math.abs(parseFlexibleNumber(priceValue));
    let value = Math.abs(parseFlexibleNumber(totalValue));

    if (shares <= 0 && price > 0 && value > 0) {
      shares = value / price;
    }

    if (shares <= 0) continue;

    const isSell = action.includes("sell");
    const signedShares = isSell ? -shares : shares;
    const signedValue = isSell ? -Math.abs(value || shares * price) : Math.abs(value || shares * price);

    const existing = holdingsByTicker.get(ticker);

    if (!existing) {
      holdingsByTicker.set(ticker, {
        ticker,
        shares: signedShares,
        entryPrice: price > 0 ? price : 0,
        value: signedValue,
      });
      continue;
    }

    const oldCost = existing.entryPrice * existing.shares;
    const newShares = existing.shares + signedShares;
    const newCost = oldCost + signedValue;

    holdingsByTicker.set(ticker, {
      ticker,
      shares: newShares,
      entryPrice: newShares > 0 && newCost > 0 ? newCost / newShares : existing.entryPrice,
      value: Math.max(0, newCost),
    });
  }

  return Array.from(holdingsByTicker.values())
    .filter((holding) => holding.shares > 0)
    .map((holding) => ({
      ...holding,
      shares: Math.round(holding.shares * 1000000) / 1000000,
      entryPrice: Math.round(holding.entryPrice * 10000) / 10000,
      value: Math.round(holding.value * 100) / 100,
    }));
}

async function getOrCreatePortfolio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  let { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance,cash_deposited_total")
    .eq("user_id", userId)
    .maybeSingle();

  if (!portfolio) {
    const { data: newPortfolio, error } = await supabase
      .from("user_portfolios")
      .insert({
        user_id: userId,
        name: "My Portfolio",
        risk_tolerance: "moderate",
        time_horizon: "medium",
        cash_balance: 0,
        cash_deposited_total: 0,
      })
      .select("id,cash_balance,cash_deposited_total")
      .single();

    if (error || !newPortfolio) return null;
    portfolio = newPortfolio;
  }

  return portfolio;
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

  const parsedHoldings = parseTrading212Holdings(csvText);

  if (parsedHoldings.length === 0) {
    return {
      success: false,
      error:
        "No holdings could be found. Export your Trading 212 Invest/ISA history as CSV and make sure it includes ticker, shares and price/value columns.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(supabase, user.id);

  if (!portfolio) {
    return {
      success: false,
      error: "Could not create portfolio.",
    };
  }

  const tickers = parsedHoldings.map((holding) => holding.ticker);

  const { data: stocks, error: stockError } = await supabase
    .from("stock_rankings")
    .select("ticker, price, score, rank")
    .in("ticker", tickers);

  if (stockError) {
    return {
      success: false,
      error: stockError.message,
    };
  }

  const stockMap = new Map(
    (stocks ?? []).map((stock) => [
      cleanTicker(String(stock.ticker)),
      {
        price: moneyNumber(stock.price),
        score: stock.score,
        rank: stock.rank,
      },
    ]),
  );

  const holdingsToInsert = parsedHoldings
    .filter((holding) => stockMap.has(holding.ticker))
    .map((holding) => {
      const stock = stockMap.get(holding.ticker);
      const entryPrice =
        holding.entryPrice > 0
          ? holding.entryPrice
          : moneyNumber(stock?.price);

      return {
        portfolio_id: portfolio.id,
        ticker: holding.ticker,
        entry_price: entryPrice,
        shares: holding.shares,
        allocation_pct: null,
        score_at_entry: stock?.score ?? null,
        rank_at_entry: stock?.rank ?? null,
        last_reviewed_at: new Date().toISOString(),
      };
    });

  const skippedTickers = parsedHoldings
    .filter((holding) => !stockMap.has(holding.ticker))
    .map((holding) => holding.ticker);

  if (holdingsToInsert.length === 0) {
    return {
      success: false,
      error:
        "None of the CSV tickers matched StockGPT rankings. Check that the export contains US stock tickers rather than only names/ISINs.",
    };
  }

  if (options.replaceExisting ?? true) {
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
    .upsert(holdingsToInsert, {
      onConflict: "portfolio_id,ticker",
    });

  if (upsertError) {
    return {
      success: false,
      error: upsertError.message,
    };
  }

  const importedValue = holdingsToInsert.reduce(
    (sum, holding) =>
      sum + moneyNumber(holding.entry_price) * moneyNumber(holding.shares),
    0,
  );

  const { error: portfolioUpdateError } = await supabase
    .from("user_portfolios")
    .update({
      investment_amount: importedValue,
      cash_balance: 0,
      cash_deposited_total: importedValue,
    })
    .eq("id", portfolio.id);

  if (portfolioUpdateError) {
    return {
      success: false,
      error: portfolioUpdateError.message,
    };
  }

  revalidatePath("/portfolio");

  for (const holding of holdingsToInsert) {
    revalidatePath(`/stock/${holding.ticker}`);
  }

  return {
    success: true,
    data: {
      imported: holdingsToInsert.length,
      skipped: skippedTickers.length,
      totalValue: Math.round(importedValue * 100) / 100,
      skippedTickers,
    },
  };
}

export async function addCash(amount: number): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a positive cash amount" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const portfolio = await getOrCreatePortfolio(supabase, user.id);
  if (!portfolio) return { success: false, error: "Could not create portfolio" };

  const currentCash = moneyNumber(portfolio.cash_balance);
  const currentDeposited = moneyNumber(portfolio.cash_deposited_total);
  const { error } = await supabase
    .from("user_portfolios")
    .update({
      cash_balance: currentCash + amount,
      cash_deposited_total: currentDeposited + amount,
    })
    .eq("id", portfolio.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}

export async function savePortfolio(
  portfolio: Portfolio,
): Promise<ActionResult<{ portfolioId: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  await supabase.from("user_portfolios").delete().eq("user_id", user.id);

  const { data: newPortfolio, error: pErr } = await supabase
    .from("user_portfolios")
    .insert({
      user_id: user.id,
      name: "My Portfolio",
      risk_tolerance: portfolio.riskTolerance,
      time_horizon: portfolio.timeHorizon,
      investment_amount: portfolio.totalInvested,
      cash_balance: 0,
      cash_deposited_total: portfolio.totalInvested,
    })
    .select("id")
    .single();

  if (pErr || !newPortfolio) {
    return {
      success: false,
      error: pErr?.message ?? "Could not save portfolio",
    };
  }

  const holdingsToInsert = portfolio.holdings.map((h) => ({
    portfolio_id: newPortfolio.id,
    ticker: h.ticker,
    entry_price: h.price,
    allocation_pct: h.allocationPct,
    shares: h.shares,
    score_at_entry: h.score,
    rank_at_entry: h.rank,
  }));

  const { error: hErr } = await supabase
    .from("portfolio_holdings")
    .insert(holdingsToInsert);

  if (hErr) return { success: false, error: hErr.message };

  revalidatePath("/portfolio");

  for (const holding of portfolio.holdings) {
    revalidatePath(`/stock/${holding.ticker}`);
  }

  return { success: true, data: { portfolioId: newPortfolio.id } };
}

export async function addHolding(
  ticker: string,
  entryPrice?: number,
  shares?: number,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("ticker, price, score, rank")
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!stock) return { success: false, error: "Stock not found in rankings" };

  const portfolio = await getOrCreatePortfolio(supabase, user.id);
  if (!portfolio) return { success: false, error: "Could not create portfolio" };

  const finalEntryPrice =
    entryPrice && Number.isFinite(entryPrice) && entryPrice > 0
      ? entryPrice
      : Number(stock.price);

  const finalShares =
    shares && Number.isFinite(shares) && shares > 0 ? shares : 1;

  const newPositionCost = finalEntryPrice * finalShares;

  const { data: existingHolding } = await supabase
    .from("portfolio_holdings")
    .select("entry_price,shares")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  const previousPositionCost =
    moneyNumber(existingHolding?.entry_price) * moneyNumber(existingHolding?.shares);
  const cashDelta = newPositionCost - previousPositionCost;
  const currentCash = moneyNumber(portfolio.cash_balance);

  if (cashDelta > currentCash + 0.001) {
    return {
      success: false,
      error: `Not enough available cash. Add $${(cashDelta - currentCash).toFixed(2)} cash or reduce the position size.`,
    };
  }

  const { error } = await supabase.from("portfolio_holdings").upsert(
    {
      portfolio_id: portfolio.id,
      ticker: upperTicker,
      entry_price: finalEntryPrice,
      shares: finalShares,
      score_at_entry: stock.score,
      rank_at_entry: stock.rank,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "portfolio_id,ticker" },
  );

  if (error) return { success: false, error: error.message };

  if (Math.abs(cashDelta) > 0.001) {
    const { error: cashError } = await supabase
      .from("user_portfolios")
      .update({ cash_balance: currentCash - cashDelta })
      .eq("id", portfolio.id);

    if (cashError) return { success: false, error: cashError.message };
  }

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function addHoldingByAmount(
  ticker: string,
  dollarAmount: number,
  entryPrice?: number,
): Promise<ActionResult> {
  const upperTicker = cleanTicker(ticker);

  if (!upperTicker) return { success: false, error: "Missing ticker" };
  if (!Number.isFinite(dollarAmount) || dollarAmount <= 0) {
    return { success: false, error: "Enter a positive investment amount" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("ticker, price")
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!stock) return { success: false, error: "Stock not found in rankings" };

  const finalEntryPrice =
    entryPrice && Number.isFinite(entryPrice) && entryPrice > 0
      ? entryPrice
      : Number(stock.price);

  if (!Number.isFinite(finalEntryPrice) || finalEntryPrice <= 0) {
    return { success: false, error: "Could not find a valid stock price" };
  }

  const portfolio = await getOrCreatePortfolio(supabase, user.id);
  if (!portfolio) return { success: false, error: "Could not create portfolio" };

  const currentCash = moneyNumber(portfolio.cash_balance);
  if (dollarAmount > currentCash + 0.001) {
    return {
      success: false,
      error: `Not enough available cash. Add $${(dollarAmount - currentCash).toFixed(2)} cash or reduce the amount.`,
    };
  }

  const finalShares = Math.round((dollarAmount / finalEntryPrice) * 1000000) / 1000000;

  return addHolding(upperTicker, finalEntryPrice, finalShares);
}

export async function removeHolding(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance,cash_deposited_total")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { data: holding } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("price")
    .eq("ticker", upperTicker)
    .maybeSingle();

  const shares = moneyNumber(holding?.shares);
  const sellPrice = moneyNumber(stock?.price, moneyNumber(holding?.entry_price));
  const cashCredit = Math.max(0, shares * sellPrice);

  const { error } = await supabase
    .from("portfolio_holdings")
    .delete()
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  if (cashCredit > 0) {
    const { error: cashError } = await supabase
      .from("user_portfolios")
      .update({ cash_balance: moneyNumber(portfolio.cash_balance) + cashCredit })
      .eq("id", portfolio.id);

    if (cashError) return { success: false, error: cashError.message };
  }

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function updateEntryPrice(
  ticker: string,
  newPrice: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { success: false, error: "Invalid price" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ entry_price: newPrice })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function updateShares(
  ticker: string,
  newShares: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newShares) || newShares < 0) {
    return { success: false, error: "Invalid share count" };
  }

  const upperTicker = cleanTicker(ticker);

  if (newShares === 0) {
    return removeHolding(upperTicker);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance,cash_deposited_total")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { data: holding } = await supabase
    .from("portfolio_holdings")
    .select("shares,entry_price")
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker)
    .maybeSingle();

  if (!holding) return { success: false, error: "Holding not found" };

  const { data: stock } = await supabase
    .from("stock_rankings")
    .select("price")
    .eq("ticker", upperTicker)
    .maybeSingle();

  const oldShares = moneyNumber(holding.shares);
  const shareDelta = newShares - oldShares;
  const tradePrice = moneyNumber(stock?.price, moneyNumber(holding.entry_price));
  const cashDelta = shareDelta * tradePrice;
  const currentCash = moneyNumber(portfolio.cash_balance);

  if (cashDelta > currentCash + 0.001) {
    return {
      success: false,
      error: `Not enough available cash. Add $${(cashDelta - currentCash).toFixed(2)} cash or reduce the share count.`,
    };
  }

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ shares: newShares })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  if (Math.abs(cashDelta) > 0.001) {
    const { error: cashError } = await supabase
      .from("user_portfolios")
      .update({ cash_balance: currentCash - cashDelta })
      .eq("id", portfolio.id);

    if (cashError) return { success: false, error: cashError.message };
  }

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function markReviewed(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return { success: false, error: "No portfolio" };

  const { error } = await supabase
    .from("portfolio_holdings")
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq("portfolio_id", portfolio.id)
    .eq("ticker", upperTicker);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath(`/stock/${upperTicker}`);

  return { success: true };
}

export async function deletePortfolio(): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const { data: existingHoldings } = await supabase
    .from("user_portfolios")
    .select("portfolio_holdings(ticker)")
    .eq("user_id", user.id)
    .maybeSingle();

  const tickers =
    existingHoldings?.portfolio_holdings?.map((holding: { ticker: string }) =>
      cleanTicker(holding.ticker),
    ) ?? [];

  const { error } = await supabase
    .from("user_portfolios")
    .delete()
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");

  for (const ticker of tickers) {
    revalidatePath(`/stock/${ticker}`);
  }

  return { success: true };
}
