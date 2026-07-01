"use client";

import { useMemo, useState, useTransition } from "react";
import { StockIcon } from "@/components/StockIcon";
import { useRouter } from "next/navigation";
import {
  createManualPortfolio,
  type ManualPortfolioHoldingInput,
} from "@/lib/actions/portfolio-management";

export type ManualBuilderStockOption = {
  ticker: string;
  company?: string | null;
  sector?: string | null;
  rank?: number | null;
  price?: number | null;
};

type Goal = "growth" | "income" | "balanced" | "watchlist" | "long-term";

type DraftHolding = ManualPortfolioHoldingInput & {
  company: string;
  sector: string;
  currentPrice: number | null;
};

type HoldingForm = {
  ticker: string;
  shares: string;
  averagePrice: string;
  purchaseDate: string;
  notes: string;
};

const emptyHolding = (): HoldingForm => ({
  ticker: "",
  shares: "",
  averagePrice: "",
  purchaseDate: "",
  notes: "",
});

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1_000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function normaliseTicker(value: string) {
  return value.trim().toUpperCase();
}

export function ManualPortfolioBuilder({
  stockOptions,
  existingCount,
  onBack,
}: {
  stockOptions: ManualBuilderStockOption[];
  existingCount: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(`Manual Portfolio ${existingCount + 1}`);
  const [currency] = useState<"USD">("USD");
  const [startingCash, setStartingCash] = useState("0");
  const [goal, setGoal] = useState<Goal>("balanced");
  const [holdings, setHoldings] = useState<DraftHolding[]>([]);
  const [holdingForm, setHoldingForm] = useState<HoldingForm>(emptyHolding);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const stockMap = useMemo(
    () =>
      new Map(
        stockOptions.map((stock) => [
          normaliseTicker(stock.ticker),
          stock,
        ]),
      ),
    [stockOptions],
  );

  const summary = useMemo(() => {
    const cash = Number(startingCash) || 0;
    const rows = holdings.map((holding) => {
      const costBasis = holding.shares * holding.averagePrice;
      const estimatedValue =
        holding.shares * (holding.currentPrice ?? holding.averagePrice);

      return { ...holding, costBasis, estimatedValue };
    });
    const holdingsValue = rows.reduce((sum, holding) => sum + holding.estimatedValue, 0);
    const totalValue = cash + holdingsValue;
    const largest = [...rows].sort((a, b) => b.estimatedValue - a.estimatedValue)[0];
    const largestPct =
      largest && totalValue > 0 ? (largest.estimatedValue / totalValue) * 100 : 0;
    const sectors = new Set(rows.map((holding) => holding.sector).filter(Boolean));

    return {
      cash,
      rows,
      holdingsValue,
      totalValue,
      cashPct: totalValue > 0 ? (cash / totalValue) * 100 : 0,
      largest,
      largestPct,
      sectors: sectors.size,
    };
  }, [holdings, startingCash]);

  function updateHoldingField<Key extends keyof HoldingForm>(
    key: Key,
    value: HoldingForm[Key],
  ) {
    setHoldingForm((current) => ({ ...current, [key]: value }));
    setError(null);

    if (key === "ticker") {
      const stock = stockMap.get(normaliseTicker(String(value)));
      if (stock?.price != null && Number.isFinite(Number(stock.price))) {
        setHoldingForm((current) => ({
          ...current,
          ticker: String(value).toUpperCase(),
          averagePrice: Number(stock.price).toFixed(2),
        }));
      }
    }
  }

  function saveHolding() {
    const ticker = normaliseTicker(holdingForm.ticker);
    const shares = Number(holdingForm.shares);
    const averagePrice = Number(holdingForm.averagePrice);
    const stock = stockMap.get(ticker);

    if (!stock) {
      setError("Choose a ticker from the StockGPT stock universe.");
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(averagePrice) || averagePrice < 0) {
      setError("Average buy price must be zero or more.");
      return;
    }
    if (
      holdings.some(
        (holding) => holding.ticker === ticker && holding.ticker !== editingTicker,
      )
    ) {
      setError(`${ticker} is already in this Portfolio Draft. Edit that holding instead.`);
      return;
    }

    const nextHolding: DraftHolding = {
      ticker,
      shares,
      averagePrice,
      purchaseDate: holdingForm.purchaseDate || null,
      notes: holdingForm.notes.trim() || null,
      company: stock.company ?? ticker,
      sector: stock.sector ?? "Unclassified",
      currentPrice:
        stock.price == null || !Number.isFinite(Number(stock.price))
          ? null
          : Number(stock.price),
    };

    setHoldings((current) =>
      editingTicker
        ? current.map((holding) =>
            holding.ticker === editingTicker ? nextHolding : holding,
          )
        : [...current, nextHolding],
    );
    setHoldingForm(emptyHolding());
    setEditingTicker(null);
    setError(null);
  }

  function editHolding(holding: DraftHolding) {
    setEditingTicker(holding.ticker);
    setHoldingForm({
      ticker: holding.ticker,
      shares: String(holding.shares),
      averagePrice: String(holding.averagePrice),
      purchaseDate: holding.purchaseDate ?? "",
      notes: holding.notes ?? "",
    });
    setError(null);
  }

  function removeHolding(ticker: string) {
    setHoldings((current) => current.filter((holding) => holding.ticker !== ticker));
    if (editingTicker === ticker) {
      setEditingTicker(null);
      setHoldingForm(emptyHolding());
    }
  }

  function continueFromBasics() {
    const cash = Number(startingCash);

    if (!name.trim()) {
      setError("Portfolio name is required.");
      return;
    }
    if (!Number.isFinite(cash) || cash < 0) {
      setError("Starting cash must be zero or more.");
      return;
    }

    setError(null);
    setStep(2);
  }

  function reviewPortfolio() {
    if (holdings.length === 0 && summary.cash === 0) {
      setError("Add at least one holding or enter starting cash.");
      return;
    }

    setError(null);
    setStep(3);
  }

  function createPortfolio() {
    if (isSaving) return;

    setError(null);
    startSaving(async () => {
      const result = await createManualPortfolio({
        name,
        currency,
        startingCash: summary.cash,
        goal,
        holdings: holdings.map((holding) => ({
          ticker: holding.ticker,
          shares: holding.shares,
          averagePrice: holding.averagePrice,
          purchaseDate: holding.purchaseDate,
          notes: holding.notes,
        })),
      });

      if (!result.success || !result.data?.portfolioId) {
        setError(result.error ?? "Could not create this portfolio.");
        return;
      }

      router.push(
        `/portfolio?portfolio=${encodeURIComponent(result.data.portfolioId)}&created=manual`,
      );
    });
  }

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <header className="relative overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] px-5 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:px-6">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#ddb159]/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              Manual Portfolio Draft · Step {step} of 3
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.05em] text-[#faf6f0] sm:text-[36px]">
              {step === 1
                ? "Set the portfolio basics."
                : step === 2
                  ? "Add your holdings."
                  : "Review before creating."}
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/58 sm:text-[13px]">
              Enter positions you already track, then use StockGPT to review allocation,
              concentration, risks and trade-offs.
            </p>
          </div>
          <button
            type="button"
            onClick={step === 1 ? onBack : () => setStep((step - 1) as 1 | 2)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/36 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
          >
            ← Back
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-3xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)] sm:p-6">
          {step === 1 && (
            <div className="grid gap-5">
              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                  Portfolio name
                </span>
                <input
                  value={name}
                  maxLength={80}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  className="h-12 w-full rounded-2xl border-2 border-[#072116]/10 bg-white px-4 text-[15px] font-black text-[#072116] outline-none focus:border-[#ddb159]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                    Currency
                  </span>
                  <select
                    value={currency}
                    disabled
                    className="h-12 w-full rounded-2xl border-2 border-[#072116]/10 bg-[#f2eee5] px-4 text-[14px] font-black text-[#072116]/70"
                  >
                    <option value="USD">USD · US dollars</option>
                  </select>
                  <p className="mt-1 text-[10px] font-semibold text-[#072116]/45">
                    StockGPT’s current ranked-stock price feed uses USD.
                  </p>
                </label>

                <label>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                    Starting cash
                  </span>
                  <input
                    value={startingCash}
                    onChange={(event) => {
                      setStartingCash(event.target.value);
                      setError(null);
                    }}
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-12 w-full rounded-2xl border-2 border-[#072116]/10 bg-white px-4 text-[15px] font-black text-[#072116] outline-none focus:border-[#ddb159]"
                  />
                </label>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/55">
                  Goal label
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ["balanced", "Balanced"],
                    ["growth", "Growth"],
                    ["income", "Income"],
                    ["long-term", "Long-term"],
                    ["watchlist", "Watchlist"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGoal(value as Goal)}
                      className={[
                        "min-h-11 rounded-2xl border-2 px-3 text-[11px] font-black transition focus:outline-none focus:ring-2 focus:ring-[#ddb159]",
                        goal === value
                          ? "border-[#ddb159] bg-[#ddb159]/15"
                          : "border-[#072116]/10 bg-white hover:border-[#ddb159]/45",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={continueFromBasics}
                className="min-h-12 rounded-full bg-[#ddb159] px-5 text-[13px] font-black text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#072116] focus:ring-offset-2"
              >
                Continue to holdings
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <div className="rounded-2xl border border-[#072116]/10 bg-white p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a641a]">
                      {editingTicker ? `Edit ${editingTicker}` : "Add holding"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#072116]/52">
                      Values are for research and portfolio tracking, not trade execution.
                    </p>
                  </div>
                  {editingTicker && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTicker(null);
                        setHoldingForm(emptyHolding());
                      }}
                      className="min-h-10 rounded-full border border-[#072116]/12 px-3 text-[10px] font-black"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/48">
                      Stock or ticker
                    </span>
                    <input
                      list="manual-portfolio-stocks"
                      value={holdingForm.ticker}
                      disabled={Boolean(editingTicker)}
                      onChange={(event) => updateHoldingField("ticker", event.target.value)}
                      placeholder="Search ticker or enter symbol"
                      className="h-12 w-full min-w-0 rounded-2xl border border-[#072116]/12 bg-white px-3 text-[13px] font-black uppercase outline-none focus:border-[#ddb159] disabled:bg-[#f2eee5]"
                    />
                    <datalist id="manual-portfolio-stocks">
                      {stockOptions.map((stock) => (
                        <option key={stock.ticker} value={stock.ticker}>
                          {stock.company ?? stock.ticker}
                        </option>
                      ))}
                    </datalist>
                  </label>

                  <label>
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/48">
                      Quantity / shares
                    </span>
                    <input
                      value={holdingForm.shares}
                      onChange={(event) => updateHoldingField("shares", event.target.value)}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="10"
                      className="h-12 w-full rounded-2xl border border-[#072116]/12 bg-white px-3 text-[13px] font-bold outline-none focus:border-[#ddb159]"
                    />
                  </label>

                  <label>
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/48">
                      Average buy price
                    </span>
                    <input
                      value={holdingForm.averagePrice}
                      onChange={(event) =>
                        updateHoldingField("averagePrice", event.target.value)
                      }
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      className="h-12 w-full rounded-2xl border border-[#072116]/12 bg-white px-3 text-[13px] font-bold outline-none focus:border-[#ddb159]"
                    />
                  </label>

                  <label>
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/48">
                      Purchase date optional
                    </span>
                    <input
                      value={holdingForm.purchaseDate}
                      onChange={(event) =>
                        updateHoldingField("purchaseDate", event.target.value)
                      }
                      type="date"
                      className="h-12 w-full rounded-2xl border border-[#072116]/12 bg-white px-3 text-[13px] font-bold outline-none focus:border-[#ddb159]"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/48">
                      Notes optional
                    </span>
                    <input
                      value={holdingForm.notes}
                      maxLength={500}
                      onChange={(event) => updateHoldingField("notes", event.target.value)}
                      placeholder="Research context, account, or position note"
                      className="h-12 w-full rounded-2xl border border-[#072116]/12 bg-white px-3 text-[13px] font-semibold outline-none focus:border-[#ddb159]"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={saveHolding}
                  className="mt-3 min-h-12 w-full rounded-full bg-[#072116] px-5 text-[12px] font-black text-[#faf6f0] transition hover:bg-[#0d3926] focus:outline-none focus:ring-2 focus:ring-[#ddb159] focus:ring-offset-2"
                >
                  {editingTicker ? "Update holding" : "Add holding"}
                </button>
              </div>

              {holdings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#072116]/18 bg-white/55 p-6 text-center">
                  <h2 className="text-[22px] font-black tracking-[-0.04em]">
                    No holdings added yet.
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-[12px] font-semibold leading-5 text-[#072116]/52">
                    Add a position above, or continue with starting cash to create a
                    cash-only Portfolio Draft.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-2 md:hidden">
                    {summary.rows.map((holding) => (
                      <article
                        key={holding.ticker}
                        className="rounded-2xl border border-[#072116]/10 bg-white p-4"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[17px] font-black">{holding.ticker}</p>
                            <p className="truncate text-[11px] font-semibold text-[#072116]/50">
                              {holding.company}
                            </p>
                          </div>
                          <p className="shrink-0 text-right text-[15px] font-black">
                            {money(holding.estimatedValue, currency)}
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <p>Shares <strong>{holding.shares}</strong></p>
                          <p>Average <strong>{money(holding.averagePrice, currency)}</strong></p>
                          <p>Cost <strong>{money(holding.costBasis, currency)}</strong></p>
                          <p>
                            Allocation{" "}
                            <strong>
                              {summary.totalValue > 0
                                ? `${((holding.estimatedValue / summary.totalValue) * 100).toFixed(1)}%`
                                : "0%"}
                            </strong>
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => editHolding(holding)}
                            className="min-h-11 rounded-full border border-[#072116]/14 text-[11px] font-black"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHolding(holding.ticker)}
                            className="min-h-11 rounded-full border border-red-300 text-[11px] font-black text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-2xl border border-[#072116]/10 md:block">
                    <div className="grid grid-cols-[minmax(160px,1.4fr)_90px_110px_110px_90px_120px] bg-[#072116] px-4 py-3 text-[9px] font-black uppercase tracking-[0.1em] text-[#faf6f0]">
                      <span>Holding</span>
                      <span className="text-right">Shares</span>
                      <span className="text-right">Average</span>
                      <span className="text-right">Est. value</span>
                      <span className="text-right">Allocation</span>
                      <span className="text-right">Actions</span>
                    </div>
                    {summary.rows.map((holding) => (
                      <div
                        key={holding.ticker}
                        className="grid min-h-14 grid-cols-[minmax(160px,1.4fr)_90px_110px_110px_90px_120px] items-center border-b border-[#072116]/8 bg-white px-4 text-[11px] last:border-0"
                      >
                        <span className="min-w-0">
                          <strong className="block">{holding.ticker}</strong>
                          <span className="block truncate text-[#072116]/45">
                            {holding.company}
                          </span>
                        </span>
                        <span className="text-right font-bold">{holding.shares}</span>
                        <span className="text-right font-bold">
                          {money(holding.averagePrice, currency)}
                        </span>
                        <span className="text-right font-black">
                          {money(holding.estimatedValue, currency)}
                        </span>
                        <span className="text-right font-bold">
                          {summary.totalValue > 0
                            ? `${((holding.estimatedValue / summary.totalValue) * 100).toFixed(1)}%`
                            : "0%"}
                        </span>
                        <span className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => editHolding(holding)}
                            className="min-h-9 rounded-full border border-[#072116]/12 px-3 font-black"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHolding(holding.ticker)}
                            aria-label={`Remove ${holding.ticker}`}
                            className="grid size-9 place-items-center rounded-full border border-red-200 font-black text-red-700"
                          >
                            <StockIcon name="close" className="size-4" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={reviewPortfolio}
                className="min-h-12 rounded-full bg-[#ddb159] px-5 text-[13px] font-black text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#072116] focus:ring-offset-2"
              >
                Review Portfolio Draft
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Portfolio", name],
                  ["Estimated value", money(summary.totalValue, currency)],
                  ["Starting cash", `${money(summary.cash, currency)} · ${summary.cashPct.toFixed(1)}%`],
                  ["Holdings", String(holdings.length)],
                  [
                    "Largest holding",
                    summary.largest
                      ? `${summary.largest.ticker} · ${summary.largestPct.toFixed(1)}%`
                      : "Cash only",
                  ],
                  ["Sector spread", `${summary.sectors} sectors represented`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[#072116]/10 bg-white p-4"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                      {label}
                    </p>
                    <p className="mt-1 text-[16px] font-black tracking-[-0.02em]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {summary.largestPct > 35 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em]">
                    Concentration check
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-5">
                    {summary.largest?.ticker} represents {summary.largestPct.toFixed(1)}%
                    of this draft. Review the concentration and trade-offs before making
                    your own decision.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-[#ddb159]/28 bg-[#072116] p-4 text-[#faf6f0]">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#ddb159]">
                  What happens next
                </p>
                <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/66">
                  StockGPT will open the normal portfolio workspace so you can run a
                  Portfolio Check, review allocation and understand concentration risks.
                </p>
              </div>

              <button
                type="button"
                onClick={createPortfolio}
                disabled={isSaving}
                className="min-h-12 rounded-full bg-[#ddb159] px-5 text-[13px] font-black text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#072116] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#cbb77e] disabled:text-[#072116]/70"
              >
                {isSaving ? "Creating portfolio…" : "Create portfolio"}
              </button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[12px] font-bold leading-5 text-red-700"
            >
              {error}
            </p>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-[#ddb159]/20 bg-[#061b12]/76 p-4 text-[#faf6f0] shadow-[0_14px_34px_rgba(0,0,0,0.2)] xl:sticky xl:top-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Draft summary
          </p>
          <p className="mt-2 truncate text-[20px] font-black tracking-[-0.04em]">
            {name || "Untitled portfolio"}
          </p>
          <p className="mt-1 text-[28px] font-black tracking-[-0.05em]">
            {money(summary.totalValue, currency)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[0.055] p-3">
              <p className="text-[9px] font-black uppercase text-[#faf6f0]/40">Holdings</p>
              <p className="mt-1 text-[18px] font-black">{holdings.length}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.055] p-3">
              <p className="text-[9px] font-black uppercase text-[#faf6f0]/40">Cash</p>
              <p className="mt-1 text-[18px] font-black">{summary.cashPct.toFixed(1)}%</p>
            </div>
          </div>
          <p className="mt-4 text-[10px] font-semibold leading-5 text-[#faf6f0]/42">
            Educational only. This workflow records your inputs for research support; it
            does not place trades or recommend buys.
          </p>
        </aside>
      </div>
    </div>
  );
}
