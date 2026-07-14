"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* Self-contained types so the scroll landing doesn't depend on the
   classic landing's visuals module, which changes between redesigns. */
export type DashboardRow = {
  rank: string;
  ticker: string;
  company: string;
  price: string;
  score: string;
  move: string;
  moveUp: boolean;
};

export type LandingMetrics = {
  totalStocks: number;
  bullishPct: number;
  sentiment: string;
  lastUpdatedLabel: string;
};

/* ------------------------------------------------------------------ */
/*  Shared design tokens (cinematic dark app theme)                    */
/* ------------------------------------------------------------------ */

const T = {
  bg: "#050f0a",
  panel: "#0a1811",
  panelSoft: "#0d1d14",
  line: "rgba(255,255,255,0.08)",
  lineSoft: "rgba(255,255,255,0.05)",
  text: "#f4f1e8",
  sub: "rgba(244,241,232,0.55)",
  faint: "rgba(244,241,232,0.34)",
  gold: "#ddb159",
  goldDeep: "#b88a32",
  green: "#34d399",
  red: "#f87171",
};

const FALLBACK_ROWS: DashboardRow[] = [
  { rank: "1", ticker: "NVDA", company: "NVIDIA Corp", price: "$224.38", score: "9,214", move: "+2.6%", moveUp: true },
  { rank: "2", ticker: "MSFT", company: "Microsoft Corp", price: "$460.52", score: "8,906", move: "+0.4%", moveUp: true },
  { rank: "3", ticker: "JPM", company: "JPMorgan Chase", price: "$296.58", score: "8,641", move: "+1.1%", moveUp: true },
  { rank: "4", ticker: "AMZN", company: "Amazon.com Inc", price: "$182.15", score: "8,402", move: "-0.2%", moveUp: false },
  { rank: "5", ticker: "AAPL", company: "Apple Inc", price: "$306.31", score: "8,188", move: "+0.8%", moveUp: true },
];

const EXTRA_ROWS: DashboardRow[] = [
  { rank: "6", ticker: "GOOGL", company: "Alphabet Inc", price: "$376.33", score: "7,954", move: "+0.1%", moveUp: true },
  { rank: "7", ticker: "META", company: "Meta Platforms", price: "$618.40", score: "7,742", move: "-1.3%", moveUp: false },
  { rank: "8", ticker: "V", company: "Visa Inc", price: "$322.09", score: "7,510", move: "+0.6%", moveUp: true },
];

const SECTOR_BY_TICKER: Record<string, string> = {
  NVDA: "Semiconductors",
  MSFT: "Software",
  JPM: "Banking",
  AMZN: "E-Commerce",
  AAPL: "Hardware",
  GOOGL: "Internet",
  META: "Internet",
  V: "Payments",
  MA: "Payments",
  TSLA: "Automotive",
};

function sectorFor(ticker: string) {
  return SECTOR_BY_TICKER[ticker] ?? "Technology";
}

/**
 * Marketing-safe metric labels: when live Supabase data is unavailable the
 * raw metrics come back zeroed ("0% bullish", "Awaiting live update"), which
 * reads as broken on a landing page. Real values always win when present.
 */
export function displayMetrics(metrics: LandingMetrics) {
  const live = metrics.totalStocks > 0;
  return {
    total: live ? metrics.totalStocks.toLocaleString("en-GB") : "500+",
    bullishPct: live ? metrics.bullishPct : 38,
    sentiment: live ? metrics.sentiment : "Healthy market",
    updated:
      live && !metrics.lastUpdatedLabel.startsWith("Awaiting")
        ? metrics.lastUpdatedLabel
        : "today, 06:00",
  };
}

export function buildRankingRows(rows?: DashboardRow[]): DashboardRow[] {
  const base = rows && rows.length > 0 ? rows : FALLBACK_ROWS;
  const seen = new Set(base.map((r) => r.ticker));
  const extras = EXTRA_ROWS.filter((r) => !seen.has(r.ticker));
  return [...base, ...extras].slice(0, 8).map((row, i) => ({
    ...row,
    rank: String(i + 1),
  }));
}

/* ------------------------------------------------------------------ */
/*  FixedScale — render a fixed-size design surface scaled to fit.     */
/*  Keeps every screen pixel-perfect at any viewport / zoom level.     */
/* ------------------------------------------------------------------ */

export function FixedScale({
  w,
  h,
  mode = "contain",
  children,
}: {
  w: number;
  h: number;
  mode?: "contain" | "cover";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      /* clientWidth/Height are layout dims, immune to the ancestor scroll
         transforms (getBoundingClientRect would measure the tilted/scaled
         bounding box and mis-scale the surface) */
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0 || ch === 0) return;
      const s = mode === "cover" ? Math.max(cw / w, ch / h) : Math.min(cw / w, ch / h);
      setScale(s);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [w, h, mode]);

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div
        data-sl-surface
        className="absolute left-1/2 top-1/2"
        style={{
          width: w,
          height: h,
          transform: `translate(-50%, -50%) scale(${scale || 1})`,
          opacity: scale ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small shared pieces                                                */
/* ------------------------------------------------------------------ */

function MoveChip({ move, up, size = 11 }: { move: string; up: boolean; size?: number }) {
  return (
    <span
      className="sl-mono inline-flex items-center justify-center rounded-full border px-2 py-0.5 font-black"
      style={{
        fontSize: size,
        color: up ? T.green : T.red,
        borderColor: up ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)",
        background: up ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
      }}
    >
      {move}
    </span>
  );
}

function ScorePill({ score, hot = false }: { score: string; hot?: boolean }) {
  return (
    <span
      className="sl-mono inline-flex min-w-[64px] items-center justify-center rounded-full px-2.5 py-1 text-[12px] font-black"
      style={{
        color: "#071b11",
        background: hot
          ? "linear-gradient(135deg, #f4d78a 0%, #ddb159 55%, #c99a3e 100%)"
          : "rgba(221,177,89,0.88)",
        boxShadow: hot ? "0 0 22px rgba(221,177,89,0.45)" : "none",
      }}
    >
      {score}
    </span>
  );
}

function Sparkline({ up, seed }: { up: boolean; seed: number }) {
  const paths = [
    "M0 20 C10 18 16 21 24 16 C34 10 42 14 52 9 C62 4 72 8 84 3",
    "M0 17 C12 19 20 12 30 14 C40 16 48 8 58 10 C68 12 76 5 84 6",
    "M0 21 C10 15 18 18 28 12 C38 6 48 12 58 7 C68 2 76 6 84 2",
    "M0 14 C10 18 20 20 30 17 C40 14 50 18 60 13 C70 8 78 10 84 5",
  ];
  const downPaths = [
    "M0 5 C10 8 18 4 28 9 C38 14 48 10 58 15 C68 20 76 17 84 21",
    "M0 8 C12 5 22 12 32 10 C42 8 52 16 62 14 C72 12 78 18 84 19",
  ];
  const d = up ? paths[seed % paths.length] : downPaths[seed % downPaths.length];
  return (
    <svg width="84" height="24" viewBox="0 0 84 24" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={up ? T.green : T.red}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

function NavIcon({ kind }: { kind: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "rankings":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
        </svg>
      );
    case "portfolio":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v9l6.5 4" />
        </svg>
      );
    case "news":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c3 3.5 3 14.5 0 18" />
          <path d="M12 3c-3 3.5-3 14.5 0 18" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z" />
          <path d="M9 11h6" />
        </svg>
      );
    case "watchlist":
      return (
        <svg {...common}>
          <path d="M12 3.5 14.7 9l6 .8-4.4 4.2 1.1 6-5.4-2.9L6.6 20l1.1-6L3.3 9.8l6-.8L12 3.5Z" />
        </svg>
      );
    default:
      return null;
  }
}

/* Shared app shell sidebar so every screen reads as the same product. */
function Sidebar({ active }: { active: string }) {
  const items = [
    { id: "dashboard", label: "Dashboard" },
    { id: "rankings", label: "Rankings" },
    { id: "portfolio", label: "Portfolio" },
    { id: "news", label: "World News" },
    { id: "chat", label: "Ask StockGPT" },
    { id: "watchlist", label: "Watchlist" },
  ];

  return (
    <div
      className="flex h-full w-[216px] shrink-0 flex-col border-r px-4 py-5"
      style={{ borderColor: T.line, background: "#04120b" }}
    >
      <div className="relative h-9 w-[132px]">
        <Image src="/logo.png" alt="StockGPT" fill className="object-contain object-left" sizes="132px" />
      </div>

      <div className="mt-6 space-y-1">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-bold"
              style={{
                color: isActive ? T.gold : T.sub,
                background: isActive ? "rgba(221,177,89,0.10)" : "transparent",
                border: `1px solid ${isActive ? "rgba(221,177,89,0.28)" : "transparent"}`,
              }}
            >
              <NavIcon kind={item.id} />
              {item.label}
            </div>
          );
        })}
      </div>

      <div className="mt-auto rounded-xl border p-3" style={{ borderColor: T.line, background: T.panel }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black"
            style={{ background: "rgba(221,177,89,0.16)", color: T.gold, border: "1px solid rgba(221,177,89,0.3)" }}
          >
            IV
          </div>
          <div>
            <p className="text-[11px] font-black" style={{ color: T.text }}>
              Investor
            </p>
            <p className="text-[9.5px] font-bold" style={{ color: T.faint }}>
              Core access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenTopBar({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b px-7 py-5" style={{ borderColor: T.line }}>
      <div>
        <h3 className="text-[22px] font-black tracking-[-0.03em]" style={{ color: T.text }}>
          {title}
        </h3>
        <p className="mt-1 text-[11.5px] font-bold" style={{ color: T.sub }}>
          {sub}
        </p>
      </div>
      <div className="flex items-center gap-2.5">{right}</div>
    </div>
  );
}

function GhostChip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-[11px] font-black"
      style={{
        color: active ? "#071b11" : T.sub,
        background: active ? T.gold : "rgba(255,255,255,0.03)",
        borderColor: active ? T.gold : T.line,
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  SCREEN 1 — Rankings  (design canvas 1280 × 756)                    */
/* ------------------------------------------------------------------ */

export function RankingsScreen({
  rows,
  metrics,
}: {
  rows?: DashboardRow[];
  metrics: LandingMetrics;
}) {
  const data = buildRankingRows(rows);
  const { total, updated } = displayMetrics(metrics);

  return (
    <div className="flex h-full w-full" style={{ background: T.bg, color: T.text }}>
      <Sidebar active="rankings" />

      <div className="flex min-w-0 flex-1 flex-col">
        <ScreenTopBar
          title="Stock Rankings"
          sub={`${total} US stocks scored across six factors · Updated ${updated}`}
          right={
            <>
              <GhostChip active>Daily run</GhostChip>
              <GhostChip>Export</GhostChip>
            </>
          }
        />

        <div className="flex items-center gap-2 px-7 py-4">
          {["All sectors", "Momentum", "Quality", "Value", "Growth", "Risk", "Income"].map((f, i) => (
            <GhostChip key={f} active={i === 0}>
              {f}
            </GhostChip>
          ))}
          <span className="sl-mono ml-auto text-[11px] font-black" style={{ color: T.faint }}>
            RANKED 1 – 8 OF {total.toUpperCase()}
          </span>
        </div>

        <div className="mx-7 mb-6 flex-1 overflow-hidden rounded-2xl border" style={{ borderColor: T.line, background: T.panel }}>
          <div
            className="grid grid-cols-[64px_1.35fr_130px_110px_90px_110px_100px] items-center border-b px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em]"
            style={{ borderColor: T.line, color: T.faint }}
          >
            <span>Rank</span>
            <span>Company</span>
            <span>Sector</span>
            <span className="text-right">Price</span>
            <span className="text-right">1D</span>
            <span className="text-center">Trend</span>
            <span className="text-right">Score</span>
          </div>

          {data.map((row, i) => (
            <div
              key={row.ticker}
              className="grid grid-cols-[64px_1.35fr_130px_110px_90px_110px_100px] items-center border-b px-5 py-[13px]"
              style={{
                borderColor: T.lineSoft,
                background: i === 0 ? "rgba(221,177,89,0.06)" : "transparent",
              }}
            >
              <span className="sl-mono flex items-center gap-2 text-[13px] font-black" style={{ color: i < 3 ? T.gold : T.faint }}>
                {String(i + 1).padStart(2, "0")}
                {i === 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[8.5px] font-black uppercase tracking-[0.12em]"
                    style={{ background: "rgba(221,177,89,0.16)", color: T.gold, border: "1px solid rgba(221,177,89,0.3)" }}
                  >
                    Top
                  </span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="sl-mono flex h-8 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.line}`, color: T.text }}
                >
                  {row.ticker}
                </span>
                <span className="truncate text-[13px] font-bold" style={{ color: T.sub }}>
                  {row.company}
                </span>
              </span>
              <span className="text-[11px] font-bold" style={{ color: T.faint }}>
                {sectorFor(row.ticker)}
              </span>
              <span className="sl-mono text-right text-[13px] font-black">{row.price}</span>
              <span className="text-right">
                <MoveChip move={row.move} up={row.moveUp} size={10.5} />
              </span>
              <span className="flex justify-center">
                <Sparkline up={row.moveUp} seed={i} />
              </span>
              <span className="flex justify-end">
                <ScorePill score={row.score} hot={i === 0} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SCREEN 2 — Portfolio Builder  (1280 × 756)                         */
/* ------------------------------------------------------------------ */

const DONUT = [
  { label: "Semiconductors", pct: 26, color: "#ddb159" },
  { label: "Software", pct: 22, color: "#34d399" },
  { label: "Financials", pct: 18, color: "#7dd3fc" },
  { label: "Healthcare", pct: 14, color: "#a78bfa" },
  { label: "Consumer", pct: 12, color: "#f9a8d4" },
  { label: "Energy", pct: 8, color: "#fbbf24" },
];

const DONUT_OFFSETS = DONUT.map((_, i) =>
  DONUT.slice(0, i).reduce((sum, seg) => sum - seg.pct, 25),
);

function Donut() {
  const r = 15.9155; // circumference = 100
  return (
    <svg viewBox="0 0 42 42" className="h-[190px] w-[190px]">
      <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5.5" />
      {DONUT.map((seg, i) => (
        <circle
          key={seg.label}
          cx="21"
          cy="21"
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth="5.5"
          strokeDasharray={`${seg.pct - 1.4} ${100 - seg.pct + 1.4}`}
          strokeDashoffset={DONUT_OFFSETS[i]}
          strokeLinecap="round"
        />
      ))}
      <text
        x="21"
        y="20"
        textAnchor="middle"
        fontSize="7"
        fontWeight="900"
        fill={T.text}
        style={{ fontFamily: "inherit" }}
      >
        12
      </text>
      <text x="21" y="26" textAnchor="middle" fontSize="2.6" fontWeight="700" fill="rgba(244,241,232,0.5)">
        HOLDINGS
      </text>
    </svg>
  );
}

const HOLDINGS = [
  { ticker: "NVDA", name: "NVIDIA Corp", pct: 14 },
  { ticker: "MSFT", name: "Microsoft Corp", pct: 12 },
  { ticker: "JPM", name: "JPMorgan Chase", pct: 10 },
  { ticker: "UNH", name: "UnitedHealth", pct: 9 },
  { ticker: "AAPL", name: "Apple Inc", pct: 8 },
];

export function PortfolioScreen() {
  return (
    <div className="flex h-full w-full" style={{ background: T.bg, color: T.text }}>
      <Sidebar active="portfolio" />

      <div className="flex min-w-0 flex-1 flex-col">
        <ScreenTopBar
          title="Portfolio Builder"
          sub="Describe your strategy — StockGPT drafts a weighted allocation from the live rankings"
          right={<GhostChip>Import Trading 212 CSV</GhostChip>}
        />

        <div className="flex min-h-0 flex-1 gap-5 px-7 pb-6 pt-5">
          {/* Builder controls */}
          <div className="flex w-[340px] shrink-0 flex-col rounded-2xl border p-5" style={{ borderColor: T.line, background: T.panel }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: T.gold }}>
              Step 1 · Your profile
            </p>

            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: T.faint }}>
              Risk appetite
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border p-1.5" style={{ borderColor: T.line }}>
              {["Cautious", "Balanced", "Aggressive"].map((r) => (
                <span
                  key={r}
                  className="rounded-lg py-2 text-center text-[10.5px] font-black"
                  style={
                    r === "Balanced"
                      ? { background: T.gold, color: "#071b11" }
                      : { color: T.sub }
                  }
                >
                  {r}
                </span>
              ))}
            </div>

            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: T.faint }}>
              Horizon
            </p>
            <div className="mt-2 flex gap-1.5">
              {["1–2 yrs", "3–5 yrs", "5+ yrs"].map((h, i) => (
                <GhostChip key={h} active={i === 2}>
                  {h}
                </GhostChip>
              ))}
            </div>

            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: T.faint }}>
              Sector tilt
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ["Technology", true],
                ["Healthcare", true],
                ["Financials", true],
                ["Energy", false],
                ["Utilities", false],
              ].map(([s, on]) => (
                <GhostChip key={s as string} active={on as boolean}>
                  {s as string}
                </GhostChip>
              ))}
            </div>

            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: T.faint }}>
              Amount
            </p>
            <div
              className="sl-mono mt-2 rounded-xl border px-4 py-3 text-[16px] font-black"
              style={{ borderColor: T.line, background: "rgba(255,255,255,0.03)" }}
            >
              £10,000
            </div>

            <div
              className="mt-auto flex items-center justify-center gap-2 rounded-xl py-3.5 text-[12px] font-black uppercase tracking-[0.14em]"
              style={{
                background: "linear-gradient(135deg, #f4d78a 0%, #ddb159 55%, #c99a3e 100%)",
                color: "#071b11",
                boxShadow: "0 8px 30px rgba(221,177,89,0.35)",
              }}
            >
              Generate portfolio
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Generated allocation */}
          <div className="flex min-w-0 flex-1 flex-col rounded-2xl border p-5" style={{ borderColor: T.line, background: T.panel }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: T.gold }}>
                Step 2 · Generated allocation
              </p>
              <span
                className="rounded-full border px-3 py-1 text-[10px] font-black"
                style={{ borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)", color: T.green }}
              >
                Balanced · 12 holdings · drafted in 4s
              </span>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 gap-6">
              <div className="flex flex-col items-center justify-center">
                <Donut />
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {DONUT.map((seg) => (
                    <div key={seg.label} className="flex items-center gap-2 text-[10px] font-bold" style={{ color: T.sub }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                      {seg.label}
                      <span className="sl-mono ml-auto font-black" style={{ color: T.text }}>
                        {seg.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                  Top weights
                </p>
                <div className="mt-2 space-y-2">
                  {HOLDINGS.map((h) => (
                    <div key={h.ticker} className="flex items-center gap-3">
                      <span
                        className="sl-mono flex h-7 w-12 shrink-0 items-center justify-center rounded-lg text-[10px] font-black"
                        style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.line}` }}
                      >
                        {h.ticker}
                      </span>
                      <span className="w-[112px] truncate text-[11px] font-bold" style={{ color: T.sub }}>
                        {h.name}
                      </span>
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${h.pct * 6}%`,
                            background: "linear-gradient(90deg, #b88a32, #ddb159)",
                          }}
                        />
                      </div>
                      <span className="sl-mono w-9 text-right text-[11px] font-black">{h.pct}%</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2.5 pt-4">
                  {[
                    ["Expected volatility", "Moderate", T.text],
                    ["Dividend yield", "1.8%", T.green],
                    ["Tech exposure", "46% · watch", T.gold],
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="rounded-xl border p-3" style={{ borderColor: T.line, background: T.panelSoft }}>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: T.faint }}>
                        {label as string}
                      </p>
                      <p className="sl-mono mt-1 text-[14px] font-black" style={{ color: color as string }}>
                        {value as string}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SCREEN 3 — World News  (1280 × 756)                                */
/* ------------------------------------------------------------------ */

const NEWS = [
  {
    lead: true,
    hue: "linear-gradient(135deg, rgba(221,177,89,0.28), rgba(221,177,89,0.06) 60%)",
    edge: "rgba(221,177,89,0.35)",
    category: "Semiconductors",
    title: "AI chip demand outruns supply again — foundries book out through 2027",
    summary: "Data-centre capex guidance keeps climbing across hyperscalers, tightening advanced-node capacity.",
    tickers: [
      { t: "NVDA", m: "+2.6%", up: true },
      { t: "AMD", m: "+1.9%", up: true },
      { t: "TSM", m: "+1.2%", up: true },
    ],
    tag: "High impact",
  },
  {
    hue: "linear-gradient(135deg, rgba(125,211,252,0.22), rgba(125,211,252,0.05) 60%)",
    edge: "rgba(125,211,252,0.3)",
    category: "Rates",
    title: "Fed minutes tilt dovish; banks reprice the curve",
    summary: "Futures now imply two cuts by year-end.",
    tickers: [
      { t: "JPM", m: "+1.1%", up: true },
      { t: "GS", m: "+0.8%", up: true },
    ],
    tag: "Medium impact",
  },
  {
    hue: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.05) 60%)",
    edge: "rgba(52,211,153,0.3)",
    category: "Cloud",
    title: "Enterprise cloud spend stays resilient into Q3",
    summary: "Migration budgets hold despite macro caution.",
    tickers: [
      { t: "MSFT", m: "+0.4%", up: true },
      { t: "AMZN", m: "-0.2%", up: false },
    ],
    tag: "High impact",
  },
  {
    hue: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.05) 60%)",
    edge: "rgba(167,139,250,0.3)",
    category: "Energy",
    title: "Crude slips as OPEC+ signals supply discipline easing",
    summary: "Refiners diverge from producers on the move.",
    tickers: [
      { t: "XOM", m: "-1.4%", up: false },
      { t: "CVX", m: "-0.9%", up: false },
    ],
    tag: "Medium impact",
  },
  {
    hue: "linear-gradient(135deg, rgba(249,168,212,0.18), rgba(249,168,212,0.04) 60%)",
    edge: "rgba(249,168,212,0.28)",
    category: "Consumer",
    title: "Holiday guidance beats across big-box retail",
    summary: "Inventory discipline is protecting margins.",
    tickers: [
      { t: "WMT", m: "+1.7%", up: true },
      { t: "COST", m: "+0.6%", up: true },
    ],
    tag: "Low impact",
  },
];

export function NewsScreen() {
  return (
    <div className="flex h-full w-full" style={{ background: T.bg, color: T.text }}>
      <Sidebar active="news" />

      <div className="flex min-w-0 flex-1 flex-col">
        <ScreenTopBar
          title="World News"
          sub="Global headlines mapped to the tickers and sectors they actually move"
          right={
            <>
              {["Global", "US", "Europe", "Asia"].map((r, i) => (
                <GhostChip key={r} active={i === 0}>
                  {r}
                </GhostChip>
              ))}
              <span className="ml-2 flex items-center gap-1.5 text-[10.5px] font-black" style={{ color: T.green }}>
                <span className="sl-pulse h-2 w-2 rounded-full" style={{ background: T.green }} />
                LIVE
              </span>
            </>
          }
        />

        <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-4 px-7 pb-6 pt-5">
          {NEWS.map((item) => (
            <article
              key={item.title}
              className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border ${item.lead ? "col-span-2" : ""}`}
              style={{ borderColor: T.line, background: T.panel }}
            >
              <div
                className="flex items-start justify-between border-b px-4 pb-3 pt-3.5"
                style={{ background: item.hue, borderColor: T.lineSoft }}
              >
                <span
                  className="rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]"
                  style={{ borderColor: item.edge, color: T.text, background: "rgba(0,0,0,0.25)" }}
                >
                  {item.category}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
                  style={{
                    background: item.tag === "High impact" ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.06)",
                    color: item.tag === "High impact" ? T.green : T.sub,
                  }}
                >
                  {item.tag}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
                <h4
                  className={`font-black leading-snug tracking-[-0.02em] ${item.lead ? "text-[19px]" : "text-[13.5px]"}`}
                  style={{ color: T.text }}
                >
                  {item.title}
                </h4>
                <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-relaxed" style={{ color: T.sub }}>
                  {item.summary}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                  {item.tickers.map((tk) => (
                    <span
                      key={tk.t}
                      className="sl-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black"
                      style={{ borderColor: T.line, background: "rgba(255,255,255,0.03)" }}
                    >
                      {tk.t}
                      <span style={{ color: tk.up ? T.green : T.red }}>{tk.m}</span>
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SCREEN 4 — Ask StockGPT  (1280 × 756)                              */
/* ------------------------------------------------------------------ */

export function ChatScreen() {
  return (
    <div className="flex h-full w-full" style={{ background: T.bg, color: T.text }}>
      <Sidebar active="chat" />

      <div className="flex min-w-0 flex-1 flex-col">
        <ScreenTopBar
          title="Ask StockGPT"
          sub="A research assistant grounded in the same engine that builds the rankings"
          right={
            <>
              <GhostChip>NVDA context loaded</GhostChip>
              <GhostChip active>New chat</GhostChip>
            </>
          }
        />

        <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col px-7 pb-6 pt-5">
          <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
            {/* user */}
            <div className="flex justify-end">
              <div
                className="max-w-[72%] rounded-2xl rounded-br-md border px-4 py-3 text-[13px] font-semibold leading-relaxed"
                style={{ borderColor: T.line, background: "rgba(255,255,255,0.05)" }}
              >
                Compare NVDA and AMD for a 5-year hold. Which score holds up better?
              </div>
            </div>

            {/* assistant */}
            <div className="flex gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                style={{ background: "rgba(221,177,89,0.16)", color: T.gold, border: "1px solid rgba(221,177,89,0.35)" }}
              >
                SG
              </div>
              <div
                className="max-w-[86%] rounded-2xl rounded-tl-md border px-4 py-3.5"
                style={{ borderColor: "rgba(221,177,89,0.2)", background: T.panel }}
              >
                <p className="text-[13px] font-semibold leading-relaxed" style={{ color: "rgba(244,241,232,0.82)" }}>
                  On today&apos;s model run, NVDA holds the stronger long-horizon profile — but the gap
                  is narrower than the headline scores suggest:
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border p-3" style={{ borderColor: T.line, background: T.panelSoft }}>
                    <div className="flex items-center justify-between">
                      <span className="sl-mono text-[11px] font-black">NVDA</span>
                      <ScorePill score="9,214" hot />
                    </div>
                    <p className="mt-2 text-[10.5px] font-semibold leading-relaxed" style={{ color: T.sub }}>
                      Leads on momentum, earnings-revision strength and sector leadership. Valuation is the drag.
                    </p>
                  </div>
                  <div className="rounded-xl border p-3" style={{ borderColor: T.line, background: T.panelSoft }}>
                    <div className="flex items-center justify-between">
                      <span className="sl-mono text-[11px] font-black">AMD</span>
                      <ScorePill score="7,466" />
                    </div>
                    <p className="mt-2 text-[10.5px] font-semibold leading-relaxed" style={{ color: T.sub }}>
                      Better value entry, weaker momentum. Score is more sensitive to data-centre share shifts.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-semibold leading-relaxed" style={{ color: T.faint }}>
                  Research context only — not a recommendation. Check both research pages before acting.
                </p>
              </div>
            </div>

            {/* user */}
            <div className="flex justify-end">
              <div
                className="max-w-[72%] rounded-2xl rounded-br-md border px-4 py-3 text-[13px] font-semibold leading-relaxed"
                style={{ borderColor: T.line, background: "rgba(255,255,255,0.05)" }}
              >
                What would break the NVDA thesis?
              </div>
            </div>

            {/* assistant typing */}
            <div className="flex gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                style={{ background: "rgba(221,177,89,0.16)", color: T.gold, border: "1px solid rgba(221,177,89,0.35)" }}
              >
                SG
              </div>
              <div
                className="max-w-[86%] rounded-2xl rounded-tl-md border px-4 py-3.5 text-[13px] font-semibold leading-relaxed"
                style={{ borderColor: "rgba(221,177,89,0.2)", background: T.panel, color: "rgba(244,241,232,0.82)" }}
              >
                Three things the model watches: hyperscaler capex guidance rolling over, gross-margin
                compression from custom silicon, and a momentum break below the 9,000 score band
                <span className="sl-caret sl-mono" style={{ color: T.gold }}>
                  ▍
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {["Why did JPM jump 3 ranks?", "Stress-test my portfolio", "Explain the risk factor"].map((s) => (
              <span
                key={s}
                className="rounded-full border px-3 py-1.5 text-[10.5px] font-bold"
                style={{ borderColor: T.line, color: T.sub, background: "rgba(255,255,255,0.02)" }}
              >
                {s}
              </span>
            ))}
          </div>

          <div
            className="mt-2.5 flex items-center gap-3 rounded-full border py-2 pl-5 pr-2"
            style={{ borderColor: "rgba(221,177,89,0.3)", background: T.panel }}
          >
            <span className="flex-1 text-[13px] font-semibold" style={{ color: T.faint }}>
              Ask anything about 500+ ranked stocks…
            </span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: T.gold, color: "#071b11" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RankCard — ONE living surface shared by the phone dashboard and    */
/*  slide 2. Everything is driven by the CSS var --t (0 → 1):          */
/*    t = 0  compact mobile card, 298px design width, 4 rows           */
/*    t = 1  desktop table, 900px design width, 8 rows, sector +       */
/*           price columns and a subtitle unfolded                     */
/*  Because both ends are the same DOM, the scroll morph between the   */
/*  phone and the slide never swaps surfaces — it just reflows.        */
/* ------------------------------------------------------------------ */

export const RANK_CARD_W0 = 298;
export const RANK_CARD_W1 = 900;

export function RankCard({ rows, metrics }: { rows: DashboardRow[]; metrics: LandingMetrics }) {
  const { total, updated } = displayMetrics(metrics);
  const reveal = (i: number) => `clamp(0, var(--t, 0) * 3 - ${(0.9 + (i - 4) * 0.35).toFixed(2)}, 1)`;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        width: `calc(${RANK_CARD_W0}px + var(--t, 0) * ${RANK_CARD_W1 - RANK_CARD_W0}px)`,
        borderColor: T.line,
        background: T.panel,
      }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: T.line }}>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: T.text }}>
            Top ranked
          </p>
          <p
            className="truncate text-[10px] font-semibold"
            style={{
              color: T.sub,
              height: "calc(var(--t, 0) * 16px)",
              opacity: "calc(var(--t, 0) * 2 - 1)",
              overflow: "hidden",
            }}
          >
            {total} US stocks scored across six factors · updated {updated}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[8.5px] font-black uppercase tracking-[0.1em]"
          style={{ background: T.gold, color: "#071b11" }}
        >
          Live
        </span>
      </div>

      {rows.map((row, i) => (
        <div
          key={row.ticker}
          className="flex items-center gap-2.5 border-b px-4 last:border-b-0"
          style={{
            borderColor: T.lineSoft,
            height: i < 4 ? 45 : `calc(${reveal(i)} * 45px)`,
            opacity: i < 4 ? 1 : `calc(${reveal(i)})`,
            overflow: "hidden",
          }}
        >
          <span className="sl-mono w-4 shrink-0 text-[11px] font-black" style={{ color: i === 0 ? T.gold : T.faint }}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="sl-mono text-[12px] font-black" style={{ color: T.text }}>
              {row.ticker}
            </p>
            <p className="truncate text-[9px] font-semibold" style={{ color: T.faint }}>
              {row.company}
            </p>
          </div>
          {/* desktop-only columns unfold as the card widens */}
          <span
            className="shrink-0 whitespace-nowrap text-[10px] font-bold"
            style={{
              color: T.faint,
              maxWidth: "calc(var(--t, 0) * 130px)",
              opacity: "calc(var(--t, 0) * 2.5 - 1.4)",
              overflow: "hidden",
            }}
          >
            {sectorFor(row.ticker)}
          </span>
          <span
            className="sl-mono shrink-0 whitespace-nowrap text-right text-[11px] font-black"
            style={{
              color: T.text,
              maxWidth: "calc(var(--t, 0) * 76px)",
              opacity: "calc(var(--t, 0) * 2.5 - 1.4)",
              overflow: "hidden",
            }}
          >
            {row.price}
          </span>
          <MoveChip move={row.move} up={row.moveUp} size={9} />
          <ScorePill score={row.score} hot={i === 0} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PHONE — dashboard screen  (design canvas 330 × 700)                */
/* ------------------------------------------------------------------ */

function PhoneChart() {
  return (
    <svg viewBox="0 0 288 84" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="slPhoneArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 66 C22 62 34 66 52 56 C72 45 86 50 104 40 C122 30 138 36 156 26 C174 17 190 24 208 14 C228 4 250 12 288 4 L288 84 L0 84 Z"
        fill="url(#slPhoneArea)"
      />
      <path
        d="M0 66 C22 62 34 66 52 56 C72 45 86 50 104 40 C122 30 138 36 156 26 C174 17 190 24 208 14 C228 4 250 12 288 4"
        fill="none"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PhoneDashboardScreen({
  metrics,
  rows,
}: {
  metrics: LandingMetrics;
  rows?: DashboardRow[];
}) {
  const data = buildRankingRows(rows).slice(0, 4);
  const { total, bullishPct, sentiment, updated } = displayMetrics(metrics);

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "#04120b", color: T.text }}>
      {/* status bar */}
      <div className="flex items-center justify-between px-7 pb-1 pt-4">
        <span className="sl-mono text-[12px] font-black">9:41</span>
        <span className="flex items-center gap-1.5">
          <svg width="15" height="10" viewBox="0 0 16 11" fill={T.text} aria-hidden="true">
            <rect x="0" y="7" width="3" height="4" rx="0.8" />
            <rect x="4.3" y="5" width="3" height="6" rx="0.8" />
            <rect x="8.6" y="2.5" width="3" height="8.5" rx="0.8" />
            <rect x="12.9" y="0" width="3" height="11" rx="0.8" />
          </svg>
          <svg width="22" height="11" viewBox="0 0 25 12" fill="none" aria-hidden="true">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={T.text} strokeOpacity="0.5" />
            <rect x="2" y="2" width="15" height="8" rx="1.6" fill={T.text} />
            <path d="M23.5 4v4a2 2 0 0 0 0-4Z" fill={T.text} fillOpacity="0.5" />
          </svg>
        </span>
      </div>

      {/* app header */}
      <div className="flex items-center justify-between px-5 pb-2 pt-2">
        <div className="relative h-8 w-[112px]">
          <Image src="/logo.png" alt="StockGPT" fill className="object-contain object-left" sizes="112px" />
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9.5px] font-black uppercase tracking-[0.06em]"
          style={{
            background: "linear-gradient(135deg, #f4d78a 0%, #ddb159 55%, #c99a3e 100%)",
            color: "#071b11",
            boxShadow: "0 4px 16px rgba(221,177,89,0.35)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
            <path
              d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Ask StockGPT
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 px-4 pb-4">
        {/* greeting */}
        <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(221,177,89,0.2)", background: T.panel }}>
          <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: T.gold }}>
            Dashboard
          </p>
          <h2 className="mt-1.5 text-[22px] font-black tracking-[-0.04em]">Welcome back.</h2>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed" style={{ color: T.sub }}>
            {total} stocks ranked · {bullishPct}% bullish · {sentiment.toLowerCase()}
          </p>
        </div>

        {/* metric tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            ["Top ranked", data[0]?.ticker ?? "NVDA", T.gold],
            ["Bullish", `${bullishPct}%`, T.green],
            ["Universe", total, T.text],
            ["Updated", updated.split(",")[0] ?? "today", T.text],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-xl border p-3" style={{ borderColor: T.line, background: T.panel }}>
              <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: T.faint }}>
                {label as string}
              </p>
              <p className="sl-mono mt-1 truncate text-[16px] font-black" style={{ color: color as string }}>
                {value as string}
              </p>
            </div>
          ))}
        </div>

        {/* rankings card — the exact same component the scroll morph
            flies out of the phone and unfolds into slide 2's panel */}
        <div data-sl-zoom style={{ "--t": 0 } as CSSProperties}>
          <RankCard rows={buildRankingRows(rows)} metrics={metrics} />
        </div>

        {/* market chart */}
        <div className="rounded-2xl border p-3.5" style={{ borderColor: T.line, background: T.panel }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: T.faint }}>
                Market overview
              </p>
              <p className="mt-0.5 text-[13px] font-black">S&amp;P 500</p>
            </div>
            <MoveChip move="+0.32%" up size={9.5} />
          </div>
          <div className="mt-2 h-[76px]">
            <PhoneChart />
          </div>
        </div>
      </div>

      {/* bottom tab bar */}
      <div
        className="flex items-center justify-around border-t px-3 pb-5 pt-2.5"
        style={{ borderColor: T.line, background: "#030d08" }}
      >
        {["dashboard", "rankings", "portfolio", "news", "chat"].map((k, i) => (
          <span key={k} style={{ color: i === 0 ? T.gold : T.faint }}>
            <NavIcon kind={k} />
          </span>
        ))}
      </div>
    </div>
  );
}
