"use client";

import { useState } from "react";

type FreshnessLabelProps = {
  value?: string | Date | null;
  label?: string;
  staleAfterMinutes?: number;
  compact?: boolean;
};

function relativeTime(value: string | Date, referenceTime: number) {
  const date = value instanceof Date ? value : new Date(value);
  const elapsed = referenceTime - date.getTime();
  if (!Number.isFinite(elapsed)) return null;
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function FreshnessLabel({ value, label, staleAfterMinutes = 180, compact = false }: FreshnessLabelProps) {
  const [referenceTime] = useState(Date.now);
  const date = value ? (value instanceof Date ? value : new Date(value)) : null;
  const ageMinutes = date && Number.isFinite(date.getTime()) ? (referenceTime - date.getTime()) / 60_000 : null;
  const stale = ageMinutes !== null && ageMinutes > staleAfterMinutes;
  const copy = label ?? (value ? relativeTime(value, referenceTime) : null) ?? "Update time unavailable";

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 font-bold ${compact ? "text-[9px]" : "text-[10px]"} ${stale ? "text-[#d5a951]" : "text-[#faf6f0]/42"}`}>
      {/* fresh data pulses like a live feed; stale data sits still */}
      <span
        className={`${stale ? "" : "fx-live-dot"} size-1.5 rounded-full ${stale ? "bg-[#d5a951]" : "bg-[#61d7ab] text-[#61d7ab]"}`}
        aria-hidden="true"
      />
      {copy}
    </span>
  );
}
