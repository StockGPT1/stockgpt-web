import { demoHoldings } from "@/lib/demo/demoData";
import { DemoMiniChart } from "./DemoMiniChart";

export function DemoPortfolioManageView() {
  return (
    <div className="grid min-w-0 gap-3">
      <section className="overflow-hidden rounded-3xl border border-[#ddb159]/18 bg-[linear-gradient(180deg,#092116,#020805)]">
        <div className="p-5 text-center sm:p-6 sm:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Balanced Portfolio Draft</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-6xl">£8,012</h1>
          <p className="mt-2 text-sm font-black text-emerald-300">+£434 total return · +5.6%</p>
          <div className="mt-4 overflow-hidden">
            <DemoMiniChart height={230} gold />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-white/8 bg-white/5">
          {[
            ["Open positions", "4"],
            ["Health", "82/100"],
            ["Cash", "£1,460"],
          ].map(([label, value]) => (
            <div key={label} className="p-3">
              <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-white/38">{label}</p>
              <p className="mt-1 text-lg font-black">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Holdings</p>
          <p className="mt-1 text-xs font-semibold text-white/45">Review value, gains/losses, allocation and research score.</p>
        </div>
        {demoHoldings.map((holding) => (
          <div key={holding.ticker} className="grid min-w-0 gap-2 rounded-2xl bg-[#faf6f0] p-3 text-[#072116] sm:grid-cols-[minmax(160px,1fr)_100px_100px_90px_90px] sm:items-center">
            <div className="min-w-0">
              <p className="font-black">{holding.ticker}</p>
              <p className="truncate text-[10px] font-semibold text-[#072116]/45">{holding.company}</p>
            </div>
            <div><p className="text-[8px] font-black uppercase text-[#072116]/35">Value</p><p className="font-black">{holding.value}</p></div>
            <div><p className="text-[8px] font-black uppercase text-[#072116]/35">P/L</p><p className={`font-black ${holding.pnl.startsWith("+") ? "text-emerald-700" : "text-red-700"}`}>{holding.pnl}</p></div>
            <div><p className="text-[8px] font-black uppercase text-[#072116]/35">Allocation</p><p className="font-black">{holding.allocation}</p></div>
            <div><p className="text-[8px] font-black uppercase text-[#072116]/35">AI score</p><p className="font-black text-[#8a641a]">{holding.score}</p></div>
          </div>
        ))}
      </section>
      <p className="px-2 pb-32 text-[10px] font-semibold leading-5 text-white/42 sm:pb-4">
        Demo values are illustrative. Portfolio monitoring is educational research support, not financial advice.
      </p>
    </div>
  );
}
