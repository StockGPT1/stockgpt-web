"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { StockLogo } from "@/components/StockLogo";
import {
  addCash,
  buyHoldingWithCash,
  deletePortfolio,
  logExistingHolding,
  markReviewed,
  removeHolding,
  renamePortfolio,
  trimHolding,
  updateHoldingDetails,
} from "@/lib/actions/portfolio-management";
import type {
  EnrichedHolding,
  HoldingAlert,
  HoldingTrigger,
  SectorMomentum,
} from "@/lib/portfolio-alerts";

type StockOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  price: number | null;
};

type PortfolioOption = {
  id: string;
  name: string;
  currency?: string | null;
  createdAt?: string | null;
};

type PortfolioTransaction = {
  id: string;
  portfolioId: string;
  ticker: string | null;
  type: string;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realisedPnl: number | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
};

type ReplacementRecommendation = {
  ticker: string;
  company: string;
  sector: string;
  rank: number | null;
  score: number | null;
  price: number | null;
  reason: string;
};

type ExtendedHolding = EnrichedHolding & {
  purchaseDate?: string | null;
  source?: string | null;
  notes?: string | null;
};

type Props = {
  portfolioId: string;
  portfolios: PortfolioOption[];
  holdings: ExtendedHolding[];
  stockOptions?: StockOption[];
  transactions?: PortfolioTransaction[];
  portfolioMeta: {
    id: string;
    name: string;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
    cashBalance: number;
    cashDepositedTotal: number;
    currency?: string | null;
  };
  replacements?: Record<string, ReplacementRecommendation | null>;
  compactImportWidget?: ReactNode;
};

type HoldingFilter = "all" | "action" | "winners" | "losers" | "recent" | "oversized";
type HoldingSort = "urgent" | "value" | "worst" | "best" | "rank" | "ticker";

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: safe >= 1000 ? 0 : 2,
  }).format(safe);
}

function number(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function pct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function horizonLabel(value: string | null) {
  if (value === "short") return "3–5 yrs";
  if (value === "medium") return "5–10 yrs";
  if (value === "long") return "10+ yrs";
  return "—";
}

function transactionLabel(type: string) {
  switch (type) {
    case "deposit":
      return "Cash deposit";
    case "withdrawal":
      return "Cash withdrawal";
    case "buy":
      return "Bought";
    case "sell":
      return "Sold";
    case "import":
      return "Trading 212 import";
    case "log_existing":
      return "Logged existing holding";
    case "adjustment":
      return "Holding adjusted";
    case "cash_adjustment":
      return "Cash adjusted";
    default:
      return type.replace(/_/g, " ");
  }
}

function severityWeight(alert: HoldingAlert) {
  if (alert.severity === "critical") return 4;
  if (alert.severity === "warning") return 3;
  if (alert.severity === "info") return 2;
  return 1;
}

function holdingUrgencyScore(holding: ExtendedHolding) {
  const alertScore = holding.alerts.reduce(
    (sum, alert) => sum + severityWeight(alert) * Math.max(alert.priority, 1),
    0,
  );

  const actionBoost = holding.actionAlerts.length * 20;
  const reviewBoost = holding.daysSinceReview > 30 ? 8 : 0;

  return alertScore + actionBoost + reviewBoost;
}

function isOversized(holding: ExtendedHolding) {
  if (!holding.targetAllocationPct) return false;
  return holding.currentAllocationPct - holding.targetAllocationPct > 3;
}

function recommendationStyle(recommendation: EnrichedHolding["recommendation"]) {
  if (recommendation === "Sell Immediately" || recommendation === "Sell Whole Position") {
    return "bg-red-600 text-white";
  }

  if (recommendation === "Review Urgently") return "bg-red-500 text-white";
  if (recommendation === "Consider Trimming") return "bg-amber-500 text-white";
  if (recommendation === "Consider Buying More") return "bg-emerald-500 text-white";
  if (recommendation === "Strong Hold") return "bg-emerald-200 text-[#072116]";
  return "bg-[#072116] text-[#ddb159]";
}

function alertStyle(alert: HoldingAlert) {
  if (alert.severity === "critical") {
    return {
      wrap: "border-red-300 bg-red-50",
      badge: "bg-red-600 text-white",
      text: "text-red-900",
      label: "Critical",
    };
  }

  if (alert.severity === "warning") {
    return {
      wrap: "border-amber-300 bg-amber-50",
      badge: "bg-amber-500 text-white",
      text: "text-amber-900",
      label: "Warning",
    };
  }

  if (alert.severity === "success") {
    return {
      wrap: "border-emerald-300 bg-emerald-50",
      badge: "bg-emerald-500 text-white",
      text: "text-emerald-900",
      label: "Positive",
    };
  }

  return {
    wrap: "border-blue-300 bg-blue-50",
    badge: "bg-blue-500 text-white",
    text: "text-blue-900",
    label: "Info",
  };
}

function sectorMomentumStyle(momentum: SectorMomentum) {
  if (momentum === "Booming") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (momentum === "Strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (momentum === "Mixed") return "border-blue-200 bg-blue-50 text-blue-700";
  if (momentum === "Weak") return "border-amber-200 bg-amber-50 text-amber-700";
  if (momentum === "Struggling") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function triggerToneStyle(tone: HoldingTrigger["tone"]) {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "negative") return "border-red-200 bg-red-50 text-red-900";
  return "border-blue-200 bg-blue-50 text-blue-900";
}

function AlertCard({ alert }: { alert: HoldingAlert }) {
  const style = alertStyle(alert);

  return (
    <div className={`min-w-0 rounded-2xl border ${style.wrap} p-3`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${style.badge}`}>
          {style.label}
        </span>
        <span className="rounded-full bg-white/75 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#072116]/65">
          {alert.category === "action" ? "Action" : "Event"}
        </span>
      </div>

      <p className={`mt-2 text-[13px] font-black tracking-[-0.01em] ${style.text}`}>
        {alert.title}
      </p>

      <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#072116]/70">
        {alert.message}
      </p>

      {alert.evidence.length > 0 && (
        <div className="mt-2 rounded-xl bg-white/75 p-2">
          <p className="text-[9px] font-black uppercase tracking-wider text-[#072116]/45">
            Evidence
          </p>
          <ul className="mt-1 grid gap-1">
            {alert.evidence.slice(0, 5).map((item) => (
              <li key={item} className="text-[11px] font-semibold leading-snug text-[#072116]/70">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 rounded-xl bg-white p-2">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#072116]/45">
          StockGPT action
        </p>
        <p className="mt-0.5 text-[12px] font-bold leading-relaxed text-[#072116]">
          {alert.recommendation}
        </p>
      </div>

      <p className="mt-2 text-[10px] font-semibold leading-relaxed text-[#072116]/45">
        {alert.expiresWhen}
      </p>
    </div>
  );
}

function AddCashWidget({ portfolioId, currency }: { portfolioId: string; currency: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Enter a valid cash amount.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const result = await addCash({ portfolioId, amount: value });

      if (!result.success) {
        setMessage(result.error ?? "Could not add cash.");
        return;
      }

      setAmount("");
      setMessage("Cash added.");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-[#ddb159]/22 bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
        Add cash
      </p>
      <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">
        Deposit funds
      </h3>
      <p className="mt-1.5 text-[11px] font-semibold leading-5 text-[#072116]/55">
        Deposits increase available cash and portfolio value, but do not count as profit.
      </p>

      <div className="mt-4 grid min-w-0 gap-2">
        <input
          type="number"
          min={0}
          step={10}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="1000"
          className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
        />

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-11 rounded-2xl bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Adding…" : "+ Add cash"}
        </button>

        {message && (
          <p className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold leading-5 text-[#072116]/65">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function ManualHoldingWidget({
  portfolioId,
  stockOptions,
  cashBalance,
  currency,
}: {
  portfolioId: string;
  stockOptions: StockOption[];
  cashBalance: number;
  currency: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"existing" | "cash">("existing");
  const [query, setQuery] = useState("");
  const [shares, setShares] = useState("");
  const [amount, setAmount] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cleanTicker = query.trim().toUpperCase();

  const exactMatch = useMemo(
    () => stockOptions.find((stock) => stock.ticker.toUpperCase() === cleanTicker),
    [cleanTicker, stockOptions],
  );

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return stockOptions.slice(0, 8);

    return stockOptions
      .filter((stock) => {
        const ticker = stock.ticker.toLowerCase();
        const company = stock.company?.toLowerCase() ?? "";
        return ticker.includes(term) || company.includes(term);
      })
      .slice(0, 8);
  }, [query, stockOptions]);

  function selectStock(stock: StockOption) {
    setQuery(stock.ticker);
    setMessage(null);
    setPriceEdited(false);

    if (stock.price && Number.isFinite(stock.price)) {
      setEntryPrice(String(stock.price));
    }
  }

  function handleTickerChange(value: string) {
    const upper = value.toUpperCase();
    setQuery(upper);
    setMessage(null);

    const match = stockOptions.find((stock) => stock.ticker.toUpperCase() === upper.trim());

    if (match?.price && !priceEdited) {
      setEntryPrice(String(match.price));
    }
  }

  function submit() {
    const ticker = cleanTicker;
    const price = Number(entryPrice);
    const shareCount = Number(shares);
    const dollarAmount = Number(amount);

    if (!ticker) {
      setMessage("Choose a ticker first.");
      return;
    }

    if (!exactMatch) {
      setMessage("Choose a ticker from the StockGPT rankings list.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setMessage("Enter a valid average entry price.");
      return;
    }

    if (mode === "existing") {
      if (!Number.isFinite(shareCount) || shareCount <= 0) {
        setMessage("Enter the number of shares you own.");
        return;
      }

      startTransition(async () => {
        const result = await logExistingHolding({
          portfolioId,
          ticker,
          shares: shareCount,
          entryPrice: price,
          purchaseDate: purchaseDate || null,
          notes: notes.trim() || null,
        });

        if (!result.success) {
          setMessage(result.error ?? "Could not log this holding.");
          return;
        }

        setShares("");
        setAmount("");
        setNotes("");
        setMessage(`${ticker} logged successfully.`);
        router.refresh();
      });

      return;
    }

    if (!Number.isFinite(dollarAmount) || dollarAmount <= 0) {
      setMessage("Enter an amount to invest.");
      return;
    }

    if (dollarAmount > cashBalance + 0.001) {
      setMessage(`Not enough cash. You need ${money(dollarAmount - cashBalance, currency)} more.`);
      return;
    }

    startTransition(async () => {
      const result = await buyHoldingWithCash({
        portfolioId,
        ticker,
        dollarAmount,
        entryPrice: price,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setMessage(result.error ?? "Could not buy this holding.");
        return;
      }

      setAmount("");
      setShares("");
      setNotes("");
      setMessage(`${ticker} added using portfolio cash.`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-[#ddb159]/22 bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
        Add holding manually
      </p>
      <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em]">
        Add a stock
      </h3>
      <p className="mt-1.5 text-[11px] font-semibold leading-5 text-[#072116]/55">
        Auto-fill the latest price, then adjust it to your real entry.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={[
            "rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition",
            mode === "existing"
              ? "border-[#ddb159] bg-[#ddb159] text-[#072116]"
              : "border-[#072116]/10 bg-white text-[#072116]/55 hover:border-[#ddb159]/50",
          ].join(" ")}
        >
          Log existing
        </button>

        <button
          type="button"
          onClick={() => setMode("cash")}
          className={[
            "rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition",
            mode === "cash"
              ? "border-[#ddb159] bg-[#ddb159] text-[#072116]"
              : "border-[#072116]/10 bg-white text-[#072116]/55 hover:border-[#ddb159]/50",
          ].join(" ")}
        >
          Buy with cash
        </button>
      </div>

      <div className="mt-3 grid min-w-0 gap-2">
        <label className="relative block min-w-0">
          <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">
            Ticker
          </span>
          <input
            value={query}
            onChange={(event) => handleTickerChange(event.target.value)}
            placeholder="AAPL"
            className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black uppercase outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
          />

          {query.trim() && suggestions.length > 0 && !exactMatch && (
            <div className="absolute left-0 right-0 top-[68px] z-20 max-h-64 overflow-y-auto rounded-2xl border border-[#ddb159]/30 bg-white p-1 shadow-[0_16px_34px_rgba(0,0,0,0.22)]">
              {suggestions.map((stock) => (
                <button
                  key={stock.ticker}
                  type="button"
                  onClick={() => selectStock(stock)}
                  className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[#ddb159]/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-black text-[#072116]">
                      {stock.ticker}
                      {stock.company ? (
                        <span className="font-semibold text-[#072116]/45">
                          {" "}
                          · {stock.company}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[10px] font-semibold text-[#072116]/45">
                      {stock.sector ?? "—"} · rank #{stock.rank ?? "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-black text-[#072116]/70">
                    {stock.price ? money(stock.price, currency) : "—"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          {mode === "existing" ? (
            <label className="block min-w-0">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">
                Shares owned
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={shares}
                onChange={(event) => setShares(event.target.value)}
                placeholder="10"
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
              />
            </label>
          ) : (
            <label className="block min-w-0">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">
                Amount to invest
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="500"
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
              />
            </label>
          )}

          <label className="block min-w-0">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/42">
              Avg entry price
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={entryPrice}
              onChange={(event) => {
                setPriceEdited(true);
                setEntryPrice(event.target.value);
              }}
              placeholder="Auto-fills"
              className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
            />
          </label>
        </div>

        <input
          type="date"
          value={purchaseDate}
          onChange={(event) => setPurchaseDate(event.target.value)}
          className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-bold outline-none transition focus:border-[#ddb159]"
        />

        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes optional"
          className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[12px] font-semibold outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
        />

        {mode === "cash" && (
          <p className="rounded-2xl border border-[#072116]/10 bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-[#072116]/60">
            Available cash:{" "}
            <span className="font-black text-[#072116]">
              {money(cashBalance, currency)}
            </span>
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-11 rounded-2xl bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Adding…" : mode === "existing" ? "+ Log holding" : "+ Buy with cash"}
        </button>

        {message && (
          <p className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold leading-5 text-[#072116]/65">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function PortfolioControls({
  portfolioId,
  portfolioName,
  portfolios,
}: {
  portfolioId: string;
  portfolioName: string;
  portfolios: PortfolioOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(portfolioName);
  const [message, setMessage] = useState<string | null>(null);
  const [isRenaming, startRenaming] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function saveName() {
    const cleanName = name.trim();

    if (!cleanName) {
      setMessage("Portfolio name cannot be empty.");
      return;
    }

    startRenaming(async () => {
      const result = await renamePortfolio({ portfolioId, name: cleanName });

      if (!result.success) {
        setMessage(result.error ?? "Could not rename portfolio.");
        return;
      }

      setMessage("Portfolio renamed.");
      router.refresh();
    });
  }

  function runDelete() {
    const confirmed = window.confirm(
      `Delete "${portfolioName}"? This removes this portfolio and its holdings only. Other portfolios will not be touched.`,
    );

    if (!confirmed) return;

    startDeleting(async () => {
      const result = await deletePortfolio({ portfolioId });

      if (!result.success) {
        setMessage(result.error ?? "Could not delete portfolio.");
        return;
      }

      router.push("/portfolio");
      router.refresh();
    });
  }

  return (
    <div className="min-w-0 rounded-3xl border border-[#ddb159]/20 bg-[#061b12]/72 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Active portfolio
          </span>
          <input
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            className="h-11 w-full min-w-0 rounded-2xl border border-[#ddb159]/20 bg-[#04180f]/80 px-4 text-[15px] font-black text-[#faf6f0] outline-none transition placeholder:text-[#faf6f0]/25 focus:border-[#ddb159]"
          />
        </label>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={saveName}
            disabled={isRenaming || name.trim() === portfolioName.trim()}
            className="h-11 rounded-2xl bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 disabled:opacity-50"
          >
            {isRenaming ? "Saving…" : "Rename"}
          </button>

          <Link
            href="/portfolio?builder=1"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#ddb159]/32 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
          >
            + New
          </Link>

          <button
            type="button"
            onClick={runDelete}
            disabled={isDeleting}
            className="col-span-2 h-11 rounded-2xl border border-red-400/40 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-red-200 transition hover:bg-red-500/10 disabled:opacity-50 sm:col-span-1"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {portfolios.length > 1 && (
        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          {portfolios.map((portfolio) => {
            const active = portfolio.id === portfolioId;

            return (
              <Link
                key={portfolio.id}
                href={`/portfolio?portfolio=${portfolio.id}`}
                className={[
                  "max-w-full rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition",
                  active
                    ? "border-[#ddb159] bg-[#ddb159] text-[#072116]"
                    : "border-[#ddb159]/22 text-[#faf6f0]/58 hover:border-[#ddb159]/60 hover:text-[#ddb159]",
                ].join(" ")}
              >
                <span className="block max-w-[180px] truncate">{portfolio.name}</span>
              </Link>
            );
          })}
        </div>
      )}

      {message && (
        <p className="mt-3 rounded-2xl border border-[#ddb159]/16 bg-[#04180f]/80 px-3 py-2 text-[11px] font-bold leading-5 text-[#faf6f0]/64">
          {message}
        </p>
      )}
    </div>
  );
}

function SummaryCard({
  portfolioMeta,
  holdings,
  transactions,
}: {
  portfolioMeta: Props["portfolioMeta"];
  holdings: ExtendedHolding[];
  transactions: PortfolioTransaction[];
}) {
  const currency = portfolioMeta.currency ?? "USD";
  const cashBalance = portfolioMeta.cashBalance;
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalValue = holdingsValue + cashBalance;
  const unrealisedPnl = holdings.reduce((sum, holding) => sum + holding.totalPnLDollars, 0);
  const realisedPnl = transactions.reduce((sum, transaction) => sum + Number(transaction.realisedPnl ?? 0), 0);
  const totalPnl = unrealisedPnl + realisedPnl;
  const basis = Math.max(portfolioMeta.cashDepositedTotal, totalCost, 1);
  const totalPnlPct = (totalPnl / basis) * 100;

  const avgScore =
    holdings.length > 0
      ? Math.round(holdings.reduce((sum, holding) => sum + holding.score, 0) / holdings.length)
      : 0;

  const actionAlerts = holdings.reduce((sum, holding) => sum + holding.actionAlerts.length, 0);
  const eventWarnings = holdings.reduce(
    (sum, holding) =>
      sum +
      holding.eventAlerts.filter(
        (alert) => alert.severity === "critical" || alert.severity === "warning",
      ).length,
    0,
  );
  const oversized = holdings.filter(isOversized).length;
  const cashDrag = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;

  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        76 +
          (avgScore > 0 ? Math.min(avgScore / 40, 12) : 0) -
          actionAlerts * 8 -
          eventWarnings * 3 -
          oversized * 5 -
          (cashDrag > 25 ? 5 : 0),
      ),
    ),
  );

  const healthLabel =
    healthScore >= 85 ? "Strong" : healthScore >= 70 ? "Healthy" : healthScore >= 55 ? "Needs review" : "High risk";

  const isPositive = totalPnl >= 0;

  return (
    <div className="relative min-w-0 overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] p-4 text-[#faf6f0] shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:p-5">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative min-w-0">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Portfolio value
            </p>
            <h1 className="mt-1 text-[34px] font-black leading-none tracking-[-0.06em] sm:text-[44px]">
              {money(totalValue, currency)}
            </h1>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              <span
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em]",
                  isPositive ? "bg-emerald-400/16 text-emerald-300" : "bg-red-400/16 text-red-200",
                ].join(" ")}
              >
                {money(totalPnl, currency)} · {pct(totalPnlPct)}
              </span>
              <span className="rounded-full bg-[#ddb159]/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#ddb159]">
                Health: {healthLabel} {healthScore}/100
              </span>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[420px]">
            <SummaryMini label="Holdings" value={String(holdings.length)} sub={money(holdingsValue, currency)} />
            <SummaryMini label="Cash" value={money(cashBalance, currency)} sub={`${cashDrag.toFixed(1)}% cash`} />
            <SummaryMini label="Avg score" value={avgScore ? String(avgScore) : "—"} sub="model quality" />
            <SummaryMini label="Action alerts" value={String(actionAlerts)} sub="direct actions" />
            <SummaryMini label="Realised" value={money(realisedPnl, currency)} sub="closed trades" positive={realisedPnl >= 0} />
            <SummaryMini label="Unrealised" value={money(unrealisedPnl, currency)} sub="open holdings" positive={unrealisedPnl >= 0} />
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
          <SummaryMini label="Risk" value={portfolioMeta.riskTolerance ?? "Manual"} sub="profile" compact />
          <SummaryMini label="Horizon" value={horizonLabel(portfolioMeta.timeHorizon)} sub="time frame" compact />
          <SummaryMini label="Deposited basis" value={money(portfolioMeta.cashDepositedTotal, currency)} sub="cash in" compact />
        </div>
      </div>
    </div>
  );
}

function SummaryMini({
  label,
  value,
  sub,
  positive,
  compact = false,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/60 p-3">
      <p className="truncate text-[8px] font-black uppercase tracking-wider text-[#ddb159]/70">
        {label}
      </p>
      <p
        className={[
          "mt-1 truncate font-black",
          compact ? "text-[13px]" : "text-[19px]",
          positive == null ? "" : positive ? "text-emerald-300" : "text-red-200",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="truncate text-[10px] font-semibold text-[#faf6f0]/42">
        {sub}
      </p>
    </div>
  );
}

function EditHoldingModal({
  portfolioId,
  holding,
  currency,
  onClose,
}: {
  portfolioId: string;
  holding: ExtendedHolding;
  currency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [shares, setShares] = useState(String(holding.shares));
  const [entryPrice, setEntryPrice] = useState(String(holding.entryPrice));
  const [purchaseDate, setPurchaseDate] = useState(dateInputValue(holding.purchaseDate));
  const [notes, setNotes] = useState(holding.notes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const shareCount = Number(shares);
    const price = Number(entryPrice);

    if (!Number.isFinite(shareCount) || shareCount < 0) {
      setMessage("Enter a valid share amount.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setMessage("Enter a valid entry price.");
      return;
    }

    startTransition(async () => {
      const result = await updateHoldingDetails({
        portfolioId,
        ticker: holding.ticker,
        shares: shareCount,
        entryPrice: price,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setMessage(result.error ?? "Could not update holding.");
        return;
      }

      router.refresh();
      onClose();
    });
  }

  function sellRemove() {
    const confirmed = window.confirm(
      `Sell/remove ${holding.ticker}? This will remove it from this portfolio and credit cash using the current price.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      const result = await removeHolding({
        portfolioId,
        ticker: holding.ticker,
        creditCash: true,
      });

      if (!result.success) {
        setMessage(result.error ?? "Could not remove holding.");
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-x-hidden bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#ddb159]/24 bg-[#faf6f0] text-[#072116] shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <div className="flex min-w-0 items-start justify-between gap-4 border-b border-[#072116]/10 p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
              Edit holding
            </p>
            <h3 className="mt-1 text-[24px] font-black tracking-[-0.04em]">
              {holding.ticker}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#072116]/12 text-[18px] font-black text-[#072116]/50 transition hover:bg-white"
          >
            ×
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Shares
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={shares}
                onChange={(event) => setShares(event.target.value)}
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none focus:border-[#ddb159]"
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Average entry
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={entryPrice}
                onChange={(event) => setEntryPrice(event.target.value)}
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-black outline-none focus:border-[#ddb159]"
              />
            </label>

            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Purchase date
              </span>
              <input
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[14px] font-bold outline-none focus:border-[#ddb159]"
              />
            </label>

            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full min-w-0 resize-none rounded-2xl border border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#ddb159]"
              />
            </label>
          </div>

          <div className="mt-3 rounded-2xl border border-[#072116]/10 bg-white p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Current value
            </p>
            <p className="mt-1 text-[18px] font-black">
              {money(holding.currentValue, currency)}
            </p>
            <p className="text-[11px] font-semibold text-[#072116]/50">
              {number(holding.shares, 4)} shares at {money(holding.currentPrice, currency)}
            </p>
          </div>

          {message && (
            <p className="mt-3 rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
              {message}
            </p>
          )}

          <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="h-11 rounded-2xl bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:brightness-110 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>

            <button
              type="button"
              onClick={sellRemove}
              disabled={isPending}
              className="h-11 rounded-2xl border border-red-300 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              Sell/remove
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-[#072116]/12 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116]/58 transition hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HoldingMetric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "positive" | "negative" | "gold";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : tone === "gold"
          ? "text-[#8a641a]"
          : "text-[#072116]";

  return (
    <div className="min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 py-2.5">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/40">
        {label}
      </p>
      <p className={`mt-1 truncate text-[17px] font-black leading-none tracking-[-0.03em] ${valueClass}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 truncate text-[10px] font-semibold leading-none text-[#072116]/45">
          {sub}
        </p>
      )}
    </div>
  );
}

function HoldingRow({
  portfolioId,
  holding,
  replacement,
  cashBalance,
  currency,
}: {
  portfolioId: string;
  holding: ExtendedHolding;
  replacement?: ReplacementRecommendation | null;
  cashBalance: number;
  currency: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(holding.actionAlerts.length > 0);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const recClass = recommendationStyle(holding.recommendation);
  const sectorClass = sectorMomentumStyle(holding.sectorMomentum);
  const isPositive = holding.totalPnLDollars >= 0;
  const drift =
    holding.targetAllocationPct == null
      ? null
      : holding.currentAllocationPct - holding.targetAllocationPct;

  const needsReplacement =
    replacement &&
    holding.actionAlerts.some(
      (alert) => alert.action === "sell" || alert.action === "trim",
    );

  const primaryAlert = holding.actionAlerts[0] ?? holding.eventAlerts[0] ?? null;
  const riskBadges = [
    holding.actionAlerts.length > 0 ? `${holding.actionAlerts.length} action` : null,
    holding.eventAlerts.length > 0 ? `${holding.eventAlerts.length} event` : null,
    drift != null && Math.abs(drift) > 3 ? `${drift > 0 ? "Over" : "Under"} ${Math.abs(drift).toFixed(1)}%` : null,
  ].filter(Boolean);

  function review() {
    startTransition(async () => {
      await markReviewed({ portfolioId, ticker: holding.ticker });
      router.refresh();
    });
  }

  function quickTrim() {
    startTransition(async () => {
      await trimHolding({ portfolioId, ticker: holding.ticker, percentage: 25 });
      router.refresh();
    });
  }

  function quickBuyMore(amount: number) {
    startTransition(async () => {
      await buyHoldingWithCash({
        portfolioId,
        ticker: holding.ticker,
        dollarAmount: amount,
        entryPrice: holding.currentPrice,
        notes: "Added from portfolio card.",
      });
      router.refresh();
    });
  }

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-[#072116]/10 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
      <div className="grid min-w-0 gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="min-w-0">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <StockLogo ticker={holding.ticker} size={44} />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/stock/${holding.ticker}`}
                    prefetch={false}
                    className="min-w-0 truncate text-[22px] font-black leading-none tracking-[-0.05em] transition hover:text-[#0b2b1d]"
                  >
                    {holding.ticker}
                  </Link>

                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${recClass}`}>
                    {holding.recommendation}
                  </span>

                  {holding.isRecentlyAdded && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-blue-700">
                      Recently added
                    </span>
                  )}
                </div>

                <p className="mt-1 truncate text-[12px] font-bold text-[#072116]/55">
                  {holding.company ?? "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
              <HoldingMetric
                label="Value"
                value={money(holding.currentValue, currency)}
                sub={`${number(holding.shares, 4)} shares`}
                tone="neutral"
              />

              <HoldingMetric
                label="P&L"
                value={money(holding.totalPnLDollars, currency)}
                sub={pct(holding.pnlPercent)}
                tone={isPositive ? "positive" : "negative"}
              />
            </div>
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:hidden">
            <HoldingMetric
              label="Avg cost / price"
              value={money(holding.entryPrice, currency)}
              sub={`Now ${money(holding.currentPrice, currency)}`}
            />
            <HoldingMetric
              label="Allocation"
              value={`${holding.currentAllocationPct.toFixed(1)}%`}
              sub={`Target ${holding.targetAllocationPct?.toFixed(1) ?? "—"}%`}
            />
            <HoldingMetric
              label="Rank"
              value={`#${holding.rank ?? "—"}`}
              sub={`Score ${number(holding.score, 0)}`}
              tone="gold"
            />
            <HoldingMetric
              label="Review"
              value={`${holding.daysSinceReview}d`}
              sub="since review"
            />
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${sectorClass}`}>
              {holding.sectorMomentum} sector
            </span>

            <span className="rounded-full border border-[#072116]/10 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#072116]/60">
              Rank #{holding.rank ?? "—"}
            </span>

            <span className="rounded-full border border-[#072116]/10 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#072116]/60">
              Score {number(holding.score, 0)}
            </span>

            {riskBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-amber-700"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
            <div className="min-w-0 rounded-2xl border border-[#072116]/10 bg-white/65 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/40">
                StockGPT summary
              </p>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[#072116]/68">
                {holding.aiSummary}
              </p>
            </div>

            {primaryAlert ? (
              <div className="min-w-0 rounded-2xl border border-[#ddb159]/25 bg-[#ddb159]/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                  Main signal
                </p>
                <p className="mt-1 text-[12px] font-black leading-5 text-[#072116]">
                  {primaryAlert.title}
                </p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-[#072116]/58">
                  {primaryAlert.action === "none" ? "No direct action" : primaryAlert.action.replace("_", " ")}
                </p>
              </div>
            ) : (
              <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                  Clear
                </p>
                <p className="mt-1 text-[12px] font-black leading-5 text-emerald-900">
                  No active alerts.
                </p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-emerald-800/70">
                  Leave alone unless your thesis changes.
                </p>
              </div>
            )}
          </div>

          {needsReplacement && replacement && (
            <div className="mt-3 min-w-0 rounded-2xl border border-[#ddb159]/30 bg-[#ddb159]/10 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
                Suggested replacement
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/stock/${replacement.ticker}`}
                    prefetch={false}
                    className="text-[15px] font-black tracking-[-0.02em] text-[#072116] hover:underline"
                  >
                    {replacement.ticker} · {replacement.company}
                  </Link>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-[#072116]/60">
                    {replacement.reason}
                  </p>
                </div>

                <Link
                  href={`/stock/${replacement.ticker}`}
                  prefetch={false}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#072116] px-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]"
                >
                  View
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className="hidden min-w-0 grid-cols-2 gap-2 xl:grid">
          <HoldingMetric
            label="Avg cost"
            value={money(holding.entryPrice, currency)}
            sub={`Now ${money(holding.currentPrice, currency)}`}
          />
          <HoldingMetric
            label="Allocation"
            value={`${holding.currentAllocationPct.toFixed(1)}%`}
            sub={`Target ${holding.targetAllocationPct?.toFixed(1) ?? "—"}%`}
          />
          <HoldingMetric
            label="Rank"
            value={`#${holding.rank ?? "—"}`}
            sub={`Score ${number(holding.score, 0)}`}
            tone="gold"
          />
          <HoldingMetric
            label="Review"
            value={`${holding.daysSinceReview}d`}
            sub="since review"
          />

          <div className="col-span-2 rounded-2xl border border-[#072116]/10 bg-white px-3 py-2.5">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/40">
              Dates
            </p>
            <p className="mt-1 truncate text-[11px] font-bold text-[#072116]">
              Bought {formatDate(holding.purchaseDate ?? holding.addedAt)}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/45">
              Reviewed {formatDate(holding.lastReviewedAt)}
            </p>
          </div>
        </aside>
      </div>

      <div className="grid min-w-0 gap-2 border-t border-[#072116]/10 bg-white/60 p-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-[#072116]/10 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#072116]/60 transition hover:border-[#ddb159]"
          >
            {expanded ? "Hide detail" : "View detail"}
          </button>

          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-full border border-[#072116]/10 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#072116]/60 transition hover:border-[#ddb159]"
          >
            Edit
          </button>

          {(holding.recommendation === "Consider Trimming" ||
            holding.recommendation === "Sell Immediately" ||
            holding.recommendation === "Sell Whole Position") && (
            <button
              type="button"
              onClick={quickTrim}
              disabled={isPending}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:brightness-105 disabled:opacity-60"
            >
              Trim 25%
            </button>
          )}

          {holding.recommendation === "Consider Buying More" && cashBalance > 0 && (
            <button
              type="button"
              onClick={() => quickBuyMore(Math.min(500, cashBalance))}
              disabled={isPending}
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:brightness-105 disabled:opacity-60"
            >
              Add {money(Math.min(500, cashBalance), currency)}
            </button>
          )}

          <button
            type="button"
            onClick={review}
            disabled={isPending}
            className="rounded-full bg-[#072116] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159] transition hover:brightness-110 disabled:opacity-60"
          >
            Mark reviewed
          </button>
        </div>

        <p className="hidden text-[10px] font-semibold text-[#072116]/45 sm:block">
          Bought {formatDate(holding.purchaseDate ?? holding.addedAt)} · reviewed{" "}
          {formatDate(holding.lastReviewedAt)}
        </p>
      </div>

      {expanded && (
        <div className="grid min-w-0 gap-3 border-t border-[#072116]/10 bg-[#faf6f0] p-3">
          {holding.actionAlerts.length > 0 && (
            <div className="grid min-w-0 gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
                Action alerts
              </p>
              <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                {holding.actionAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {holding.eventAlerts.length > 0 && (
            <div className="grid min-w-0 gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
                Event alerts
              </p>
              <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                {holding.eventAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {holding.triggers.length > 0 && (
            <div className="grid min-w-0 gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
                Decision levels
              </p>
              <div className="grid min-w-0 gap-2 md:grid-cols-2">
                {holding.triggers.map((trigger) => (
                  <div
                    key={`${holding.ticker}-${trigger.type}`}
                    className={`min-w-0 rounded-2xl border p-3 ${triggerToneStyle(trigger.tone)}`}
                  >
                    <p className="text-[12px] font-black">{trigger.condition}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 opacity-75">
                      {trigger.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {holding.actionAlerts.length === 0 &&
            holding.eventAlerts.length === 0 &&
            holding.triggers.length === 0 && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800">
                No active alerts for this holding.
              </p>
            )}
        </div>
      )}

      {editOpen && (
        <EditHoldingModal
          portfolioId={portfolioId}
          holding={holding}
          currency={currency}
          onClose={() => setEditOpen(false)}
        />
      )}
    </article>
  );
}

function TransactionHistory({
  transactions,
  currency,
}: {
  transactions: PortfolioTransaction[];
  currency: string;
}) {
  if (transactions.length === 0) {
    return (
      <div className="min-w-0 rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 text-[#faf6f0]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
          Recent activity
        </p>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/50">
          No transaction history yet. Cash deposits, imports, buys, sells and manual logs will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-4 text-[#faf6f0]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
        Recent activity
      </p>
      <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">
        Deposits, buys, sells, imports and manual logs.
      </p>

      <div className="mt-3 grid min-w-0 gap-2">
        {transactions.slice(0, 10).map((transaction) => (
          <div
            key={transaction.id}
            className="grid min-w-0 gap-2 rounded-2xl border border-[#ddb159]/10 bg-[#04180f]/72 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-[#faf6f0]">
                {transactionLabel(transaction.type)}
                {transaction.ticker ? ` · ${transaction.ticker}` : ""}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-[#faf6f0]/42">
                {formatDate(transaction.createdAt)}
                {transaction.notes ? ` · ${transaction.notes}` : ""}
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
              {transaction.shares != null && (
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-[#faf6f0]/60">
                  {number(transaction.shares, 4)} shares
                </span>
              )}

              {transaction.amount != null && (
                <span className="rounded-full bg-[#ddb159]/12 px-2 py-1 text-[10px] font-black text-[#ddb159]">
                  {money(transaction.amount, transaction.currency ?? currency)}
                </span>
              )}

              {transaction.realisedPnl != null && transaction.realisedPnl !== 0 && (
                <span
                  className={[
                    "rounded-full px-2 py-1 text-[10px] font-black",
                    transaction.realisedPnl >= 0
                      ? "bg-emerald-400/12 text-emerald-300"
                      : "bg-red-400/12 text-red-200",
                  ].join(" ")}
                >
                  Realised {money(transaction.realisedPnl, transaction.currency ?? currency)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SavedPortfolio({
  portfolioId,
  portfolios,
  holdings,
  stockOptions = [],
  transactions = [],
  portfolioMeta,
  replacements = {},
  compactImportWidget,
}: Props) {
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [sort, setSort] = useState<HoldingSort>("urgent");

  const currency = portfolioMeta.currency ?? "USD";
  const cashBalance = portfolioMeta.cashBalance;

  const filteredHoldings = useMemo(() => {
    let next = [...holdings];

    if (filter === "action") next = next.filter((holding) => holding.actionAlerts.length > 0);
    if (filter === "winners") next = next.filter((holding) => holding.totalPnLDollars > 0);
    if (filter === "losers") next = next.filter((holding) => holding.totalPnLDollars < 0);
    if (filter === "recent") next = next.filter((holding) => holding.isRecentlyAdded);
    if (filter === "oversized") next = next.filter(isOversized);

    next.sort((a, b) => {
      if (sort === "urgent") return holdingUrgencyScore(b) - holdingUrgencyScore(a);
      if (sort === "value") return b.currentValue - a.currentValue;
      if (sort === "worst") return a.pnlPercent - b.pnlPercent;
      if (sort === "best") return b.pnlPercent - a.pnlPercent;
      if (sort === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999);
      return a.ticker.localeCompare(b.ticker);
    });

    return next;
  }, [filter, holdings, sort]);

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      <PortfolioControls
        portfolioId={portfolioId}
        portfolioName={portfolioMeta.name}
        portfolios={portfolios}
      />

      <SummaryCard
        portfolioMeta={portfolioMeta}
        holdings={holdings}
        transactions={transactions}
      />

      <div className="grid min-w-0 max-w-full gap-3 xl:grid-cols-3">
        <AddCashWidget portfolioId={portfolioId} currency={currency} />

        <ManualHoldingWidget
          portfolioId={portfolioId}
          stockOptions={stockOptions}
          cashBalance={cashBalance}
          currency={currency}
        />

        <div className="min-w-0">{compactImportWidget}</div>
      </div>

      <div className="min-w-0 rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-3 text-[#faf6f0]">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              Holdings
            </p>
            <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">
              Compact cards show the decision, P&L, allocation and main signal without wasted space.
            </p>
          </div>

          <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as HoldingFilter)}
              className="h-10 min-w-0 rounded-2xl border border-[#ddb159]/20 bg-[#04180f] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#faf6f0] outline-none focus:border-[#ddb159]"
            >
              <option value="all">All holdings</option>
              <option value="action">Action needed</option>
              <option value="winners">Winners</option>
              <option value="losers">Losers</option>
              <option value="recent">Recently added</option>
              <option value="oversized">Oversized</option>
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as HoldingSort)}
              className="h-10 min-w-0 rounded-2xl border border-[#ddb159]/20 bg-[#04180f] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#faf6f0] outline-none focus:border-[#ddb159]"
            >
              <option value="urgent">Most urgent</option>
              <option value="value">Highest value</option>
              <option value="worst">Worst P&L</option>
              <option value="best">Best P&L</option>
              <option value="rank">Best rank</option>
              <option value="ticker">Ticker A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="min-w-0 rounded-3xl border border-dashed border-[#ddb159]/24 bg-[#061b12]/72 p-6 text-center text-[#faf6f0]">
          <p className="text-[24px] font-black tracking-[-0.05em]">
            No holdings yet.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#faf6f0]/52">
            Add cash, log an existing holding, import from Trading 212, or build a new AI portfolio.
          </p>
        </div>
      ) : filteredHoldings.length === 0 ? (
        <div className="min-w-0 rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-5 text-[#faf6f0]">
          <p className="text-[16px] font-black">No holdings match this filter.</p>
          <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">
            Try changing the filter or sort option.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          {filteredHoldings.map((holding) => (
            <HoldingRow
              key={holding.ticker}
              portfolioId={portfolioId}
              holding={holding}
              replacement={replacements[holding.ticker]}
              cashBalance={cashBalance}
              currency={currency}
            />
          ))}
        </div>
      )}

      <TransactionHistory transactions={transactions} currency={currency} />

      <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">
        ⚠️ StockGPT portfolio alerts are generated from rankings, factor diagnostics, portfolio data, price action and recent news. They are research tools, not financial advice.
      </p>
    </div>
  );
}
