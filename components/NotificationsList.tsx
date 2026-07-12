"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  dismissAllNotifications,
  dismissNotification,
  restoreNotification,
} from "@/lib/actions/notifications";
import { buildAskHref } from "@/lib/ask-context";
import type { Notification } from "@/lib/notifications";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { ModuleState } from "@/components/ModuleState";
import { StockGPTView } from "@/components/StockGPTView";
import { StockLogo } from "@/components/StockLogo";

type InboxFilter =
  | "all"
  | "portfolio"
  | "holdings"
  | "rank"
  | "news"
  | "unread"
  | "resolved";

const filters: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "portfolio", label: "Portfolio" },
  { id: "holdings", label: "Holdings" },
  { id: "rank", label: "Rank moves" },
  { id: "news", label: "News" },
  { id: "unread", label: "Unread" },
  { id: "resolved", label: "Resolved" },
];

function severityDetails(severity: Notification["severity"]) {
  if (severity === "critical") {
    return { label: "Critical", className: "border-[#b9504d]/45 bg-[#b9504d]/12 text-[#efb7b2]" };
  }
  if (severity === "warning") {
    return { label: "Important", className: "border-[#ddb159]/45 bg-[#ddb159]/14 text-[#f1cf7b]" };
  }
  if (severity === "success") {
    return { label: "Info", className: "border-[#68b999]/32 bg-[#68b999]/10 text-[#9bd8c0]" };
  }
  return { label: "Review", className: "border-[#faf6f0]/18 bg-[#faf6f0]/[0.06] text-[#faf6f0]/72" };
}

function matchesFilter(notification: Notification, filter: InboxFilter, resolved: boolean) {
  if (filter === "resolved") return resolved;
  if (resolved) return filter === "all";
  if (filter === "all" || filter === "unread") return true;
  if (filter === "rank") return notification.type === "rank_event" || notification.type === "score_event";
  if (filter === "news") return notification.type === "news_event";
  if (filter === "portfolio") return notification.type === "sector_event";
  return ["price_event", "sell_action", "trim_action", "buy_more_action", "review_action"].includes(notification.type);
}

function NotificationRow({
  notification,
  resolved,
  selected,
  onSelect,
}: {
  notification: Notification;
  resolved: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const severity = severityDetails(notification.severity);
  const holdingHref = `/portfolio?portfolio=${encodeURIComponent(notification.portfolioId)}&holding=${encodeURIComponent(notification.ticker)}`;

  return (
    <article
      className={`rounded-[20px] border bg-[#09251a] p-3.5 transition ${selected ? "border-[#ddb159]/55" : "border-[#ddb159]/16 hover:border-[#ddb159]/34"} ${resolved ? "opacity-65" : ""}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left" aria-pressed={selected}>
        <div className="flex min-w-0 items-start gap-3">
          <StockLogo ticker={notification.ticker} company={notification.company} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${severity.className}`}>
                {severity.label}
              </span>
              <span className="text-[10px] font-black text-[#ddb159]">{notification.ticker}</span>
              <span className="truncate text-[10px] font-semibold text-[#faf6f0]/38">{notification.portfolioName}</span>
            </div>
            <h2 className="mt-2 text-[13px] font-black leading-5 text-[#faf6f0]">{notification.title}</h2>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-[18px] text-[#faf6f0]/56">{notification.message}</p>
            <div className="mt-2">
              <FreshnessLabel
                value={notification.createdAt}
                label={notification.createdAt ? undefined : "Current condition"}
                staleAfterMinutes={1440}
                compact
              />
            </div>
          </div>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#faf6f0]/[0.07] pt-3">
        <Link href={holdingHref} prefetch={false} className="inline-flex min-h-9 items-center rounded-full bg-[#ddb159] px-3 text-[10px] font-black text-[#07170f]">
          Review holding
        </Link>
        <Link href={`/stock/${notification.ticker}`} prefetch={false} className="inline-flex min-h-9 items-center rounded-full border border-[#ddb159]/25 px-3 text-[10px] font-black text-[#faf6f0]/72">
          View stock
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => {
            if (resolved) await restoreNotification(notification.key);
            else await dismissNotification(notification.key);
          })}
          className="inline-flex min-h-9 items-center rounded-full border border-[#faf6f0]/12 px-3 text-[10px] font-black text-[#faf6f0]/52 disabled:opacity-40"
        >
          {resolved ? "Restore" : "Mark as read"}
        </button>
      </div>
    </article>
  );
}

function AlertDetail({ notification, resolved }: { notification: Notification; resolved: boolean }) {
  return (
    <div className="grid gap-3 lg:sticky lg:top-3">
      <section className="rounded-[22px] border border-[#ddb159]/22 bg-[#0a2a1d] p-5">
        <div className="flex items-center gap-3">
          <StockLogo ticker={notification.ticker} company={notification.company} size={42} />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">{notification.portfolioName}</p>
            <h2 className="mt-1 text-[18px] font-black text-[#faf6f0]">{notification.title}</h2>
          </div>
        </div>
        <p className="mt-4 text-[12px] font-semibold leading-5 text-[#faf6f0]/64">{notification.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/portfolio?portfolio=${encodeURIComponent(notification.portfolioId)}`} prefetch={false} className="inline-flex min-h-10 items-center rounded-full border border-[#ddb159]/28 px-3 text-[10px] font-black text-[#f1cf7b]">
            Open portfolio
          </Link>
          <Link href={buildAskHref({ contextType: "holding", portfolioId: notification.portfolioId, holdingTicker: notification.ticker, ownsStock: true })} prefetch={false} className="inline-flex min-h-10 items-center rounded-full bg-[#ddb159] px-3 text-[10px] font-black text-[#07170f]">
            Ask about this
          </Link>
        </div>
        {resolved && <p className="mt-4 text-[10px] font-bold text-[#faf6f0]/40">This alert is resolved. Restore it to return it to your inbox.</p>}
      </section>
      <StockGPTView
        judgement={notification.recommendation}
        status="Review"
        evidence={[notification.message]}
        risks={["Treat this as a research prompt and review the underlying position data before making a decision."]}
        updatedAt={notification.createdAt}
        freshnessLabel={notification.createdAt ? undefined : "Based on the current condition"}
        compact
      />
    </div>
  );
}

export function NotificationsList({
  unread,
  read,
  status,
}: {
  unread: Notification[];
  read: Notification[];
  status: "ok" | "error";
}) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(unread[0]?.key ?? read[0]?.key ?? null);
  const [isPending, startTransition] = useTransition();

  const items = useMemo(() => {
    const combined = [
      ...unread.map((notification) => ({ notification, resolved: false })),
      ...read.map((notification) => ({ notification, resolved: true })),
    ];
    return combined.filter((item) => matchesFilter(item.notification, filter, item.resolved));
  }, [filter, read, unread]);

  const selected = items.find((item) => item.notification.key === selectedKey) ?? items[0] ?? null;

  if (status === "error") {
    return (
      <ModuleState
        eyebrow="Alerts"
        title="Alerts are temporarily unavailable"
        description="StockGPT could not refresh your alert inbox. Your portfolio data has not been replaced or shown as all clear. Try again shortly."
        tone="error"
        action={<button type="button" onClick={() => window.location.reload()} className="min-h-10 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#07170f]">Try again</button>}
      />
    );
  }

  return (
    <div className="grid gap-4 pb-6">
      <header className="rounded-[24px] border border-[#ddb159]/24 bg-[linear-gradient(135deg,#082519,#0d3420)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ddb159]">Alert inbox</p>
            <h1 className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#faf6f0]">What needs review</h1>
            <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">
              {unread.length > 0 ? `${unread.length} unread research ${unread.length === 1 ? "prompt" : "prompts"}` : "No major alerts right now. Your portfolio and rankings look stable."}
            </p>
          </div>
          {unread.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                await dismissAllNotifications(unread.map((item) => item.key));
              })}
              className="min-h-10 rounded-full border border-[#ddb159]/35 px-3 text-[10px] font-black text-[#f1cf7b] disabled:opacity-40"
            >
              Mark all as read
            </button>
          )}
        </div>
      </header>

      <nav aria-label="Alert filters" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-[10px] font-black ${filter === item.id ? "border-[#ddb159] bg-[#ddb159] text-[#07170f]" : "border-[#ddb159]/22 bg-[#09251a] text-[#faf6f0]/62"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {items.length === 0 ? (
        <ModuleState
          eyebrow="Alerts"
          title={filter === "resolved" ? "No resolved alerts" : "Nothing needs review in this view"}
          description={filter === "resolved" ? "Alerts you mark as read will appear here so you can restore them later." : "No major alerts right now. Your portfolio and rankings look stable."}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
          <div className="grid gap-2.5">
            {items.map((item) => (
              <NotificationRow
                key={`${item.resolved ? "resolved" : "unread"}:${item.notification.key}`}
                notification={item.notification}
                resolved={item.resolved}
                selected={selected?.notification.key === item.notification.key}
                onSelect={() => setSelectedKey(item.notification.key)}
              />
            ))}
          </div>
          {selected && <div className="hidden lg:block"><AlertDetail notification={selected.notification} resolved={selected.resolved} /></div>}
        </div>
      )}

      <p className="text-[10px] font-semibold leading-5 text-[#faf6f0]/38">
        Alerts are research prompts generated from StockGPT data. They are not instructions or financial advice.
      </p>
    </div>
  );
}
