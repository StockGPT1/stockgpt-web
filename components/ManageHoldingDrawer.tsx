"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { StockLogo } from "@/components/StockLogo";
import { StockGPTView } from "@/components/StockGPTView";
import { useFocusedFlow } from "@/components/AppChromeProvider";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { PortfolioTrimRecommendation } from "@/lib/portfolio-trim-recommendation";
import type { PortfolioActionRecommendation } from "@/lib/portfolio-action-engine";
import { buildAskHref } from "@/lib/ask-context";
import { resolveTradeOrder } from "@/lib/trade-calculator";
import {
  buyHoldingWithCash,
  logExistingHolding,
  removeHolding,
  trimHolding,
} from "@/lib/actions/portfolio-management";

type TradeMode = "trim" | "buy" | null;

type SavedLevels = {
  entry_price: number | null;
  risk_level_at_entry: number | null;
  target_level_at_entry: number | null;
  current_price: number | null;
};

type Props = {
  portfolioId: string;
  holding: ExtendedHolding;
  recommendation: PortfolioTrimRecommendation;
  action: PortfolioActionRecommendation;
  cashBalance: number;
  displayCurrency: string;
  usdToDisplayRate: number;
  onClose: () => void;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function number(value: number, digits = 4) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function InputField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/42">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-[#ddb159]/22 bg-[#020805]/55 px-3 text-[16px] font-black text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/28 focus:border-[#ddb159]"
      />
    </label>
  );
}

export function ManageHoldingDrawer({
  portfolioId,
  holding,
  recommendation,
  action,
  cashBalance,
  displayCurrency,
  usdToDisplayRate,
  onClose,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [tradeMode, setTradeMode] = useState<TradeMode>(null);
  const [trimValue, setTrimValue] = useState("");
  const [trimPrice, setTrimPrice] = useState(
    holding.currentPrice > 0 ? String(Number(holding.currentPrice.toFixed(2))) : "",
  );
  const [trimShares, setTrimShares] = useState("");
  const [buyValue, setBuyValue] = useState("");
  const [buyPrice, setBuyPrice] = useState(
    holding.currentPrice > 0 ? String(Number(holding.currentPrice.toFixed(2))) : "",
  );
  const [buyShares, setBuyShares] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [levels, setLevels] = useState<SavedLevels | null>(null);
  const [levelsLoaded, setLevelsLoaded] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useFocusedFlow(`manage-holding-${portfolioId}-${holding.ticker}`, true);

  const rate = Number.isFinite(usdToDisplayRate) && usdToDisplayRate > 0
    ? usdToDisplayRate
    : 1;
  const toUsd = (value: number) => value / rate;
  const trimCalculation = useMemo(
    () => resolveTradeOrder({ value: trimValue, price: trimPrice, shares: trimShares }),
    [trimPrice, trimShares, trimValue],
  );
  const buyCalculation = useMemo(
    () => resolveTradeOrder({ value: buyValue, price: buyPrice, shares: buyShares }),
    [buyPrice, buyShares, buyValue],
  );
  const tooManyShares =
    trimCalculation.shares != null && trimCalculation.shares > holding.shares + 0.000001;
  const insufficientCash =
    buyCalculation.value != null && buyCalculation.value > cashBalance + 0.01;
  const trimValid =
    !trimCalculation.error &&
    trimCalculation.value != null &&
    trimCalculation.price != null &&
    trimCalculation.shares != null &&
    !tooManyShares;
  const buyValid =
    !buyCalculation.error &&
    buyCalculation.value != null &&
    buyCalculation.price != null &&
    buyCalculation.shares != null;
  const realisedPnl = trimValid
    ? ((trimCalculation.price ?? 0) - holding.entryPrice) * (trimCalculation.shares ?? 0)
    : null;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((node) => node.offsetParent !== null);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => focusable()[0]?.focus({ preventScroll: true }), 0);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ portfolioId, ticker: holding.ticker });
    fetch(`/api/portfolio/holding-trade-levels?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { levels?: SavedLevels | null } | null;
        if (response.ok) setLevels(payload?.levels ?? null);
      })
      .catch(() => {})
      .finally(() => setLevelsLoaded(true));
    return () => controller.abort();
  }, [holding.ticker, portfolioId]);

  function prefillSuggestedTrim() {
    const percentage = action.suggestedTrimRange?.[0] ?? recommendation.pct ?? null;
    if (percentage == null || holding.currentPrice <= 0) return;
    const shares = holding.shares * (percentage / 100);
    setTradeMode("trim");
    setTrimShares(String(Number(shares.toFixed(6))));
    setTrimPrice(String(Number(holding.currentPrice.toFixed(2))));
    setTrimValue(String(Number((shares * holding.currentPrice).toFixed(2))));
  }

  function finish(successMessage: string) {
    setMessage(successMessage);
    window.setTimeout(() => router.refresh(), 100);
    window.setTimeout(onClose, 650);
  }

  function runTrim() {
    if (!trimValid) return;
    setMessage("Recording trim...");
    startTransition(async () => {
      const result = await trimHolding({
        portfolioId,
        ticker: holding.ticker,
        value: toUsd(trimCalculation.value ?? 0),
        price: toUsd(trimCalculation.price ?? 0),
        shares: trimCalculation.shares ?? 0,
      });
      if (!result.success) {
        setMessage(result.error ?? "Could not record the portfolio change.");
        return;
      }
      finish(`${holding.ticker} trim recorded. Proceeds were added to portfolio cash.`);
    });
  }

  function runBuyMore(mode: "cash" | "external") {
    if (!buyValid || (mode === "cash" && insufficientCash)) return;
    setMessage(mode === "cash" ? "Recording cash purchase..." : "Recording external purchase...");
    startTransition(async () => {
      const input = {
        portfolioId,
        ticker: holding.ticker,
        value: toUsd(buyCalculation.value ?? 0),
        price: toUsd(buyCalculation.price ?? 0),
        shares: buyCalculation.shares ?? 0,
      };
      const result = mode === "cash"
        ? await buyHoldingWithCash(input)
        : await logExistingHolding(input);
      if (!result.success) {
        setMessage(result.error ?? "Could not record the portfolio change.");
        return;
      }
      finish(mode === "cash" ? `${holding.ticker} cash purchase recorded.` : `${holding.ticker} external purchase recorded.`);
    });
  }

  function runRemove(creditCash: boolean) {
    const wording = creditCash
      ? "close this position and credit portfolio cash"
      : "remove this holding without crediting cash";
    if (!window.confirm(`Confirm that you want to ${wording}. This cannot be undone.`)) return;
    setMessage("Recording change...");
    startTransition(async () => {
      const result = creditCash
        ? await trimHolding({ portfolioId, ticker: holding.ticker, percentage: 100 })
        : await removeHolding({ portfolioId, ticker: holding.ticker, creditCash: false });
      if (!result.success) {
        setMessage(result.error ?? "Could not record the portfolio change.");
        return;
      }
      finish(creditCash ? `${holding.ticker} position closed.` : `${holding.ticker} removed.`);
    });
  }

  const target = holding.targetAllocationPct;
  const allocationStatus = target == null
    ? "Target unavailable"
    : holding.currentAllocationPct > target + 1
      ? "Above target"
      : holding.currentAllocationPct < target - 1
        ? "Below target"
        : "In range";
  const askHref = buildAskHref({
    contextType: "holding",
    portfolioId,
    holdingTicker: holding.ticker,
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="stockgpt-manage-overlay fixed inset-0 z-[2147483647] flex bg-[#020805]/92 text-[#faf6f0] lg:justify-end lg:p-4">
      <button type="button" aria-label="Close Manage Holding" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-holding-title"
        className="stockgpt-manage-holding-dialog relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden border-[#ddb159]/24 bg-[#061b12] lg:h-[calc(100dvh-2rem)] lg:max-w-[1040px] lg:rounded-[30px] lg:border"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[#ddb159]/16 bg-[#04140c] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:p-5">
          <StockLogo ticker={holding.ticker} company={holding.company} size={42} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#ddb159]">Manage holding</p>
            <h2 id="manage-holding-title" className="truncate text-[22px] font-black tracking-[-0.04em]">{holding.ticker} <span className="text-[#faf6f0]/46">{holding.company}</span></h2>
          </div>
          <Link href={askHref} className="hidden h-10 items-center rounded-full border border-[#ddb159]/28 px-3 text-[10px] font-black text-[#ddb159] sm:inline-flex">Ask about this holding</Link>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ddb159]/24 text-xl text-[#ddb159]">&times;</button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)] lg:overflow-hidden">
          <div className="grid content-start gap-4 p-4 lg:overflow-y-auto lg:p-6">
            <section>
              <p className="text-[34px] font-black leading-none tracking-[-0.055em]">{money(holding.currentValue, displayCurrency)}</p>
              <p className={`mt-2 text-[15px] font-black ${holding.totalPnLDollars >= 0 ? "text-[#61d7ab]" : "text-[#f1908d]"}`}>
                {money(holding.totalPnLDollars, displayCurrency)} · {holding.pnlPercent >= 0 ? "+" : ""}{holding.pnlPercent.toFixed(1)}%
              </p>
              <p className="mt-3 text-[12px] font-semibold text-[#faf6f0]/52">
                {number(holding.shares, 6)} shares · {holding.currentAllocationPct.toFixed(1)}% invested allocation · target {target?.toFixed(1) ?? "—"}%
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/52">
                AI score {number(holding.score, 0)} · Rank {holding.rank == null ? "unavailable" : `#${holding.rank}`} · {allocationStatus}
              </p>
            </section>

            <StockGPTView
              judgement={action.plainEnglishReason}
              status={action.label}
              evidence={action.evidence.slice(0, 3)}
              risks={action.risks.slice(0, 3)}
              updatedAt={action.dataUpdatedAt ?? action.generatedAt}
            />

            <section className="grid gap-2 rounded-[20px] border border-[#ddb159]/16 bg-[#faf6f0]/[0.035] p-4 sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/38">Recent movement</p>
                <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/62">Not enough reliable history yet.</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/38">Since entry</p>
                <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/62">Score {holding.scoreAtEntry == null ? "—" : number(holding.scoreAtEntry, 0)} → {number(holding.score, 0)} · Rank {holding.rankAtEntry == null ? "—" : `#${holding.rankAtEntry}`} → {holding.rank == null ? "—" : `#${holding.rank}`}</p>
              </div>
            </section>
          </div>

          <div className="grid content-start gap-4 border-t border-[#ddb159]/14 bg-[#04140c]/45 p-4 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-6">
            <section className="rounded-[20px] border border-[#ddb159]/16 bg-[#faf6f0]/[0.035] p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Saved trade levels</p>
              {!levelsLoaded ? (
                <p className="mt-2 text-[12px] font-semibold text-[#faf6f0]/48">Loading saved levels...</p>
              ) : levels ? (
                <p className="mt-2 text-[13px] font-semibold text-[#faf6f0]/70">
                  Stop loss {levels.risk_level_at_entry == null ? "—" : money(levels.risk_level_at_entry * rate, displayCurrency)} · Take profit {levels.target_level_at_entry == null ? "—" : money(levels.target_level_at_entry * rate, displayCurrency)}
                </p>
              ) : (
                <p className="mt-2 text-[12px] font-semibold text-[#faf6f0]/48">No reliable saved levels are available for this holding.</p>
              )}
              <p className="mt-1 text-[10px] font-semibold text-[#faf6f0]/38">Saved from when this holding was added.</p>
            </section>

            <section>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Record a change</p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/50">This records a portfolio change in StockGPT. It does not place a broker order.</p>
              {action.freshness === "stale" && <p className="mt-2 rounded-xl border border-[#ddb159]/22 bg-[#ddb159]/8 px-3 py-2 text-[11px] font-semibold text-[#e6c36e]">Latest price/model inputs may be stale. Check the order price before confirming.</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTradeMode(tradeMode === "trim" ? null : "trim")} className={`h-12 rounded-2xl border text-[11px] font-black ${tradeMode === "trim" ? "border-[#ddb159] bg-[#ddb159] text-[#061b12]" : "border-[#ddb159]/25 text-[#ddb159]"}`}>Trim</button>
                <button type="button" onClick={() => setTradeMode(tradeMode === "buy" ? null : "buy")} className={`h-12 rounded-2xl border text-[11px] font-black ${tradeMode === "buy" ? "border-[#ddb159] bg-[#ddb159] text-[#061b12]" : "border-[#ddb159]/25 text-[#ddb159]"}`}>Buy more</button>
              </div>
            </section>

            {tradeMode === "trim" && (
              <section className="rounded-[20px] border border-[#ddb159]/18 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-black">Trim {holding.ticker}</h3><p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">Enter any two of value, price and shares.</p></div>
                  {(action.suggestedTrimRange || recommendation.pct != null) && <button type="button" onClick={prefillSuggestedTrim} className="rounded-full border border-[#ddb159]/24 px-2.5 py-1.5 text-[9px] font-black text-[#ddb159]">Prefill</button>}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <InputField label={`Value sold (${displayCurrency})`} value={trimValue} onChange={setTrimValue} step="0.01" />
                  <InputField label={`Price (${displayCurrency})`} value={trimPrice} onChange={setTrimPrice} step="0.01" />
                  <InputField label="Shares sold" value={trimShares} onChange={setTrimShares} step="0.000001" />
                </div>
                <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold ${!trimValid ? "bg-[#b9504d]/10 text-[#f1aaa7]" : "bg-[#faf6f0]/[0.045] text-[#faf6f0]/62"}`}>
                  {tooManyShares
                    ? `You own ${number(holding.shares, 6)} shares; reduce the trim amount.`
                    : trimCalculation.error
                      ? trimCalculation.error
                      : <>Sell {number(trimCalculation.shares ?? 0, 6)} shares at {money(trimCalculation.price ?? 0, displayCurrency)} · proceeds {money(trimCalculation.value ?? 0, displayCurrency)} · estimated realised P/L {money(realisedPnl ?? 0, displayCurrency)}</>}
                </div>
                <button type="button" disabled={isPending || !trimValid} onClick={runTrim} className="mt-3 h-12 w-full rounded-2xl bg-[#ddb159] text-[11px] font-black text-[#061b12] disabled:cursor-not-allowed disabled:opacity-40">Confirm trim</button>
              </section>
            )}

            {tradeMode === "buy" && (
              <section className="rounded-[20px] border border-[#ddb159]/18 p-4">
                <h3 className="font-black">Buy more {holding.ticker}</h3>
                <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">Enter any two of value, price and shares.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <InputField label={`Value (${displayCurrency})`} value={buyValue} onChange={setBuyValue} step="0.01" />
                  <InputField label={`Price (${displayCurrency})`} value={buyPrice} onChange={setBuyPrice} step="0.01" />
                  <InputField label="Shares" value={buyShares} onChange={setBuyShares} step="0.000001" />
                </div>
                <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold ${!buyValid ? "bg-[#b9504d]/10 text-[#f1aaa7]" : "bg-[#faf6f0]/[0.045] text-[#faf6f0]/62"}`}>
                  {buyCalculation.error ?? <>Add {number(buyCalculation.shares ?? 0, 6)} shares at {money(buyCalculation.price ?? 0, displayCurrency)} · value {money(buyCalculation.value ?? 0, displayCurrency)}</>}
                </div>
                {insufficientCash && <p className="mt-2 text-[11px] font-semibold text-[#e7c56c]">Portfolio cash is {money(cashBalance, displayCurrency)}. Cash mode is unavailable for this amount.</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={isPending || !buyValid || insufficientCash} onClick={() => runBuyMore("cash")} className="h-12 rounded-2xl bg-[#ddb159] px-3 text-[10px] font-black text-[#061b12] disabled:opacity-40">Buy more with cash</button>
                  <button type="button" disabled={isPending || !buyValid} onClick={() => runBuyMore("external")} className="h-12 rounded-2xl border border-[#ddb159]/24 px-3 text-[10px] font-black text-[#ddb159] disabled:opacity-40">Add external purchase</button>
                </div>
              </section>
            )}

            <section className="border-t border-[#ddb159]/14 pt-3">
              <button type="button" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen} className="flex h-11 w-full items-center justify-between text-left text-[11px] font-black text-[#faf6f0]/58"><span>Advanced actions</span><span aria-hidden="true">{advancedOpen ? "−" : "+"}</span></button>
              {advancedOpen && <div className="grid gap-2 rounded-[18px] border border-[#b9504d]/22 bg-[#b9504d]/[0.04] p-3 sm:grid-cols-2"><button type="button" disabled={isPending} onClick={() => runRemove(true)} className="h-11 rounded-xl border border-[#ddb159]/22 text-[10px] font-black text-[#e7c56c]">Close + credit cash</button><button type="button" disabled={isPending} onClick={() => runRemove(false)} className="h-11 rounded-xl border border-[#b9504d]/36 text-[10px] font-black text-[#f1aaa7]">Remove only</button><p className="sm:col-span-2 text-[10px] font-semibold leading-4 text-[#faf6f0]/42">These actions remove the full position from StockGPT. Review the confirmation carefully.</p></div>}
            </section>

            {message && <p role="status" className="rounded-xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] px-3 py-2 text-[11px] font-semibold text-[#faf6f0]/62">{message}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
