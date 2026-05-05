import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { StockChart } from "@/components/StockChart";
import { createClient } from "@/utils/supabase/server";
import { getSP500Chart, getTopMovers } from "@/lib/yahoo";

type Ranking = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}
function formatScore(value: Ranking["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}
function formatUpdatedTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default async function Home() {
  const supabase = await createClient();

  const { data: rankingsData } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,sector,score,price,updated_at")
    .order("rank", { ascending: true })
    .limit(10);

  const rankings = (rankingsData ?? []) as Ranking[];
  const topRanked = rankings[0];

  const tickerList = rankings.map((r) => r.ticker).filter((t): t is string => !!t);
  const [sp500Data, movers] = await Promise.all([
    getSP500Chart(["1M", "6M", "1Y", "5Y"]),
    getTopMovers(tickerList, 4),
  ]);

  const { count: totalCount } = await supabase
    .from("stock_rankings").select("*", { count: "exact", head: true });
  const { count: bullishCount } = await supabase
    .from("stock_rankings").select("*", { count: "exact", head: true }).gte("score", 7000);
  const bullishPct = totalCount && totalCount > 0
    ? Math.round(((bullishCount ?? 0) / totalCount) * 100) : 0;
  const sentiment = bullishPct >= 50 ? "Strong market"
    : bullishPct >= 35 ? "Healthy market"
    : bullishPct >= 20 ? "Cautious market" : "Weak market";

  const gridCols = "grid-cols-[44px_70px_minmax(0,1fr)_115px_75px_72px]";

  return (
    <AppShell activePath="/">
      <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-y-auto pr-1 lg:overflow-hidden">
        <WelcomeBanner />

        {/* 2-col layout */}
        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
          {/* ── LEFT: Stats row + Top 10 ── */}
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:overflow-hidden">
            {/* ✦ Stats row above top 10 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock label="Top Ranked" main={topRanked?.ticker ?? "—"} sub={topRanked?.company ?? "—"} />
              <StatBlock label="Bullish %" main={`${bullishPct}%`} sub={sentiment} />
              <StatBlock label="Total" main="500" sub="ranked daily" />
              <StatBlock label="Updated" main={formatUpdatedTime(topRanked?.updated_at)} sub="latest refresh" />
            </div>

            {/* Top 10 rankings */}
            <div className="min-h-0 overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h2 className="text-[20px] font-black leading-none tracking-[-0.03em]">
                    Top 10 Ranked Stocks
                  </h2>
                  <p className="mt-1 text-[10px] font-semibold" style={{ color: "rgba(7,33,22,0.55)" }}>
                    Click any row for full AI analysis
                  </p>
                </div>
                <Link
                  href="/rankings"
                  style={{ backgroundColor: "#ddb159", color: "#072116" }}
                  className="rounded-full px-3 py-1.5 text-[10px] font-black transition hover:opacity-90"
                >
                  View All →
                </Link>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#072116]/10">
                <div className={`grid ${gridCols} bg-[#072116] text-[#faf6f0]`}>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">#</div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">Ticker</div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">Company</div>
                  <div className="hidden px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide sm:block">Sector</div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">Price</div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">Score</div>
                </div>

                {rankings.length > 0 ? (
                  rankings.map((stock) => (
                    <Link
                      key={stock.id}
                      href={`/stock/${stock.ticker}`}
                      style={{ color: "#072116" }}
                      className={`grid ${gridCols} items-center border-b border-[#072116]/8 text-[12px] transition last:border-b-0 hover:bg-[#ddb159]/8`}
                    >
                      <div className="px-2.5 py-2.5 font-bold">{stock.rank ?? "—"}</div>
                      <div className="px-2.5 py-2.5 font-black">{stock.ticker ?? "—"}</div>
                      <div className="truncate px-2.5 py-2.5 font-semibold">{stock.company ?? "—"}</div>
                      <div className="hidden truncate px-2.5 py-2.5 sm:block" style={{ color: "rgba(7,33,22,0.65)" }}>
                        {stock.sector ?? "—"}
                      </div>
                      <div className="px-2.5 py-2.5 font-semibold tabular-nums">{formatPrice(stock.price)}</div>
                      <div className="px-2.5 py-2.5">
                        <span
                          className="inline-flex min-w-[52px] justify-center rounded-full px-2 py-0.5 text-[10px] font-black"
                          style={{ backgroundColor: "#ddb159", color: "#072116" }}
                        >
                          {formatScore(stock.score)}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center font-semibold" style={{ color: "rgba(7,33,22,0.6)" }}>
                    No ranking data available yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── RIGHT: Chart + Movers + Portfolio (taller now) ── */}
          <aside className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 lg:overflow-hidden">
            {/* S&P 500 chart */}
            <div className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-3 backdrop-blur">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                ✦ Market Overview
              </p>
              <h3 className="mt-0.5 text-[14px] font-black tracking-[-0.02em] text-[#faf6f0]">
                S&amp;P 500
              </h3>
              <div className="mt-2">
                <StockChart
                  ticker="S&P 500"
                  data={sp500Data}
                  initialRange="6M"
                  height={140}
                />
              </div>
            </div>

            {/* Top movers */}
            <div className="rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "rgba(7,33,22,0.55)" }}>
                ✦ Top Movers · 5d
              </p>
              <div className="mt-2 grid gap-1.5">
                {[...movers.gainers.slice(0, 2), ...movers.losers.slice(0, 2)]
                  .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
                  .map((m) => {
                    const isUp = m.changePct >= 0;
                    return (
                      <Link
                        key={m.ticker}
                        href={`/stock/${m.ticker}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:border-[#ddb159]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`inline-block size-1.5 shrink-0 rounded-full ${isUp ? "bg-emerald-500" : "bg-red-500"}`}
                          />
                          <p className="text-[12px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>
                            {m.ticker}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-bold tabular-nums" style={{ color: "#072116" }}>
                            ${m.currentPrice.toFixed(2)}
                          </p>
                          <p className={`text-[10px] font-black tabular-nums ${isUp ? "text-emerald-600" : "text-red-600"}`}>
                            {isUp ? "+" : ""}{m.changePct.toFixed(2)}%
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                {movers.gainers.length === 0 && movers.losers.length === 0 && (
                  <p className="py-3 text-center text-[11px] font-semibold" style={{ color: "rgba(7,33,22,0.5)" }}>
                    Loading movers...
                  </p>
                )}
              </div>
            </div>

            {/* ✦ Portfolio promo — beefed up with feature list */}
            <Link
              href="/portfolio"
              className="group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#0d3420,#082519)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition hover:border-[#ddb159]"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#ddb159]/15 blur-3xl transition group-hover:bg-[#ddb159]/25" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 size-32 rounded-full bg-emerald-500/10 blur-3xl" />

              <div className="relative">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                  ✦ AI-Powered
                </p>
                <h2 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.03em] text-[#faf6f0]">
                  Build Your AI Portfolio
                </h2>
                <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-[#faf6f0]/65">
                  Tell the AI your goals. It picks the stocks, weights them, and watches them for you.
                </p>
              </div>

              <ul className="relative mt-3 grid gap-1.5 text-[11px] font-medium text-[#faf6f0]/80">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ddb159]">✓</span>
                  <span>Picks 8–15 stocks tailored to your risk profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ddb159]">✓</span>
                  <span>Real-time alerts when scores drop or news hits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ddb159]">✓</span>
                  <span>Action plans: when to sell, trim, or buy more</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ddb159]">✓</span>
                  <span>Track stocks you already own too</span>
                </li>
              </ul>

              <div className="relative mt-auto pt-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-black transition group-hover:translate-x-0.5"
                  style={{ backgroundColor: "#ddb159", color: "#072116" }}
                >
                  Start in 30 seconds
                  <span>→</span>
                </span>
              </div>
            </Link>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function StatBlock({ label, main, sub }: { label: string; main: string; sub: string }) {
  return (
    <div className="rounded-xl bg-[#faf6f0] px-3 py-2 text-[#072116] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "rgba(7,33,22,0.55)" }}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-[16px] font-black leading-tight tracking-[-0.02em]" style={{ color: "#072116" }}>
        {main}
      </p>
      <p className="truncate text-[9px] font-semibold" style={{ color: "rgba(7,33,22,0.55)" }}>
        {sub}
      </p>
    </div>
  );
}
