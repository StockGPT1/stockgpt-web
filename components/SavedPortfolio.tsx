"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  removeHolding,
  updateEntryPrice,
  markReviewed,
  deletePortfolio,
} from "@/lib/actions/portfolio-management";
import { addHolding } from "@/lib/actions/portfolio-management";
import type { EnrichedHolding, HoldingAlert } from "@/lib/portfolio-alerts";

type Props = {
  holdings: EnrichedHolding[];
  portfolioMeta: {
    name: string;
    riskTolerance: string | null;
    timeHorizon: string | null;
    investmentAmount: number | null;
  };
};

function severityStyle(s: HoldingAlert["severity"]) {
  if (s === "critical") return { bg: "bg-red-500", text: "text-white", label: "Critical" };
  if (s === "warning") return { bg: "bg-amber-500", text: "text-white", label: "Warning" };
  if (s === "success") return { bg: "bg-emerald-500", text: "text-white", label: "Good" };
  return { bg: "bg-blue-500", text: "text-white", label: "Info" };
}

function recommendationStyle(r: EnrichedHolding["recommendation"]) {
  if (r === "Review Urgently") return "bg-red-500 text-white";
  if (r === "Consider Trimming") return "bg-amber-500 text-white";
  if (r === "Consider Buying More") return "bg-emerald-500 text-white";
  if (r === "Strong Hold") return "bg-emerald-400 text-[#072116]";
  return "bg-[#072116]/10 text-[#072116]";
}

function momentumStyle(m: EnrichedHolding["sectorMomentum"]) {
  if (m === "Hot") return "bg-red-100 text-red-700 border-red-200";
  if (m === "Warm") return "bg-amber-100 text-amber-700 border-amber-200";
  if (m === "Cool") return "bg-blue-100 text-blue-700 border-blue-200";
  if (m === "Cold") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}

function HoldingRow({ holding }: { holding: EnrichedHolding }) {
  const [isPending, startTransition] = useTransition();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(holding.entryPrice.toString());
  const [showAlerts, setShowAlerts] = useState(false);

  const pnlColor = holding.pnlPercent >= 0 ? "text-emerald-600" : "text-red-600";
  const pnlSign = holding.pnlPercent >= 0 ? "+" : "";
  const recStyle = recommendationStyle(holding.recommendation);
  const momentum = momentumStyle(holding.sectorMomentum);

  function handleSavePrice() {
    const newPrice = Number(priceInput);
    if (Number.isFinite(newPrice) && newPrice > 0) {
      startTransition(() => updateEntryPrice(holding.ticker, newPrice));
      setEditingPrice(false);
    }
  }

  function handleRemove() {
    if (confirm(`Remove ${holding.ticker} from your portfolio?`)) {
      startTransition(() => removeHolding(holding.ticker));
    }
  }

  function handleReviewed() {
    startTransition(() => markReviewed(holding.ticker));
  }

  return (
    <div className="rounded-2xl border border-[#072116]/8 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      {/* Top row */}
      <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-4 p-4">
        {/* Ticker */}
        <Link href={`/stock/${holding.ticker}`} className="group">
          <p className="text-[18px] font-black tracking-[-0.02em] text-[#072116] group-hover:text-[#ddb159]">
            {holding.ticker}
          </p>
          <p className="text-[9px] font-bold uppercase text-[#072116]/45">
            #{holding.rank ?? "—"}
          </p>
        </Link>

        {/* Mid section */}
        <div className="min-w-0">
          <Link href={`/stock/${holding.ticker}`} className="hover:text-[#ddb159]">
            <p className="truncate text-[13px] font-bold text-[#072116]">
              {holding.company ?? holding.ticker}
            </p>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold text-[#072116]/55">
              {holding.sector ?? "—"}
            </p>
            <span className={`rounded border px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${momentum}`}>
              Sector: {holding.sectorMomentum}
            </span>
          </div>
        </div>

        {/* Recommendation badge */}
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${recStyle}`}>
          {holding.recommendation}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4">
        {/* Entry price (editable) */}
        <div className="rounded-lg border border-[#072116]/8 bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
            Entry Price
          </p>
          {editingPrice ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[12px] font-bold text-[#072116]/50">$</span>
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                step="0.01"
                className="w-16 rounded border border-[#ddb159] bg-white px-1 py-0.5 text-[12px] font-bold outline-none"
                autoFocus
              />
              <button
                onClick={handleSavePrice}
                disabled={isPending}
                className="rounded bg-emerald-500 px-1.5 text-[10px] font-bold text-white"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setEditingPrice(false);
                  setPriceInput(holding.entryPrice.toString());
                }}
                className="rounded bg-[#072116]/15 px-1.5 text-[10px] font-bold"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingPrice(true)}
              className="mt-0.5 flex items-baseline gap-1 text-left"
            >
              <p className="text-[14px] font-black tracking-[-0.02em]">
                ${holding.entryPrice.toFixed(2)}
              </p>
              <span className="text-[10px] text-[#072116]/35">edit</span>
            </button>
          )}
        </div>

        {/* Current price */}
        <div className="rounded-lg border border-[#072116]/8 bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
            Current
          </p>
          <p className="mt-0.5 text-[14px] font-black tracking-[-0.02em]">
            ${holding.currentPrice.toFixed(2)}
          </p>
        </div>

        {/* P&L */}
        <div className="rounded-lg border border-[#072116]/8 bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
            P&amp;L
          </p>
          <p className={`mt-0.5 text-[14px] font-black tabular-nums tracking-[-0.02em] ${pnlColor}`}>
            {pnlSign}
            {holding.pnlPercent.toFixed(1)}%
          </p>
        </div>

        {/* AI Score change */}
        <div className="rounded-lg border border-[#072116]/8 bg-[#faf6f0] px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
            AI Score
          </p>
          <p className="mt-0.5 text-[14px] font-black tracking-[-0.02em]">
            {holding.score.toLocaleString()}
            {holding.scoreChange !== 0 && (
              <span
                className={`ml-1 text-[10px] ${holding.scoreChange > 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {holding.scoreChange > 0 ? "↑" : "↓"}
                {Math.abs(holding.scoreChange).toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {holding.alerts.length > 0 && (
        <div className="border-t border-[#072116]/8 px-4 py-3">
          <button
            onClick={() => setShowAlerts((s) => !s)}
            className="flex w-full items-center justify-between"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
              ✦ AI Alerts ({holding.alerts.length})
            </p>
            <span className="text-[10px] font-bold text-[#072116]/45">
              {showAlerts ? "Hide ▴" : "Show ▾"}
            </span>
          </button>

          {showAlerts && (
            <div className="mt-2 grid gap-1.5">
              {holding.alerts.map((alert, i) => {
                const style = severityStyle(alert.severity);
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-[#072116]/8 bg-[#faf6f0] p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-black tracking-[-0.01em]">
                          {alert.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#072116]/65">
                          {alert.message}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[#072116]/85">
                          → {alert.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-[#072116]/8 px-4 py-2.5">
        <p className="text-[10px] font-medium text-[#072116]/45">
          Reviewed{" "}
          {holding.daysSinceReview === 0
            ? "today"
            : `${holding.daysSinceReview} day${holding.daysSinceReview === 1 ? "" : "s"} ago`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReviewed}
            disabled={isPending}
            className="rounded-full border border-[#ddb159]/40 px-3 py-1 text-[10px] font-bold text-[#072116] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
          >
            Mark Reviewed
          </button>
          <Link
            href={`/stock/${holding.ticker}`}
            className="rounded-full bg-[#072116] px-3 py-1 text-[10px] font-bold text-[#ddb159] transition hover:bg-[#0b2b1d]"
          >
            View Details
          </Link>
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="rounded-full border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-50"
            title="Remove from portfolio"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add stock form ──
function AddStockForm() {
  const [ticker, setTicker] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!ticker.trim()) {
      setError("Enter a ticker");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addHolding(
        ticker.trim().toUpperCase(),
        entryPrice ? Number(entryPrice) : undefined
      );
      if (!result.success) {
        setError(result.error ?? "Could not add stock");
      } else {
        setTicker("");
        setEntryPrice("");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
        ✦ Add Your Own Stocks
      </p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">
        Already own something? Add it to track AI score changes and get alerts.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_auto]">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[14px] font-black uppercase outline-none focus:border-[#ddb159]"
        />
        <input
          type="number"
          step="0.01"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          placeholder="Entry price (optional)"
          className="rounded-lg border-2 border-[#072116]/10 bg-white px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#ddb159]"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending}
          style={{ backgroundColor: "#ddb159", color: "#072116" }}
          className="rounded-lg px-4 py-2 text-[13px] font-black transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Adding…" : "+ Add"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>
      )}
    </div>
  );
}

export function SavedPortfolio({ holdings, portfolioMeta }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDeletePortfolio() {
    if (confirm("Delete your entire portfolio? This cannot be undone.")) {
      startTransition(() => deletePortfolio());
    }
  }

  // Aggregate stats
  const totalValue = holdings.reduce((s, h) => s + h.currentPrice * (1 / h.entryPrice), 0);
  const totalCost = holdings.length;
  const totalPnLPct =
    holdings.length > 0
      ? holdings.reduce((s, h) => s + h.pnlPercent, 0) / holdings.length
      : 0;
  const criticalAlerts = holdings.flatMap((h) =>
    h.alerts.filter((a) => a.severity === "critical")
  ).length;
  const warningAlerts = holdings.flatMap((h) =>
    h.alerts.filter((a) => a.severity === "warning")
  ).length;
  const totalAlerts = holdings.flatMap((h) => h.alerts).length;

  return (
    <div className="grid gap-3">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              ✦ {portfolioMeta.name}
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">
              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"} · Avg P&amp;L{" "}
              <span className={totalPnLPct >= 0 ? "text-emerald-400" : "text-red-400"}>
                {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(1)}%
              </span>
            </h1>
            {(portfolioMeta.riskTolerance || portfolioMeta.timeHorizon) && (
              <p className="mt-1 text-[12px] font-medium capitalize text-[#faf6f0]/55">
                {portfolioMeta.riskTolerance ?? ""}
                {portfolioMeta.riskTolerance && portfolioMeta.timeHorizon && " · "}
                {portfolioMeta.timeHorizon === "short"
                  ? "3–5 yrs"
                  : portfolioMeta.timeHorizon === "medium"
                    ? "5–10 yrs"
                    : portfolioMeta.timeHorizon === "long"
                      ? "10+ yrs"
                      : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/portfolio?builder=1"
              className="rounded-full border border-[#ddb159]/40 px-4 py-2 text-[12px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
            >
              + New Portfolio
            </Link>
            <button
              onClick={handleDeletePortfolio}
              disabled={isPending}
              className="rounded-full border border-red-400/40 px-3 py-2 text-[11px] font-bold text-red-400 transition hover:border-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Alert summary */}
        {totalAlerts > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {criticalAlerts > 0 && (
              <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-black text-white">
                ⚠ {criticalAlerts} critical
              </span>
            )}
            {warningAlerts > 0 && (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">
                ⚠ {warningAlerts} warning{warningAlerts === 1 ? "" : "s"}
              </span>
            )}
            {totalAlerts - criticalAlerts - warningAlerts > 0 && (
              <span className="rounded-full bg-blue-500 px-3 py-1 text-[11px] font-black text-white">
                {totalAlerts - criticalAlerts - warningAlerts} info
              </span>
            )}
          </div>
        )}
      </div>

      {/* Add stock form */}
      <AddStockForm />

      {/* Holdings */}
      {holdings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#ddb159]/25 bg-[#061b12]/50 p-8 text-center">
          <p className="text-[14px] font-bold text-[#faf6f0]">
            No holdings yet
          </p>
          <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/50">
            Add stocks above, or generate a new AI portfolio
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {holdings.map((h) => (
            <HoldingRow key={h.ticker} holding={h} />
          ))}
        </div>
      )}

      <p className="px-2 text-[11px] font-medium leading-relaxed text-[#faf6f0]/40">
        ⚠️ AI-generated alerts and recommendations based on quantitative
        factors. Not financial advice. Always do your own research.
      </p>
    </div>
  );
}
