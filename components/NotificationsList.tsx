"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  dismissNotification,
  dismissAllNotifications,
  restoreNotification,
} from "@/lib/actions/notifications";
import type { Notification } from "@/lib/notifications";

function severityStyle(s: Notification["severity"]) {
  if (s === "critical")
    return {
      pillBg: "bg-red-500",
      pillText: "text-white",
      label: "Critical",
      cardBorder: "border-red-200",
      cardAccent: "bg-red-500",
    };
  if (s === "warning")
    return {
      pillBg: "bg-amber-500",
      pillText: "text-white",
      label: "Warning",
      cardBorder: "border-amber-200",
      cardAccent: "bg-amber-500",
    };
  if (s === "success")
    return {
      pillBg: "bg-emerald-500",
      pillText: "text-white",
      label: "Good news",
      cardBorder: "border-emerald-200",
      cardAccent: "bg-emerald-500",
    };
  return {
    pillBg: "bg-blue-500",
    pillText: "text-white",
    label: "Info",
    cardBorder: "border-blue-200",
    cardAccent: "bg-blue-500",
  };
}

function NotificationCard({
  notification,
  isRead,
}: {
  notification: Notification;
  isRead: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const style = severityStyle(notification.severity);

  function handleDismiss() {
    startTransition(() => {
      dismissNotification(notification.key);
    });
  }

  function handleRestore() {
    startTransition(() => {
      restoreNotification(notification.key);
    });
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 bg-[#faf6f0] shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition ${style.cardBorder} ${isRead ? "opacity-65" : ""}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${style.cardAccent}`} />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 pl-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${style.pillBg} ${style.pillText}`}
            >
              {style.label}
            </span>
            <Link
              href={`/stock/${notification.ticker}`}
              prefetch={false}
              className="text-[11px] font-black tracking-wider text-[#072116] underline decoration-[#ddb159]/40 underline-offset-2 hover:decoration-[#ddb159]"
            >
              {notification.ticker}
            </Link>
            {notification.company && (
              <span className="truncate text-[10px] font-semibold text-[#072116]/55">
                · {notification.company}
              </span>
            )}
          </div>

          <h3 className="mt-1.5 text-[14px] font-black tracking-[-0.02em] text-[#072116]">
            {notification.title}
          </h3>

          <p className="mt-1 text-[12px] font-medium text-[#072116]/65">
            {notification.message}
          </p>

          <div className="mt-2 rounded-lg border border-[#072116]/10 bg-white/70 px-3 py-2">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/45">
              AI Recommendation
            </p>
            <p className="mt-0.5 text-[12px] font-bold text-[#072116]/85">
              {notification.recommendation}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          {!isRead ? (
            <button
              onClick={handleDismiss}
              disabled={isPending}
              className="rounded-full border border-[#072116]/15 px-3 py-1 text-[10px] font-bold text-[#072116]/55 transition hover:border-[#072116]/35 hover:text-[#072116] disabled:opacity-50"
            >
              Mark read
            </button>
          ) : (
            <button
              onClick={handleRestore}
              disabled={isPending}
              className="rounded-full border border-[#072116]/15 px-3 py-1 text-[10px] font-bold text-[#072116]/55 transition hover:border-[#072116]/35 hover:text-[#072116] disabled:opacity-50"
            >
              Restore
            </button>
          )}

          <Link
            href={`/stock/${notification.ticker}`}
            prefetch={false}
            className="rounded-full bg-[#072116] px-3 py-1 text-[10px] font-bold text-[#ddb159] transition hover:bg-[#0b2b1d]"
          >
            View →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NotificationsList({
  unread,
  read,
}: {
  unread: Notification[];
  read: Notification[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showRead, setShowRead] = useState(false);

  function handleMarkAllRead() {
    if (unread.length === 0) return;
    startTransition(() => {
      dismissAllNotifications(unread.map((n) => n.key));
    });
  }

  const critical = unread.filter((n) => n.severity === "critical");
  const warnings = unread.filter((n) => n.severity === "warning");
  const success = unread.filter((n) => n.severity === "success");
  const info = unread.filter((n) => n.severity === "info");

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              AI Notifications
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0]">
              {unread.length === 0
                ? "All caught up"
                : `${unread.length} alert${unread.length === 1 ? "" : "s"} need${unread.length === 1 ? "s" : ""} attention`}
            </h1>
            <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/55">
              {unread.length === 0
                ? "No new alerts about your portfolio."
                : "AI-generated alerts based on rank, score, news, and sector changes."}
            </p>
          </div>

          {unread.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="rounded-full border border-[#ddb159]/40 px-4 py-2 text-[12px] font-bold text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10 disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>

        {unread.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {critical.length > 0 && (
              <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-black text-white">
                ⚠ {critical.length} critical
              </span>
            )}
            {warnings.length > 0 && (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">
                {warnings.length} warning{warnings.length === 1 ? "" : "s"}
              </span>
            )}
            {success.length > 0 && (
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-white">
                {success.length} good news
              </span>
            )}
            {info.length > 0 && (
              <span className="rounded-full bg-blue-500 px-3 py-1 text-[11px] font-black text-white">
                {info.length} info
              </span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#ddb159]/16 bg-[#061b12]/60 px-4 py-3 text-[11px] font-medium leading-5 text-[#faf6f0]/45">
        Alerts are research prompts generated from StockGPT data. Use them as a
        review starting point, not as instructions.
      </div>

      {unread.length > 0 ? (
        <div className="grid gap-2.5">
          {unread.map((n) => (
            <NotificationCard key={n.key} notification={n} isRead={false} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[#ddb159]/25 bg-[#061b12]/50 py-12">
          <div className="text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full border border-[#ddb159]/25 bg-[#072116]">
              <svg
                viewBox="0 0 24 24"
                className="size-6 text-[#ddb159]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <p className="mt-3 text-[14px] font-black text-[#faf6f0]">
              You&apos;re all caught up
            </p>
            <p className="mt-1 text-[12px] font-medium text-[#faf6f0]/45">
              We&apos;ll let you know if anything important changes.
            </p>
          </div>
        </div>
      )}

      {read.length > 0 && (
        <>
          <button
            onClick={() => setShowRead((s) => !s)}
            className="mt-2 self-start rounded-full border border-[#ddb159]/30 px-4 py-1.5 text-[11px] font-bold text-[#faf6f0]/65 transition hover:border-[#ddb159] hover:text-[#ddb159]"
          >
            {showRead ? "Hide" : "Show"} {read.length} dismissed
          </button>

          {showRead && (
            <div className="grid gap-2.5">
              {read.map((n) => (
                <NotificationCard key={n.key} notification={n} isRead={true} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
