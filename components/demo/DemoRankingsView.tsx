import { demoRankings } from "@/lib/demo/demoData";

export function DemoRankingsView() {
  return (
    <div className="grid min-w-0 gap-3">
      <section className="rounded-3xl border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,0.07),rgba(221,177,89,0.06))] p-4">
        <p className="inline-flex rounded-full border border-[#ddb159]/25 bg-[#072116]/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
          AI ranking engine
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#faf6f0]">Stock Rankings</h1>
        <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-[#faf6f0]/58">
          Compare a structured S&P 500 research list. The rank is a research priority, not a prediction or buy signal.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_110px]">
          <div className="h-11 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/40">Search ticker or company</div>
          <div className="h-11 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-black">All sectors</div>
          <div className="grid h-11 place-items-center rounded-2xl bg-[#ddb159] text-xs font-black text-[#072116]">Apply</div>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116]">
        <div className="hidden grid-cols-[52px_80px_100px_minmax(0,1fr)_112px_90px_90px] bg-[#072116] text-[10px] font-black uppercase tracking-wide text-[#faf6f0] md:grid">
          {["Rank", "Move", "Ticker", "Company", "Sector", "Price", "AI score"].map((item) => (
            <div key={item} className="px-3 py-3">{item}</div>
          ))}
        </div>
        {demoRankings.map((stock) => (
          <div key={stock.ticker} className="grid min-w-0 grid-cols-[40px_64px_minmax(0,1fr)_68px] items-center gap-1 border-b border-[#072116]/8 px-3 py-3 text-xs last:border-0 md:grid-cols-[52px_80px_100px_minmax(0,1fr)_112px_90px_90px] md:gap-0 md:px-0">
            <div className="font-black text-[#072116]/55 md:px-3">#{stock.rank}</div>
            <div className={`font-black md:px-3 ${stock.move.startsWith("+") ? "text-emerald-700" : "text-red-700"}`}>{stock.move}</div>
            <div className="font-black md:px-3">{stock.ticker}</div>
            <div className="min-w-0 truncate font-semibold text-[#072116]/62 md:px-3">{stock.company}</div>
            <div className="hidden truncate font-semibold text-[#072116]/48 md:block md:px-3">{stock.sector}</div>
            <div className="hidden font-black md:block md:px-3">{stock.price}</div>
            <div className="md:px-3"><span className="inline-flex rounded-full bg-[#ddb159] px-2 py-1 text-[9px] font-black">{stock.score}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
