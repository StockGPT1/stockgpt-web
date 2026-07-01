import { demoRankings } from "@/lib/demo/demoData";
import { DemoMiniChart } from "./DemoMiniChart";

export function DemoDashboardView() {
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="grid min-w-0 gap-3">
        <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(120deg,#061f15,#123b25)] p-5">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-65 sm:block">
            <DemoMiniChart height={150} gold />
          </div>
          <div className="relative max-w-lg">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Dashboard</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#faf6f0] sm:text-4xl">
              Your research workflow at a glance.
            </h1>
            <p className="mt-2 text-xs font-semibold text-[#faf6f0]/58">
              Review the market, shortlist companies, then test each idea against the evidence.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Portfolio", "£8,012", "+5.6% total"],
            ["Top ranked", "NVDA", "8,742 score"],
            ["Bullish", "42%", "cautious market"],
            ["Coverage", "503", "stocks ranked"],
          ].map(([label, value, detail]) => (
            <div key={label} className="min-w-0 rounded-2xl bg-[#faf6f0] p-3 text-[#072116]">
              <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-[#072116]/45">{label}</p>
              <p className="mt-1 truncate text-xl font-black">{value}</p>
              <p className="mt-1 truncate text-[10px] font-semibold text-[#072116]/48">{detail}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116]">
          <div className="flex items-center justify-between border-b border-[#072116]/10 px-4 py-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8a641a]">AI rankings</p>
              <h2 className="text-lg font-black">Research priorities</h2>
            </div>
            <span className="rounded-full bg-[#ddb159] px-3 py-1 text-[10px] font-black">View all</span>
          </div>
          {demoRankings.slice(0, 4).map((stock) => (
            <div key={stock.ticker} className="grid grid-cols-[32px_72px_minmax(0,1fr)_68px] items-center border-b border-[#072116]/8 px-3 py-2.5 text-xs last:border-0">
              <span className="font-black text-[#072116]/45">#{stock.rank}</span>
              <span className="font-black">{stock.ticker}</span>
              <span className="min-w-0 truncate font-semibold text-[#072116]/55">{stock.company}</span>
              <span className="rounded-full bg-[#ddb159] px-2 py-0.5 text-center text-[9px] font-black">{stock.score}</span>
            </div>
          ))}
        </div>
      </section>

      <aside className="grid min-w-0 content-start gap-3">
        <div className="overflow-hidden rounded-3xl border border-[#ddb159]/20 bg-[#061b12] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Balanced Portfolio Draft</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">£8,012</p>
          <p className="mt-1 text-xs font-black text-emerald-300">+£434 · +5.6%</p>
          <div className="mt-3 overflow-hidden rounded-xl bg-[#072116]/40">
            <DemoMiniChart height={132} gold />
          </div>
        </div>
        <div className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116]">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/45">Today</p>
          <h2 className="mt-1 text-xl font-black">What changed</h2>
          <div className="mt-3 grid gap-2">
            {demoRankings.slice(0, 3).map((stock) => (
              <div key={stock.ticker} className="flex items-center justify-between rounded-xl bg-white p-2.5">
                <span className="font-black">{stock.ticker}</span>
                <span className={stock.move.startsWith("+") ? "text-emerald-700" : "text-red-700"}>{stock.move}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
