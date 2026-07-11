"use client";

import Image from "next/image";

export type LandingVisualMetrics = {
  totalStocks: number;
  bullishPct: number;
  sentiment: string;
  lastUpdatedLabel: string;
};

export type DashboardRow = {
  rank: string;
  ticker: string;
  company: string;
  price: string;
  score: string;
  move: string;
  moveUp: boolean;
};

type MoverRow = {
  ticker: string;
  move: string;
  moveUp: boolean;
};

const dashboardRows: DashboardRow[] = [
  {
    rank: "1",
    ticker: "NVDA",
    company: "NVIDIA Corp",
    price: "$224.38",
    score: "9,214",
    move: "+2.6%",
    moveUp: true,
  },
  {
    rank: "2",
    ticker: "MSFT",
    company: "Microsoft Corp",
    price: "$460.52",
    score: "8,906",
    move: "+0.4%",
    moveUp: true,
  },
  {
    rank: "3",
    ticker: "JPM",
    company: "JPMorgan Chase",
    price: "$296.58",
    score: "8,641",
    move: "+1.1%",
    moveUp: true,
  },
  {
    rank: "4",
    ticker: "AMZN",
    company: "Amazon.com Inc",
    price: "$182.15",
    score: "8,402",
    move: "-0.2%",
    moveUp: false,
  },
  {
    rank: "5",
    ticker: "AAPL",
    company: "Apple Inc",
    price: "$306.31",
    score: "8,188",
    move: "+0.8%",
    moveUp: true,
  },
  {
    rank: "6",
    ticker: "GOOGL",
    company: "Alphabet Inc",
    price: "$376.33",
    score: "7,954",
    move: "+0.1%",
    moveUp: true,
  },
];

const moverRows: MoverRow[] = [
  { ticker: "PLTR", move: "+4.8%", moveUp: true },
  { ticker: "META", move: "-3.4%", moveUp: false },
  { ticker: "MA", move: "+0.8%", moveUp: true },
];

function stockCountLabel(metrics: LandingVisualMetrics) {
  return metrics.totalStocks > 0
    ? metrics.totalStocks.toLocaleString("en-GB")
    : "500+";
}

function MiniLineChart() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#fbfaf6]">
      <svg
        viewBox="0 0 520 150"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="portfolioArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f9f5d" stopOpacity="0.24" />
            <stop offset="70%" stopColor="#0f9f5d" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0f9f5d" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M0 122 C34 116 52 118 78 108 C108 96 132 103 158 88 C184 73 208 78 236 64 C262 51 284 61 310 48 C338 34 364 45 392 29 C424 12 454 24 520 8 L520 150 L0 150 Z"
          fill="url(#portfolioArea)"
        />

        <path
          d="M0 122 C34 116 52 118 78 108 C108 96 132 103 158 88 C184 73 208 78 236 64 C262 51 284 61 310 48 C338 34 364 45 392 29 C424 12 454 24 520 8"
          fill="none"
          stroke="#0f9f5d"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <path d="M0 126 H520" stroke="#072116" strokeOpacity="0.08" strokeWidth="1" />
        <path d="M0 92 H520" stroke="#072116" strokeOpacity="0.06" strokeWidth="1" />
        <path d="M0 58 H520" stroke="#072116" strokeOpacity="0.06" strokeWidth="1" />
        <path d="M0 24 H520" stroke="#072116" strokeOpacity="0.05" strokeWidth="1" />
      </svg>
    </div>
  );
}

function DashboardMiniCard({
  label,
  main,
  sub,
  tone = "gold",
}: {
  label: string;
  main: string;
  sub: string;
  tone?: "gold" | "green" | "plain";
}) {
  return (
    <div className="rounded-2xl border border-[#072116]/10 bg-[#faf6f0] p-3 shadow-[0_8px_18px_rgba(7,33,22,0.06)]">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#072116]/50">
        {label}
      </p>
      <p
        className={[
          "mt-1 truncate text-[17px] font-black leading-none tracking-[-0.03em]",
          tone === "green"
            ? "text-emerald-700"
            : tone === "plain"
              ? "text-[#072116]"
              : "text-[#b88a32]",
        ].join(" ")}
      >
        {main}
      </p>
      <p className="mt-1 truncate text-[9px] font-bold text-[#072116]/42">{sub}</p>
    </div>
  );
}

function RealDashboardScreen({
  metrics,
  rows,
}: {
  metrics: LandingVisualMetrics;
  rows?: DashboardRow[];
}) {
  const rankingRows = rows && rows.length > 0 ? rows : dashboardRows;

  return (
    <div className="h-[650px] w-[330px] overflow-hidden bg-[#072116] text-[#faf6f0]">
      <div className="flex h-[56px] items-center justify-between border-b border-[#ddb159]/18 bg-[#04180f] px-4">
        <div className="relative h-9 w-[128px]">
          <Image
            src="/logo.png"
            alt="StockGPT"
            fill
            className="object-contain object-left"
            sizes="128px"
          />
        </div>
        <div className="h-8 w-8 rounded-full border border-[#ddb159]/26 bg-[#ddb159]/10" />
      </div>

      <div className="h-[594px] overflow-hidden">
        <div className="sg-phone-scroll space-y-3 p-3">
          <div className="rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0]/[0.035] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Dashboard
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">
              Welcome back.
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#faf6f0]/52">
              Your rankings, market overview and research tools in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DashboardMiniCard label="Top Ranked" main="Locked" sub="account unlock" />
            <DashboardMiniCard
              label="Bullish %"
              main={`${metrics.bullishPct}%`}
              sub={metrics.sentiment}
              tone="green"
            />
            <DashboardMiniCard
              label="Total"
              main={stockCountLabel(metrics)}
              sub="stocks ranked"
            />
            <DashboardMiniCard
              label="Updated"
              main={metrics.lastUpdatedLabel.split(",")[0] ?? metrics.lastUpdatedLabel}
              sub="latest model run"
              tone="plain"
            />
          </div>

          <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)]">
            <div className="flex h-[62px] items-start justify-between border-b border-[#072116]/10 px-4 py-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#072116]/55">
                  Rankings
                </p>
                <h3 className="mt-1 text-[17px] font-black leading-none tracking-[-0.04em]">
                  Top 10 Ranked Stocks
                </h3>
              </div>
              <span className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[9px] font-black text-[#072116]">
                Unlock
              </span>
            </div>

            <div className="grid grid-cols-[32px_minmax(0,1fr)_72px_62px] bg-[#072116] px-3 py-2 text-[8px] font-black uppercase tracking-wide text-[#faf6f0]">
              <div>#</div>
              <div>Ticker</div>
              <div className="text-right">Price</div>
              <div className="text-right">Score</div>
            </div>

            <div className="divide-y divide-[#072116]/8">
              {rankingRows.slice(0, 5).map((stock) => (
                <div
                  key={stock.ticker}
                  className="grid min-h-[45px] grid-cols-[32px_minmax(0,1fr)_72px_62px] items-center gap-1 px-3 py-2 text-[11px]"
                >
                  <div className="font-bold tabular-nums text-[#072116]/65">
                    {stock.rank}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-black">{stock.ticker}</p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">
                        {stock.company}
                      </p>
                      <span
                        className={[
                          "inline-flex h-4 min-w-[38px] items-center justify-center rounded-full border px-1 text-[7.5px] font-black tabular-nums",
                          stock.moveUp
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                            : "border-red-500/25 bg-red-500/10 text-red-700",
                        ].join(" ")}
                      >
                        {stock.move}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-[10px] font-bold tabular-nums">
                    {stock.price}
                  </div>

                  <div className="flex justify-end">
                    <span className="inline-flex min-w-[48px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black tabular-nums text-[#072116]">
                      {stock.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                  Market Overview
                </p>
                <h3 className="mt-1 text-[15px] font-black text-[#faf6f0]">
                  S&amp;P 500
                </h3>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">
                +0.32%
              </span>
            </div>
            <div className="mt-3 h-[86px] overflow-hidden rounded-xl bg-[#072116]/45">
              <div className="sg-real-chart h-full" />
            </div>
          </div>

          <div className="rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/55">
                Top Gainers &amp; Losers
              </p>
              <span className="rounded-full border border-[#072116]/10 px-2 py-0.5 text-[8px] font-black text-[#072116]/55">
                1D
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {moverRows.map((item) => (
                <div
                  key={item.ticker}
                  className="flex items-center justify-between rounded-xl border border-[#072116]/8 bg-[#072116]/[0.03] px-3 py-2"
                >
                  <p className="sg-data text-xs font-black">{item.ticker}</p>
                  <p
                    className={[
                      "sg-data text-xs font-black",
                      item.moveUp ? "text-emerald-700" : "text-red-700",
                    ].join(" ")}
                  >
                    {item.move}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}

export function TiltingIphoneDashboard({
  metrics,
  rows,
}: {
  metrics: LandingVisualMetrics;
  rows?: DashboardRow[];
}) {
  return (
    <div className="group relative mx-auto flex min-h-[520px] w-full items-center justify-center sm:min-h-[560px] lg:min-h-[650px]">
      <div className="absolute h-[330px] w-[330px] rounded-full bg-[#ddb159]/12 blur-3xl sm:h-[390px] sm:w-[390px]" />

      <div className="relative scale-[0.86] rounded-[3.2rem] border-[11px] border-[#04180f] bg-[#04180f] shadow-[0_42px_100px_rgba(7,27,17,0.28)] transition duration-700 ease-out sm:scale-100 lg:[transform:perspective(1200px)_rotateY(-16deg)_rotateZ(-5deg)] lg:group-hover:[transform:perspective(1200px)_rotateY(0deg)_rotateZ(0deg)_scale(1.025)]">
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-[#020806]" />
        <div className="overflow-hidden rounded-[2.35rem]">
          <RealDashboardScreen metrics={metrics} rows={rows} />
        </div>
      </div>
    </div>
  );
}

export function RankingVisual({ rows }: { rows?: DashboardRow[] }) {
  const live = Boolean(rows && rows.length > 0);
  const rankingRows = live ? (rows as DashboardRow[]) : dashboardRows;

  return (
    <div className="h-full overflow-hidden rounded-[2rem] border border-[#dfe5dc] bg-white shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="grid gap-5 border-b border-[#edf0ea] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            {live ? "Live rankings" : "Rankings preview"}
          </p>
          <p className="sg-heading mt-1 text-3xl font-medium text-[#0a2d1d]">
            Top ranked stocks
          </p>
        </div>
        <div className="rounded-full bg-[#0a2d1d] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white">
          Account unlock
        </div>
      </div>

      <div className="hidden grid-cols-[52px_90px_minmax(0,1fr)_78px_82px] border-b border-[#edf0ea] bg-[#072116] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#faf6f0] sm:grid">
        <span>#</span>
        <span>Ticker</span>
        <span>Company</span>
        <span>Price</span>
        <span className="text-right">Score</span>
      </div>

      {rankingRows.slice(0, 5).map((stock, index) => (
        <div
          key={stock.ticker}
          className="sg-rank-row grid grid-cols-[38px_minmax(0,1fr)_72px] items-center border-b border-[#edf0ea] px-4 py-4 sm:grid-cols-[52px_90px_minmax(0,1fr)_78px_82px]"
          style={{ animationDelay: `${index * 180}ms` }}
        >
          <span className="sg-data font-black text-[#b88a32]">{stock.rank}</span>
          <span className="sg-data hidden font-black text-[#072116] sm:block">
            {stock.ticker}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-[#072116]">
              {stock.company}
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs font-bold text-[#66746b] sm:hidden">
              <span>{stock.ticker}</span>
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-[10px] font-black",
                  stock.moveUp
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                    : "border-red-500/25 bg-red-500/10 text-red-700",
                ].join(" ")}
              >
                {stock.move}
              </span>
            </span>
          </span>
          <span className="sg-data hidden text-sm font-bold text-[#072116]/72 sm:block">
            {stock.price}
          </span>
          <span className="flex justify-end">
            <span className="sg-data inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-1 text-xs font-black text-[#072116]">
              {stock.score}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResearchPlanVisual() {
  return (
    <div className="h-full overflow-hidden rounded-[2rem] border border-[#dfe5dc] bg-white shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="flex flex-col gap-4 border-b border-[#edf0ea] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            Research plan
          </p>
          <h3 className="sg-heading mt-1 text-3xl font-medium text-[#0a2d1d]">
            Scenario levels
          </h3>
        </div>
        <span className="w-fit rounded-full bg-emerald-500/85 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white">
          High research priority
        </span>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#ddb159]/35 bg-[#fffaf0] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6828]">
              Entry zone
            </p>
            <span className="rounded-full border border-[#0a2d1d]/12 px-2 py-0.5 text-[9px] font-black uppercase text-[#0a2d1d]/48">
              Explain
            </span>
          </div>
          <p className="sg-data mt-2 text-3xl font-black text-[#072116]">
            $1046.84
          </p>
          <p className="mt-1 text-xs font-bold text-[#66746b]">Research level</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">
            Invalidation
          </p>
          <p className="sg-data mt-2 text-3xl font-black text-red-700">
            $664.50
          </p>
          <p className="mt-1 text-xs font-bold text-red-500">-36.5%</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
            Target zone
          </p>
          <p className="sg-data mt-2 text-3xl font-black text-emerald-800">
            $2958.53
          </p>
          <p className="mt-1 text-xs font-bold text-emerald-700">+182.6%</p>
        </div>
      </div>

      <div className="mx-5 rounded-2xl bg-[#072116] px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ddb159]">
            Risk / reward
          </p>
          <p className="sg-data text-lg font-black text-[#ddb159]">1 : 5</p>
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-[#dfe5dc] bg-[#fbfaf6] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#66746b]">
            Projected timeline
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#66746b]">
                Expected return
              </p>
              <p className="sg-data mt-1 text-2xl font-black text-emerald-800">
                24.7%/yr
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#66746b]">
                Target date
              </p>
              <p className="mt-1 text-2xl font-black text-[#072116]">Dec 2028</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#66746b]">
                Hold period
              </p>
              <p className="mt-1 text-2xl font-black text-[#072116]">
                20–38 months
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-[#4f5f55]">
            Medium-term research framework using a projected target zone,
            invalidation level and model conviction. Not a recommendation.
          </p>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="font-black text-emerald-900">
                If price approaches $2958.53
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Review valuation, momentum and news context around the target zone.
              </p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
              <p className="font-black text-red-900">If price breaks $664.50</p>
              <p className="mt-1 text-sm leading-6 text-red-800">
                Reassess the thesis and risk exposure around the invalidation level.
              </p>
            </div>
            <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4">
              <p className="font-black text-[#072116]">
                If ranking score weakens
              </p>
              <p className="mt-1 text-sm leading-6 text-[#66746b]">
                Recheck the research view because model conviction has changed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AskStockGPTVisual() {
  return (
    <div className="flex h-full flex-col rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="mb-5 flex items-center justify-between border-b border-[#edf0ea] pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            Ask StockGPT
          </p>
          <p className="mt-1 text-lg font-black text-[#072116]">
            Research assistant preview
          </p>
        </div>
        <div className="h-3 w-3 rounded-full bg-emerald-500" />
      </div>

      <div className="flex min-h-[470px] flex-1 flex-col justify-center space-y-4">
        <div className="sg-chat-bubble sg-chat-a max-w-[88%] rounded-[1.4rem] border border-[#dfe5dc] bg-[#fbfaf6] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#0a2d1d]">Investor</p>
            <p className="sg-data text-xs text-[#8a948d]">09:42</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#66746b]">
            Why is NVDA ranking above Microsoft this week?
          </p>
        </div>

        <div className="sg-chat-bubble sg-chat-b ml-auto max-w-[92%] rounded-[1.4rem] border border-[#0a2d1d]/12 bg-[#061b12] p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#ddb159]">Ask StockGPT</p>
            <p className="sg-data text-xs text-white/40">09:42</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/68">
            NVDA ranks higher due to stronger momentum, earnings revision strength
            and sector leadership. Microsoft remains high quality, but valuation and
            weaker short-term movement are weighing on its score.
          </p>
        </div>

        <div className="sg-chat-bubble sg-chat-c max-w-[88%] rounded-[1.4rem] border border-[#dfe5dc] bg-[#fbfaf6] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#0a2d1d]">Investor</p>
            <p className="sg-data text-xs text-[#8a948d]">09:43</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#66746b]">
            Is that a buy signal?
          </p>
        </div>

        <div className="sg-chat-bubble sg-chat-d ml-auto max-w-[92%] rounded-[1.4rem] border border-[#0a2d1d]/12 bg-[#061b12] p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="font-black text-[#ddb159]">Ask StockGPT</p>
            <p className="sg-data text-xs text-white/40">09:43</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/68">
            No. Treat it as a research prompt, not a recommendation. Check valuation,
            risk and whether it fits your portfolio before making a decision.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PortfolioVisual() {
  return (
    <div className="h-full rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="relative h-full overflow-hidden rounded-[1.5rem] bg-[#eef6ef] p-5">
        <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-[#0f9f5d]/18" />

        <div className="relative rounded-3xl bg-white p-5 shadow-[0_18px_50px_rgba(7,27,17,0.10)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6828]">
            Portfolio
          </p>
          <p className="sg-data mt-2 text-4xl font-black text-[#0a2d1d]">
            £24,810.42
          </p>
          <p className="mt-1 text-sm font-black text-[#0f9f5d]">
            +£1,205.80 this month
          </p>

          <div className="mt-5 h-28 rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-3">
            <MiniLineChart />
          </div>
        </div>

        <div className="relative mt-4 space-y-3">
          {[
            {
              title: "Technology exposure",
              detail: "High concentration",
              value: "46%",
            },
            {
              title: "Weak-ranked holding",
              detail: "Review suggested",
              value: "1",
            },
            {
              title: "Trading 212 CSV",
              detail: "Import ready",
              value: "Ready",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-[0_12px_34px_rgba(7,27,17,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-[#0a2d1d]">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-[#66746b]">
                    {item.detail}
                  </p>
                </div>
                <p className="sg-data font-black text-[#ddb159]">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewsVisual() {
  return (
    <div className="flex h-full flex-col rounded-[2rem] border border-[#dfe5dc] bg-white p-5 shadow-[0_28px_80px_rgba(7,27,17,0.08)]">
      <div className="flex flex-1 flex-col justify-center space-y-3">
        {[
          {
            title: "Chip demand pushes semiconductor names higher",
            tickers: "NVDA · AMD · AVGO",
            tag: "High relevance",
          },
          {
            title: "Banks react to rate outlook shift",
            tickers: "JPM · BAC · GS",
            tag: "Medium relevance",
          },
          {
            title: "Cloud spending remains resilient",
            tickers: "MSFT · AMZN · GOOGL",
            tag: "High relevance",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-[#edf0ea] bg-[#fbfaf6] p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6828]">
                  Market news
                </p>
                <h3 className="mt-2 font-black text-[#0a2d1d]">{item.title}</h3>
                <p className="sg-data mt-2 text-xs font-black text-[#66746b]">
                  {item.tickers}
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#e8f7ee] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#0f9f5d]">
                {item.tag}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
