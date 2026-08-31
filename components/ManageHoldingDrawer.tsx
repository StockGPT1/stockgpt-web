"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { StockLogo } from "@/components/StockLogo";
import { useFocusedFlow } from "@/components/AppChromeProvider";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { HoldingReferenceLevels } from "@/components/portfolio-workspace/types";
import type { HoldingIntelligenceView } from "@/lib/portfolio-intelligence-presentation";
import { intelligenceToneClass } from "@/components/portfolio-workspace/utils";
import { buildAskHref } from "@/lib/ask-context";
import { resolveTradeOrder } from "@/lib/trade-calculator";
import {
  buyHoldingWithCash,
  logExistingHolding,
  removeHolding,
  trimHolding,
} from "@/lib/actions/portfolio-management";

type TradeMode = "reduction" | "purchase" | null;

type Props = {
  portfolioId: string;
  holding: ExtendedHolding;
  assessment: HoldingIntelligenceView;
  referenceLevels: HoldingReferenceLevels;
  cashBalance: number;
  displayCurrency: string;
  usdToWriteRate: number | null;
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
  assessment,
  referenceLevels,
  cashBalance,
  displayCurrency,
  usdToWriteRate,
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useFocusedFlow(`manage-holding-${portfolioId}-${holding.ticker}`, true);

  const writeRate =
    Number.isFinite(usdToWriteRate) && Number(usdToWriteRate) > 0
      ? Number(usdToWriteRate)
      : null;
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

  function finish(successMessage: string) {
    setMessage(successMessage);
    window.setTimeout(() => router.refresh(), 100);
    window.setTimeout(onClose, 650);
  }

  function runTrim() {
    if (!trimValid) return;
    if (writeRate == null) {
      setMessage("A current verified FX rate is unavailable. Use USD for this financial action or try again later.");
      return;
    }
    setMessage("Recording reduction...");
    startTransition(async () => {
      const result = await trimHolding({
        portfolioId,
        ticker: holding.ticker,
        value: (trimCalculation.value ?? 0) / writeRate,
        price: (trimCalculation.price ?? 0) / writeRate,
        shares: trimCalculation.shares ?? 0,
      });
      if (!result.success) {
        setMessage(result.error ?? "Could not record the portfolio change.");
        return;
      }
      finish(`${holding.ticker} reduction recorded. Proceeds were added to portfolio cash.`);
    });
  }

  function runBuyMore(mode: "cash" | "external") {
    if (!buyValid || (mode === "cash" && insufficientCash)) return;
    if (writeRate == null) {
      setMessage("A current verified FX rate is unavailable. Use USD for this financial action or try again later.");
      return;
    }
    setMessage(mode === "cash" ? "Recording cash purchase..." : "Recording external purchase...");
    startTransition(async () => {
      const input = {
        portfolioId,
        ticker: holding.ticker,
        value: (buyCalculation.value ?? 0) / writeRate,
        price: (buyCalculation.price ?? 0) / writeRate,
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

  function runFullSale() {
    if (!window.confirm("Confirm that you want to record a full sale and credit portfolio cash. This cannot be undone.")) return;
    setMessage("Recording full sale...");
    startTransition(async () => {
      const result = await trimHolding({ portfolioId, ticker: holding.ticker, percentage: 100 });
      if (!result.success) {
        setMessage(result.error ?? "Could not record the portfolio change.");
        return;
      }
      finish(`${holding.ticker} full sale recorded.`);
    });
  }

  function runRemoveFromTracking() {
    if (!window.confirm("Confirm that you want to remove this holding from tracking without recording a sale. This cannot be undone.")) return;
    setMessage("Removing from tracking...");
    startTransition(async () => {
      const result = await removeHolding({ portfolioId, ticker: holding.ticker });
      if (!result.success) {
        setMessage(result.error ?? "Could not remove the holding from tracking.");
        return;
      }
      finish(`${holding.ticker} removed from tracking.`);
    });
  }

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
                {number(holding.shares, 6)} shares · {holding.currentAllocationPct.toFixed(1)}% current allocation
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/52">
                AI score {number(holding.score, 0)} · Rank {holding.rank == null ? "unavailable" : `#${holding.rank}`}
              </p>
            </section>

            <section className="rounded-[20px] border border-[#ddb159]/16 bg-[#faf6f0]/[0.035] p-4" aria-labelledby="holding-assessment-title">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">StockGPT assessment</p>
              <h3 id="holding-assessment-title" className={`mt-2 text-[21px] font-black ${intelligenceToneClass(assessment.tone)}`}>
                {assessment.statusLabel}
              </h3>
              {assessment.status == null ? (
                <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/52">
                  A complete canonical assessment is unavailable for this portfolio. Holding facts and manual record controls remain available.
                </p>
              ) : assessment.reasons.length > 0 ? (
                <div className="mt-3 grid gap-3">
                  {assessment.reasons.map((reason) => (
                    <article key={reason.code} className="border-t border-[#faf6f0]/8 pt-3 first:border-t-0 first:pt-0">
                      <p className="text-[12px] font-black text-[#faf6f0]">{reason.title}</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/48">{reason.detail}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/52">
                  No material holding-level review signal is present in the currently covered data.
                </p>
              )}
            </section>

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
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Saved reference levels</p>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ["Entry price", referenceLevels.entryPrice],
                  ["Risk reference", referenceLevels.savedRiskLevel],
                  ["Target reference", referenceLevels.savedTargetLevel],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[9px] font-semibold text-[#faf6f0]/38">{label}</dt>
                    <dd className="mt-1 truncate text-[11px] font-black text-[#faf6f0]/70">
                      {typeof value === "number" ? money(value, displayCurrency) : "Unavailable"}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[10px] font-semibold leading-4 text-[#faf6f0]/38">Stored factual references only. Missing levels are not calculated when this drawer opens.</p>
            </section>

            <section>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Record a change</p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/50">This updates your StockGPT portfolio record. It does not place a broker order.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTradeMode(tradeMode === "reduction" ? null : "reduction")} className={`min-h-12 rounded-2xl border px-3 text-[11px] font-black ${tradeMode === "reduction" ? "border-[#ddb159] bg-[#ddb159] text-[#061b12]" : "border-[#ddb159]/25 text-[#ddb159]"}`}>Record reduction / sale</button>
                <button type="button" onClick={() => setTradeMode(tradeMode === "purchase" ? null : "purchase")} className={`min-h-12 rounded-2xl border px-3 text-[11px] font-black ${tradeMode === "purchase" ? "border-[#ddb159] bg-[#ddb159] text-[#061b12]" : "border-[#ddb159]/25 text-[#ddb159]"}`}>Record additional purchase</button>
              </div>
            </section>

            {tradeMode === "reduction" && (
              <section className="rounded-[20px] border border-[#ddb159]/18 p-4">
                <h3 className="font-black">Record a reduction for {holding.ticker}</h3>
                <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">Enter any two of value, price and shares.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <InputField label={`Value sold (${displayCurrency})`} value={trimValue} onChange={setTrimValue} step="0.01" />
                  <InputField label={`Price (${displayCurrency})`} value={trimPrice} onChange={setTrimPrice} step="0.01" />
                  <InputField label="Shares sold" value={trimShares} onChange={setTrimShares} step="0.000001" />
                </div>
                <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold ${!trimValid ? "bg-[#b9504d]/10 text-[#f1aaa7]" : "bg-[#faf6f0]/[0.045] text-[#faf6f0]/62"}`}>
                  {tooManyShares
                    ? `You own ${number(holding.shares, 6)} shares; reduce the recorded amount.`
                    : trimCalculation.error
                      ? trimCalculation.error
                      : <>Record {number(trimCalculation.shares ?? 0, 6)} shares at {money(trimCalculation.price ?? 0, displayCurrency)} · proceeds {money(trimCalculation.value ?? 0, displayCurrency)} · estimated realised P/L {money(realisedPnl ?? 0, displayCurrency)}</>}
                </div>
                <button type="button" disabled={isPending || !trimValid} onClick={runTrim} className="mt-3 h-12 w-full rounded-2xl bg-[#ddb159] text-[11px] font-black text-[#061b12] disabled:cursor-not-allowed disabled:opacity-40">Record reduction / sale</button>
              </section>
            )}

            {tradeMode === "purchase" && (
              <section className="rounded-[20px] border border-[#ddb159]/18 p-4">
                <h3 className="font-black">Record an additional purchase for {holding.ticker}</h3>
                <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">Enter any two of value, price and shares.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <InputField label={`Value (${displayCurrency})`} value={buyValue} onChange={setBuyValue} step="0.01" />
                  <InputField label={`Price (${displayCurrency})`} value={buyPrice} onChange={setBuyPrice} step="0.01" />
                  <InputField label="Shares" value={buyShares} onChange={setBuyShares} step="0.000001" />
                </div>
                <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold ${!buyValid ? "bg-[#b9504d]/10 text-[#f1aaa7]" : "bg-[#faf6f0]/[0.045] text-[#faf6f0]/62"}`}>
                  {buyCalculation.error ?? <>Record {number(buyCalculation.shares ?? 0, 6)} shares at {money(buyCalculation.price ?? 0, displayCurrency)} · value {money(buyCalculation.value ?? 0, displayCurrency)}</>}
                </div>
                {insufficientCash && <p className="mt-2 text-[11px] font-semibold text-[#e7c56c]">Portfolio cash is {money(cashBalance, displayCurrency)}. Cash mode is unavailable for this amount.</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={isPending || !buyValid || insufficientCash} onClick={() => runBuyMore("cash")} className="h-12 rounded-2xl bg-[#ddb159] px-3 text-[10px] font-black text-[#061b12] disabled:opacity-40">Record using portfolio cash</button>
                  <button type="button" disabled={isPending || !buyValid} onClick={() => runBuyMore("external")} className="h-12 rounded-2xl border border-[#ddb159]/24 px-3 text-[10px] font-black text-[#ddb159] disabled:opacity-40">Record external purchase</button>
                </div>
              </section>
            )}

            <section className="border-t border-[#ddb159]/14 pt-3">
              <button type="button" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen} className="flex h-11 w-full items-center justify-between text-left text-[11px] font-black text-[#faf6f0]/58"><span>Remove holding</span><span aria-hidden="true">{advancedOpen ? "−" : "+"}</span></button>
              {advancedOpen && <div className="grid gap-2 rounded-[18px] border border-[#b9504d]/22 bg-[#b9504d]/[0.04] p-3 sm:grid-cols-2"><button type="button" disabled={isPending} onClick={runFullSale} className="h-11 rounded-xl border border-[#ddb159]/22 text-[10px] font-black text-[#e7c56c]">Record full sale</button><button type="button" disabled={isPending} onClick={runRemoveFromTracking} className="h-11 rounded-xl border border-[#b9504d]/36 text-[10px] font-black text-[#f1aaa7]">Remove from tracking</button><p className="sm:col-span-2 text-[10px] font-semibold leading-4 text-[#faf6f0]/42">A full sale records proceeds in portfolio cash. Removing from tracking records no sale or cash movement.</p></div>}
            </section>

            {message && <p role="status" className="rounded-xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] px-3 py-2 text-[11px] font-semibold text-[#faf6f0]/62">{message}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
