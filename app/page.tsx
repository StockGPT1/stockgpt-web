import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
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
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const tickerList = rankings
    .map((r) => r.ticker)
    .filter((t): t is string => !!t);

  const [sp500Data, movers] = await Promise.all([
    getSP500Chart(["1M", "6M", "1Y", "5Y"]),
    getTopMovers(tickerList, 4),
  ]);

  const { count: totalCount } = await supabase
    .from("stock_rankings")
    .select("*", { count: "exact", head: true });

  const { count: bullishCount } = await supabase
    .from("stock_rankings")
    .select("*", { count: "exact", head: true })
    .gte("score", 7000);

  const bullishPct =
    totalCount && totalCount > 0
      ? Math.round(((bullishCount ?? 0) / totalCount) * 100)
      : 0;

  const sentiment =
    bullishPct >= 50
      ? "Strong market"
      : bullishPct >= 35
        ? "Healthy market"
        : bullishPct >= 20
          ? "Cautious market"
          : "Weak market";

  const gridCols = "grid-cols-[44px_88px_minmax(0,1fr)_115px_75px_72px]";

  const moversToShow = [
    ...movers.gainers.slice(0, 2),
    ...movers.losers.slice(0, 2),
  ].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  return (
    <AppShell activePath="/">
      <main className="h-full min-h-0 overflow-hidden pr-1">
        <div className="grid h-full min-h-0 gap-2 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="grid h-full min-h-0 grid-rows-[150px_72px_minmax(0,1fr)] gap-2 overflow-hidden">
            <WelcomeBanner />

            <div className="grid min-h-0 grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock
                icon="♛"
                label="Top Ranked"
                main={topRanked?.ticker ?? "—"}
                sub={topRanked?.company ?? "—"}
              />
              <StatBlock
                icon="↗"
                label="Bullish %"
                main={`${bullishPct}%`}
                sub={sentiment}
              />
              <StatBlock icon="▦" label="Total" main="500" sub="ranked daily" />
              <StatBlock
                icon="◷"
                label="Updated"
                main={formatUpdatedTime(topRanked?.updated_at)}
                sub="latest refresh"
              />
            </div>

            <div className="min-h-0 overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
              <div className="flex h-[58px] items-start justify-between gap-3 border-b border-[#072116]/10 px-3 py-2">
                <div>
                  <p
                    className="text-[9px] font-extrabold uppercase tracking-[0.14em]"
                    style={{ color: "rgba(7,33,22,0.55)" }}
                  >
                    ✦ AI Rankings
                  </p>
                  <h2 className="mt-0.5 text-[19px] font-black leading-none tracking-[-0.04em]">
                    Top 10 Ranked Stocks
                  </h2>
                  <p
                    className="mt-0.5 text-[10px] font-semibold"
                    style={{ color: "rgba(7,33,22,0.55)" }}
                  >
                    Click any row for full AI analysis
                  </p>
                </div>

                <Link
                  href="/rankings"
                  style={{ backgroundColor: "#ddb159", color: "#072116" }}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black shadow-[0_6px_16px_rgba(221,177,89,0.24)] transition hover:-translate-y-0.5 hover:opacity-90"
                >
                  View All →
                </Link>
              </div>

              <div className="flex h-[calc(100%-58px)] min-h-0 flex-col overflow-hidden">
                <div className={`grid ${gridCols} bg-[#072116] text-[#faf6f0]`}>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                    #
                  </div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                    Ticker
                  </div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                    Company
                  </div>
                  <div className="hidden px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide sm:block">
                    Sector
                  </div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                    Price
                  </div>
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                    Score
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  {rankings.length > 0 ? (
                    rankings.map((stock) => (
                      <Link
                        key={stock.id}
                        href={`/stock/${stock.ticker}`}
                        style={{ color: "#072116" }}
                        className={`grid ${gridCols} h-[10%] items-center border-b border-[#072116]/8 text-[12px] transition last:border-b-0 hover:bg-[#ddb159]/10`}
                      >
                        <div className="px-2.5 py-1.5 font-bold">
                          {stock.rank ?? "—"}
                        </div>

                        <div className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5 font-black">
                          <StockLogo
                            ticker={stock.ticker}
                            company={stock.company}
                            size={18}
                          />
                          <span className="truncate">{stock.ticker ?? "—"}</span>
                        </div>

                        <div className="truncate px-2.5 py-1.5 font-semibold">
                          {stock.company ?? "—"}
                        </div>

                        <div
                          className="hidden truncate px-2.5 py-1.5 sm:block"
                          style={{ color: "rgba(7,33,22,0.65)" }}
                        >
                          {stock.sector ?? "—"}
                        </div>

                        <div className="px-2.5 py-1.5 font-semibold tabular-nums">
                          {formatPrice(stock.price)}
                        </div>

                        <div className="px-2.5 py-1.5">
                          <span
                            className="inline-flex min-w-[52px] justify-center rounded-full px-2 py-0.5 text-[10px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                            style={{
                              backgroundColor: "#ddb159",
                              color: "#072116",
                            }}
                          >
                            {formatScore(stock.score)}
                          </span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div
                      className="px-4 py-8 text-center font-semibold"
                      style={{ color: "rgba(7,33,22,0.6)" }}
                    >
                      No ranking data available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_120px] gap-2 overflow-hidden">
            <div className="min-h-0 overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur transition hover:border-[#ddb159]/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                    ✦ Market Overview
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-black tracking-[-0.02em] text-[#faf6f0]">
                    S&amp;P 500
                  </h3>
                </div>
                <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
                  6M
                </p>
              </div>

              <div className="mt-2">
                <StockChart
                  ticker="S&P 500"
                  data={sp500Data}
                  initialRange="6M"
                  height={105}
                />
              </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  ✦ Top Movers · 5d
                </p>
                <span
                  className="rounded-full border border-[#072116]/10 px-2 py-0.5 text-[8px] font-black"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  Today
                </span>
              </div>

              <div className="mt-2 grid min-h-0 gap-1.5 overflow-hidden">
                {moversToShow.length > 0 ? (
                  moversToShow.map((m) => {
                    const isUp = m.changePct >= 0;

                    return (
                      <Link
                        key={m.ticker}
                        href={`/stock/${m.ticker}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:-translate-y-0.5 hover:border-[#ddb159] hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`inline-block size-1.5 shrink-0 rounded-full ${
                              isUp ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <p
                              className="truncate text-[12px] font-black tracking-[-0.01em]"
                              style={{ color: "#072116" }}
                            >
                              {m.ticker}
                            </p>
                            <p
                              className="truncate text-[9px] font-semibold"
                              style={{ color: "rgba(7,33,22,0.45)" }}
                            >
                              {isUp ? "Gainer" : "Pullback"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className="text-[11px] font-bold tabular-nums"
                            style={{ color: "#072116" }}
                          >
                            ${m.currentPrice.toFixed(2)}
                          </p>
                          <p
                            className={`text-[10px] font-black tabular-nums ${
                              isUp ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {isUp ? "+" : ""}
                            {m.changePct.toFixed(2)}%
                          </p>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <p
                    className="py-3 text-center text-[11px] font-semibold"
                    style={{ color: "rgba(7,33,22,0.5)" }}
                  >
                    Loading movers...
                  </p>
                )}
              </div>
            </div>

            <PortfolioPromoCard />
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function StatBlock({
  icon,
  label,
  main,
  sub,
}: {
  icon: string;
  label: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="group flex min-h-0 items-center gap-3 rounded-xl bg-[#faf6f0] px-3 py-2 text-[#072116] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.14)] hover:ring-1 hover:ring-[#ddb159]/30">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[16px] font-black text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition group-hover:scale-105">
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-[9px] font-extrabold uppercase tracking-[0.1em]"
          style={{ color: "rgba(7,33,22,0.55)" }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 truncate text-[15px] font-black leading-tight tracking-[-0.02em]"
          style={{ color: "#072116" }}
        >
          {main}
        </p>
        <p
          className="truncate text-[9px] font-semibold"
          style={{ color: "rgba(7,33,22,0.55)" }}
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

function PortfolioPromoCard() {
  return (
    <Link
      href="/portfolio"
      className="group relative min-h-0 overflow-hidden rounded-2xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061f15)] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-[#ddb159]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-[#ddb159]/20 blur-2xl transition group-hover:bg-[#ddb159]/30" />
      <div className="pointer-events-none absolute -bottom-12 left-4 size-24 rounded-full bg-[#faf6f0]/5 blur-2xl" />

      <div className="relative">
        <div className="mb-2 flex size-8 items-center justify-center rounded-2xl border border-[#ddb159]/30 bg-[#072116]/80 text-[18px] text-[#ddb159]">
          ♛
        </div>

        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
          ✦ AI-Powered
        </p>

        <h2 className="mt-1 text-[17px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0]">
          Build Your AI Portfolio
        </h2>

        <p className="mt-1.5 line-clamp-2 text-[10px] font-medium leading-snug text-[#faf6f0]/65">
          Tell the AI your goals. It picks the stocks, weights them, and watches
          them for you.
        </p>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold text-[#ddb159] transition group-hover:translate-x-0.5">
            Start in 30 seconds →
          </p>

          <div className="flex items-end gap-1">
            <span className="h-3 w-1.5 rounded bg-[#ddb159]/40" />
            <span className="h-5 w-1.5 rounded bg-[#ddb159]/55" />
            <span className="h-7 w-1.5 rounded bg-[#ddb159]/75" />
            <span className="h-9 w-1.5 rounded bg-[#ddb159]" />
          </div>
        </div>
      </div>
    </Link>
  );
}
