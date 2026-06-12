"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buyHoldingWithCash,
  logExistingHolding,
} from "@/lib/actions/portfolio-management";

type PortfolioOption = {
  id: string;
  name: string;
  cashBalance?: number | null;
  currency?: string | null;
};

type StockOption = {
  ticker: string;
  company?: string | null;
  sector?: string | null;
  rank?: number | null;
  price?: number | null;
};

type Props = {
  defaultTicker?: string;
  defaultEntryPrice?: number | null;
  compact?: boolean;
  isAuthenticated?: boolean;
  portfolios?: PortfolioOption[];
  defaultPortfolioId?: string | null;
  stockOptions?: StockOption[];
  onSuccess?: () => void;
};

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    return "";
  }

  return Number(value).toFixed(2);
}

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: safe >= 1000 ? 0 : 2,
  }).format(safe);
}

function dateToday() {
  return new Date().toISOString().slice(0, 10);
}

export function ManualPortfolioEntry({
  defaultTicker = "",
  defaultEntryPrice,
  compact = false,
  isAuthenticated = true,
  portfolios = [],
  defaultPortfolioId = null,
  stockOptions = [],
  onSuccess,
}: Props) {
  const router = useRouter();

  const normalisedDefaultTicker = defaultTicker.trim().toUpperCase();
  const hasLockedTicker = Boolean(normalisedDefaultTicker);

  const initialPortfolioId =
    defaultPortfolioId && portfolios.some((portfolio) => portfolio.id === defaultPortfolioId)
      ? defaultPortfolioId
      : portfolios[0]?.id ?? "";

  const [mode, setMode] = useState<"existing" | "cash">("existing");
  const [portfolioId, setPortfolioId] = useState(initialPortfolioId);
  const [ticker, setTicker] = useState(normalisedDefaultTicker);
  const [shares, setShares] = useState("");
  const [dollarAmount, setDollarAmount] = useState("");
  const [entryPrice, setEntryPrice] = useState(formatPrice(defaultEntryPrice));
  const [purchaseDate, setPurchaseDate] = useState(dateToday());
  const [notes, setNotes] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const cleanTicker = ticker.trim().toUpperCase();

  const activePortfolio = useMemo(() => {
    if (!portfolioId) return portfolios[0] ?? null;
    return portfolios.find((portfolio) => portfolio.id === portfolioId) ?? null;
  }, [portfolioId, portfolios]);

  const currency = activePortfolio?.currency ?? "USD";
  const cashBalance = Number(activePortfolio?.cashBalance ?? 0);

  const exactStock = useMemo(() => {
    if (!cleanTicker) return null;

    return (
      stockOptions.find(
        (stock) => stock.ticker.trim().toUpperCase() === cleanTicker,
      ) ?? null
    );
  }, [cleanTicker, stockOptions]);

  const suggestions = useMemo(() => {
    const term = ticker.trim().toLowerCase();

    if (!term || hasLockedTicker) return [];

    return stockOptions
      .filter((stock) => {
        const stockTicker = stock.ticker.toLowerCase();
        const company = stock.company?.toLowerCase() ?? "";
        return stockTicker.includes(term) || company.includes(term);
      })
      .slice(0, 8);
  }, [hasLockedTicker, stockOptions, ticker]);

  const calculatedShares = useMemo(() => {
    const amount = Number(dollarAmount);
    const price = Number(entryPrice);

    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (!Number.isFinite(price) || price <= 0) return null;

    return amount / price;
  }, [dollarAmount, entryPrice]);

  function selectStock(stock: StockOption) {
    const nextTicker = stock.ticker.trim().toUpperCase();
    setTicker(nextTicker);
    setMessage(null);
    setIsSuccess(false);

    if (!priceEdited && stock.price && Number.isFinite(Number(stock.price))) {
      setEntryPrice(formatPrice(Number(stock.price)));
    }
  }

  function updateTicker(value: string) {
    const upper = value.toUpperCase();
    setTicker(upper);
    setMessage(null);
    setIsSuccess(false);

    const match = stockOptions.find(
      (stock) => stock.ticker.trim().toUpperCase() === upper.trim(),
    );

    if (!priceEdited && match?.price && Number.isFinite(Number(match.price))) {
      setEntryPrice(formatPrice(Number(match.price)));
    }
  }

  function updatePrice(value: string) {
    setPriceEdited(true);
    setEntryPrice(value);
  }

  function validateShared() {
    if (!isAuthenticated) {
      router.push("/login");
      return false;
    }

    if (!cleanTicker) {
      setIsSuccess(false);
      setMessage("Enter a ticker.");
      return false;
    }

    if (stockOptions.length > 0 && !hasLockedTicker && !exactStock) {
      setIsSuccess(false);
      setMessage("Choose a ticker from the StockGPT rankings list.");
      return false;
    }

    const price = Number(entryPrice);

    if (!Number.isFinite(price) || price <= 0) {
      setIsSuccess(false);
      setMessage("Enter a valid average entry price.");
      return false;
    }

    return true;
  }

  function submitExisting() {
    if (!validateShared()) return;

    const shareCount = Number(shares);
    const price = Number(entryPrice);

    if (!Number.isFinite(shareCount) || shareCount <= 0) {
      setIsSuccess(false);
      setMessage("Enter the number of shares you own.");
      return;
    }

    setMessage(null);
    setIsSuccess(false);

    startTransition(async () => {
      const result = await logExistingHolding({
        portfolioId: portfolioId || null,
        ticker: cleanTicker,
        shares: shareCount,
        entryPrice: price,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setIsSuccess(false);
        setMessage(result.error ?? "Could not log this holding.");
        return;
      }

      setIsSuccess(true);
      setMessage(`${cleanTicker} logged successfully.`);
      setShares("");
      setNotes("");

      if (!hasLockedTicker) {
        setTicker("");
        setEntryPrice("");
        setPurchaseDate(dateToday());
        setPriceEdited(false);
      }

      router.refresh();
      onSuccess?.();
    });
  }

  function submitCashBuy() {
    if (!validateShared()) return;

    const amount = Number(dollarAmount);
    const price = Number(entryPrice);

    if (!Number.isFinite(amount) || amount <= 0) {
      setIsSuccess(false);
      setMessage("Enter an amount to invest.");
      return;
    }

    if (portfolioId && amount > cashBalance + 0.001) {
      setIsSuccess(false);
      setMessage(
        `Not enough available cash. You need ${money(amount - cashBalance, currency)} more.`,
      );
      return;
    }

    setMessage(null);
    setIsSuccess(false);

    startTransition(async () => {
      const result = await buyHoldingWithCash({
        portfolioId: portfolioId || null,
        ticker: cleanTicker,
        dollarAmount: amount,
        entryPrice: price,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setIsSuccess(false);
        setMessage(result.error ?? "Could not buy this holding.");
        return;
      }

      setIsSuccess(true);
      setMessage(`${cleanTicker} added using portfolio cash.`);
      setDollarAmount("");
      setNotes("");

      if (!hasLockedTicker) {
        setTicker("");
        setEntryPrice("");
        setPurchaseDate(dateToday());
        setPriceEdited(false);
      }

      router.refresh();
      onSuccess?.();
    });
  }

  function submit() {
    if (mode === "existing") {
      submitExisting();
      return;
    }

    submitCashBuy();
  }

  return (
    <div
      className={[
        "stockgpt-manual-entry relative min-w-0 overflow-visible rounded-2xl border border-[#ddb159]/24 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]",
        compact ? "p-3" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[#ddb159]/20 blur-3xl" />

      <div className="relative min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          Add holding manually
        </p>

        <h3
          className={[
            "mt-1 font-black tracking-[-0.035em]",
            compact ? "text-[19px]" : "text-[23px]",
          ].join(" ")}
        >
          {hasLockedTicker ? `Add ${cleanTicker}` : "Add a stock"}
        </h3>

        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#072116]/55">
          Log a stock you already own, or buy using portfolio cash. The price
          auto-fills where available and stays editable.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("existing");
              setMessage(null);
            }}
            className={[
              "min-w-0 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition",
              mode === "existing"
                ? "border-[#ddb159] bg-[#ddb159] text-[#072116]"
                : "border-[#072116]/10 bg-white text-[#072116]/55 hover:border-[#ddb159]/50",
            ].join(" ")}
          >
            Log existing
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("cash");
              setMessage(null);
            }}
            className={[
              "min-w-0 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition",
              mode === "cash"
                ? "border-[#ddb159] bg-[#ddb159] text-[#072116]"
                : "border-[#072116]/10 bg-white text-[#072116]/55 hover:border-[#ddb159]/50",
            ].join(" ")}
          >
            Buy with cash
          </button>
        </div>

        <div
          className={[
            "mt-3 grid min-w-0 gap-2",
            compact ? "grid-cols-1" : "sm:grid-cols-2",
          ].join(" ")}
        >
          {portfolios.length > 0 && (
            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Portfolio
              </span>
              <select
                value={portfolioId}
                onChange={(event) => {
                  setPortfolioId(event.target.value);
                  setMessage(null);
                }}
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[12px] font-black text-[#072116] outline-none transition focus:border-[#ddb159]"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {portfolios.length === 0 && (
            <div className="min-w-0 rounded-2xl border border-[#072116]/8 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[11px] font-semibold leading-5 text-[#072116]/58">
                This will use your first portfolio, or create one automatically
                if none exists yet.
              </p>
            </div>
          )}

          <label className="relative block min-w-0">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Ticker
            </span>
            <input
              value={ticker}
              onChange={(event) => updateTicker(event.target.value)}
              placeholder="AAPL"
              disabled={hasLockedTicker}
              className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-black uppercase text-[#072116] outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159] disabled:bg-[#f3efe5] disabled:text-[#072116]/70"
            />

            {suggestions.length > 0 && !exactStock && (
              <div className="absolute left-0 right-0 top-[68px] z-30 max-h-64 overflow-y-auto rounded-2xl border border-[#ddb159]/30 bg-white p-1 shadow-[0_16px_34px_rgba(0,0,0,0.22)]">
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
                      {stock.price ? money(Number(stock.price), currency) : "—"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </label>

          {mode === "existing" ? (
            <label className="block min-w-0">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Shares
              </span>
              <input
                value={shares}
                onChange={(event) => setShares(event.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="10"
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-bold text-[#072116] outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
              />
            </label>
          ) : (
            <label className="block min-w-0">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
                Amount to invest
              </span>
              <input
                value={dollarAmount}
                onChange={(event) => setDollarAmount(event.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="500"
                className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-bold text-[#072116] outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
              />
            </label>
          )}

          <label className="block min-w-0">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Avg entry price
            </span>
            <input
              value={entryPrice}
              onChange={(event) => updatePrice(event.target.value)}
              type="number"
              min="0"
              step="any"
              placeholder="Auto-fills where available"
              className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-bold text-[#072116] outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Purchase date
            </span>
            <input
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              type="date"
              className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[13px] font-bold text-[#072116] outline-none transition focus:border-[#ddb159]"
            />
          </label>

          <label className="block min-w-0 sm:col-span-2">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Notes optional
            </span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Long-term hold, ISA position, etc."
              className="h-11 w-full min-w-0 rounded-2xl border border-[#072116]/10 bg-white px-3 text-[12px] font-semibold text-[#072116] outline-none transition placeholder:text-[#072116]/25 focus:border-[#ddb159]"
            />
          </label>

          {mode === "cash" && (
            <div className="min-w-0 rounded-2xl border border-[#072116]/8 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[11px] font-semibold leading-5 text-[#072116]/58">
                Available cash:{" "}
                <span className="font-black text-[#072116]">
                  {money(cashBalance, currency)}
                </span>
                {calculatedShares != null ? (
                  <>
                    {" "}
                    · estimated shares:{" "}
                    <span className="font-black text-[#072116]">
                      {calculatedShares.toFixed(6)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="h-11 rounded-2xl bg-[#ddb159] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 disabled:opacity-60 sm:col-span-2"
          >
            {isPending
              ? "Adding…"
              : mode === "existing"
                ? "+ Log holding"
                : "+ Buy with cash"}
          </button>
        </div>

        {message && (
          <p
            className={[
              "mt-3 rounded-2xl border px-3 py-2 text-[11px] font-bold leading-5",
              isSuccess
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-red-300 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
