from pathlib import Path

# -----------------------------
# Server actions: cash accounting
# -----------------------------
actions = Path("lib/actions/portfolio-management.ts")
s = actions.read_text()

if "export async function addCash" not in s:
    s = s.replace(
'''function cleanTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}
''',
'''function cleanTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

function moneyNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getOrCreatePortfolio(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  let { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance")
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
      })
      .select("id,cash_balance")
      .single();

    if (error || !newPortfolio) return null;
    portfolio = newPortfolio;
  }

  return portfolio;
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
  const { error } = await supabase
    .from("user_portfolios")
    .update({ cash_balance: currentCash + amount })
    .eq("id", portfolio.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/portfolio");
  return { success: true };
}
'''
    )

s = s.replace(
'''      investment_amount: portfolio.totalInvested,
''',
'''      investment_amount: portfolio.totalInvested,
      cash_balance: 0,
'''
)

start = s.find("export async function addHolding(")
end = s.find("export async function removeHolding", start)
if start != -1 and end != -1:
    s = s[:start] + '''export async function addHolding(
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

''' + s[end:]

start = s.find("export async function removeHolding")
end = s.find("export async function updateEntryPrice", start)
if start != -1 and end != -1:
    s = s[:start] + '''export async function removeHolding(ticker: string): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "not_authenticated" };

  const upperTicker = cleanTicker(ticker);

  const { data: portfolio } = await supabase
    .from("user_portfolios")
    .select("id,cash_balance")
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

''' + s[end:]

start = s.find("export async function updateShares")
end = s.find("export async function markReviewed", start)
if start != -1 and end != -1:
    s = s[:start] + '''export async function updateShares(
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
    .select("id,cash_balance")
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

''' + s[end:]

actions.write_text(s)

# -----------------------------
# Portfolio page: cash + replacements
# -----------------------------
page = Path("app/portfolio/page.tsx")
s = page.read_text()
s = s.replace(
'.select("id, name, risk_tolerance, time_horizon, investment_amount")',
'.select("id, name, risk_tolerance, time_horizon, investment_amount, cash_balance")'
)

old = '''  const enriched = await enrichHoldings(
    (holdingsData ?? []).map((holding) => ({
      ticker: holding.ticker as string,
      entry_price: holding.entry_price as number | null,
      score_at_entry: holding.score_at_entry as number | null,
      rank_at_entry: holding.rank_at_entry as number | null,
      shares: holding.shares as number | null,
      allocation_pct: holding.allocation_pct as number | null,
      added_at: holding.added_at as string,
      last_reviewed_at: holding.last_reviewed_at as string,
    })),
    riskTolerance,
  );
'''
new = '''  const enriched = await enrichHoldings(
    (holdingsData ?? []).map((holding) => ({
      ticker: holding.ticker as string,
      entry_price: holding.entry_price as number | null,
      score_at_entry: holding.score_at_entry as number | null,
      rank_at_entry: holding.rank_at_entry as number | null,
      shares: holding.shares as number | null,
      allocation_pct: holding.allocation_pct as number | null,
      added_at: holding.added_at as string,
      last_reviewed_at: holding.last_reviewed_at as string,
    })),
    riskTolerance,
  );

  const heldTickers = new Set(enriched.map((holding) => holding.ticker));
  const needsReplacement = enriched.filter((holding) =>
    holding.actionAlerts.some((alert) => alert.action === "sell" || alert.action === "trim"),
  );

  const { data: candidateData } = needsReplacement.length > 0
    ? await supabase
        .from("stock_rankings")
        .select("ticker, company, sector, rank, score, price")
        .order("rank", { ascending: true })
        .limit(80)
    : { data: [] };

  const replacementCandidates = ((candidateData ?? []) as Array<{
    ticker: string | null;
    company: string | null;
    sector: string | null;
    rank: number | null;
    score: number | null;
    price: number | null;
  }>).filter((candidate) => candidate.ticker && !heldTickers.has(candidate.ticker));

  const replacements = Object.fromEntries(
    needsReplacement.map((holding) => {
      const sameSector = replacementCandidates.find((candidate) => candidate.sector && candidate.sector === holding.sector);
      const candidate = sameSector ?? replacementCandidates[0] ?? null;
      return [
        holding.ticker,
        candidate
          ? {
              ticker: candidate.ticker as string,
              company: candidate.company ?? candidate.ticker ?? "—",
              sector: candidate.sector ?? "—",
              rank: Number(candidate.rank) || null,
              score: Number(candidate.score) || null,
              price: Number(candidate.price) || null,
              reason: sameSector
                ? `${candidate.ticker} is the strongest available ${candidate.sector} replacement not already in your portfolio, ranked #${candidate.rank ?? "—"}. It keeps sector exposure similar while upgrading model conviction.`
                : `${candidate.ticker} is the strongest available replacement not already in your portfolio, ranked #${candidate.rank ?? "—"}. It improves overall portfolio quality without adding to the weakened position.`,
            }
          : null,
      ];
    }),
  );
'''
if old in s:
    s = s.replace(old, new)
else:
    print("Could not patch enriched/replacement block")

s = s.replace(
'''            investmentAmount: savedPortfolio.investment_amount as number | null,
          }}
        />''',
'''            investmentAmount: savedPortfolio.investment_amount as number | null,
            cashBalance: Number(savedPortfolio.cash_balance ?? 0),
          }}
          replacements={replacements}
        />'''
)
page.write_text(s)

# -----------------------------
# SavedPortfolio UI
# -----------------------------
comp = Path("components/SavedPortfolio.tsx")
s = comp.read_text()
s = s.replace(
'''  addHolding,
  deletePortfolio,''',
'''  addCash,
  addHolding,
  deletePortfolio,'''
)
s = s.replace(
'''    investmentAmount: number | null;
  };
};''',
'''    investmentAmount: number | null;
    cashBalance: number;
  };
  replacements?: Record<string, ReplacementRecommendation | null>;
};

type ReplacementRecommendation = {
  ticker: string;
  company: string;
  sector: string;
  rank: number | null;
  score: number | null;
  price: number | null;
  reason: string;
};'''
)
s = s.replace(
'''function HoldingRow({ holding }: { holding: EnrichedHolding }) {''',
'''function HoldingRow({ holding, replacement }: { holding: EnrichedHolding; replacement?: ReplacementRecommendation | null }) {'''
)
s = s.replace(
'''  const eventWarnings = holding.eventAlerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical").length;
''',
'''  const eventWarnings = holding.eventAlerts.filter((alert) => alert.severity === "warning" || alert.severity === "critical").length;
  const shouldShowReplacement = replacement && holding.actionAlerts.some((alert) => alert.action === "sell" || alert.action === "trim");
'''
)
s = s.replace(
'''        {(holding.actionAlerts.length > 0 || eventWarnings > 0) && (''',
'''        {shouldShowReplacement && (
          <div className="mt-3 rounded-xl border-2 border-[#ddb159]/35 bg-[#fff8e8] p-3">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/55">Suggested replacement</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Link href={`/stock/${replacement.ticker}`} className="flex min-w-0 items-center gap-2">
                <StockLogo ticker={replacement.ticker} company={replacement.company} size={24} />
                <div className="min-w-0">
                  <p className="text-[16px] font-black tracking-[-0.03em] text-[#072116]">{replacement.ticker}</p>
                  <p className="truncate text-[11px] font-bold text-[#072116]/60">{replacement.company}</p>
                </div>
              </Link>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full bg-[#072116] px-2 py-1 text-[10px] font-black text-[#ddb159]">Rank #{replacement.rank ?? "—"}</span>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#072116]/70">{replacement.sector}</span>
              </div>
            </div>
            <p className="mt-2 text-[12px] font-semibold leading-relaxed text-[#072116]/70">{replacement.reason}</p>
          </div>
        )}

        {(holding.actionAlerts.length > 0 || eventWarnings > 0) && ('''
)

# Replace AddStockForm signature and internal cash awareness.
s = s.replace("function AddStockForm() {", "function AddStockForm({ cashBalance }: { cashBalance: number }) {")
s = s.replace(
'''    if (!shares || Number(shares) <= 0) { setError("Enter shares, e.g. 10"); return; }
    setError(null);''',
'''    if (!shares || Number(shares) <= 0) { setError("Enter shares, e.g. 10"); return; }
    const estimatedCost = Number(shares) * Number(entryPrice || 0);
    if (entryPrice && estimatedCost > cashBalance) {
      setError(`Not enough available cash. Add $${(estimatedCost - cashBalance).toFixed(2)} cash or reduce the order.`);
      return;
    }
    setError(null);'''
)
s = s.replace(
'''      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Track stocks you already own. Enter shares and your entry price.</p>''',
'''      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Available cash: ${cashBalance.toLocaleString()}. Buying a stock uses cash; selling returns value to cash.</p>'''
)

insert_after = '''  );
}

export function SavedPortfolio'''
add_cash = '''  );
}

function AddCashForm() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a positive cash amount");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await addCash(value);
      if (!result.success) setError(result.error ?? "Could not add cash");
      else setAmount("");
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ Add Cash</p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Deposits increase available cash and portfolio value, but they do not count as profit.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5000" className="min-w-[160px] flex-1 rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-bold text-[#072116] outline-none focus:border-[#ddb159]" />
        <button onClick={handleSubmit} disabled={isPending} className="rounded-lg px-4 py-2 text-[13px] font-black transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#ddb159", color: "#072116" }}>{isPending ? "Adding…" : "+ Add Cash"}</button>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function SavedPortfolio'''
if insert_after in s and "function AddCashForm" not in s:
    s = s.replace(insert_after, add_cash)

s = s.replace("export function SavedPortfolio({ holdings, portfolioMeta }: Props) {", "export function SavedPortfolio({ holdings, portfolioMeta, replacements = {} }: Props) {")
s = s.replace(
'''  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);''',
'''  const cashBalance = Number(portfolioMeta.cashBalance ?? 0);
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalValue = holdingsValue + cashBalance;
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);'''
)
s = s.replace(
'''              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"} · Cost basis ${totalCost.toLocaleString()} · {totalPnLDollars >= 0 ? "+" : "−"}${Math.abs(totalPnLDollars).toLocaleString()}''',
'''              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"} · Holdings ${holdingsValue.toLocaleString()} · Cash ${cashBalance.toLocaleString()} · P/L {totalPnLDollars >= 0 ? "+" : "−"}${Math.abs(totalPnLDollars).toLocaleString()}'''
)
s = s.replace(
'''          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Event Warnings</p><p className={`mt-0.5 text-[18px] font-black ${eventWarnings > 0 ? "text-amber-400" : "text-emerald-400"}`}>{eventWarnings}</p></div>''',
'''          <div className="rounded-xl border border-[#ddb159]/15 bg-[#072116]/60 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#ddb159]/80">Cash</p><p className="mt-0.5 text-[18px] font-black text-[#faf6f0]">${cashBalance.toLocaleString()}</p></div>'''
)
s = s.replace("      <AddStockForm />", "      <div className=\"grid gap-3 lg:grid-cols-2\"><AddCashForm /><AddStockForm cashBalance={cashBalance} /></div>")
s = s.replace(
'''<div className="grid gap-3">{holdings.map((holding) => <HoldingRow key={holding.ticker} holding={holding} />)}</div>''',
'''<div className="grid gap-3">{holdings.map((holding) => <HoldingRow key={holding.ticker} holding={holding} replacement={replacements[holding.ticker]} />)}</div>'''
)
comp.write_text(s)

print("Portfolio cash balance, add-cash flow, cash-aware buys/sells, and replacement recommendations patched.")
