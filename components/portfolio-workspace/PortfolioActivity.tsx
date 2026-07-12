"use client";

import { useMemo, useState } from "react";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import { PortfolioIcon } from "@/components/portfolio-workspace/PortfolioIcon";
import type {
  ActivityFilter,
  ActivityItem,
  PortfolioMeta,
  PortfolioTransaction,
} from "@/components/portfolio-workspace/types";
import {
  buildActivityItems,
  dateGroupLabel,
  formatDate,
} from "@/components/portfolio-workspace/utils";

const FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "transactions", label: "Transactions" },
  { value: "ai", label: "AI events" },
  { value: "reviews", label: "Reviews" },
];

function iconFor(item: ActivityItem) {
  if (item.kind === "transaction") return "cash" as const;
  if (item.kind === "review") return "filter" as const;
  return "activity" as const;
}

function toneClasses(tone: ActivityItem["tone"]) {
  if (tone === "positive") return "border-[#61d7ab]/38 bg-[#61d7ab]/10 text-[#61d7ab]";
  if (tone === "negative") return "border-[#f1908d]/38 bg-[#f1908d]/10 text-[#f1908d]";
  if (tone === "warning") return "border-[#e8bd61]/38 bg-[#e8bd61]/10 text-[#e8bd61]";
  return "border-[#faf6f0]/14 bg-[#faf6f0]/5 text-[#faf6f0]/58";
}

export function PortfolioActivity({
  transactions,
  holdings,
  meta,
  onHolding,
}: {
  transactions: PortfolioTransaction[];
  holdings: ExtendedHolding[];
  meta: PortfolioMeta;
  onHolding: (holding: ExtendedHolding) => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [limit, setLimit] = useState(40);
  const activity = useMemo(
    () => buildActivityItems(transactions, holdings, meta.currency),
    [holdings, meta.currency, transactions],
  );
  const filtered = useMemo(
    () =>
      activity.filter((item) => {
        if (filter === "all") return true;
        if (filter === "transactions") return item.kind === "transaction";
        if (filter === "ai") return item.kind === "ai";
        return item.kind === "review";
      }),
    [activity, filter],
  );
  const visible = filtered.slice(0, limit);
  const holdingMap = useMemo(
    () => new Map(holdings.map((holding) => [holding.ticker.toUpperCase(), holding])),
    [holdings],
  );
  const groups = useMemo(() => {
    const result: Array<{ label: string; items: ActivityItem[] }> = [];
    for (const item of visible) {
      const label = dateGroupLabel(item.date);
      const current = result.at(-1);
      if (current?.label === label) current.items.push(item);
      else result.push({ label, items: [item] });
    }
    return result;
  }, [visible]);

  return (
    <div>
      <section>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio history</p>
        <h2 className="mt-1 text-[27px] font-black tracking-[-0.045em] text-[#faf6f0] lg:text-[34px]">Activity, connected</h2>
        <p className="mt-3 max-w-2xl text-[12px] font-semibold leading-6 text-[#faf6f0]/44">
          Transactions, model events and holding reviews appear in one timeline so performance changes have context.
        </p>
      </section>

      <nav aria-label="Activity filters" className="-mx-4 mt-7 flex gap-2 overflow-x-auto border-y border-[#faf6f0]/8 px-4 py-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => { setFilter(item.value); setLimit(40); }}
            aria-pressed={filter === item.value}
            className={`min-h-10 shrink-0 rounded-full px-4 text-[10px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] ${
              filter === item.value
                ? "bg-[#ddb159] text-[#061b12]"
                : "border border-[#ddb159]/14 text-[#faf6f0]/46 hover:text-[#faf6f0]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="mt-7 border-y border-[#faf6f0]/8 py-12 text-center">
          <p className="text-[18px] font-black text-[#faf6f0]">No activity in this view</p>
          <p className="mx-auto mt-2 max-w-lg text-[12px] font-semibold leading-6 text-[#faf6f0]/44">
            Transactions and meaningful StockGPT events will appear here as the portfolio changes.
          </p>
        </div>
      ) : (
        <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <div>
            {groups.map((group) => (
              <section key={group.label} className="mt-8 first:mt-0" aria-labelledby={`activity-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <h3 id={`activity-${group.label.replace(/\s+/g, "-").toLowerCase()}`} className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                  {group.label}
                </h3>
                <div className="mt-3">
                  {group.items.map((item, index) => {
                    const holding = item.ticker ? holdingMap.get(item.ticker.toUpperCase()) : null;
                    const content = (
                      <>
                        <span className="relative flex w-11 shrink-0 justify-center">
                          {index < group.items.length - 1 && <span className="absolute left-1/2 top-10 h-[calc(100%+16px)] w-px -translate-x-1/2 bg-[#faf6f0]/10" />}
                          <span className={`relative z-10 grid size-10 place-items-center rounded-full border ${toneClasses(item.tone)}`}>
                            <PortfolioIcon name={iconFor(item)} className="size-4" />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 border-b border-[#faf6f0]/8 pb-5">
                          <span className="flex items-start justify-between gap-4">
                            <span className="min-w-0">
                              <span className="block text-[14px] font-black text-[#faf6f0]">{item.title}</span>
                              <span className="mt-1 block text-[11px] font-semibold leading-5 text-[#faf6f0]/46">{item.detail}</span>
                            </span>
                            <span className="shrink-0 text-right text-[9px] font-semibold text-[#faf6f0]/30">{formatDate(item.date, true)}</span>
                          </span>
                          {item.ticker && <span className="mt-2 block text-[9px] font-black uppercase tracking-[0.1em] text-[#ddb159]">{item.ticker} · {item.kind === "transaction" ? "Transaction" : item.kind === "review" ? "Review" : "AI event"}</span>}
                        </span>
                      </>
                    );
                    return holding ? (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onHolding(holding)}
                        className="flex min-h-[76px] w-full gap-3 py-2 text-left transition hover:bg-[#faf6f0]/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159]"
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={item.id} className="flex min-h-[76px] gap-3 py-2">{content}</div>
                    );
                  })}
                </div>
              </section>
            ))}

            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => setLimit((value) => value + 40)}
                className="mt-8 h-12 w-full rounded-2xl border border-[#ddb159]/20 text-[11px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
              >
                Load more activity
              </button>
            )}
          </div>

          <aside className="mt-10 border-t border-[#faf6f0]/8 pt-6 lg:sticky lg:top-[120px] lg:mt-0 lg:self-start lg:rounded-[20px] lg:border lg:border-[#ddb159]/14 lg:bg-[#0a2a1d]/40 lg:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Timeline summary</p>
            <dl className="mt-5 divide-y divide-[#faf6f0]/8">
              {[
                ["Transactions", String(activity.filter((item) => item.kind === "transaction").length)],
                ["AI events", String(activity.filter((item) => item.kind === "ai").length)],
                ["Reviews", String(activity.filter((item) => item.kind === "review").length)],
                ["Most recent", activity[0] ? formatDate(activity[0].date, true) : "No activity"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <dt className="text-[10px] font-semibold text-[#faf6f0]/38">{label}</dt>
                  <dd className="max-w-[58%] text-right text-[11px] font-black text-[#faf6f0]">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-[10px] font-semibold leading-5 text-[#faf6f0]/32">
              Transactions are user actions. AI events and reviews are research signals, not executed trades or financial advice.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
