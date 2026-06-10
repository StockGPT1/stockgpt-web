import fs from "node:fs";

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

// Make compact portfolio charts blend into their parent instead of creating a visible rectangle.
{
  const path = "components/StockChart.tsx";
  let chart = fs.readFileSync(path, "utf8");

  chart = chart.replace(
    'const fillColor = `${lineColor}26`;',
    'const fillColor = compact ? `${lineColor}12` : `${lineColor}26`;',
  );

  chart = chart.replace(
    `bareOnMobile
            ? "rounded-none bg-transparent sm:rounded-xl sm:bg-[#072116]/40"
            : "rounded-xl bg-[#072116]/40",`,
    `compact
            ? "rounded-none bg-transparent"
            : bareOnMobile
              ? "rounded-none bg-transparent sm:rounded-xl sm:bg-[#072116]/40"
              : "rounded-xl bg-[#072116]/40",`,
  );

  fs.writeFileSync(path, chart);
}

// Correct portfolio intraday chart logic so 1D and longer ranges share the same contribution-adjusted basis.
{
  const path = "lib/portfolio-page-chart.ts";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    /function buildIntradayPortfolioChart\([\s\S]*?\n}\n\nexport async function/,
    `function buildIntradayPortfolioChart({
  chartResults,
  enriched,
  events,
  createdAtMs,
  displayBasis,
  summary,
}: {
  chartResults: TickerChartResult[];
  enriched: EnrichedHolding[];
  events: PortfolioEvent[];
  createdAtMs: number;
  displayBasis: number;
  summary: PortfolioHealthSummary;
}) {
  const holdingMap = new Map(enriched.map((holding) => [holding.ticker, holding]));
  const intradayMap = new Map(chartResults.map((item) => [item.ticker, item.intradayPoints]));
  const nowMs = Date.now();
  const dateSet = new Set<number>([createdAtMs, nowMs]);

  events.forEach((event) => {
    if (event.dateMs >= createdAtMs && event.dateMs <= nowMs) dateSet.add(event.dateMs);
  });

  chartResults.forEach(({ intradayPoints }) => {
    intradayPoints.forEach((point) => {
      const ms = safeDateMs(point.date, 0);
      if (ms >= createdAtMs && ms <= nowMs) dateSet.add(ms);
    });
  });

  const sortedDates = Array.from(dateSet).sort((a, b) => a - b);
  if (sortedDates.length < 2) return [];

  const sortedEvents = [...events].sort((a, b) => a.dateMs - b.dateMs);
  const shares = new Map<string, number>();
  const costBasis = new Map<string, number>();
  let realisedPnl = 0;
  let eventIndex = 0;

  const points: ChartPoint[] = sortedDates.map((dateMs) => {
    while (eventIndex < sortedEvents.length && sortedEvents[eventIndex].dateMs <= dateMs) {
      const event = sortedEvents[eventIndex];
      realisedPnl += toNumber(event.realisedPnlDelta, 0);

      if (event.ticker) {
        if (event.setShares != null) {
          shares.set(event.ticker, Math.max(0, event.setShares));
        } else {
          shares.set(event.ticker, Math.max(0, (shares.get(event.ticker) ?? 0) + toNumber(event.shareDelta, 0)));
        }

        if (event.setCostBasis != null) {
          costBasis.set(event.ticker, Math.max(0, event.setCostBasis));
        } else {
          costBasis.set(event.ticker, Math.max(0, (costBasis.get(event.ticker) ?? 0) + toNumber(event.costDelta, 0)));
        }
      }

      eventIndex += 1;
    }

    let unrealisedPnl = 0;
    shares.forEach((shareCount, ticker) => {
      if (shareCount <= EPSILON) return;
      const fallbackPrice = getFallbackPrice(holdingMap.get(ticker));
      const price = getPriceAtOrBefore(intradayMap.get(ticker) ?? [], dateMs, fallbackPrice);
      unrealisedPnl += shareCount * price - (costBasis.get(ticker) ?? 0);
    });

    return {
      date: new Date(dateMs).toISOString(),
      close: Math.max(0, roundMoney(displayBasis + realisedPnl + unrealisedPnl)),
    };
  });

  points[0] = { ...points[0], close: roundMoney(displayBasis) };
  points[points.length - 1] = {
    ...points[points.length - 1],
    close: Math.max(0, roundMoney(displayBasis + summary.totalPnl)),
  };

  return points;
}

export async function`,
  );

  source = source.replace(
    `const intradayPoints = buildIntradayPortfolioChart({
    chartResults,
    enriched,
    currentCash,
    summary,
  });`,
    `const intradayPoints = buildIntradayPortfolioChart({
    chartResults,
    enriched,
    events,
    createdAtMs,
    displayBasis,
    summary,
  });`,
  );

  fs.writeFileSync(path, source);
}

// Put manage-holding modal into document.body so it covers header, ticker tape, sidebar and mobile nav.
{
  const path = "components/PortfolioCommandCentreRevolut.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    'import { useMemo, useState, useTransition } from "react";',
    'import { useEffect, useMemo, useState, useTransition } from "react";\nimport { createPortal } from "react-dom";',
  );

  source = replaceAll(
    source,
    'if (cashBalance <= Math.max(50, totalValue * 0.01)) return null;\n  function buyIdea',
    'function buyIdea',
  );

  source = source.replace(
    'const [isPending, startTransition] = useTransition();\n  function runTrim',
    'const [isPending, startTransition] = useTransition();\n  const [mounted, setMounted] = useState(false);\n\n  useEffect(() => {\n    setMounted(true);\n  }, []);\n\n  if (!mounted) return null;\n\n  function runTrim',
  );

  source = source.replace(
    'return (\n    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#020805] p-3 sm:p-6">',
    'return createPortal(\n    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#072116] p-3 sm:p-6">',
  );

  source = source.replace(
    '    </div>\n  );\n}\n\nfunction MiniMetric',
    '    </div>,\n    document.body,\n  );\n}\n\nfunction MiniMetric',
  );

  source = source.replace(
    'const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));\n\n  return (',
    'const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));\n  const decision = buildHoldingDecision(holding);\n  const actionLabel = decision.action === "trim" ? "Trim " + decision.percent + "%" : decision.action === "exit" ? "Exit" : decision.action === "add" ? "Add" : decision.action === "review" ? "Review" : "Hold";\n\n  return (',
  );

  source = source.replace(
    '<button type="button" onClick={() => setOpen(true)} aria-label={`Manage ${holding.ticker}`} className="grid size-9 min-w-0 place-items-center rounded-full bg-[#072116] text-[#ddb159] transition hover:brightness-110 sm:h-9 sm:w-full sm:px-4">',
    '<div className="flex min-w-0 items-center justify-end gap-1">\n          <span className={["hidden h-8 items-center justify-center rounded-full px-2 text-[9px] font-black uppercase tracking-[0.08em] sm:inline-flex", decision.tone === "positive" ? "bg-emerald-500/12 text-emerald-700" : decision.tone === "negative" ? "bg-red-500/10 text-red-700" : "bg-[#072116]/6 text-[#072116]/45"].join(" ")}>{actionLabel}</span>\n          <button type="button" onClick={() => setOpen(true)} aria-label={`Manage ${holding.ticker}`} className="grid size-9 min-w-0 shrink-0 place-items-center rounded-full bg-[#072116] text-[#ddb159] transition hover:brightness-110">',
  );

  source = source.replace(
    '          <span className="hidden text-[10px] font-black uppercase tracking-[0.08em] sm:inline">Manage</span>\n        </button>',
    '          <span className="sr-only">Manage</span>\n          </button>\n        </div>',
  );

  fs.writeFileSync(path, source);
}
