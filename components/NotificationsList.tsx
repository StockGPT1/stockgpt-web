"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { ModuleState } from "@/components/ModuleState";
import { StockLogo } from "@/components/StockLogo";
import {
  dismissAllNotifications,
  dismissNotification,
  restoreNotification,
} from "@/lib/actions/notifications";
import { buildAskHref } from "@/lib/ask-context";
import type { Notification } from "@/lib/canonical-notifications";

type InboxFilter =
  | "all"
  | "urgent_review"
  | "review"
  | "references"
  | "unread"
  | "read";

const filters: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "urgent_review", label: "Urgent review" },
  { id: "review", label: "Review" },
  { id: "references", label: "References" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
];

function notificationTone(notification: Notification) {
  if (notification.status === "urgent_review") {
    return {
      label: "Urgent review",
      className: "border-[#b9504d]/45 bg-[#b9504d]/12 text-[#efb7b2]",
    };
  }
  if (notification.status === "review") {
    return {
      label: "Review",
      className: "border-[#ddb159]/45 bg-[#ddb159]/14 text-[#f1cf7b]",
    };
  }
  return {
    label: "Saved reference",
    className: "border-[#faf6f0]/18 bg-[#faf6f0]/[0.06] text-[#faf6f0]/72",
  };
}

function matchesFilter(
  notification: Notification,
  filter: InboxFilter,
  isRead: boolean,
) {
  if (filter === "unread") return !isRead;
  if (filter === "read") return isRead;
  if (filter === "urgent_review") return notification.status === "urgent_review";
  if (filter === "review") return notification.status === "review";
  if (filter === "references") return notification.kind === "saved_reference";
  return true;
}

function NotificationRow({
  notification,
  isRead,
  selected,
  onSelect,
}: {
  notification: Notification;
  isRead: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const tone = notificationTone(notification);
  const holdingHref = `/portfolio?portfolio=${encodeURIComponent(notification.portfolioId)}&holding=${encodeURIComponent(notification.ticker)}`;

  return (
    <article
      className={`rounded-[20px] border bg-[#09251a] p-3.5 transition ${selected ? "border-[#ddb159]/55" : "border-[#ddb159]/16 hover:border-[#ddb159]/34"} ${isRead ? "opacity-65" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
        aria-pressed={selected}
      >
        <div className="flex min-w-0 items-start gap-3">
          <StockLogo
            ticker={notification.ticker}
            company={notification.company}
            size={36}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${tone.className}`}
              >
                {tone.label}
              </span>
              <span className="text-[10px] font-black text-[#ddb159]">
                {notification.ticker}
              </span>
              <span className="truncate text-[10px] font-semibold text-[#faf6f0]/38">
                {notification.portfolioName}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#faf6f0]/32">
                {isRead ? "Read" : "Unread"}
              </span>
            </div>
            <h2 className="mt-2 text-[13px] font-black leading-5 text-[#faf6f0]">
              {notification.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-[18px] text-[#faf6f0]/56">
              {notification.message}
            </p>
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
        <Link
          href={holdingHref}
          prefetch={false}
          className="inline-flex min-h-9 items-center rounded-full bg-[#ddb159] px-3 text-[10px] font-black text-[#07170f]"
        >
          Review holding
        </Link>
        <Link
          href={`/stock/${notification.ticker}`}
          prefetch={false}
          className="inline-flex min-h-9 items-center rounded-full border border-[#ddb159]/25 px-3 text-[10px] font-black text-[#faf6f0]/72"
        >
          View stock
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              if (isRead) await restoreNotification(notification.key);
              else await dismissNotification(notification.key);
            })
          }
          className="inline-flex min-h-9 items-center rounded-full border border-[#faf6f0]/12 px-3 text-[10px] font-black text-[#faf6f0]/52 disabled:opacity-40"
        >
          {isRead ? "Restore to unread" : "Mark as read"}
        </button>
      </div>
    </article>
  );
}

function NotificationDetail({
  notification,
  isRead,
}: {
  notification: Notification;
  isRead: boolean;
}) {
  return (
    <section className="grid gap-3 rounded-[22px] border border-[#ddb159]/22 bg-[#0a2a1d] p-5 lg:sticky lg:top-3">
      <div className="flex items-center gap-3">
        <StockLogo
          ticker={notification.ticker}
          company={notification.company}
          size={42}
        />
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
            {notification.portfolioName}
          </p>
          <h2 className="mt-1 text-[18px] font-black text-[#faf6f0]">
            {notification.title}
          </h2>
        </div>
      </div>
      <p className="text-[12px] font-semibold leading-5 text-[#faf6f0]/64">
        {notification.message}
      </p>
      {notification.reasons.length > 0 && (
        <div className="grid gap-2">
          {notification.reasons.map((reason) => (
            <div
              key={reason.code}
              className="rounded-[16px] border border-[#faf6f0]/[0.08] bg-[#071d15] p-3"
            >
              <p className="text-[11px] font-black text-[#faf6f0]">
                {reason.title}
              </p>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[#faf6f0]/50">
                {reason.detail}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/portfolio?portfolio=${encodeURIComponent(notification.portfolioId)}&holding=${encodeURIComponent(notification.ticker)}`}
          prefetch={false}
          className="inline-flex min-h-10 items-center rounded-full border border-[#ddb159]/28 px-3 text-[10px] font-black text-[#f1cf7b]"
        >
          Review holding
        </Link>
        <Link
          href={`/stock/${notification.ticker}`}
          prefetch={false}
          className="inline-flex min-h-10 items-center rounded-full border border-[#ddb159]/28 px-3 text-[10px] font-black text-[#f1cf7b]"
        >
          View stock
        </Link>
        <Link
          href={buildAskHref({
            contextType: "holding",
            portfolioId: notification.portfolioId,
            holdingTicker: notification.ticker,
            ownsStock: true,
          })}
          prefetch={false}
          className="inline-flex min-h-10 items-center rounded-full bg-[#ddb159] px-3 text-[10px] font-black text-[#07170f]"
        >
          Ask about this
        </Link>
      </div>
      {isRead && (
        <p className="text-[10px] font-bold text-[#faf6f0]/40">
          This prompt is marked as read. Restore it to return it to the unread inbox.
        </p>
      )}
    </section>
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
  const [selectedKey, setSelectedKey] = useState<string | null>(
    unread[0]?.key ?? read[0]?.key ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const items = useMemo(() => {
    const combined = [
      ...unread.map((notification) => ({ notification, isRead: false })),
      ...read.map((notification) => ({ notification, isRead: true })),
    ];
    return combined.filter((item) =>
      matchesFilter(item.notification, filter, item.isRead),
    );
  }, [filter, read, unread]);
  const selected =
    items.find((item) => item.notification.key === selectedKey) ??
    items[0] ??
    null;

  if (status === "error") {
    return (
      <ModuleState
        eyebrow="Notifications"
        title="Notifications are temporarily unavailable"
        description="StockGPT could not refresh your research-prompt inbox. Your portfolio data has not been replaced or presented as all clear. Try again shortly."
        tone="error"
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-10 rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#07170f]"
          >
            Try again
          </button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 pb-6">
      <header className="rounded-[24px] border border-[#ddb159]/24 bg-[linear-gradient(135deg,#082519,#0d3420)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ddb159]">
              Research prompt inbox
            </p>
            <h1 className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#faf6f0]">
              What needs review
            </h1>
            <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/48">
              {unread.length > 0
                ? `${unread.length} unread current ${unread.length === 1 ? "prompt" : "prompts"}`
                : "No current Review or Urgent review prompts."}
            </p>
          </div>
          {unread.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await dismissAllNotifications(unread.map((item) => item.key));
                })
              }
              className="min-h-10 rounded-full border border-[#ddb159]/35 px-3 text-[10px] font-black text-[#f1cf7b] disabled:opacity-40"
            >
              Mark all as read
            </button>
          )}
        </div>
      </header>

      <nav
        aria-label="Notification filters"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
          eyebrow="Notifications"
          title={filter === "read" ? "No read prompts" : "Nothing in this view"}
          description={
            filter === "read"
              ? "Prompts you mark as read appear here while the underlying current condition still exists."
              : "No current Review or Urgent review prompts match this view."
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
          <div className="grid gap-2.5">
            {items.map((item) => (
              <NotificationRow
                key={`${item.isRead ? "read" : "unread"}:${item.notification.key}`}
                notification={item.notification}
                isRead={item.isRead}
                selected={selected?.notification.key === item.notification.key}
                onSelect={() => setSelectedKey(item.notification.key)}
              />
            ))}
          </div>
          {selected && (
            <div className="hidden lg:block">
              <NotificationDetail
                notification={selected.notification}
                isRead={selected.isRead}
              />
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] font-semibold leading-5 text-[#faf6f0]/38">
        These are current research prompts from StockGPT&apos;s covered portfolio data. They are not transaction instructions or financial advice.
      </p>
    </div>
  );
}
