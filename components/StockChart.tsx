"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

export type ChartPoint = {
  date: string;
  close: number;
};

export type TimeRange = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "MAX";

type Props = {
  ticker: string;
  data: Partial<Record<TimeRange, ChartPoint[]>>;
  initialRange?: TimeRange;
  height?: number;
  compact?: boolean;
  color?: string;
};

const RANGES: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"];

function formatPrice(n: number) {
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string, range: TimeRange) {
  const d = new Date(iso);

  if (range === "1D") {
    return d.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "5D") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "1M" || range === "6M") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StockChart({
  ticker,
  data,
  initialRange = "1Y",
  height = 280,
  compact = false,
  color,
}: Props) {
  const [range, setRange] = useState<TimeRange>(initialRange);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const availableRanges = useMemo(
    () => RANGES.filter((r) => (data[r]?.length ?? 0) > 1),
    [data],
  );

  useEffect(() => {
    if ((data[range]?.length ?? 0) < 2 && availableRanges.length > 0) {
      setRange(availableRanges[0]);
    }
  }, [data, range, availableRanges]);

  const points = data[range] ?? [];

  const direction = useMemo(() => {
    if (points.length < 2) return "flat";

    const first = points[0].close;
    const last = points[points.length - 1].close;

    return last >= first ? "up" : "down";
  }, [points]);

  const lineColor =
    color ??
    (direction === "up"
      ? "#10b981"
      : direction === "down"
        ? "#ef4444"
        : "#ddb159");

  const fillColor = `${lineColor}26`;

  const {
    svgWidth,
    padding,
    plotW,
    plotH,
    minPrice,
    maxPrice,
    pathD,
    areaD,
    gridPrices,
  } = useMemo(() => {
    const svgWidth = 800;

    const padding = compact
      ? { top: 8, right: 8, bottom: 8, left: 8 }
      : { top: 16, right: 12, bottom: 32, left: 56 };

    const plotW = svgWidth - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    if (points.length < 2) {
      return {
        svgWidth,
        padding,
        plotW,
        plotH,
        minPrice: 0,
        maxPrice: 0,
        pathD: "",
        areaD: "",
        gridPrices: [] as number[],
      };
    }

    const closes = points.map((p) => p.close);
    let minP = Math.min(...closes);
    let maxP = Math.max(...closes);

    if (minP === maxP) {
      minP -= 1;
      maxP += 1;
    } else {
      const buffer = (maxP - minP) * 0.08;
      minP -= buffer;
      maxP += buffer;
    }

    const xStep = plotW / (points.length - 1);

    const yScale = (price: number) =>
      padding.top + plotH * (1 - (price - minP) / (maxP - minP));

    let pathD = "";
    let areaD = "";

    points.forEach((p, i) => {
      const x = padding.left + i * xStep;
      const y = yScale(p.close);

      if (i === 0) {
        pathD = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
        areaD = `M ${x.toFixed(2)} ${(padding.top + plotH).toFixed(
          2,
        )} L ${x.toFixed(2)} ${y.toFixed(2)}`;
      } else {
        pathD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        areaD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    });

    const lastX = padding.left + (points.length - 1) * xStep;
    areaD += ` L ${lastX.toFixed(2)} ${(padding.top + plotH).toFixed(2)} Z`;

    const gridPrices: number[] = [];

    if (!compact) {
      for (let i = 0; i <= 4; i++) {
        gridPrices.push(minP + ((maxP - minP) * i) / 4);
      }
    }

    return {
      svgWidth,
      padding,
      plotW,
      plotH,
      minPrice: minP,
      maxPrice: maxP,
      pathD,
      areaD,
      gridPrices,
    };
  }, [points, height, compact]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!svgRef.current || points.length < 2) return;

      const rect = svgRef.current.getBoundingClientRect();
      const cursorX = ((clientX - rect.left) / rect.width) * svgWidth;
      const xStep = plotW / (points.length - 1);

      const idx = Math.max(
        0,
        Math.min(
          points.length - 1,
          Math.round((cursorX - padding.left) / xStep),
        ),
      );

      setHoverIdx(idx);
    },
    [points.length, svgWidth, plotW, padding.left],
  );

  const handlePointerLeave = useCallback(() => setHoverIdx(null), []);

  const summary = useMemo(() => {
    if (points.length < 2) return null;

    const first = points[0].close;
    const last = points[points.length - 1].close;
    const change = last - first;
    const changePct = (change / first) * 100;

    return { first, last, change, changePct };
  }, [points]);

  const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;

  const yScale = (price: number) =>
    minPrice === maxPrice
      ? padding.top + plotH / 2
      : padding.top + plotH * (1 - (price - minPrice) / (maxPrice - minPrice));

  const xPos =
    hoverIdx != null
      ? padding.left + (plotW / Math.max(1, points.length - 1)) * hoverIdx
      : 0;

  const yPos = hoverPoint ? yScale(hoverPoint.close) : 0;

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-[#072116]/40"
        style={{ height: `${height}px` }}
      >
        <p className="text-[12px] font-semibold text-[#faf6f0]/40">
          No chart data available
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {!compact && summary && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#faf6f0]/45">
              {ticker} · {range}
            </p>

            <p className="mt-0.5 text-[24px] font-black tabular-nums tracking-[-0.03em] text-[#faf6f0]">
              {formatPrice(hoverPoint ? hoverPoint.close : summary.last)}
            </p>

            {hoverPoint ? (
              <p className="text-[11px] font-semibold text-[#faf6f0]/55">
                {formatDate(hoverPoint.date, range)}
              </p>
            ) : (
              <p
                className={`text-[11px] font-bold ${
                  summary.change >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {summary.change >= 0 ? "+" : ""}
                {formatPrice(summary.change)} (
                {summary.changePct >= 0 ? "+" : ""}
                {summary.changePct.toFixed(2)}%)
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-xl bg-[#072116]/40"
        style={{ height: `${height}px` }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full touch-none"
          onPointerMove={(e) => handleMove(e.clientX)}
          onPointerDown={(e) => handleMove(e.clientX)}
          onPointerLeave={handlePointerLeave}
        >
          {!compact &&
            gridPrices.map((price, i) => {
              const y = yScale(price);

              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    x2={padding.left + plotW}
                    y1={y}
                    y2={y}
                    stroke="#ddb159"
                    strokeOpacity="0.08"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={padding.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#faf6f0"
                    fillOpacity="0.4"
                    fontWeight="600"
                  >
                    {formatPrice(price)}
                  </text>
                </g>
              );
            })}

          <path d={areaD} fill={fillColor} />

          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {hoverPoint && (
            <>
              <line
                x1={xPos}
                x2={xPos}
                y1={padding.top}
                y2={padding.top + plotH}
                stroke="#ddb159"
                strokeOpacity={compact ? "0.55" : "0.4"}
                strokeDasharray="3 3"
              />
              <circle cx={xPos} cy={yPos} r={compact ? "4" : "5"} fill={lineColor} />
              <circle
                cx={xPos}
                cy={yPos}
                r={compact ? "7" : "9"}
                fill={lineColor}
                fillOpacity="0.25"
              />
            </>
          )}

          {!compact && points.length > 2 && (
            <>
              {[0, Math.floor(points.length / 2), points.length - 1].map(
                (idx, i) => {
                  const x = padding.left + (plotW / (points.length - 1)) * idx;
                  const dateText = formatDate(points[idx].date, range);

                  return (
                    <text
                      key={i}
                      x={x}
                      y={height - 10}
                      textAnchor={
                        i === 0 ? "start" : i === 2 ? "end" : "middle"
                      }
                      fontSize="10"
                      fill="#faf6f0"
                      fillOpacity="0.4"
                      fontWeight="600"
                    >
                      {dateText}
                    </text>
                  );
                },
              )}
            </>
          )}
        </svg>

        {hoverPoint && (
          <div
            className={[
              "pointer-events-none absolute rounded-lg border border-[#ddb159]/30 bg-[#072116]/95 backdrop-blur",
              compact
                ? "right-2 top-2 px-2.5 py-1.5"
                : "right-3 top-3 px-3 py-2",
            ].join(" ")}
          >
            <p
              className={[
                "font-bold uppercase tracking-wider text-[#ddb159]/75",
                compact ? "text-[8px]" : "text-[9px]",
              ].join(" ")}
            >
              {formatDate(hoverPoint.date, range)}
            </p>

            <p
              className={[
                "font-black tabular-nums text-[#faf6f0]",
                compact ? "mt-0.5 text-[12px]" : "mt-0.5 text-[14px]",
              ].join(" ")}
            >
              {formatPrice(hoverPoint.close)}
            </p>
          </div>
        )}
      </div>

      {!compact && availableRanges.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {availableRanges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 text-[11px] font-black transition ${
                range === r
                  ? "bg-[#ddb159] text-[#072116]"
                  : "bg-[#072116]/40 text-[#faf6f0]/65 hover:bg-[#072116]/60 hover:text-[#faf6f0]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
