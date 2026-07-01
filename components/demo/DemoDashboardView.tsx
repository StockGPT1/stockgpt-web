import { WelcomeBanner } from "@/components/WelcomeBanner";
import { demoRankings } from "@/lib/demo/demoData";
import { DemoMiniChart } from "./DemoMiniChart";
import { StockIcon, type StockIconName } from "@/components/StockIcon";

function DemoStatBlock({
  icon,
  label,
  main,
  sub,
}: {
  icon: StockIconName;
  label: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="flex min-h-[58px] min-w-0 max-w-full items-center gap-2 rounded-xl bg-[#faf6f0] px-2.5 py-2 text-[#072116] shadow-[0_6px_16px_rgba(0,0,0,0.14)] ring-1 ring-white/30 sm:gap-3 sm:px-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[#ddb159]">
        <StockIcon name={icon} className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[8.5px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[14px] font-black leading-none tracking-[-0.02em]">
          {main}
        </p>
        <p className="mt-1 truncate text-[9.5px] font-semibold text-[#072116]/45">
          {sub}
        </p>
      </div>
    </div>
  );
}

function DemoRankingsPanel() {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 lg:min-h-0">
      <div className="flex h-[54px] items-center justify-between gap-3 border-b border-[#072116]/10 px-4 py-2">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            AI Rankings
          </p>
          <h2 className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.04em]">
            Top 10 Ranked Stocks
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#ddb159] px-4 py-2 text-[10px] font-black text-[#072116]">
          View All →
        </span>
      </div>

      <div className="lg:hidden">
        <div className="grid grid-cols-[32px_minmax(0,1fr)_72px_68px] bg-[#072116] px-3 py-2 text-[9px] font-black uppercase tracking-wide text-[#faf6f0]">
          <span>#</span>
          <span>Ticker</span>
          <span className="text-right">Price</span>
          <span className="text-right">Score</span>
        </div>
        {demoRankings.slice(0, 5).map((stock) => (
          <div
            key={stock.ticker}
            className="grid min-h-[42px] grid-cols-[32px_minmax(0,1fr)_72px_68px] items-center gap-1 border-b border-[#072116]/8 px-3 py-2 text-[11px] last:border-0"
          >
            <span className="font-bold text-[#072116]/65">{stock.rank}</span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-black">{stock.ticker}</span>
              <span className="block truncate text-[9px] font-semibold text-[#072116]/45">
                {stock.company}
              </span>
            </span>
            <span className="text-right text-[10px] font-bold">{stock.price}</span>
            <span className="ml-auto min-w-[52px] rounded-full bg-[#ddb159] px-2 py-0.5 text-center text-[9px] font-black">
              {stock.score}
            </span>
          </div>
        ))}
      </div>

      <div className="hidden h-[calc(100%-54px)] min-h-0 lg:flex lg:flex-col">
        {demoRankings.slice(0, 10).map((stock) => (
          <div
            key={stock.ticker}
            className="grid min-h-[38px] flex-1 grid-cols-[34px_minmax(76px,0.55fr)_minmax(120px,1.25fr)_minmax(88px,0.85fr)_70px_70px] items-center border-b border-[#072116]/8 text-[11px] last:border-0"
          >
            <span className="px-2 font-bold text-[#072116]/75">{stock.rank}</span>
            <span className="truncate px-2 font-black">{stock.ticker}</span>
            <span className="truncate px-2 font-semibold">{stock.company}</span>
            <span className="truncate px-2 text-[#072116]/60">{stock.sector}</span>
            <span className="px-2 text-right font-semibold">{stock.price}</span>
            <span className="mx-2 rounded-full bg-[#ddb159] px-2 py-0.5 text-center text-[9px] font-black">
              {stock.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoPortfolioWidget() {
  return (
    <div className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061b12)] p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8.5px] font-black uppercase tracking-[0.15em] text-[#ddb159]">
            Portfolio
          </p>
          <h2 className="mt-1 truncate text-[18px] font-black leading-none tracking-[-0.05em]">
            Balanced Portfolio Draft
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black text-[#072116]">
          Health 82/100
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] items-end gap-3">
        <div>
          <p className="text-2xl font-black tracking-[-0.05em]">£8,012</p>
          <p className="mt-1 text-[11px] font-black text-emerald-300">+£434 · +5.6%</p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl bg-[#072116]/35">
          <DemoMiniChart height={76} gold />
        </div>
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.11em] text-[#faf6f0]/45">
        Since created · 6 holdings
      </p>
    </div>
  );
}

function DemoMarketOverview() {
  return (
    <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
            Market Overview
          </p>
          <h3 className="mt-1 text-[22px] font-black leading-none tracking-[-0.05em]">
            S&amp;P 500 <span className="text-[13px] text-[#faf6f0]/72">5,487.03</span>
          </h3>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
          +0.42%
        </span>
      </div>
      <div className="mt-3 min-h-[108px] overflow-hidden rounded-xl bg-[#072116]/35">
        <DemoMiniChart height={108} gold />
      </div>
    </div>
  );
}

function DemoChanges() {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">
        Today
      </p>
      <h2 className="mt-1 text-xl font-black">What changed</h2>
      <div className="mt-3 grid gap-2">
        {demoRankings.slice(0, 4).map((stock) => (
          <div
            key={stock.ticker}
            className="flex min-w-0 items-center justify-between rounded-xl border border-[#072116]/8 bg-white p-2.5"
          >
            <span className="truncate font-black">{stock.ticker}</span>
            <span
              className={
                stock.move.startsWith("+") ? "text-emerald-700" : "text-red-700"
              }
            >
              {stock.move}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoDashboardView() {
  return (
    <div className="grid w-full min-w-0 max-w-full gap-3 overflow-x-hidden lg:min-h-full lg:grid-cols-[minmax(0,1fr)_clamp(318px,29vw,430px)]">
      <section className="grid w-full min-w-0 max-w-full content-start gap-3 lg:grid-rows-[clamp(108px,15dvh,138px)_auto_auto_minmax(380px,1fr)]">
        <WelcomeBanner demoMode />

        <div className="rounded-2xl border border-[#ddb159]/20 bg-[#061b12]/75 px-4 py-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ddb159]">
                Getting started
              </p>
              <p className="line-clamp-2 text-[11px] font-bold leading-4 text-[#faf6f0]/72 sm:text-[12px]">
                Plan selected · Portfolio Draft created · First StockGPT Check ready
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black text-emerald-300">
              3/3
            </span>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-4">
          <DemoStatBlock icon="rankings" label="Top Ranked" main="NVDA" sub="NVIDIA" />
          <DemoStatBlock icon="trend-up" label="Bullish %" main="42%" sub="cautious market" />
          <DemoStatBlock icon="total" label="Total" main="503" sub="stocks ranked" />
          <DemoStatBlock icon="clock" label="Updated" main="09:30" sub="latest model run" />
        </div>

        <DemoRankingsPanel />
      </section>

      <aside className="grid w-full min-w-0 max-w-full content-start gap-3 lg:grid-rows-[auto_auto_minmax(280px,1fr)]">
        <DemoPortfolioWidget />
        <DemoMarketOverview />
        <DemoChanges />
      </aside>
    </div>
  );
}
