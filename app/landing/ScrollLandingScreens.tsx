"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type DashboardRow = {
  rank: string;
  ticker: string;
  company: string;
  sector: string;
  price: string;
  score: string;
  move: string;
  moveUp: boolean;
  rankMove: string;
  confidence: "High" | "Medium";
};

export type LandingMetrics = {
  totalStocks: number;
  bullishPct: number;
  sentiment: string;
  lastUpdatedLabel: string;
};

const T = {
  shell: "#072116",
  shellDeep: "#04180f",
  panel: "#0a2a1d",
  panelDeep: "#061b12",
  cream: "#faf6f0",
  creamWarm: "#fbf4e5",
  ink: "#072116",
  gold: "#ddb159",
  goldLight: "#f2d27a",
  green: "#61d7ab",
  red: "#f1908d",
};

/* One coherent, fictional account powers every landing demo. */
const DEMO_ROWS: DashboardRow[] = [
  { rank: "1", ticker: "VRT", company: "Vertiv Holdings", sector: "Industrials", price: "$154.32", score: "9,284", move: "+2.6%", moveUp: true, rankMove: "▲ 4", confidence: "High" },
  { rank: "2", ticker: "ANET", company: "Arista Networks", sector: "Technology", price: "$128.77", score: "9,106", move: "+1.9%", moveUp: true, rankMove: "▲ 1", confidence: "High" },
  { rank: "3", ticker: "NVDA", company: "NVIDIA", sector: "Technology", price: "$182.46", score: "8,972", move: "+1.4%", moveUp: true, rankMove: "—", confidence: "High" },
  { rank: "4", ticker: "AVGO", company: "Broadcom", sector: "Technology", price: "$312.18", score: "8,744", move: "-0.5%", moveUp: false, rankMove: "▼ 2", confidence: "High" },
  { rank: "5", ticker: "GOOGL", company: "Alphabet", sector: "Communication", price: "$207.63", score: "8,506", move: "+0.8%", moveUp: true, rankMove: "▲ 3", confidence: "Medium" },
  { rank: "6", ticker: "MSFT", company: "Microsoft", sector: "Technology", price: "$496.21", score: "8,331", move: "+0.4%", moveUp: true, rankMove: "—", confidence: "High" },
  { rank: "7", ticker: "JPM", company: "JPMorgan Chase", sector: "Financials", price: "$286.92", score: "8,118", move: "-0.3%", moveUp: false, rankMove: "▼ 1", confidence: "Medium" },
  { rank: "8", ticker: "COST", company: "Costco Wholesale", sector: "Consumer", price: "$1,012.40", score: "7,946", move: "+0.6%", moveUp: true, rankMove: "▲ 2", confidence: "Medium" },
];

export function displayMetrics(metrics: LandingMetrics) {
  const live = metrics.totalStocks > 0;
  return {
    total: live ? metrics.totalStocks.toLocaleString("en-GB") : "503",
    bullishPct: live ? metrics.bullishPct : 42,
    sentiment: live ? metrics.sentiment : "Cautiously bullish",
    updated: live && !metrics.lastUpdatedLabel.startsWith("Awaiting") ? metrics.lastUpdatedLabel : "today, 20:31",
  };
}

export function buildRankingRows() {
  return DEMO_ROWS;
}

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
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;
      setScale(mode === "cover" ? Math.max(cw / w, ch / h) : Math.min(cw / w, ch / h));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [h, mode, w]);

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div
        data-sl-surface
        className="absolute left-1/2 top-1/2"
        style={{
          width: w,
          height: h,
          opacity: scale ? 1 : 0,
          transform: "translate(-50%, -50%) scale(" + (scale || 1) + ")",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const ENTRY_VECTORS = [
  [-88, 46, 112, -54],
  [72, -58, -96, 64],
  [-54, 82, 76, -92],
  [92, 34, -118, -32],
  [-70, -42, 108, 76],
  [56, 76, -72, -96],
  [-94, 12, 124, 24],
  [76, -76, -88, 102],
] as const;

export function fragmentStyle(index: number): CSSProperties {
  const vector = ENTRY_VECTORS[index % ENTRY_VECTORS.length];
  return {
    "--sl-delay": Math.min(index * 0.055, 0.38),
    "--sl-in-x": vector[0] + "px",
    "--sl-in-y": vector[1] + "px",
    "--sl-out-x": vector[2] + "px",
    "--sl-out-y": vector[3] + "px",
    "--sl-rot": (index % 2 === 0 ? -1 : 1) * (2.2 + (index % 3)) + "deg",
  } as CSSProperties;
}

function AppIcon({ kind, className = "size-4" }: { kind: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="15" width="7" height="6" rx="1.5" /></>,
    rankings: <><path d="M4 20V11M10 20V5M16 20v-7M22 20H2" /></>,
    portfolio: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 4" /></>,
    watchlist: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
    alerts: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21h4" /></>,
    news: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
    chat: <path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind] ?? paths.dashboard}
    </svg>
  );
}

function StockMark({ ticker, dark = false }: { ticker: string; dark?: boolean }) {
  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full border text-[8px] font-black"
      style={{
        color: dark ? T.ink : T.goldLight,
        borderColor: dark ? "rgba(7,33,22,.14)" : "rgba(221,177,89,.25)",
        background: dark ? "rgba(7,33,22,.06)" : "rgba(221,177,89,.1)",
      }}
    >
      {ticker.slice(0, 2)}
    </span>
  );
}

const NAV = [
  ["dashboard", "Dashboard"],
  ["rankings", "Rankings"],
  ["portfolio", "Portfolio"],
  ["watchlist", "Watchlist"],
  ["alerts", "Alerts"],
  ["news", "World News"],
  ["settings", "Settings"],
] as const;

function DemoAppShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#072116] text-[#faf6f0]">
      <header data-sl-fragment data-sl-morph-target={active === "rankings" ? "app-header" : undefined} style={fragmentStyle(0)} className="flex h-16 shrink-0 items-center gap-3 border-b border-[#ddb159]/20 bg-[#04180f] px-5 shadow-[0_8px_28px_rgba(0,0,0,.24)]">
        <div className="relative h-12 w-[192px] shrink-0">
          <Image src="/logo.png" alt="StockGPT" fill className="object-contain object-left" sizes="192px" />
        </div>
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#ddb159]/20 bg-[#faf6f0]/[0.045] px-4 text-[11px] font-semibold text-[#faf6f0]/36">
          <AppIcon kind="search" />
          Search stocks, tickers or companies
          <span className="ml-auto rounded-md border border-white/10 px-2 py-0.5 text-[8px]">⌘ K</span>
        </div>
        <div className="flex h-10 items-center gap-2 rounded-full bg-[#ddb159] px-4 text-[10px] font-black text-[#072116]">
          <AppIcon kind="chat" /> Ask StockGPT
        </div>
        <span className="grid size-10 place-items-center rounded-full border border-[#ddb159]/70 text-[#ddb159]"><AppIcon kind="alerts" /></span>
        <span className="grid size-10 place-items-center rounded-full border border-[#ddb159]/70 text-[10px] font-black text-[#ddb159]">AM</span>
      </header>

      <div data-sl-fragment style={fragmentStyle(1)} className="flex h-8 shrink-0 items-center gap-7 overflow-hidden border-b border-[#ddb159]/10 bg-[#061b12] px-5 text-[9px] font-black uppercase tracking-[0.08em] text-[#faf6f0]/58">
        <span className="text-[#ddb159]">Markets</span>
        <span>S&amp;P 500 <b className="ml-1 text-emerald-300">+0.42%</b></span>
        <span>NASDAQ <b className="ml-1 text-emerald-300">+0.67%</b></span>
        <span>DOW <b className="ml-1 text-red-300">-0.11%</b></span>
        <span>VIX <b className="ml-1 text-emerald-300">16.84</b></span>
        <span className="ml-auto flex items-center gap-1.5 text-emerald-300"><i className="size-1.5 rounded-full bg-emerald-400" /> Live</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside data-sl-fragment data-sl-morph-target={active === "rankings" ? "nav" : undefined} style={fragmentStyle(2)} className="w-[178px] shrink-0 border-r border-[#ddb159]/16 bg-[#061b12] px-3 py-4">
          <nav className="space-y-2">
            {NAV.map(([key, label]) => {
              const selected = active === key;
              return (
                <div
                  key={key}
                  className={"relative flex h-10 items-center gap-2.5 rounded-xl border px-3 text-[12px] font-bold " + (selected ? "border-[#ddb159] bg-[#ddb159]/12 text-[#faf6f0]" : "border-transparent text-[#faf6f0]/70")}
                >
                  {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[#ddb159]" />}
                  <span className="text-[#ddb159]"><AppIcon kind={key} className="size-[18px]" /></span>
                  {label}
                </div>
              );
            })}
          </nav>
          <div className="mt-8 rounded-2xl border border-[#ddb159]/16 bg-[#0a2a1d]/55 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Demo account</p>
            <p className="mt-2 text-[11px] font-black">Alex Morgan</p>
            <p className="mt-1 text-[9px] font-semibold text-[#faf6f0]/42">Core member</p>
          </div>
        </aside>
        <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#072116,#051a11)] p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_4%,rgba(221,177,89,.055),transparent_30%)]" />
          <div className="relative h-full min-h-0">{children}</div>
        </section>
      </div>
    </div>
  );
}

function ChangePill({ row }: { row: DashboardRow }) {
  return (
    <span className={"inline-flex min-w-[52px] justify-center rounded-full border px-2 py-1 text-[9px] font-black tabular-nums " + (row.moveUp ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-500" : "border-red-400/25 bg-red-400/10 text-red-500")}>
      {row.move}
    </span>
  );
}

export function RankingsScreen({ metrics }: { metrics: LandingMetrics }) {
  const info = displayMetrics(metrics);
  return (
    <DemoAppShell active="rankings">
      <main className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
        <section data-sl-fragment data-sl-morph-target="briefing" style={fragmentStyle(3)} className="shrink-0 rounded-[24px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,.07),rgba(250,246,240,.022)_46%,rgba(221,177,89,.06))] p-4 shadow-[0_14px_34px_rgba(0,0,0,.18)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ddb159]/24 bg-[#072116]/45 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                <span className="size-1.5 rounded-full bg-[#ddb159]" /> AI Ranking Engine
              </div>
              <h1 className="mt-2 text-[30px] font-black leading-none tracking-[-0.055em]">Stock Rankings</h1>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-[#faf6f0]/46">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Last model run {info.updated}
              </div>
            </div>
            <p className="max-w-[470px] text-right text-[11px] font-semibold leading-5 text-[#faf6f0]/52">
              {info.total} stocks scored across value, quality, momentum, growth, risk and income.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-[minmax(260px,1fr)_120px_120px] gap-2 rounded-[20px] border border-[#ddb159]/16 bg-[#02150d]/62 p-2.5">
            <div className="flex h-10 items-center gap-3 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 text-[11px] font-semibold text-[#faf6f0]/34">
              <AppIcon kind="search" /> Search ticker or company
            </div>
            <div className="grid h-10 place-items-center rounded-2xl bg-[#ddb159] text-[11px] font-black text-[#072116]">Apply</div>
            <div className="grid h-10 place-items-center rounded-2xl border border-white/10 text-[11px] font-black text-white/60">Filters</div>
          </div>
        </section>

        <section data-sl-fragment data-sl-morph-target="rankings-title" style={fragmentStyle(4)} className="flex h-12 shrink-0 items-center justify-between rounded-2xl border border-[#ddb159]/16 bg-[#04180f]/72 px-4">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#ddb159]">How scores work</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[#faf6f0]/48">Six factor families, refreshed from the latest complete market snapshot.</p>
          </div>
          <div className="flex gap-1.5">
            {["Value", "Quality", "Momentum", "Growth", "Risk", "Income"].map((item) => <span key={item} className="rounded-full border border-[#ddb159]/14 px-2.5 py-1 text-[8px] font-black text-[#faf6f0]/52">{item}</span>)}
          </div>
        </section>

        <section data-sl-fragment data-sl-morph-target="rankings" style={fragmentStyle(5)} className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#faf6f0] shadow-[0_14px_36px_rgba(0,0,0,.2)]">
          <div className="grid h-9 grid-cols-[48px_62px_90px_minmax(0,1fr)_92px_82px_82px_68px] items-center bg-[#072116] px-2 text-[9px] font-bold uppercase tracking-wide text-[#faf6f0]">
            {["Rank", "Move", "Ticker", "Company", "Confidence", "Price", "AI Score", "Why"].map((h) => <span key={h} className="px-2">{h}</span>)}
          </div>
          {DEMO_ROWS.map((row, index) => (
            <div data-sl-morph-target={index < 3 ? `rank-row-${index}` : undefined} key={row.ticker} className="grid h-[42px] grid-cols-[48px_62px_90px_minmax(0,1fr)_92px_82px_82px_68px] items-center border-b border-[#072116]/8 px-2 text-[10px] text-[#072116]">
              <span className="px-2 font-bold text-[#072116]/60">{row.rank}</span>
              <span className={"mx-1 inline-flex h-6 items-center justify-center rounded-full border text-[8px] font-black " + (row.rankMove.includes("▲") ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : row.rankMove.includes("▼") ? "border-red-500/20 bg-red-500/10 text-red-700" : "border-[#072116]/10 text-[#072116]/45")}>{row.rankMove}</span>
              <span className="flex items-center gap-2 px-2 font-black"><StockMark ticker={row.ticker} dark />{row.ticker}</span>
              <span className="flex min-w-0 items-center justify-between gap-2 px-2"><b className="truncate">{row.company}</b><ChangePill row={row} /></span>
              <span className="px-2"><i className="rounded-full border border-[#072116]/12 bg-[#072116]/5 px-2 py-1 text-[8px] font-black not-italic">{row.confidence}</i></span>
              <span className="px-2 font-bold tabular-nums">{row.price}</span>
              <span className="mx-2 rounded-full bg-[#ddb159] px-2 py-1 text-center text-[9px] font-black">{row.score}</span>
              <span className="mx-2 grid size-7 place-items-center rounded-full border border-[#072116]/12 text-[9px] font-black">Why</span>
            </div>
          ))}
        </section>
      </main>
    </DemoAppShell>
  );
}

function PortfolioChart() {
  return (
    <svg viewBox="0 0 900 250" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ddb159" stopOpacity=".24" />
          <stop offset="100%" stopColor="#ddb159" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[45, 95, 145, 195].map((y) => <path key={y} d={"M0 " + y + "H900"} stroke="rgba(250,246,240,.07)" strokeDasharray="5 8" />)}
      <path d="M0 216 C55 205 80 212 128 190 C170 171 205 184 252 148 C304 110 340 126 386 116 C430 105 463 136 512 105 C562 73 605 92 648 62 C700 25 742 51 782 39 C824 28 858 44 900 10 L900 250 L0 250Z" fill="url(#portfolioFill)" />
      <path d="M0 216 C55 205 80 212 128 190 C170 171 205 184 252 148 C304 110 340 126 386 116 C430 105 463 136 512 105 C562 73 605 92 648 62 C700 25 742 51 782 39 C824 28 858 44 900 10" fill="none" stroke="#ddb159" strokeWidth="4" strokeLinecap="round" />
      <circle cx="900" cy="10" r="7" fill="#ddb159" stroke="#061b12" strokeWidth="4" />
    </svg>
  );
}

export function PortfolioScreen() {
  return (
    <DemoAppShell active="portfolio">
      <main className="h-full overflow-hidden">
        <section className="relative isolate flex h-full flex-col overflow-hidden rounded-[28px] border border-[#ddb159]/18 px-7 pb-3 pt-5">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(221,177,89,.12),transparent_34%),linear-gradient(180deg,#0a2a1d_0%,#061b12_74%)]" />
          <div data-sl-fragment style={fragmentStyle(3)} className="flex items-start justify-between gap-3">
            <div className="relative flex h-11 w-[300px] items-center rounded-full border border-[#ddb159]/26 bg-[#04140c]/62 px-4 text-[12px] font-black">
              Core Growth <span className="ml-auto text-[#ddb159]">⌄</span>
            </div>
            <div className="flex gap-2">
              <span className="grid size-11 place-items-center rounded-full bg-[#ddb159] text-[20px] font-black text-[#061b12]">+</span>
              <span className="grid size-11 place-items-center rounded-full border border-[#ddb159]/24 text-[#ddb159]"><AppIcon kind="settings" /></span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-8">
            <div data-sl-fragment style={fragmentStyle(4)}>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#faf6f0]/42">Current portfolio value</p>
              <h1 className="mt-2 text-[52px] font-black leading-none tracking-[-0.065em] tabular-nums">£48,372.60</h1>
              <p className="mt-2 text-[14px] font-black tabular-nums text-emerald-300">+£6,842.15 · +16.5%</p>
            </div>
            <div data-sl-fragment style={fragmentStyle(5)} className="flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ddb159]/30 bg-[#ddb159]/10 px-3 py-1.5">
                <i className="size-2 rounded-full bg-emerald-400" />
                <b className="text-[12px] text-[#ddb159]">Health 82/100</b>
                <span className="text-[10px] font-black text-[#faf6f0]/72">Strong</span>
              </span>
              <p className="text-[9px] font-semibold text-[#faf6f0]/42">Updated 8 minutes ago</p>
            </div>
          </div>

          <div data-sl-fragment style={fragmentStyle(6)} className="mt-1 min-h-0 flex-1">
            <PortfolioChart />
          </div>

          <div data-sl-fragment style={fragmentStyle(7)} className="grid h-10 shrink-0 grid-cols-5 items-center border-b border-[#ddb159]/14">
            {["1D", "1M", "6M", "1Y", "All"].map((range, index) => <span key={range} className={"mx-auto grid min-h-9 min-w-9 place-items-center rounded-full px-3 text-[10px] font-black " + (index === 1 ? "bg-[#faf6f0] text-[#061b12]" : "text-[#faf6f0]/45")}>{range}</span>)}
          </div>

          <div data-sl-fragment style={fragmentStyle(8)} className="grid h-11 shrink-0 grid-cols-[1fr_auto] items-stretch">
            <nav className="grid grid-cols-3">
              {["Overview", "Holdings", "Activity"].map((item, index) => <span key={item} className={"relative grid place-items-center text-[11px] font-black " + (index === 0 ? "text-white" : "text-white/40")}>{item}{index === 0 && <i className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-[#ddb159]" />}</span>)}
            </nav>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#ddb159] px-4 py-2 text-[10px] font-black text-[#061b12]">+ Add</span>
              <span className="rounded-full border border-[#ddb159]/24 px-4 py-2 text-[10px] font-black text-[#ddb159]">Manage</span>
            </div>
          </div>
        </section>
      </main>
    </DemoAppShell>
  );
}

const NEWS_ITEMS = [
  { direction: "Positive", source: "Reuters", age: "18m ago", title: "Data-centre investment accelerates as cloud groups lift 2027 spending plans", summary: "Fresh capex guidance supports networking, cooling and semiconductor demand.", tickers: ["VRT", "ANET", "NVDA"] },
  { direction: "Negative", source: "Financial Times", age: "42m ago", title: "Oil retreats as supply expectations outpace summer demand", summary: "Energy producers weaken while transport-sensitive industries gain.", tickers: ["XOM", "CVX"] },
  { direction: "Neutral", source: "Bloomberg", age: "1h ago", title: "Fed officials keep rates steady and leave September options open", summary: "Treasury yields move only modestly after balanced policy language.", tickers: ["JPM", "GS"] },
];

function NewsCard({ item, featured = false }: { item: (typeof NEWS_ITEMS)[number]; featured?: boolean }) {
  return (
    <article className={"rounded-[22px] border border-[#ddb159]/16 bg-[#061b12]/78 p-4 shadow-[0_14px_34px_rgba(0,0,0,.18)] " + (featured ? "min-h-[184px]" : "")}>
      <div className="flex items-center justify-between">
        <span className={"rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] " + (item.direction === "Positive" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : item.direction === "Negative" ? "border-red-400/25 bg-red-400/10 text-red-300" : "border-white/10 bg-white/5 text-white/55")}>{item.direction}</span>
        <span className="text-[9px] font-bold text-white/35">{item.source} · {item.age}</span>
      </div>
      <h3 className={(featured ? "mt-4 text-[19px]" : "mt-3 text-[14px]") + " font-black leading-snug tracking-[-0.025em]"}>{item.title}</h3>
      <p className="mt-2 text-[10px] font-semibold leading-5 text-white/50">{item.summary}</p>
      <div className="mt-3 flex gap-1.5">{item.tickers.map((ticker) => <span key={ticker} className="rounded-full border border-[#ddb159]/15 bg-[#ddb159]/6 px-2 py-1 text-[8px] font-black text-[#ddb159]">{ticker}</span>)}</div>
    </article>
  );
}

export function NewsScreen() {
  return (
    <DemoAppShell active="news">
      <main className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <section data-sl-fragment style={fragmentStyle(3)} className="shrink-0 rounded-[28px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,#061b12,#0b2b1d_58%,#061b12)] p-4 shadow-[0_22px_70px_rgba(0,0,0,.24)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159]">StockGPT Market Briefing</p>
              <h1 className="mt-1 text-[34px] font-black leading-none tracking-[-0.05em]">World News</h1>
              <p className="mt-2 max-w-[580px] text-[10px] font-semibold leading-5 text-white/52">AI-linked market stories, affected stocks and plain-English context. Educational research only.</p>
            </div>
            <div className="grid w-[390px] grid-cols-3 gap-2">
              {[["Latest story", "18m"], ["Articles", "36"], ["Stocks", "128"]].map(([label, value], index) => <div key={label} className="rounded-2xl border border-[#ddb159]/14 bg-[#061b12]/72 px-3 py-3"><p className="text-[7px] font-black uppercase tracking-[0.14em] text-white/35">{label}</p><p className={"mt-1 text-[18px] font-black " + (index === 0 ? "text-[#ddb159]" : "")}>{value}</p></div>)}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_300px] gap-3">
            <div className="rounded-[20px] border border-[#ddb159]/14 bg-[#04180f]/60 p-3">
              <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.15em] text-[#ddb159]"><span>Today&apos;s tone</span><span className="text-white/36">Fresh · 18m ago</span></div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full"><i className="w-[56%] bg-emerald-400" /><i className="w-[27%] bg-white/30" /><i className="w-[17%] bg-red-400" /></div>
              <div className="mt-2 flex justify-between text-[9px] font-black"><span className="text-emerald-300">20 positive</span><span className="text-white/50">10 neutral</span><span className="text-red-300">6 negative</span></div>
            </div>
            <div className="rounded-[20px] border border-[#ddb159]/14 bg-[#04180f]/60 p-3"><p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Feed scope</p><p className="mt-2 text-[9px] font-semibold leading-4 text-white/48">36 curated briefings from 84 recent source articles.</p></div>
          </div>
        </section>

        <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-3">
          <div className="grid min-h-0 grid-rows-[auto_52px_1fr] gap-2">
            <div data-sl-fragment style={fragmentStyle(4)}><NewsCard item={NEWS_ITEMS[0]} featured /></div>
            <div data-sl-fragment style={fragmentStyle(5)} className="grid grid-cols-[1fr_repeat(4,118px)_82px] items-center gap-2 rounded-[20px] border border-[#ddb159]/16 bg-[#061b12]/92 p-2">
              <span className="flex h-9 items-center gap-2 rounded-xl border border-[#ddb159]/14 bg-white/[0.04] px-3 text-[9px] font-semibold text-white/34"><AppIcon kind="search" /> Search ticker or theme</span>
              {["Impact: All", "Industry: All", "Country: All", "Topic: All"].map((item) => <span key={item} className="grid h-9 place-items-center rounded-xl border border-[#ddb159]/14 text-[8px] font-black text-white/55">{item}</span>)}
              <span className="grid h-9 place-items-center rounded-xl bg-[#ddb159] text-[8px] font-black text-[#061b12]">Reset</span>
            </div>
            <div data-sl-fragment style={fragmentStyle(6)} className="grid min-h-0 grid-cols-2 gap-2 overflow-hidden">
              <NewsCard item={NEWS_ITEMS[1]} />
              <NewsCard item={NEWS_ITEMS[2]} />
            </div>
          </div>
          <aside className="grid min-h-0 grid-rows-2 gap-3">
            <section data-sl-fragment style={fragmentStyle(7)} className="rounded-[22px] border border-[#ddb159]/16 bg-[#061b12]/78 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Top affected stocks</p>
              <div className="mt-3 grid gap-2">
                {DEMO_ROWS.slice(0, 4).map((row) => <div key={row.ticker} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-2"><StockMark ticker={row.ticker} /><div><p className="text-[10px] font-black">{row.ticker}</p><p className="text-[8px] text-white/38">{row.company}</p></div><span className="ml-auto text-[9px] font-black text-emerald-300">{row.move}</span></div>)}
              </div>
            </section>
            <section data-sl-fragment style={fragmentStyle(8)} className="rounded-[22px] border border-[#ddb159]/16 bg-[#061b12]/78 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Biggest moves</p>
              <div className="mt-3 rounded-2xl border border-emerald-400/18 bg-emerald-400/8 p-3"><span className="text-[8px] font-black uppercase text-emerald-300">Positive</span><p className="mt-2 text-[11px] font-black leading-5">Cloud capex lifts the AI infrastructure chain.</p></div>
              <div className="mt-2 rounded-2xl border border-red-400/18 bg-red-400/8 p-3"><span className="text-[8px] font-black uppercase text-red-300">Negative</span><p className="mt-2 text-[11px] font-black leading-5">Oil producers soften on supply outlook.</p></div>
            </section>
          </aside>
        </section>
      </main>
    </DemoAppShell>
  );
}

function ChatPrompt({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-[#ddb159]/16 bg-white/[0.035] px-3 py-2.5"><p className="text-[7px] font-black uppercase tracking-[0.13em] text-[#ddb159]/72">{eyebrow}</p><p className="mt-1 text-[10px] font-bold leading-snug text-white/75">{children}</p></div>;
}

export function ChatScreen() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#020805] text-[#fbf4e5]">
      <header data-sl-fragment style={fragmentStyle(0)} className="flex h-16 shrink-0 items-center justify-between border-b border-[#ddb159]/16 bg-[#04140c] px-5">
        <span className="rounded-full border border-[#ddb159]/24 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">← Back</span>
        <div className="text-center"><p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ddb159]">Ask StockGPT</p><p className="mt-1 text-[10px] font-semibold text-white/40">Chat and portfolio intelligence</p></div>
        <span className="rounded-full border border-[#ddb159]/24 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Clear</span>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px] gap-3 overflow-hidden p-3">
        <aside data-sl-fragment style={fragmentStyle(2)} className="min-h-0 overflow-hidden rounded-[26px] border border-[#ddb159]/18 bg-[#06140d] p-3">
          <div className="flex items-center gap-3 border-b border-[#ddb159]/12 px-1 pb-3"><span className="grid size-9 place-items-center rounded-2xl border border-[#ddb159]/35 bg-[#092418] text-[12px] font-black text-[#ddb159]">SG</span><div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#ddb159]">Research modes</p><p className="mt-1 text-[9px] text-white/38">Choose a workspace</p></div></div>
          <div className="mt-3 grid gap-1.5">
            {["Portfolio", "Rankings", "Learn", "Account"].map((mode, index) => <div key={mode} className={"rounded-2xl border px-3 py-2.5 " + (index === 0 ? "border-[#ddb159] bg-[#ddb159]/10" : "border-transparent")}><p className="text-[10px] font-black">{mode}</p><p className="mt-0.5 text-[8px] text-white/36">{["Holdings, alerts, P&L", "Scores, sectors, leaders", "Trading concepts", "Membership and billing"][index]}</p></div>)}
          </div>
          <p className="mt-4 text-[8px] font-black uppercase tracking-[0.15em] text-[#ddb159]">Suggested</p>
          <div className="mt-2 grid gap-2"><ChatPrompt eyebrow="Portfolio coach">Find my weakest holding</ChatPrompt><ChatPrompt eyebrow="Action plan">Trim, hold, sell or buy more</ChatPrompt><ChatPrompt eyebrow="Risk control">Check stop-loss levels</ChatPrompt></div>
        </aside>

        <section data-sl-fragment style={fragmentStyle(3)} className="grid min-h-0 min-w-0 grid-rows-[112px_minmax(0,1fr)_110px] overflow-hidden rounded-[28px] border border-[#ddb159]/18 bg-[#06140d]">
          <header className="border-b border-[#ddb159]/14 px-5 py-4">
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-2xl border border-[#ddb159]/35 bg-[#092418] text-[11px] font-black text-[#ddb159]">SG</span><div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ddb159]">Portfolio intelligence</p><h1 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em]">Ask StockGPT</h1></div></div>
            <p className="mt-3 text-[11px] font-medium text-white/48">Ask naturally. Portfolio and ranking tools load only when needed.</p>
          </header>
          <div className="min-h-0 overflow-hidden px-5 py-4">
            <div className="mx-auto grid max-w-[650px] gap-3">
              <div className="flex justify-start"><div className="max-w-[82%] rounded-[22px] rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] px-4 py-3 text-[#07170f] shadow-[0_16px_40px_rgba(0,0,0,.18)]"><p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#07170f]/42">StockGPT Coach</p><p className="mt-2 text-[11px] font-semibold leading-5">Your Core Growth portfolio is healthy overall. The main watch item is concentration: NVDA and ANET now make up 27.8% together.</p></div></div>
              <div className="flex justify-end"><div className="max-w-[76%] rounded-[22px] rounded-br-md bg-[#ddb159] px-4 py-3 text-[11px] font-bold leading-5 text-[#07170f]">Which holding should I review first, and why?</div></div>
              <div className="flex justify-start"><div className="max-w-[82%] rounded-[22px] rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] px-4 py-3 text-[#07170f]"><p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#07170f]/42">StockGPT Coach</p><p className="mt-2 text-[11px] font-semibold leading-5"><b>Review AVGO first.</b> Its rank slipped two places, momentum weakened, and the position is 11.2% of the portfolio. The long-term quality signal remains strong, so this is a review—not an automatic sell.</p></div></div>
            </div>
          </div>
          <form className="border-t border-[#ddb159]/14 bg-[#04140c]/95 p-4">
            <div className="mx-auto max-w-[680px] rounded-[24px] border border-[#ddb159]/28 bg-[#071b12] p-2 shadow-[0_18px_55px_rgba(0,0,0,.3)]">
              <p className="px-3 py-2 text-[11px] font-medium text-white/32">Ask naturally. Imperfect grammar is fine...</p>
              <div className="flex justify-end gap-2"><span className="rounded-full border border-[#ddb159]/20 px-4 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]/75">Holdings</span><span className="rounded-full bg-[#ddb159] px-5 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#07170f]">Send</span></div>
            </div>
          </form>
        </section>

        <aside data-sl-fragment style={fragmentStyle(4)} className="min-h-0 overflow-hidden rounded-[26px] border border-[#ddb159]/18 bg-[#06140d] p-4">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#ddb159]">Portfolio context</p>
          <h2 className="mt-2 text-[20px] font-black tracking-[-0.04em]">Core Growth</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[#ddb159]/12 bg-white/[0.03] p-3"><p className="text-[7px] uppercase text-white/35">Value</p><p className="mt-1 text-[14px] font-black">£48,373</p></div>
            <div className="rounded-2xl border border-[#ddb159]/12 bg-white/[0.03] p-3"><p className="text-[7px] uppercase text-white/35">Health</p><p className="mt-1 text-[14px] font-black text-[#ddb159]">82/100</p></div>
          </div>
          <p className="mt-4 text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Largest holdings</p>
          <div className="mt-2 grid gap-2">
            {[
              ["NVDA", "14.8%", "£7,158"],
              ["ANET", "13.0%", "£6,288"],
              ["MSFT", "11.7%", "£5,659"],
              ["AVGO", "11.2%", "£5,417"],
            ].map(([ticker, weight, value]) => <div key={ticker} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-2.5"><StockMark ticker={ticker} /><b className="text-[10px]">{ticker}</b><span className="ml-auto text-right"><b className="block text-[9px] text-[#ddb159]">{weight}</b><small className="text-[8px] text-white/35">{value}</small></span></div>)}
          </div>
          <div className="mt-4 rounded-2xl border border-[#ddb159]/16 bg-[#ddb159]/6 p-3"><p className="text-[8px] font-black uppercase tracking-[0.13em] text-[#ddb159]">Active context</p><p className="mt-2 text-[10px] font-semibold leading-5 text-white/55">Portfolio holdings, latest rankings and recent alerts are available to the conversation.</p></div>
        </aside>
      </main>
    </div>
  );
}

function MiniPortfolioChart() {
  return (
    <svg viewBox="0 0 330 88" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="phonePortfolioFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ddb159" stopOpacity=".28" /><stop offset="100%" stopColor="#ddb159" stopOpacity="0" /></linearGradient></defs>
      <path d="M0 76 C30 73 45 80 66 61 C88 43 108 59 132 42 C156 24 178 37 204 25 C232 12 258 22 282 10 C301 1 316 8 330 3 L330 88 L0 88Z" fill="url(#phonePortfolioFill)" />
      <path d="M0 76 C30 73 45 80 66 61 C88 43 108 59 132 42 C156 24 178 37 204 25 C232 12 258 22 282 10 C301 1 316 8 330 3" fill="none" stroke="#ddb159" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function MiniMarketChart() {
  return (
    <svg viewBox="0 0 330 78" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="phoneMarketFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#61d7ab" stopOpacity=".2" /><stop offset="100%" stopColor="#61d7ab" stopOpacity="0" /></linearGradient></defs>
      <path d="M0 62 C34 55 49 64 74 48 C101 31 121 45 148 34 C176 23 198 35 226 20 C258 3 284 19 330 6 L330 78 L0 78Z" fill="url(#phoneMarketFill)" />
      <path d="M0 62 C34 55 49 64 74 48 C101 31 121 45 148 34 C176 23 198 35 226 20 C258 3 284 19 330 6" fill="none" stroke="#61d7ab" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

function PhoneRankingCard({ row, index }: { row: DashboardRow; index: number }) {
  return (
    <article
      data-sl-phone-piece
      data-sl-morph-source={`rank-row-${index}`}
      style={phonePiece(42 + index * 18, 46 + index * 10, 1.5 + index)}
      className="h-[132px] w-[164px] shrink-0 rounded-2xl border border-[#ddb159]/18 bg-[#0b2b1d]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-[#ddb159] text-[12px] font-black text-[#072116]">{row.rank}</span>
        <span className="rounded-full bg-[#ddb159]/14 px-2 py-1 text-[9px] font-black tabular-nums text-[#ddb159]">{row.score}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <StockMark ticker={row.ticker} />
        <div className="min-w-0"><p className="truncate text-[13px] font-black">{row.ticker}</p><p className="truncate text-[9px] font-semibold text-white/42">{row.company}</p></div>
      </div>
      <p className="mt-3 text-[10px] font-bold tabular-nums text-white/62">{row.price}</p>
    </article>
  );
}

const phonePiece = (x: number, y: number, r: number): CSSProperties => ({
  "--phone-x": x + "px",
  "--phone-y": y + "px",
  "--phone-r": r + "deg",
} as CSSProperties);

export function PhoneDashboardScreen() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#072116] text-[#faf6f0]">
      <div data-sl-phone-piece style={phonePiece(-24, -38, -3)} className="flex h-[30px] items-center justify-between bg-[#04180f] px-7 pt-2 text-[12px] font-black">
        <span>9:41</span>
        <span className="flex items-center gap-1.5 text-[9px]">● ◒ ▰</span>
      </div>
      <header data-sl-phone-piece data-sl-morph-source="app-header" style={phonePiece(28, -28, 2)} className="flex h-[56px] items-center gap-2 border-b border-[#ddb159]/14 bg-[#04180f] px-3">
        <div className="relative h-10 w-[118px] shrink-0"><Image src="/logo.png" alt="StockGPT" fill className="object-contain object-left" sizes="118px" /></div>
        <span className="min-w-0 flex-1" />
        <span className="grid size-11 place-items-center rounded-full text-[#ddb159]"><AppIcon kind="search" className="size-5" /></span>
        <span className="grid size-11 place-items-center rounded-full border border-[#ddb159]/28 text-[#ddb159]"><AppIcon kind="settings" className="size-5" /></span>
      </header>

      <div className="absolute inset-x-0 bottom-[88px] top-[86px] overflow-hidden bg-[linear-gradient(180deg,#072116,#051a11)]">
        <div data-sl-phone-scroll className="px-3 pb-10 pt-1 [will-change:transform]">
          <section data-sl-phone-piece data-sl-morph-source="briefing" style={phonePiece(-52, 22, -2)} className="relative overflow-hidden border-b border-[#ddb159]/15 px-1 pb-4 pt-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2"><p className="text-[12px] font-semibold text-[#ddb159]">Good evening, Alex</p><span className="inline-flex items-center gap-1.5 rounded-full border border-[#ddb159]/18 bg-[#072116]/55 px-2 py-1 text-[9px] font-bold text-white/62"><i className="size-1.5 rounded-full bg-white/38" />Markets closed</span></div>
                <h1 className="mt-2 text-[24px] font-black leading-[1.02] tracking-[-0.045em]">Today at a glance</h1>
                <p className="mt-1.5 text-[11px] font-semibold leading-[1.45] text-white/56">Healthy portfolio · VRT remains #1</p>
              </div>
              <span className="mt-0.5 grid h-10 place-items-center rounded-full bg-[#ddb159] px-3 text-[9px] font-black text-[#072116]">Ask StockGPT</span>
            </div>
          </section>

          <section data-sl-phone-piece data-sl-morph-source="portfolio" style={phonePiece(62, 36, 3)} className="relative mt-4 h-[310px] overflow-hidden rounded-[26px] border border-[#ddb159]/24 bg-[linear-gradient(145deg,rgba(15,57,37,.9),rgba(6,28,19,.94))] p-4 shadow-[0_18px_38px_rgba(0,0,0,.2)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Your portfolio</p><h2 className="mt-1 truncate text-[18px] font-black tracking-[-0.04em]">Core Growth</h2></div>
              <span className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black text-[#072116]">Health 82/100</span>
            </div>
            <div className="mt-1.5 flex justify-end"><span className="text-[8px] font-black uppercase tracking-[0.08em] text-white/38">Updated 8m ago</span></div>
            <div className="mt-3 flex items-end justify-between gap-3"><div className="min-w-0"><p className="truncate text-[34px] font-black leading-none tracking-[-0.06em]">£48,373</p><p className="mt-1.5 text-[13px] font-black text-emerald-300">+£6,842 · +16.5%</p></div><span className="shrink-0 rounded-full border border-[#ddb159]/22 bg-[#061b12]/55 px-3 py-2 text-[9px] font-black uppercase tracking-[0.09em] text-[#ddb159]">Open →</span></div>
            <div className="mt-3 h-[94px] overflow-hidden rounded-2xl border border-white/6 bg-[#04180f]/42"><MiniPortfolioChart /></div>
            <div className="mt-2 flex justify-between text-[9px] font-black uppercase tracking-[0.1em] text-white/42"><span>8 holdings · 5 sectors</span><span>Cached history</span></div>
          </section>
          <div data-sl-phone-piece style={phonePiece(-18, 42, -1)} className="mt-3 flex justify-center gap-2"><i className="h-2 w-6 rounded-full bg-[#ddb159]" /><i className="size-2 rounded-full bg-white/20" /><i className="size-2 rounded-full bg-white/20" /></div>

          <div data-sl-phone-piece data-sl-morph-source="rankings-title" style={phonePiece(-44, 54, -2)} className="mb-3 mt-6 flex items-end justify-between px-1"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">AI rankings</p><h2 className="mt-1 text-[20px] font-black tracking-[-0.04em]">Top ranked today</h2></div><span className="min-h-10 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159]">View all →</span></div>
          <div data-sl-phone-rankings data-sl-morph-source="rankings" className="flex gap-3 overflow-hidden pr-7">
            {DEMO_ROWS.slice(0, 3).map((row, index) => <PhoneRankingCard key={row.ticker} row={row} index={index} />)}
          </div>

          <section data-sl-phone-piece style={phonePiece(52, 72, 2)} className="mt-6 px-1">
            <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Market snapshot</p><div className="mt-1 flex items-end gap-2"><h2 className="text-[20px] font-black tracking-[-0.04em]">S&amp;P 500</h2><span className="pb-0.5 text-[11px] font-black text-white/52">6,284.41</span></div></div><span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">+0.42%</span></div>
            <div className="mt-3 h-[102px] overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#071d14]/55 p-2"><MiniMarketChart /></div>
          </section>
        </div>
      </div>

      <nav data-sl-phone-piece data-sl-morph-source="nav" style={phonePiece(0, 48, 0)} aria-label="Primary mobile navigation" className="absolute bottom-[10px] left-[18px] right-[18px] flex h-[68px] items-center justify-between gap-1 rounded-[26px] border border-[#ddb159]/28 bg-[#04180f]/96 px-2 shadow-[0_16px_45px_rgba(0,0,0,.5)]">
        {[{ key: "dashboard", label: "Home" }, { key: "rankings", label: "Rankings" }, { key: "portfolio", label: "Portfolio" }, { key: "alerts", label: "Alerts" }, { key: "news", label: "News" }].map((item, index) => <span key={item.key} className={index === 0 ? "flex h-12 w-[104px] items-center justify-center gap-1.5 rounded-full bg-[#ddb159] px-3 text-[#061b12]" : "grid size-11 place-items-center rounded-full text-white/62"}><AppIcon kind={item.key} className="size-[19px]" />{index === 0 && <b className="text-[11px] font-black">{item.label}</b>}</span>)}
      </nav>
    </div>
  );
}
