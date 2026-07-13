"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { Trading212CsvImport } from "@/components/Trading212CsvImport";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import { PortfolioSheet } from "@/components/portfolio-workspace/PortfolioSheet";
import type {
  PortfolioMeta,
  StockOption,
} from "@/components/portfolio-workspace/types";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import {
  addCash,
  buyHoldingWithCash,
  deletePortfolio,
  logExistingHolding,
  renamePortfolio,
  updatePortfolioPreferences,
} from "@/lib/actions/portfolio-management";
import { withdrawPortfolioCash } from "@/lib/actions/portfolio-cash";
import { money, number } from "@/components/portfolio-workspace/utils";

type AddMode = "menu" | "cash" | "withdraw" | "holding" | "import";
type FundingSource = "external" | "cash";
type FeedbackTone = "neutral" | "error" | "success";

function ActionRow({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: "plus" | "cash" | "withdraw" | "import" | "portfolio";
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[68px] w-full items-center gap-4 py-4 text-left transition hover:bg-[#faf6f0]/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ddb159]/10 text-[#ddb159]">
        <PortfolioIcon name={icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black text-[#faf6f0]">{title}</span>
        <span className="mt-1 block text-[11px] font-semibold leading-5 text-[#faf6f0]/42">
          {detail}
        </span>
      </span>
      <PortfolioIcon name="arrow" className="size-5 shrink-0 text-[#ddb159]" />
    </button>
  );
}

function BackButton({
  onClick,
  label = "Back to actions",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex min-h-11 items-center gap-2 text-[11px] font-black text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}

function Feedback({
  message,
  tone = "neutral",
}: {
  message: string | null;
  tone?: FeedbackTone;
}) {
  if (!message) return null;
  const style =
    tone === "error"
      ? "border-[#f1908d]/24 bg-[#f1908d]/8 text-[#ffc0bd]"
      : tone === "success"
        ? "border-[#61d7ab]/24 bg-[#61d7ab]/8 text-[#9de9cc]"
        : "border-[#faf6f0]/8 bg-[#faf6f0]/4 text-[#faf6f0]/58";
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-4 rounded-2xl border px-4 py-3 text-[11px] font-bold leading-5 ${style}`}
    >
      {message}
    </p>
  );
}

function ReviewLine({
  label,
  value,
  tone = "text-[#faf6f0]",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-[11px] font-semibold text-[#faf6f0]/42">{label}</dt>
      <dd className={`max-w-[62%] text-right text-[12px] font-black ${tone}`}>{value}</dd>
    </div>
  );
}

export function AddPortfolioSheet({
  open,
  onClose,
  portfolioId,
  meta,
  holdings,
  stockOptions,
  summary,
  usdToDisplayRate,
}: {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  meta: PortfolioMeta;
  holdings: ExtendedHolding[];
  stockOptions: StockOption[];
  summary: PortfolioHealthSummary;
  usdToDisplayRate: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AddMode>("menu");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<FeedbackTone>("neutral");
  const [amount, setAmount] = useState("");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [funding, setFunding] = useState<FundingSource>("external");
  const [holdingReview, setHoldingReview] = useState(false);
  const [isPending, startTransition] = useTransition();

  const rate =
    Number.isFinite(usdToDisplayRate) && usdToDisplayRate > 0
      ? usdToDisplayRate
      : 1;
  const toUsd = (value: number) => value / rate;
  const normalizedTicker = ticker.trim().toUpperCase();
  const selectedStock =
    stockOptions.find((stock) => stock.ticker === normalizedTicker) ?? null;
  const matches = useMemo(() => {
    const query = ticker.trim().toLowerCase();
    if (!query || selectedStock) return [];
    return stockOptions
      .filter((stock) =>
        `${stock.ticker} ${stock.company ?? ""}`.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [selectedStock, stockOptions, ticker]);

  const shareCount = Number(shares);
  const entryPrice = Number(price || selectedStock?.price || 0);
  const hasValidOrder =
    Boolean(selectedStock) &&
    Number.isFinite(shareCount) &&
    shareCount > 0 &&
    Number.isFinite(entryPrice) &&
    entryPrice > 0;
  const entryValue = hasValidOrder ? shareCount * entryPrice : 0;
  const currentMarketPrice =
    selectedStock?.price != null && selectedStock.price > 0
      ? selectedStock.price
      : entryPrice;
  const projectedMarketValue = hasValidOrder
    ? shareCount * currentMarketPrice
    : 0;
  const existingHolding = holdings.find(
    (holding) => holding.ticker === selectedStock?.ticker,
  );
  const existingValue = existingHolding?.currentValue ?? 0;
  const projectedTotal =
    funding === "external"
      ? summary.totalValue + projectedMarketValue
      : summary.totalValue;
  const resultingAllocation =
    projectedTotal > 0
      ? ((existingValue + projectedMarketValue) / projectedTotal) * 100
      : 0;
  const cashRemaining = Math.max(0, meta.cashBalance - entryValue);
  const duplicate = Boolean(existingHolding);
  const dirty = Boolean(amount || ticker || shares || price || holdingReview);

  function reset(next: AddMode = "menu") {
    setMode(next);
    setMessage(null);
    setMessageTone("neutral");
    setAmount("");
    setTicker("");
    setShares("");
    setPrice("");
    setFunding("external");
    setHoldingReview(false);
  }

  function finish(copy: string) {
    setMessage(copy);
    setMessageTone("success");
    router.refresh();
    window.setTimeout(() => {
      reset();
      onClose();
    }, 650);
  }

  function submitCash(withdraw = false) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage(
        withdraw
          ? "Enter a positive withdrawal amount."
          : "Enter a positive cash amount.",
      );
      setMessageTone("error");
      return;
    }
    setMessage(withdraw ? "Recording withdrawal…" : "Adding cash…");
    setMessageTone("neutral");
    startTransition(async () => {
      const result = withdraw
        ? await withdrawPortfolioCash({ portfolioId, amount: toUsd(value) })
        : await addCash({ portfolioId, amount: toUsd(value) });
      if (!result.success) {
        setMessage(
          result.error ??
            (withdraw ? "Could not withdraw cash." : "Could not add cash."),
        );
        setMessageTone("error");
        return;
      }
      finish(withdraw ? "Cash withdrawn." : "Cash added.");
    });
  }

  function validateHolding() {
    if (!hasValidOrder || !selectedStock) {
      setMessage("Choose a supported stock and enter valid shares and price.");
      setMessageTone("error");
      return false;
    }
    if (funding === "cash" && entryValue > meta.cashBalance + 0.01) {
      setMessage(
        `Available cash is ${money(meta.cashBalance, meta.currency)}. Reduce the order or add cash first.`,
      );
      setMessageTone("error");
      return false;
    }
    setMessage(null);
    return true;
  }

  function reviewHolding() {
    if (!validateHolding()) return;
    setHoldingReview(true);
  }

  function submitHolding() {
    if (!validateHolding() || !selectedStock) return;
    setMessage(
      funding === "cash"
        ? "Buying with portfolio cash…"
        : "Adding existing holding…",
    );
    setMessageTone("neutral");
    startTransition(async () => {
      const result =
        funding === "cash"
          ? await buyHoldingWithCash({
              portfolioId,
              ticker: selectedStock.ticker,
              shares: shareCount,
              price: toUsd(entryPrice),
            })
          : await logExistingHolding({
              portfolioId,
              ticker: selectedStock.ticker,
              shares: shareCount,
              entryPrice: toUsd(entryPrice),
            });
      if (!result.success) {
        setMessage(result.error ?? "Could not add holding.");
        setMessageTone("error");
        return;
      }
      finish(`${selectedStock.ticker} ${duplicate ? "updated" : "added"}.`);
    });
  }

  const title =
    mode === "menu"
      ? "Add to portfolio"
      : mode === "cash"
        ? "Add cash"
        : mode === "withdraw"
          ? "Withdraw cash"
          : mode === "holding"
            ? holdingReview
              ? "Review holding"
              : "Add holding"
            : "Import Trading 212";

  return (
    <PortfolioSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={title}
      subtitle={
        meta.currency === "USD"
          ? "Portfolio actions"
          : `Displayed in ${meta.currency}`
      }
      closeConfirmation={
        dirty && !isPending
          ? "Discard the information entered in this flow?"
          : null
      }
      widthClass="lg:max-w-[520px]"
    >
      {mode !== "menu" && (
        <BackButton
          onClick={() => {
            if (holdingReview) {
              setHoldingReview(false);
              setMessage(null);
              return;
            }
            reset();
          }}
          label={holdingReview ? "Edit holding" : "Back to actions"}
        />
      )}

      {mode === "menu" && (
        <div className="divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
          <ActionRow
            icon="plus"
            title="Add holding"
            detail="Log an existing position or buy using portfolio cash"
            onClick={() => reset("holding")}
          />
          <ActionRow
            icon="cash"
            title="Add cash"
            detail="Increase the available portfolio cash balance"
            onClick={() => reset("cash")}
          />
          <ActionRow
            icon="withdraw"
            title="Withdraw cash"
            detail={`Available: ${money(meta.cashBalance, meta.currency)}`}
            onClick={() => reset("withdraw")}
          />
          <ActionRow
            icon="import"
            title="Import Trading 212"
            detail="Preview and merge a supported CSV export"
            onClick={() => reset("import")}
          />
          <Link
            href="/portfolio?builder=1"
            className="flex min-h-[68px] items-center gap-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ddb159]/10 text-[#ddb159]">
              <PortfolioIcon name="portfolio" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-black text-[#faf6f0]">
                Create another portfolio
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-[#faf6f0]/42">
                Open the portfolio builder
              </span>
            </span>
            <PortfolioIcon name="arrow" className="size-5 text-[#ddb159]" />
          </Link>
        </div>
      )}

      {(mode === "cash" || mode === "withdraw") && (
        <div>
          <p className="text-[13px] font-semibold leading-6 text-[#faf6f0]/52">
            {mode === "cash"
              ? "Add cash in your displayed currency. Allocation and cash-drag metrics update after confirmation."
              : "Withdraw only available portfolio cash. Holdings are not sold automatically."}
          </p>
          <label className="mt-6 block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">
              Amount ({meta.currency})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={mode === "withdraw" ? meta.cashBalance : undefined}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[20px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
            />
          </label>
          {mode === "withdraw" && (
            <p className="mt-2 text-[10px] font-semibold text-[#faf6f0]/36">
              Available {money(meta.cashBalance, meta.currency)}
            </p>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => submitCash(mode === "withdraw")}
            className={`mt-5 h-12 w-full rounded-2xl text-[12px] font-black disabled:opacity-50 ${
              mode === "withdraw"
                ? "border border-[#f1908d]/32 text-[#ffc0bd]"
                : "bg-[#ddb159] text-[#061b12]"
            }`}
          >
            {isPending
              ? "Saving…"
              : mode === "withdraw"
                ? "Confirm withdrawal"
                : "Add cash"}
          </button>
        </div>
      )}

      {mode === "holding" && !holdingReview && (
        <div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#ddb159]/14 bg-[#04140c]/58 p-1">
            {(["external", "cash"] as FundingSource[]).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setFunding(source)}
                aria-pressed={funding === source}
                className={`min-h-11 rounded-xl px-3 text-[10px] font-black ${
                  funding === source
                    ? "bg-[#ddb159] text-[#061b12]"
                    : "text-[#faf6f0]/46"
                }`}
              >
                {source === "external" ? "Already own it" : "Use portfolio cash"}
              </button>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">
              Stock
            </span>
            <input
              value={ticker}
              onChange={(event) => {
                const value = event.target.value.toUpperCase();
                setTicker(value);
                const match = stockOptions.find((stock) => stock.ticker === value);
                if (match?.price) setPrice(String(match.price));
              }}
              placeholder="Ticker or company"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[14px] font-black uppercase text-[#faf6f0] outline-none focus:border-[#ddb159]"
            />
          </label>

          {matches.length > 0 && (
            <div className="mt-2 max-h-64 divide-y divide-[#faf6f0]/8 overflow-y-auto rounded-2xl border border-[#faf6f0]/8 bg-[#04140c]">
              {matches.map((stock) => (
                <button
                  key={stock.ticker}
                  type="button"
                  onClick={() => {
                    setTicker(stock.ticker);
                    if (stock.price) setPrice(String(stock.price));
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 truncate text-[12px] font-black text-[#faf6f0]">
                    {stock.ticker}{" "}
                    <span className="font-semibold text-[#faf6f0]/38">
                      {stock.company}
                    </span>
                  </span>
                  <span className="text-[10px] font-black text-[#ddb159]">
                    #{stock.rank ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">
                Shares
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.000001"
                value={shares}
                onChange={(event) => setShares(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[15px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
              />
            </label>
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/40">
                Average price
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[15px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
              />
            </label>
          </div>

          {entryValue > 0 && (
            <dl className="mt-5 divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
              <ReviewLine
                label={funding === "cash" ? "Order value" : "Recorded cost basis"}
                value={money(entryValue, meta.currency)}
              />
              <ReviewLine
                label="Estimated resulting allocation"
                value={`${resultingAllocation.toFixed(1)}%`}
                tone={
                  resultingAllocation > 30
                    ? "text-[#e8bd61]"
                    : "text-[#ddb159]"
                }
              />
              {funding === "cash" && (
                <ReviewLine
                  label="Cash remaining"
                  value={money(cashRemaining, meta.currency)}
                />
              )}
              {duplicate && (
                <div className="py-3 text-[10px] font-semibold leading-5 text-[#e8bd61]">
                  This ticker already exists. Shares will be merged and the average
                  entry price recalculated.
                </div>
              )}
            </dl>
          )}

          <button
            type="button"
            onClick={reviewHolding}
            className="mt-5 h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12]"
          >
            Review holding
          </button>
        </div>
      )}

      {mode === "holding" && holdingReview && selectedStock && (
        <div>
          <p className="text-[13px] font-semibold leading-6 text-[#faf6f0]/52">
            Confirm the position details and portfolio impact before saving.
          </p>
          <div className="mt-5 rounded-[20px] border border-[#ddb159]/18 bg-[#0a2a1d]/64 p-5">
            <p className="text-[20px] font-black text-[#faf6f0]">
              {selectedStock.ticker}
              <span className="ml-2 text-[13px] font-semibold text-[#faf6f0]/38">
                {selectedStock.company}
              </span>
            </p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
              {funding === "cash" ? "Portfolio cash purchase" : "Existing holding"}
            </p>
          </div>
          <dl className="mt-5 divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
            <ReviewLine label="Shares" value={number(shareCount, 6)} />
            <ReviewLine
              label="Average price"
              value={money(entryPrice, meta.currency)}
            />
            <ReviewLine
              label={funding === "cash" ? "Order value" : "Recorded cost basis"}
              value={money(entryValue, meta.currency)}
            />
            <ReviewLine
              label="Estimated current value"
              value={money(projectedMarketValue, meta.currency)}
            />
            <ReviewLine
              label="Estimated resulting allocation"
              value={`${resultingAllocation.toFixed(1)}%`}
              tone={
                resultingAllocation > 30
                  ? "text-[#e8bd61]"
                  : "text-[#ddb159]"
              }
            />
            {funding === "cash" && (
              <ReviewLine
                label="Cash after purchase"
                value={money(cashRemaining, meta.currency)}
              />
            )}
          </dl>
          <p className="mt-4 text-[10px] font-semibold leading-5 text-[#faf6f0]/34">
            Allocation is an estimate using the latest available market price. It may
            change when fresh market data arrives.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={submitHolding}
            className="mt-5 h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12] disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : funding === "cash"
                ? "Confirm purchase"
                : "Confirm holding"}
          </button>
        </div>
      )}

      {mode === "import" && (
        <div className="[&_section]:border-[#ddb159]/16">
          <Trading212CsvImport portfolioId={portfolioId} compact />
        </div>
      )}
      <Feedback message={message} tone={messageTone} />
    </PortfolioSheet>
  );
}

function PreferenceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      <span className="mb-2 block text-[10px] font-black text-[#faf6f0]/42">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04140c] px-4 text-[13px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ManagePortfolioSheet({
  open,
  onClose,
  portfolioId,
  meta,
}: {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  meta: PortfolioMeta;
}) {
  const router = useRouter();
  const [name, setName] = useState(meta.name);
  const [objective, setObjective] = useState(meta.objective ?? "balanced");
  const [risk, setRisk] = useState(meta.riskTolerance ?? "moderate");
  const [horizon, setHorizon] = useState(meta.timeHorizon ?? "medium");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<FeedbackTone>("neutral");
  const [isPending, startTransition] = useTransition();
  const dirty =
    name.trim() !== meta.name ||
    objective !== (meta.objective ?? "balanced") ||
    risk !== (meta.riskTolerance ?? "moderate") ||
    horizon !== (meta.timeHorizon ?? "medium");

  function resetAndClose() {
    setName(meta.name);
    setObjective(meta.objective ?? "balanced");
    setRisk(meta.riskTolerance ?? "moderate");
    setHorizon(meta.timeHorizon ?? "medium");
    setMessage(null);
    onClose();
  }

  function save() {
    if (!name.trim()) {
      setMessage("Portfolio name cannot be empty.");
      setTone("error");
      return;
    }
    setMessage("Saving changes…");
    setTone("neutral");
    startTransition(async () => {
      const renamed =
        name.trim() !== meta.name
          ? await renamePortfolio({ portfolioId, name: name.trim() })
          : { success: true };
      if (!renamed.success) {
        setMessage(renamed.error ?? "Could not rename portfolio.");
        setTone("error");
        return;
      }
      const result = await updatePortfolioPreferences({
        portfolioId,
        objective: objective as
          | "growth"
          | "income"
          | "balanced"
          | "capital_preservation"
          | "watchlist",
        riskTolerance: risk as "conservative" | "moderate" | "aggressive",
        timeHorizon: horizon as "short" | "medium" | "long",
      });
      if (!result.success) {
        setMessage(result.error ?? "Could not save preferences.");
        setTone("error");
        return;
      }
      setMessage("Portfolio updated.");
      setTone("success");
      router.refresh();
      window.setTimeout(resetAndClose, 550);
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete “${meta.name}”? This permanently removes its holdings and portfolio history.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deletePortfolio({ portfolioId });
      if (!result.success) {
        setMessage(result.error ?? "Could not delete portfolio.");
        setTone("error");
        return;
      }
      router.push("/portfolio");
      router.refresh();
    });
  }

  return (
    <PortfolioSheet
      open={open}
      onClose={resetAndClose}
      title="Manage portfolio"
      subtitle="Preferences and administration"
      closeConfirmation={
        dirty && !isPending ? "Discard unsaved portfolio changes?" : null
      }
    >
      <div className="space-y-8">
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Portfolio details
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-[10px] font-black text-[#faf6f0]/42">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className="h-12 w-full rounded-2xl border border-[#ddb159]/18 bg-[#04140c] px-4 text-[14px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159]"
            />
          </label>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[#faf6f0]/8 px-4 py-3">
            <span>
              <span className="block text-[10px] font-black text-[#faf6f0]">
                Display currency
              </span>
              <span className="mt-1 block text-[9px] font-semibold text-[#faf6f0]/34">
                Managed globally in Settings
              </span>
            </span>
            <Link
              href="/settings"
              className="min-h-11 rounded-full border border-[#ddb159]/18 px-4 py-3 text-[10px] font-black text-[#ddb159]"
            >
              {meta.currency} · Change
            </Link>
          </div>
        </section>

        <section className="border-t border-[#faf6f0]/8 pt-7">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
            Investment preferences
          </p>
          <div className="mt-4 grid gap-4">
            <PreferenceSelect
              label="Objective"
              value={objective}
              onChange={setObjective}
              options={[
                ["growth", "Growth"],
                ["income", "Income"],
                ["balanced", "Balanced"],
                ["capital_preservation", "Preservation"],
                ["watchlist", "Watchlist"],
              ]}
            />
            <PreferenceSelect
              label="Risk tolerance"
              value={risk}
              onChange={setRisk}
              options={[
                ["conservative", "Conservative"],
                ["moderate", "Moderate"],
                ["aggressive", "Aggressive"],
              ]}
            />
            <PreferenceSelect
              label="Time horizon"
              value={horizon}
              onChange={setHorizon}
              options={[
                ["short", "Short"],
                ["medium", "Medium"],
                ["long", "Long"],
              ]}
            />
          </div>
        </section>

        <section className="border-t border-[#faf6f0]/8 pt-7">
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={save}
            className="h-12 w-full rounded-2xl bg-[#ddb159] text-[12px] font-black text-[#061b12] disabled:opacity-35"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          <Feedback message={message} tone={tone} />
        </section>

        <section className="border-t border-red-400/14 pt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">
            Danger zone
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/38">
            Deleting a portfolio removes its holdings and cannot be undone.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={remove}
            className="mt-4 h-12 w-full rounded-2xl border border-red-400/26 text-[11px] font-black text-red-200 disabled:opacity-40"
          >
            Delete portfolio
          </button>
        </section>
      </div>
    </PortfolioSheet>
  );
}

export function PortfolioAnalysisSheet({
  open,
  onClose,
  summary,
  portfolioId,
}: {
  open: boolean;
  onClose: () => void;
  summary: PortfolioHealthSummary;
  portfolioId: string;
}) {
  const items = [
    ["Health score", `${summary.score}/100 · ${summary.label}`],
    [
      "Weighted AI score",
      summary.weightedAvgScore?.toLocaleString("en-GB") ?? "Unavailable",
    ],
    [
      "Diversification",
      `${summary.holdingsCount} holdings across ${summary.sectorCount} sectors`,
    ],
    [
      "Portfolio concentration",
      `${summary.largestPositionPct.toFixed(1)}% in the largest position`,
    ],
    ["Action reviews", `${summary.actionAlerts} active`],
    ["Supporting events", `${summary.eventAlerts} active`],
    ["Cash allocation", `${summary.cashDrag.toFixed(1)}%`],
  ];
  return (
    <PortfolioSheet
      open={open}
      onClose={onClose}
      title="Portfolio analysis"
      subtitle="How StockGPT is reading this portfolio"
    >
      <p className="text-[16px] font-black leading-7 text-[#faf6f0]">
        {summary.explanation}
      </p>
      <dl className="mt-7 divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-4">
            <dt className="text-[11px] font-semibold text-[#faf6f0]/42">
              {label}
            </dt>
            <dd className="max-w-[58%] text-right text-[12px] font-black text-[#faf6f0]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <AskStockGPTButton
        canUseAskStockGPT
        isAuthenticated
        label="Ask about this portfolio"
        context={{ contextType: "portfolio", portfolioId }}
        className="mt-7 h-12 w-full rounded-2xl"
      />
      <p className="mt-5 text-[10px] font-semibold leading-5 text-[#faf6f0]/34">
        This analysis is generated from portfolio holdings, rankings, alerts and current
        valuation data. It is educational only and may be incomplete when market data is
        stale or unavailable.
      </p>
    </PortfolioSheet>
  );
}
