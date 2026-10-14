type ReportingMetadata = { basis?: string; periods?: unknown; period?: unknown } | null | undefined;

const BASIS_LABELS: Record<string, string> = {
  ttm: "Last 12 months",
  quarterly_ttm: "Last 12 months",
  annual: "Annual accounts",
  quarterly_yoy: "Quarterly vs last year",
  annual_yoy: "Annual vs prior year",
  ttm_yoy: "Last 12 months vs prior year",
  balance_sheet_snapshot: "Balance sheet",
};

export function fundamentalReportingLabel(metadata: ReportingMetadata) {
  if (!metadata) return null;
  const basis = BASIS_LABELS[metadata.basis?.toLowerCase() ?? ""] ?? null;
  const periods = Array.isArray(metadata.periods) ? metadata.periods : [metadata.period];
  const timestamps = periods
    .filter((period): period is string => typeof period === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(period))
    .map((period) => Date.parse(period))
    .filter(Number.isFinite);
  const latest = timestamps.length ? new Date(Math.max(...timestamps)) : null;
  const date = latest?.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const parts = [basis, date].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
