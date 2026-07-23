"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  logExistingHolding,
} from "@/lib/actions/portfolio-management";
import { withdrawPortfolioCash } from "@/lib/actions/portfolio-cash";
import { resolveTradeOrder } from "@/lib/trade-calculator";
import { money, number } from "@/components/portfolio-workspace/utils";

type AddMode = "menu" | "cash" | "withdraw" | "holding" | "import";
type FundingSource = "external" | "cash";
type FeedbackTone = "neutral" | "error" | "success";

type ActionIcon = "plus" | "cash" | "withdraw" | "import" | "portfolio";

function ActionRow({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ActionIcon;
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
  tone,
}: {
  message: string | null;
  tone: FeedbackTone;
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
      <dd className={`max-w-[62%] text-right text-[12px] font-black ${tone}`}>
        {value}
      </dd>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
  placeholder?: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-3 text-[14px] font-black text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/20 focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/14"
      />
    </label>
  );
}

export function PortfolioAddSheet({
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
  const [cashAmount, setCashAmount] = useState("");
  const [ticker, setTicker] = useState("");
  const [value, setValue] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [funding, setFunding] = useState<FundingSource>("external");
  const [holdingReview, setHoldingReview] = useState(false);
  const [isPending, startTransition] = useTransition();

  const rate =
    Number.isFinite(usdToDisplayRate) && usdToDisplayRate > 0
      ? usdToDisplayRate
      : 1;
  const toUsd = (amount: number) => amount / rate;
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
      .slice(0, 7);
  }, [selectedStock, stockOptions, ticker]);

  const order = resolveTradeOrder({ value, price, shares });
  const orderReady = Boolean(selectedStock) && order.error == null;
  const orderValue = order.value ?? 0;
  const orderPrice = order.price ?? 0;
  const orderShares = order.shares ?? 0;
  const currentMarketPrice =
    selectedStock?.price != null && selectedStock.price > 0
      ? selectedStock.price
      : orderPrice;
  const projectedMarketValue = orderReady ? orderShares * currentMarketPrice : 0;
  const existingHolding = holdings.find(
    (holding) => holding.ticker.toUpperCase() === selectedStock?.ticker,
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
  const cashRemaining = Math.max(0, meta.cashBalance - orderValue);
  const duplicate = Boolean(existingHolding);
  const dirty = Boolean(
    cashAmount || ticker || value || shares || price || holdingReview,
  );

  function reset(next: AddMode = "menu") {
    setMode(next);
    setMessage(null);
    setMessageTone("neutral");
    setCashAmount("");
    setTicker("");
    setValue("");
    setShares("");
    setPrice("");
    setFunding("external");
    setHoldingReview(false);
  }

  function chooseStock(stock: StockOption) {
    setTicker(stock.ticker);
    if (!price && stock.price && stock.price > 0) setPrice(String(stock.price));
    setMessage(null);
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
    const parsed = Number(cashAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
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
        ? await withdrawPortfolioCash({
            portfolioId,
            amount: toUsd(parsed),
          })
        : await addCash({ portfolioId, amount: toUsd(parsed) });
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
    if (!selectedStock) {
      setMessage("Choose a supported stock from the search results.");
      setMessageTone("error");
      return false;
    }
    if (order.error || !orderReady) {
      setMessage(order.error ?? "Enter valid trade details.");
      setMessageTone("error");
      return false;
    }
    if (funding === "cash" && orderValue > meta.cashBalance + 0.01) {
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
              shares: orderShares,
              price: toUsd(orderPrice),
            })
          : await logExistingHolding({
              portfolioId,
              ticker: selectedStock.ticker,
              shares: orderShares,
              entryPrice: toUsd(orderPrice),
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
      widthClass="lg:max-w-[540px]"
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
            className="flex min-h-[68px] items-center gap-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159]"
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
              value={cashAmount}
              onChange={(event) => setCashAmount(event.target.value)}
              className="h-14 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[20px] font-black text-[#faf6f0] outline-none focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/14"
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
                setTicker(event.target.value.toUpperCase());
                setMessage(null);
              }}
              placeholder="Ticker or company"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-[#ddb159]/20 bg-[#04140c] px-4 text-[14px] font-black uppercase text-[#faf6f0] outline-none placeholder:normal-case placeholder:text-[#faf6f0]/24 focus:border-[#ddb159] focus-visible:ring-2 focus-visible:ring-[#ddb159]/14"
            />
          </label>

          {matches.length > 0 && (
            <div className="mt-2 max-h-64 divide-y divide-[#faf6f0]/8 overflow-y-auto overscroll-contain rounded-2xl border border-[#faf6f0]/8 bg-[#04140c]">
              {matches.map((stock) => (
                <button
                  key={stock.ticker}
                  type="button"
                  onClick={() => chooseStock(stock)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#faf6f0]/4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159]"
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

          {selectedStock && (
            <p className="mt-2 text-[10px] font-semibold text-[#61d7ab]">
              Selected {selectedStock.ticker} · {selectedStock.company}
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <NumberField
              label={`Value (${meta.currency})`}
              value={value}
              onChange={setValue}
              step="0.01"
              placeholder="Any 2"
            />
            <NumberField
              label="Price"
              value={price}
              onChange={setPrice}
              step="0.0001"
              placeholder="Any 2"
            />
            <NumberField
              label="Shares"
              value={shares}
              onChange={setShares}
              step="0.000001"
              placeholder="Any 2"
            />
          </div>
          <p className="mt-2 text-[9px] font-semibold leading-5 text-[#faf6f0]/30">
            Enter any two fields. StockGPT calculates the third and rejects inconsistent values.
          </p>

          {order.entered >= 2 && (
            <dl className="mt-5 divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
              {order.error ? (
                <div className="py-3 text-[10px] font-semibold leading-5 text-[#f1908d]">
                  {order.error}
                </div>
              ) : (
                <>
                  <ReviewLine
                    label={funding === "cash" ? "Order value" : "Recorded cost basis"}
                    value={money(orderValue, meta.currency)}
                  />
                  <ReviewLine label="Resolved shares" value={number(orderShares, 6)} />
                  <ReviewLine
                    label="Resolved price"
                    value={money(orderPrice, meta.currency)}
                  />
                  <ReviewLine
                    label="Estimated allocation"
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
                      This ticker already exists. Shares will be merged and the average entry price recalculated.
                    </div>
                  )}
                </>
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
            <ReviewLine label="Shares" value={number(orderShares, 6)} />
            <ReviewLine
              label="Average price"
              value={money(orderPrice, meta.currency)}
            />
            <ReviewLine
              label={funding === "cash" ? "Order value" : "Recorded cost basis"}
              value={money(orderValue, meta.currency)}
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
            Allocation is an estimate using the latest available market price. It may change when fresh market data arrives.
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
