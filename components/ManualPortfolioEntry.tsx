"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addHolding } from "@/lib/actions/portfolio-management";

export function ManualPortfolioEntry({
  defaultTicker = "",
  defaultEntryPrice,
  compact = false,
  isAuthenticated = true,
}: {
  defaultTicker?: string;
  defaultEntryPrice?: number | null;
  compact?: boolean;
  isAuthenticated?: boolean;
}) {
  const router = useRouter();
  const [ticker, setTicker] = useState(defaultTicker.toUpperCase());
  const [shares, setShares] = useState("");
  const [entryPrice, setEntryPrice] = useState(
    defaultEntryPrice && Number.isFinite(defaultEntryPrice)
      ? String(Number(defaultEntryPrice).toFixed(2))
      : "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const cleanTicker = ticker.trim().toUpperCase();
    const shareCount = Number(shares);
    const price = entryPrice.trim() ? Number(entryPrice) : undefined;

    if (!cleanTicker) {
      setIsSuccess(false);
      setMessage("Enter a ticker.");
      return;
    }

    if (!Number.isFinite(shareCount) || shareCount <= 0) {
      setIsSuccess(false);
      setMessage("Enter the number of shares you own.");
      return;
    }

    if (price != null && (!Number.isFinite(price) || price <= 0)) {
      setIsSuccess(false);
      setMessage("Entry price must be a positive number.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const result = await addHolding(cleanTicker, price, shareCount);

      if (!result.success) {
        setIsSuccess(false);
        setMessage(result.error ?? "Could not add stock to portfolio.");
        return;
      }

      setIsSuccess(true);
      setMessage(`${cleanTicker} added to your portfolio.`);
      setShares("");

      if (!defaultTicker) {
        setTicker("");
        setEntryPrice("");
      }

      router.refresh();
    });
  }

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]",
        compact ? "p-3" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[#ddb159]/20 blur-3xl" />

      <div className="relative">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ Manual Portfolio Entry
        </p>

        <h3
          className={[
            "mt-1 font-black tracking-[-0.035em]",
            compact ? "text-[18px]" : "text-[22px]",
          ].join(" ")}
        >
          Add a stock you already own
        </h3>

        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#072116]/55">
          Enter ticker, shares and your average entry price. StockGPT will track
          value, AI score movement, rank movement and portfolio alerts.
        </p>

        <div
          className={[
            "mt-3 grid gap-2",
            compact
              ? "grid-cols-1"
              : "sm:grid-cols-[110px_110px_minmax(0,1fr)_auto]",
          ].join(" ")}
        >
          <label className="block">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Ticker
            </span>
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="AAPL"
              disabled={!!defaultTicker}
              className="h-10 w-full rounded-xl border-2 border-[#072116]/10 bg-white px-3 text-[13px] font-black uppercase text-[#072116] outline-none transition focus:border-[#ddb159] disabled:bg-[#f3efe5]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Shares
            </span>
            <input
              value={shares}
              onChange={(event) => setShares(event.target.value)}
              type="number"
              min="0"
              step="0.0001"
              placeholder="10"
              className="h-10 w-full rounded-xl border-2 border-[#072116]/10 bg-white px-3 text-[13px] font-bold text-[#072116] outline-none transition focus:border-[#ddb159]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
              Avg entry price
            </span>
            <input
              value={entryPrice}
              onChange={(event) => setEntryPrice(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional — current price if blank"
              className="h-10 w-full rounded-xl border-2 border-[#072116]/10 bg-white px-3 text-[13px] font-bold text-[#072116] outline-none transition focus:border-[#ddb159]"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="mt-auto h-10 rounded-xl bg-[#ddb159] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105 disabled:opacity-60"
          >
            {isPending ? "Adding…" : "+ Add"}
          </button>
        </div>

        {message && (
          <p
            className={[
              "mt-2 rounded-xl px-3 py-2 text-[11px] font-bold",
              isSuccess
                ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border border-red-300 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
