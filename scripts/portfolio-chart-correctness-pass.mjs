import fs from "node:fs";

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

const chartFile = "lib/portfolio-page-chart.ts";
let chart = fs.readFileSync(chartFile, "utf8");
chart = chart.replace(
  /\n  const intradayPoints = visibleFlatPoints\(endValue, now\);\n\n  return \{\n    MAX: maxPoints,\n    "1D": intradayPoints,\n    "1M": maxPoints,\n    "6M": maxPoints,\n    "1Y": maxPoints,\n  \};/,
  `\n  return {\n    MAX: maxPoints,\n  };`,
);
chart = replaceAll(
  chart,
  "// Keep portfolio initial render fast. Detailed contribution-adjusted chart reconstruction\n  // previously fetched historical data for every holding and could block mobile loads.",
  "// Fast fallback: total portfolio performance only. Period ranges require real range data.",
);
fs.writeFileSync(chartFile, chart);

const componentFile = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(componentFile, "utf8");
source = source.replace(
  /function buildRangeData\([\s\S]*?\n}\n\nfunction preferredInitialRange/,
  `function buildRangeData(
  source: Partial<Record<TimeRange, ChartPoint[]>>,
  createdAt?: string | null,
): Partial<Record<TimeRange, ChartPoint[]>> {
  const maxPoints = source.MAX ?? [];
  const data: Partial<Record<TimeRange, ChartPoint[]>> = { ...source };
  const hasPeriodRange = RANGE_LABELS.some(
    ({ range }) => range !== "MAX" && (source[range]?.length ?? 0) > 1,
  );

  if (!hasPeriodRange && maxPoints.length <= 2) {
    return maxPoints.length > 1 ? { MAX: maxPoints } : data;
  }

  if (maxPoints.length < 3) return data;

  const createdMs = createdAt ? new Date(createdAt).getTime() : new Date(maxPoints[0].date).getTime();
  const nowMs = Date.now();

  RANGE_LABELS.forEach(({ range, days }) => {
    if (range === "MAX" || days == null) return;
    if ((source[range]?.length ?? 0) > 1) return;

    const startMs = Math.max(createdMs, nowMs - days * 86_400_000);
    const points = maxPoints.filter((point) => new Date(point.date).getTime() >= startMs);
    if (points.length > 1) data[range] = points;
  });

  return data;
}

function preferredInitialRange`,
);
source = source.replace(
  /function preferredInitialRange\(data: Partial<Record<TimeRange, ChartPoint\[\]>>\) \{[\s\S]*?\n}\n\nfunction SectionButton/,
  `function preferredInitialRange(data: Partial<Record<TimeRange, ChartPoint[]>>) {
  if ((data["1D"]?.length ?? 0) > 1) return "1D" as TimeRange;
  if ((data["1M"]?.length ?? 0) > 1) return "1M" as TimeRange;
  if ((data["6M"]?.length ?? 0) > 1) return "6M" as TimeRange;
  if ((data["1Y"]?.length ?? 0) > 1) return "1Y" as TimeRange;
  return "MAX" as TimeRange;
}

function SectionButton`,
);
source = replaceAll(
  source,
  "{money(rangeDelta, currency)} {validRangeLabel} · {pct(rangePct)}",
  "{validRange === \"MAX\" ? money(summary.totalPnl, currency) : money(rangeDelta, currency)} {validRangeLabel} · {validRange === \"MAX\" ? pct(summary.totalPnlPct) : pct(rangePct)}",
);
fs.writeFileSync(componentFile, source);
