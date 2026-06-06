"use client";

import { useState } from "react";

type NotificationPreferenceTogglesProps = {
  initialDigest: boolean;
  initialPortfolioAlerts: boolean;
  initialWatchlistAlerts: boolean;
};

export function NotificationPreferenceToggles({
  initialDigest,
  initialPortfolioAlerts,
  initialWatchlistAlerts,
}: NotificationPreferenceTogglesProps) {
  const [digest, setDigest] = useState(initialDigest);
  const [portfolioAlerts, setPortfolioAlerts] = useState(initialPortfolioAlerts);
  const [watchlistAlerts, setWatchlistAlerts] = useState(initialWatchlistAlerts);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(next: {
    digest: boolean;
    portfolioAlerts: boolean;
    watchlistAlerts: boolean;
  }) {
    setDigest(next.digest);
    setPortfolioAlerts(next.portfolioAlerts);
    setWatchlistAlerts(next.watchlistAlerts);
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!response.ok) {
        setDigest(digest);
        setPortfolioAlerts(portfolioAlerts);
        setWatchlistAlerts(watchlistAlerts);
        setMessage("Could not save. Please try again.");
        return;
      }

      setMessage("Notification preferences saved.");
    } catch {
      setDigest(digest);
      setPortfolioAlerts(portfolioAlerts);
      setWatchlistAlerts(watchlistAlerts);
      setMessage("Could not connect. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    {
      key: "digest",
      title: "Daily email digest",
      detail: "8am summary covering rank changes, watchlist news, portfolio alerts and the market overview.",
      enabled: digest,
      onChange: (value: boolean) =>
        save({ digest: value, portfolioAlerts, watchlistAlerts }),
    },
    {
      key: "portfolio",
      title: "Portfolio alert emails",
      detail: "Email me when a saved holding triggers a meaningful review, risk or action alert.",
      enabled: portfolioAlerts,
      onChange: (value: boolean) =>
        save({ digest, portfolioAlerts: value, watchlistAlerts }),
    },
    {
      key: "watchlist",
      title: "Watchlist alert emails",
      detail: "Email me when a watchlisted stock has relevant news or a notable ranking change.",
      enabled: watchlistAlerts,
      onChange: (value: boolean) =>
        save({ digest, portfolioAlerts, watchlistAlerts: value }),
    },
  ];

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <label
          key={row.key}
          className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#072116]/10 px-4 py-3 transition hover:border-[#ddb159]/40"
        >
          <div>
            <p className="text-[13px] font-bold">{row.title}</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-5 text-[#072116]/50">
              {row.detail}
            </p>
          </div>
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => void row.onChange(event.target.checked)}
            disabled={saving}
            className="h-5 w-5 shrink-0 accent-[#ddb159]"
          />
        </label>
      ))}

      <div className="flex min-h-5 items-center justify-between gap-3 px-1">
        {message ? (
          <p
            className={[
              "text-[10px] font-bold",
              message.includes("Could not") ? "text-red-600" : "text-emerald-700",
            ].join(" ")}
          >
            {message}
          </p>
        ) : (
          <p className="text-[10px] font-semibold text-[#072116]/42">
            Instant emails are reserved for genuinely urgent alerts.
          </p>
        )}
        {saving && <span className="text-[10px] font-bold text-[#072116]/40">Saving…</span>}
      </div>
    </div>
  );
}
