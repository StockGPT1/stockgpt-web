from pathlib import Path

# -----------------------------
# Patch server actions
# -----------------------------
actions = Path("lib/actions/portfolio-management.ts")
s = actions.read_text()

s = s.replace('.select("id,cash_balance")', '.select("id,cash_balance,cash_deposited_total")')
s = s.replace('cash_balance: 0,\n      })', 'cash_balance: 0,\n        cash_deposited_total: 0,\n      })')
s = s.replace('cash_balance: 0,\n    })', 'cash_balance: 0,\n      cash_deposited_total: portfolio.totalInvested,\n    })')

# addCash should update both cash balance and deposited basis.
s = s.replace(
'''  const currentCash = moneyNumber(portfolio.cash_balance);
  const { error } = await supabase
    .from("user_portfolios")
    .update({ cash_balance: currentCash + amount })
    .eq("id", portfolio.id);
''',
'''  const currentCash = moneyNumber(portfolio.cash_balance);
  const currentDeposited = moneyNumber(portfolio.cash_deposited_total);
  const { error } = await supabase
    .from("user_portfolios")
    .update({
      cash_balance: currentCash + amount,
      cash_deposited_total: currentDeposited + amount,
    })
    .eq("id", portfolio.id);
'''
)

# Add a dollar-amount based add action while keeping the old addHolding for compatibility.
if "export async function addHoldingByAmount" not in s:
    marker = "export async function removeHolding"
    insert = '''export async function addHoldingByAmount(
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

'''
    s = s.replace(marker, insert + marker)

actions.write_text(s)

# -----------------------------
# Patch portfolio page metadata passed to client
# -----------------------------
page = Path("app/portfolio/page.tsx")
s = page.read_text()
s = s.replace(
'.select("id, name, risk_tolerance, time_horizon, investment_amount, cash_balance")',
'.select("id, name, risk_tolerance, time_horizon, investment_amount, cash_balance, cash_deposited_total")'
)
s = s.replace(
'''            cashBalance: Number(savedPortfolio.cash_balance ?? 0),
          }}''',
'''            cashBalance: Number(savedPortfolio.cash_balance ?? 0),
            cashDepositedTotal: Number(savedPortfolio.cash_deposited_total ?? savedPortfolio.investment_amount ?? 0),
          }}'''
)
page.write_text(s)

# -----------------------------
# Patch SavedPortfolio UI
# -----------------------------
comp = Path("components/SavedPortfolio.tsx")
s = comp.read_text()
s = s.replace("  addHolding,", "  addHoldingByAmount,")
s = s.replace("    cashBalance: number;", "    cashBalance: number;\n    cashDepositedTotal: number;")

# Replace AddStockForm with amount-based version.
start = s.find("function AddStockForm({ cashBalance }")
end = s.find("function AddCashForm()", start)
if start == -1 or end == -1:
    raise SystemExit("Could not find AddStockForm block")
new_add_stock = '''function AddStockForm({ cashBalance }: { cashBalance: number }) {
  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const dollarAmount = Number(amount);
    if (!ticker.trim()) { setError("Enter a ticker"); return; }
    if (!Number.isFinite(dollarAmount) || dollarAmount <= 0) { setError("Enter how much money to invest"); return; }
    if (dollarAmount > cashBalance) {
      setError(`Not enough available cash. Add $${(dollarAmount - cashBalance).toFixed(2)} cash or reduce the amount.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addHoldingByAmount(ticker.trim().toUpperCase(), dollarAmount, entryPrice ? Number(entryPrice) : undefined);
      if (!result.success) setError(result.error ?? "Could not add stock");
      else { setTicker(""); setAmount(""); setEntryPrice(""); }
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-3.5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ Add Your Own Stocks</p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Available cash: ${cashBalance.toLocaleString()}. Enter the dollar amount — StockGPT calculates shares automatically.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[90px_120px_minmax(130px,1fr)_auto]">
        <input type="text" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder="AAPL" className="min-w-0 rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[14px] font-black uppercase text-[#072116] outline-none focus:border-[#ddb159]" />
        <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount $" className="min-w-0 rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-bold text-[#072116] outline-none focus:border-[#ddb159]" />
        <input type="number" step="0.01" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} placeholder="Entry price optional" className="min-w-0 rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-semibold text-[#072116] outline-none focus:border-[#ddb159]" />
        <button onClick={handleSubmit} disabled={isPending} className="rounded-lg px-4 py-2 text-[13px] font-black transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#ddb159", color: "#072116" }}>{isPending ? "Adding…" : "+ Add"}</button>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

'''
s = s[:start] + new_add_stock + s[end:]

# Responsive / no horizontal overflow tightening.
s = s.replace('return (\n    <div className="grid gap-3">', 'return (\n    <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">')
s = s.replace('rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient', 'rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient')
s = s.replace('px-6 py-5', 'px-4 py-4 sm:px-5 sm:py-5')
s = s.replace('text-[28px] font-black', 'text-[24px] font-black sm:text-[28px]')
s = s.replace('className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"', 'className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4"')
s = s.replace('className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5"', 'className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-5"')
s = s.replace('className="grid grid-cols-2 gap-3 px-5 pb-3 sm:grid-cols-3"', 'className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-3 sm:px-5"')
s = s.replace('className="flex items-center gap-2">', 'className="flex flex-wrap items-center gap-2">')
s = s.replace('className="mt-3 flex flex-wrap gap-2">', 'className="mt-3 flex flex-col gap-2 sm:flex-row">')
s = s.replace('className="min-w-[160px] flex-1', 'className="min-w-0 flex-1')

# P/L since inception: total value minus deposited/original basis. Cash does not count as profit.
s = s.replace(
'''  const cashBalance = Number(portfolioMeta.cashBalance ?? 0);
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalValue = holdingsValue + cashBalance;
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalPnLDollars = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnLDollars / totalCost) * 100 : 0;''',
'''  const cashBalance = Number(portfolioMeta.cashBalance ?? 0);
  const cashDepositedTotal = Number(portfolioMeta.cashDepositedTotal ?? portfolioMeta.investmentAmount ?? 0);
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalValue = holdingsValue + cashBalance;
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const inceptionBasis = Math.max(cashDepositedTotal, totalCost, 0);
  const totalPnLDollars = inceptionBasis > 0 ? totalValue - inceptionBasis : 0;
  const totalPnLPct = inceptionBasis > 0 ? (totalPnLDollars / inceptionBasis) * 100 : 0;'''
)
s = s.replace('Cost basis ${totalCost.toLocaleString()}', 'Basis ${inceptionBasis.toLocaleString()}')
s = s.replace('      <div className="grid gap-3 lg:grid-cols-2"><AddCashForm /><AddStockForm cashBalance={cashBalance} /></div>', '      <div className="grid min-w-0 gap-3 xl:grid-cols-2"><AddCashForm /><AddStockForm cashBalance={cashBalance} /></div>')

comp.write_text(s)
print("Portfolio upgraded: since-inception P/L, amount-based add stock, tighter responsive layout.")
