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
  _createdAt?: string | null,
): Partial<Record<TimeRange, ChartPoint[]>> {
  return Object.fromEntries(
    Object.entries(source).filter(([, points]) => (points?.length ?? 0) > 1),
  ) as Partial<Record<TimeRange, ChartPoint[]>>;
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

function hasChartPoints(data: Partial<Record<TimeRange, ChartPoint[]>>, range: TimeRange) {
  return (data[range]?.length ?? 0) > 1;
}

function SectionButton`,
);
source = replaceAll(
  source,
  "{money(rangeDelta, currency)} {validRangeLabel} · {pct(rangePct)}",
  "{range === \"MAX\" ? money(summary.totalPnl, currency) : money(rangeDelta, currency)} {validRangeLabel} · {range === \"MAX\" ? pct(summary.totalPnlPct) : pct(rangePct)}",
);
fs.writeFileSync(componentFile, source);
