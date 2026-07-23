"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StockLogo } from "@/components/StockLogo";
import type { ExtendedHolding } from "@/components/PortfolioCommandCentreRevolut";
import type { ExposureView } from "@/components/portfolio-workspace/types";
import {
  clamp,
  money,
  number,
  signedMoney,
  signedPct,
  statusForHolding,
  statusTone,
  toneClass,
} from "@/components/portfolio-workspace/utils";

export function HoldingLedgerRow({
  holding,
  currency,
  riskTolerance,
  onOpen,
  compact = false,
}: {
  holding: ExtendedHolding;
  currency: string;
  riskTolerance: string | null;
  onOpen: (holding: ExtendedHolding) => void;
  compact?: boolean;
}) {
  const status = statusForHolding(holding, riskTolerance);
  const priceAvailable = holding.currentPrice > 0 || holding.shares <= 0;
  const visualAllocation = priceAvailable
    ? clamp(
        holding.currentAllocationPct,
        holding.currentAllocationPct > 0 ? 0.35 : 0,
        100,
      )
    : 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(holding)}
      aria-label={`Open holding ${holding.ticker}, ${holding.currentAllocationPct.toFixed(1)}% allocation, ${status}`}
      className={`group block w-full border-b border-[#faf6f0]/8 text-left transition hover:bg-[#faf6f0]/[0.025] focus-visible:bg-[#faf6f0]/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ddb159] ${
        compact ? "px-0 py-4" : "px-0 py-5 sm:px-1"
      }`}
    >
      <span className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3">
        <StockLogo ticker={holding.ticker} company={holding.company} size={44} />
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-black tracking-[-0.02em] text-[#faf6f0]">
            {holding.company || holding.ticker}
          </span>
          <span className="mt-1 block truncate text-[11px] font-bold text-[#faf6f0]/42">
            {holding.ticker} · {number(holding.shares, 6)} shares
          </span>
        </span>
        <span className="min-w-[92px] text-right">
          <span className="block text-[16px] font-black tabular-nums text-[#faf6f0]">
            {priceAvailable ? money(holding.currentValue, currency) : "—"}
          </span>
          <span className={`mt-1 block text-[11px] font-black tabular-nums ${toneClass(holding.totalPnLDollars)}`}>
            {priceAvailable
              ? `${signedMoney(holding.totalPnLDollars, currency)} · ${signedPct(holding.pnlPercent)}`
              : "Price unavailable"}
          </span>
        </span>
      </span>

      <span className="mt-4 flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-[10px] font-black text-[#ddb159]">
          AI #{holding.rank ?? "—"} · {Math.round(holding.score).toLocaleString("en-GB")}
        </span>
        <span className={`shrink-0 text-[10px] font-black ${statusTone(status)}`}>{status}</span>
      </span>

      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-[#faf6f0]/9">
        <span
          className="block h-full rounded-full bg-[linear-gradient(90deg,#b7842f,#ddb159_55%,#f2d27a)]"
          style={{ width: `${visualAllocation}%` }}
        />
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-3 text-[10px] font-bold text-[#faf6f0]/36">
        <span>{priceAvailable ? `${holding.currentAllocationPct.toFixed(1)}%` : "Unavailable"}</span>
        <span>of total portfolio</span>
      </span>
    </button>
  );
}

export function PortfolioExposureView({
  holdings,
  riskTolerance,
  currency,
  initialView = "map",
  showToggle = true,
  onSelect,
}: {
  holdings: ExtendedHolding[];
  riskTolerance: string | null;
  currency: string;
  initialView?: ExposureView;
  showToggle?: boolean;
  onSelect: (holding: ExtendedHolding) => void;
}) {
  const [view, setView] = useState<ExposureView>(initialView);
  const usable = useMemo(
    () => holdings.filter((holding) => holding.currentPrice > 0 && holding.currentValue > 0),
    [holdings],
  );
  const missing = holdings.filter(
    (holding) => holding.shares > 0 && holding.currentPrice <= 0,
  );

  if (holdings.length === 0) {
    return (
      <div className="border-y border-[#faf6f0]/8 py-10 text-center">
        <p className="text-[16px] font-black text-[#faf6f0]">No holdings to map yet</p>
        <p className="mt-2 text-[12px] font-semibold text-[#faf6f0]/44">
          Add a holding to see conviction, exposure and concentration together.
        </p>
      </div>
    );
  }

  return (
    <div>
      {showToggle && (
        <div className="mb-4 flex justify-end">
          <div className="inline-grid grid-cols-2 rounded-full border border-[#ddb159]/18 bg-[#04140c]/62 p-1">
            {(["map", "treemap"] as ExposureView[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                aria-pressed={view === item}
                className={`min-h-9 rounded-full px-4 text-[10px] font-black capitalize transition ${
                  view === item
                    ? "bg-[#ddb159] text-[#061b12]"
                    : "text-[#faf6f0]/48 hover:text-[#faf6f0]"
                }`}
              >
                {item === "map" ? "Conviction map" : "Allocation"}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "map" ? (
        <ConvictionMap holdings={usable} riskTolerance={riskTolerance} onSelect={onSelect} />
      ) : (
        <AllocationTreemap holdings={usable} currency={currency} onSelect={onSelect} />
      )}

      {missing.length > 0 && (
        <div className="mt-4 border-l-2 border-[#f1908d]/45 pl-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#f1908d]">
            Not plotted
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/44">
            {missing.map((holding) => holding.ticker).join(", ")} {missing.length === 1 ? "has" : "have"} no reliable current price.
          </p>
        </div>
      )}
    </div>
  );
}

function ConvictionMap({
  holdings,
  riskTolerance,
  onSelect,
}: {
  holdings: ExtendedHolding[];
  riskTolerance: string | null;
  onSelect: (holding: ExtendedHolding) => void;
}) {
  const points = useMemo(() => {
    const scores = holdings.map((holding) => holding.score);
    const minScore = Math.min(...scores, 0);
    const maxScore = Math.max(...scores, minScore + 1);
    const maxAllocation = Math.max(...holdings.map((holding) => holding.currentAllocationPct), 1);
    return holdings.map((holding, index) => {
      const x = 8 + (holding.currentAllocationPct / maxAllocation) * 82;
      const y = 86 - ((holding.score - minScore) / (maxScore - minScore)) * 72;
      const size = clamp(44 + Math.sqrt(Math.max(holding.currentValue, 0)) * 0.45, 48, 78);
      const jitterX = ((index % 3) - 1) * 1.1;
      const jitterY = ((index % 2) - 0.5) * 1.4;
      return {
        holding,
        x: clamp(x + jitterX, 8, 92),
        y: clamp(y + jitterY, 11, 87),
        size,
      };
    });
  }, [holdings]);

  return (
    <div>
      <div
        className="relative h-[380px] overflow-hidden border-y border-[#faf6f0]/8 bg-[linear-gradient(180deg,rgba(97,215,171,0.028),transparent_47%,rgba(241,144,141,0.026))] lg:h-[510px] lg:rounded-[20px] lg:border lg:border-[#ddb159]/14"
        role="group"
        aria-label="Holdings mapped by allocation and AI conviction"
      >
        <div className="absolute inset-x-[8%] top-1/2 h-px bg-[#faf6f0]/7" />
        <div className="absolute inset-y-[10%] left-1/2 w-px bg-[#faf6f0]/7" />
        {/* exactly two axis labels — one per axis, no corner clutter */}
        {/* label is rotated -90°, so a "→" glyph ends up pointing up */}
        <span className="absolute left-3 top-1/2 origin-center -translate-y-1/2 -rotate-90 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/38">
          Model conviction →
        </span>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/38">
          Allocation size →
        </span>

        {points.map(({ holding, x, y, size }) => {
          const status = statusForHolding(holding, riskTolerance);
          const review = status === "Review" || status === "Review size" || status === "Oversized";
          const fill =
            holding.pnlPercent > 0.1
              ? "bg-[#61d7ab]/18 text-[#9de9cc]"
              : holding.pnlPercent < -0.1
                ? "bg-[#f1908d]/18 text-[#ffc0bd]"
                : "bg-[#ddb159]/14 text-[#f2d27a]";
          return (
            <button
              key={holding.ticker}
              type="button"
              onClick={() => onSelect(holding)}
              aria-label={`${holding.ticker}, ${holding.currentAllocationPct.toFixed(1)}% allocation, AI score ${Math.round(holding.score)}, ${status}`}
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[10px] font-black shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur transition hover:z-30 hover:scale-110 focus-visible:z-30 focus-visible:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#faf6f0] ${fill} ${
                review ? "border-[#e8bd61]/65" : "border-[#faf6f0]/18"
              }`}
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
            >
              {holding.ticker}
            </button>
          );
        })}
      </div>

      <details className="mt-3 text-[11px] text-[#faf6f0]/44">
        <summary className="cursor-pointer py-2 font-black text-[#ddb159] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">
          Accessible map data
        </summary>
        <ul className="divide-y divide-[#faf6f0]/8 border-y border-[#faf6f0]/8">
          {holdings
            .slice()
            .sort((a, b) => b.currentAllocationPct - a.currentAllocationPct)
            .map((holding) => (
              <li key={holding.ticker}>
                <button
                  type="button"
                  onClick={() => onSelect(holding)}
                  className="flex min-h-11 w-full items-center justify-between gap-4 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
                >
                  <span className="font-black text-[#faf6f0]">{holding.ticker}</span>
                  <span>{holding.currentAllocationPct.toFixed(1)}% · AI {Math.round(holding.score).toLocaleString("en-GB")}</span>
                </button>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}

type TreemapRect = { x: number; y: number; w: number; h: number };

/* Squarified treemap (Bruls et al.): lays each value out so tile AREA is
   exactly proportional to it, keeping tiles as close to square as the
   packing allows. Values must be normalised so their sum equals the
   rect's area; `out` is filled by original index. */
function squarify(
  values: Array<{ index: number; area: number }>,
  rect: TreemapRect,
  out: TreemapRect[],
) {
  if (values.length === 0) return;
  if (values.length === 1) {
    out[values[0].index] = rect;
    return;
  }

  const horizontal = rect.w >= rect.h;
  const side = horizontal ? rect.h : rect.w;
  let bestCount = 1;
  let bestWorst = Infinity;
  let sum = 0;

  for (let count = 1; count <= values.length; count++) {
    sum += values[count - 1].area;
    const thickness = sum / side;
    if (thickness <= 0) break;
    let worst = 0;
    for (let i = 0; i < count; i++) {
      const length = values[i].area / thickness;
      worst = Math.max(worst, Math.max(thickness / length, length / thickness));
    }
    if (worst <= bestWorst) {
      bestWorst = worst;
      bestCount = count;
    } else {
      break;
    }
  }

  const rowSum = values.slice(0, bestCount).reduce((total, value) => total + value.area, 0);
  const thickness = rowSum / side;
  let offset = 0;
  for (let i = 0; i < bestCount; i++) {
    const length = values[i].area / thickness;
    out[values[i].index] = horizontal
      ? { x: rect.x, y: rect.y + offset, w: thickness, h: length }
      : { x: rect.x + offset, y: rect.y, w: length, h: thickness };
    offset += length;
  }

  squarify(
    values.slice(bestCount),
    horizontal
      ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h }
      : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness },
    out,
  );
}

const TREEMAP_W = 100;

function AllocationTreemap({
  holdings,
  currency,
  onSelect,
}: {
  holdings: ExtendedHolding[];
  currency: string;
  onSelect: (holding: ExtendedHolding) => void;
}) {
  /* The squarify row/column decisions depend on the canvas shape, so the
     layout must run in the container's REAL aspect ratio. A fixed wide
     canvas stretched into the near-square mobile container produced
     distorted strips whose areas no longer read as proportional. */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) setSize({ w: clientWidth, h: clientHeight });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const aspect = size ? size.w / size.h : 100 / 62;
  const treemapH = TREEMAP_W / aspect;
  const sorted = holdings
    .slice()
    .sort((a, b) => Math.max(b.currentValue, 0) - Math.max(a.currentValue, 0));
  const weights = sorted.map((holding) =>
    holding.currentValue > 0
      ? holding.currentValue
      : Math.max(holding.currentAllocationPct, 0.01),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const rects: TreemapRect[] = new Array(sorted.length);
  squarify(
    weights.map((weight, index) => ({
      index,
      area: (weight / totalWeight) * TREEMAP_W * treemapH,
    })),
    { x: 0, y: 0, w: TREEMAP_W, h: treemapH },
    rects,
  );

  return (
    <div
      ref={containerRef}
      className="relative h-[380px] border-y border-[#faf6f0]/8 lg:h-[510px] lg:rounded-[20px] lg:border lg:border-[#ddb159]/14"
      role="group"
      aria-label="Holdings sized by market value"
    >
      {sorted.map((holding, index) => {
        const rect = rects[index];
        if (!rect) return null;
        /* real pixel dimensions decide how much text fits — fractions
           mean different physical sizes at different aspect ratios */
        const pxW = size ? (rect.w / TREEMAP_W) * size.w : 0;
        const pxH = size ? (rect.h / treemapH) * size.h : 0;
        const showCompany = pxW > 120 && pxH > 96;
        const showFooter = pxW > 104 && pxH > 84;
        const showTicker = pxW > 40 && pxH > 26;
        return (
          <button
            key={holding.ticker}
            type="button"
            onClick={() => onSelect(holding)}
            aria-label={`${holding.ticker}, ${money(holding.currentValue, currency)}, ${holding.currentAllocationPct.toFixed(1)}% of portfolio`}
            style={{
              left: `${(rect.x / TREEMAP_W) * 100}%`,
              top: `${(rect.y / treemapH) * 100}%`,
              width: `${(rect.w / TREEMAP_W) * 100}%`,
              height: `${(rect.h / treemapH) * 100}%`,
            }}
            className="group absolute overflow-hidden p-[3px] text-left focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]"
          >
            <span className="relative flex h-full w-full flex-col overflow-hidden rounded-[12px] border border-[#ddb159]/14 bg-[#0a2a1d] p-2.5 transition group-hover:border-[#ddb159]/38 group-hover:bg-[#0c3021] sm:p-3">
              {showTicker && (
                <span className="block truncate text-[13px] font-black text-[#faf6f0] sm:text-[15px]">
                  {holding.ticker}
                </span>
              )}
              {showCompany && (
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#faf6f0]/38">
                  {holding.company}
                </span>
              )}
              {showFooter && (
                <span className="mt-auto flex items-end justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-black tabular-nums text-[#ddb159] sm:text-[16px]">
                      {money(holding.currentValue, currency)}
                    </span>
                    <span className="block text-[9px] font-black tabular-nums text-[#faf6f0]/45">
                      {holding.currentAllocationPct.toFixed(1)}%
                    </span>
                  </span>
                  <span className={`shrink-0 text-[10px] font-black ${toneClass(holding.totalPnLDollars)}`}>
                    {signedPct(holding.pnlPercent)}
                  </span>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
