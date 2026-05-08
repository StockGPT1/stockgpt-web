import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { StockChart } from "@/components/StockChart";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { getOneDayMoveMap, getSP500Chart, getTopMovers } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
} from "@/lib/rank-history";

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

type MoveTone = "up" | "down" | "flat" | "none";

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatUpdatedTime(value?: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChartChangePct(
  data: Partial<Record<string, Array<{ close: number }>>>,
  range = "1D",
) {
  const points = data[range];
  if (!points || points.length < 2) return null;

  const first = points.find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  const last = [...points].reverse().find((p) => Number.isFinite(p.close) && p.close > 0)?.close;

  if (!first || !last || first <= 0) return null;

  return ((last - first) / first) * 100;
}

function moveClassName(tone: MoveTone) {
  if (tone === "up") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  if (tone === "down") {
    return "border-red-500/25 bg-red-500/10 text-red-700";
  }

  if (tone === "flat") {
    return "border-[#072116]/10 bg-[#072116]/5 text-[#072116]/45";
  }

  return "border-[#072116]/8 bg-transparent text-[#072116]/35";
}

function dailyMoveClassName(changePct: number | null | undefined) {
  if (!Number.isFinite(changePct)) {
    return "border-[#072116]/8 bg-transparent text-[#072116]/35";
  }

  if (Number(changePct) >= 0) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  return "border-red-500/25 bg-red-500/10 text-red-700";
}

function DailyMovePill({
  changePct,
  className = "h-5 min-w-[42px] px-1 text-[8px]",
}: {
  changePct: number | null | undefined;
  className?: string;
}) {
  const valid = Number.isFinite(changePct);
  const value = valid ? Number(changePct) : null;

  return (
    <span
      title="1D price move"
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full border font-black tabular-nums",
        className,
        dailyMoveClassName(value),
      ].join(" ")}
    >
      {value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}

function getFirstNameFromUserMetadata(user: {
  user_metadata?: Record<string, unknown>;
}) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name.trim()
        : "";

  if (!fullName) return undefined;

  return fullName.split(/\s+/)[0];
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasSubscription = false;
  let firstName: string | undefined;

  if (user) {
    firstName = getFirstNameFromUserMetadata(user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    hasSubscription = profile?.subscription_status === "basic";
  }

  const rankingsLocked = !hasSubscription;

  const [{ data: rankingsData }, { data: moverUniverseData }] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(10),
    supabase
      .from("stock_rankings")
      .select("ticker")
      .order("rank", { ascending: true })
      .limit(500),
  ]);

  const rankings = (rankingsData ?? []) as Ranking[];
  const topRanked = rankings[0];

  const moverTickerList = Array.from(
    new Set(
      ((moverUniverseData ?? []) as Array<{ ticker: string | null }>)
        .map((r) => r.ticker)
        .filter((t): t is string => !!t),
    ),
  );
  const dashboardTickerList = rankings
    .map((r) => r.ticker)
    .filter((t): t is string => !!t);

  const [sp500Data, movers, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getTopMovers(moverTickerList, 8),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
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

  const dashboardRankingsGrid =
    "grid-cols-[34px_92px_minmax(0,1fr)_60px_112px_76px_78px]";

  const sp500DailyChangePct = getChartChangePct(sp500Data, "1D");
  const topGainers = movers.gainers.slice(0, 3);
  const topLosers = movers.losers.slice(0, 3);

  return (
    <AppShell activePath="/">
      <main className="min-h-full overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden">
        <div className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-2">
          <section className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-rows-[150px_68px_minmax(0,1fr)] lg:gap-2 lg:overflow-hidden">
            <WelcomeBanner name={firstName} />

            <div className="grid grid-cols-2 gap-2 lg:min-h-0 lg:grid-cols-4">
              <StatBlock
                icon="♛"
                label="Top Ranked"
                main={rankingsLocked ? "Locked" : topRanked?.ticker ?? "—"}
                sub={rankingsLocked ? "Subscribe to unlock" : topRanked?.company ?? "—"}
              />

              <StatBlock
                icon="↗︎"
                label="Bullish %"
                main={`${bullishPct}%`}
                sub={sentiment}
              />

              <StatBlock
                icon="▦"
                label="Total"
                main={(totalCount ?? rankings.length).toLocaleString()}
                sub="stocks ranked"
              />

              <StatBlock
                icon="◷"
                label="Updated"
                main={formatUpdatedTime(topRanked?.updated_at)}
                sub="latest model run"
              />
            </div>

            <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 transition duration-300 hover:-translate-y-0.5 lg:min-h-0">
              <div className="flex h-[66px] items-start justify-between gap-3 border-b border-[#072116]/10 px-4 py-3">
                <div className="min-w-0">
                  <p
                    className="text-[9px] font-extrabold uppercase tracking-[0.14em]"
                    style={{ color: "rgba(7,33,22,0.55)" }}
                  >
                    ✦ AI Rankings
                  </p>

                  <h2 className="mt-1 truncate text-[18px] font-black leading-none tracking-[-0.04em]">
                    Top 10 Ranked Stocks
                  </h2>
                </div>

                <Link
                  href={rankingsLocked ? "/pricing" : "/rankings"}
                  style={{ backgroundColor: "#ddb159", color: "#072116" }}
                  className="mt-1 shrink-0 rounded-full px-4 py-2 text-[10px] font-black shadow-[0_6px_16px_rgba(221,177,89,0.26)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(221,177,89,0.34)] hover:brightness-105"
                >
                  {rankingsLocked ? "Unlock →" : "View All →"}
                </Link>
              </div>

              <RankingsLock isLocked={rankingsLocked} className="lg:hidden">
                <div>
                  <div className="grid grid-cols-[32px_minmax(0,1fr)_72px_68px] bg-[#072116] px-3 py-2 text-[9px] font-black uppercase tracking-wide text-[#faf6f0]">
                    <div>#</div>
                    <div>Ticker</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Score</div>
                  </div>

                  <div className="divide-y divide-[#072116]/8">
                    {rankings.length > 0 ? (
                      rankings.map((stock) => (
                        <Link
                          key={stock.id}
                          href={`/stock/${stock.ticker}`}
                          className="grid min-h-[42px] grid-cols-[32px_minmax(0,1fr)_72px_68px] items-center gap-1 px-3 py-2 text-[11px] transition hover:bg-[#ddb159]/10"
                          style={{ color: "#072116" }}
                        >
                          <div className="font-bold tabular-nums text-[#072116]/65">
                            {stock.rank ?? "—"}
                          </div>

                          <div className="flex min-w-0 items-center gap-2">
                            <StockLogo
                              ticker={stock.ticker}
                              company={stock.company}
                              size={18}
                            />

                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-black">
                                {stock.ticker ?? "—"}
                              </p>
                              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                <p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">
                                  {stock.company ?? "—"}
                                </p>
                                <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} className="h-4 min-w-[38px] px-1 text-[7.5px]" />
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[10px] font-bold tabular-nums">
                            {formatPrice(stock.price)}
                          </div>

                          <div className="flex justify-end">
                            <span
                              className="inline-flex min-w-[52px] justify-center rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums"
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
                      <div className="px-4 py-8 text-center text-[12px] font-semibold text-[#072116]/55">
                        No ranking data available yet.
                      </div>
                    )}
                  </div>
                </div>
              </RankingsLock>

              <RankingsLock
                isLocked={rankingsLocked}
                className="hidden h-[calc(100%-66px)] min-h-0 overflow-hidden lg:block"
              >
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-hidden">
                    {rankings.length > 0 ? (
                      rankings.map((stock) => {
                        const move = getRankMove24h(
                          stock.rank,
                          snapshotMap.get(stock.ticker ?? ""),
                        );

                        return (
                          <Link
                            key={stock.id}
                            href={`/stock/${stock.ticker}`}
                            style={{ color: "#072116" }}
                            className={`group grid ${dashboardRankingsGrid} h-[10%] min-h-0 items-center border-b border-[#072116]/8 text-[10.5px] transition duration-300 last:border-b-0 hover:bg-[#ddb159]/12 hover:shadow-[inset_3px_0_0_#ddb159]`}
                          >
                            <div className="px-2 font-bold tabular-nums text-[#072116]/75">
                              {stock.rank ?? "—"}
                            </div>

                            <div className="flex min-w-0 items-center gap-2 px-2 font-black">
                              <StockLogo
                                ticker={stock.ticker}
                                company={stock.company}
                                size={17}
                              />
                              <span className="min-w-0 truncate tracking-[-0.01em]">
                                {stock.ticker ?? "—"}
                              </span>
                            </div>

                            <div className="flex min-w-0 items-center gap-2 px-2 font-semibold tracking-[-0.01em]">
                              <span className="min-w-0 truncate">{stock.company ?? "—"}</span>
                              <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} />
                            </div>

                            <div className="px-2">
                              <span
                                title={move.title}
                                className={[
                                  "inline-flex h-5 min-w-[38px] items-center justify-center rounded-full border px-1 text-[8px] font-black tabular-nums transition duration-300 group-hover:scale-105",
                                  moveClassName(move.tone),
                                ].join(" ")}
                              >
                                {move.label}
                              </span>
                            </div>

                            <div
                              className="hidden min-w-0 truncate px-2 sm:block"
                              style={{ color: "rgba(7,33,22,0.6)" }}
                            >
                              {stock.sector ?? "—"}
                            </div>

                            <div className="px-2 text-right font-semibold tabular-nums">
                              {formatPrice(stock.price)}
                            </div>

                            <div className="flex justify-end px-2">
                              <span
                                className="inline-flex min-w-[58px] justify-center rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-300 group-hover:shadow-[0_0_18px_rgba(221,177,89,0.38)]"
                                style={{
                                  backgroundColor: "#ddb159",
                                  color: "#072116",
                                }}
                              >
                                {formatScore(stock.score)}
                              </span>
                            </div>
                          </Link>
                        );
                      })
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
              </RankingsLock>
            </div>
          </section>

          <aside className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-rows-[156px_minmax(0,1fr)_88px] lg:gap-2 lg:overflow-hidden lg:pb-1">
            <div className="overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#ddb159]/45 hover:bg-[#faf6f0]/[0.05] lg:min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                    ✦ Market Overview
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-black tracking-[-0.02em] text-[#faf6f0]">
                    S&amp;P 500
                  </h3>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
                    1D
                  </p>
                  {sp500DailyChangePct != null && (
                    <p
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${
                        sp500DailyChangePct >= 0
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border-red-400/30 bg-red-500/10 text-red-300"
                      }`}
                    >
                      {sp500DailyChangePct >= 0 ? "+" : ""}
                      {sp500DailyChangePct.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 overflow-hidden rounded-xl bg-[#072116]/35 lg:hidden">
                <StockChart
                  ticker="S&P 500"
                  data={sp500Data}
                  initialRange="1D"
                  height={150}
                  compact
                />
              </div>

              <div className="mt-1.5 hidden h-[74px] overflow-hidden rounded-xl bg-[#072116]/35 lg:block">
                <StockChart
                  ticker="S&P 500"
                  data={sp500Data}
                  initialRange="1D"
                  height={74}
                  compact
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(0,0,0,0.24)] lg:flex lg:min-h-0 lg:flex-col">
              <div className="flex h-[20px] shrink-0 items-center justify-between gap-3">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  ✦ Top Gainers &amp; Losers
                </p>
                <span
                  className="rounded-full border border-[#072116]/10 px-2 py-0.5 text-[8px] font-black"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  1D
                </span>
              </div>

              <div className="mt-2 grid min-h-0 flex-1 grid-rows-2 gap-2.5 overflow-hidden">
                <div className="flex min-h-0 flex-col">
                  <p className="mb-1 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700/80">
                    ▲ Gainers
                  </p>
                  <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden">
                    {topGainers.length > 0 ? (
                      topGainers.map((m) => (
                        <Link
                          key={m.ticker}
                          href={`/stock/${m.ticker}`}
                          className="group flex min-h-0 items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50/40 px-2.5 py-1.5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-[0_6px_14px_rgba(16,185,129,0.15)]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-block size-1.5 shrink-0 rounded-full bg-emerald-500 transition group-hover:scale-125" />
                            <p
                              className="truncate text-[12px] font-black tracking-[-0.01em]"
                              style={{ color: "#072116" }}
                            >
                              {m.ticker}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-[10px] font-bold tabular-nums"
                              style={{ color: "rgba(7,33,22,0.7)" }}
                            >
                              ${m.currentPrice.toFixed(2)}
                            </p>
                            <p className="text-[10px] font-black tabular-nums text-emerald-600">
                              +{m.changePct.toFixed(2)}%
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p
                        className="py-2 text-center text-[10px] font-semibold"
                        style={{ color: "rgba(7,33,22,0.5)" }}
                      >
                        No gainers yet
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <p className="mb-1 text-[8px] font-extrabold uppercase tracking-wider text-red-700/80">
                    ▼ Losers
                  </p>
                  <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden">
                    {topLosers.length > 0 ? (
                      topLosers.map((m) => (
                        <Link
                          key={m.ticker}
                          href={`/stock/${m.ticker}`}
                          className="group flex min-h-0 items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-50/40 px-2.5 py-1.5 transition duration-300 hover:-translate-y-0.5 hover:border-red-500/50 hover:shadow-[0_6px_14px_rgba(239,68,68,0.15)]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-block size-1.5 shrink-0 rounded-full bg-red-500 transition group-hover:scale-125" />
                            <p
                              className="truncate text-[12px] font-black tracking-[-0.01em]"
                              style={{ color: "#072116" }}
                            >
                              {m.ticker}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-[10px] font-bold tabular-nums"
                              style={{ color: "rgba(7,33,22,0.7)" }}
                            >
                              ${m.currentPrice.toFixed(2)}
                            </p>
                            <p className="text-[10px] font-black tabular-nums text-red-600">
                              {m.changePct.toFixed(2)}%
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p
                        className="py-2 text-center text-[10px] font-semibold"
                        style={{ color: "rgba(7,33,22,0.5)" }}
                      >
                        No losers yet
                      </p>
                    )}
                  </div>
                </div>
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
    <div className="group flex min-h-[74px] items-center gap-3 rounded-xl bg-[#faf6f0] px-3 py-2 text-[#072116] shadow-[0_6px_16px_rgba(0,0,0,0.14)] ring-1 ring-white/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)] hover:ring-[#ddb159]/35 lg:min-h-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[15px] font-black text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_0_18px_rgba(221,177,89,0.24)] [font-variant-emoji:text]">
        {icon}
      </div>

      <div className="min-w-0">
        <p
          className="truncate text-[8.5px] font-extrabold uppercase tracking-[0.1em]"
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
      className="group relative flex min-h-[88px] items-center gap-3 overflow-hidden rounded-2xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061f15)] px-3 py-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-[#ddb159] hover:shadow-[0_18px_44px_rgba(0,0,0,0.28)] lg:h-full lg:min-h-0"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-20 rounded-full bg-[#ddb159]/20 blur-2xl transition duration-500 group-hover:bg-[#ddb159]/30" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.045),transparent)] opacity-0 transition duration-500 group-hover:opacity-100" />

      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#ddb159]/30 bg-[#072116]/80 text-[18px] text-[#ddb159] transition duration-300 group-hover:scale-105">
        ♛
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
          ✦ AI-Powered
        </p>
        <h2 className="mt-0.5 truncate text-[14px] font-black leading-tight tracking-[-0.03em] text-[#faf6f0]">
          Build Your AI Portfolio
        </h2>
        <p className="mt-0.5 truncate text-[10px] font-medium text-[#faf6f0]/65">
          AI picks, weights, and watches stocks for you.
        </p>
      </div>

      <div className="relative shrink-0">
        <span className="text-[11px] font-bold text-[#ddb159] transition duration-300 group-hover:translate-x-0.5">
          Start →
        </span>
      </div>
    </Link>
  );
}
