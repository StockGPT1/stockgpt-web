import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { StockChart } from "@/components/StockChart";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { getOneDayMoveMap, getSP500Chart } from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
  moveClassName,
} from "@/lib/rank-history";

export const metadata: Metadata = {
  title: "Dashboard | StockGPT Portfolio Intelligence",
  description:
    "Private StockGPT dashboard for AI stock rankings, portfolio monitoring, daily market changes and S&P 500 insights.",
  robots: { index: false, follow: false },
};

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

type PortfolioRow = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  currency: string | null;
  created_at: string | null;
};

type HoldingRow = {
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
};

type HoldingRanking = {
  ticker: string | null;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | string | null;
  price: number | string | null;
};

type PortfolioHoldingSummary = {
  ticker: string;
  company: string | null;
  sector: string | null;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  score: number | null;
  rank: number | null;
};

type PortfolioSummary = {
  id: string;
  name: string;
  currency: string;
  riskTolerance: string | null;
  totalValue: number;
  holdingsValue: number;
  cashBalance: number;
  pnl: number;
  pnlPct: number;
  healthScore: number;
  healthLabel: string;
  avgScore: number | null;
  holdings: PortfolioHoldingSummary[];
  weakCount: number;
  sectorCount: number;
};

type DailyChangeItem = {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  score: string;
  rankLabel: string;
  rankTone: "up" | "down" | "flat" | "none";
  rankTitle: string;
  dailyMoveLabel: string;
  dailyMoveTone: "positive" | "negative" | "neutral";
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPrice(value: Ranking["price"] | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"] | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: safe >= 1000 ? 0 : 2,
  }).format(safe);
}

function pct(value: number, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

function formatUpdatedTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanPortfolioName(name: string | null | undefined) {
  const cleaned = String(name ?? "").trim();
  return cleaned || "Main Portfolio";
}

function getChartChangePct(
  data: Partial<Record<string, Array<{ close: number }>>>,
  range = "1D",
) {
  const points = data[range];
  if (!points || points.length < 2) return null;
  const first = points.find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  const last = [...points]
    .reverse()
    .find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  if (!first || !last || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function dailyMoveClassName(changePct: number | null | undefined) {
  if (!Number.isFinite(changePct)) return "border-[#072116]/8 bg-transparent text-[#072116]/35";
  if (Number(changePct) >= 0) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
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

function getFirstNameFromUserMetadata(user: { user_metadata?: Record<string, unknown> }) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name.trim()
        : "";
  if (!fullName) return undefined;
  return fullName.split(/\s+/)[0];
}

function healthLabel(score: number) {
  if (score >= 82) return "Strong";
  if (score >= 68) return "Healthy";
  if (score >= 52) return "Needs review";
  return "High risk";
}

function buildPortfolioSummary({
  portfolio,
  holdings,
  rankingMap,
}: {
  portfolio: PortfolioRow | null;
  holdings: HoldingRow[];
  rankingMap: Map<string, HoldingRanking>;
}): PortfolioSummary | null {
  if (!portfolio) return null;

  const currency = portfolio.currency ?? "USD";
  const holdingSummaries = holdings
    .filter((holding) => holding.ticker)
    .map((holding) => {
      const ticker = String(holding.ticker).toUpperCase();
      const ranking = rankingMap.get(ticker);
      const shares = toNumber(holding.shares, 0);
      const entryPrice = toNumber(holding.entry_price, 0);
      const currentPrice = toNumber(ranking?.price, entryPrice);
      const currentValue = shares * currentPrice;
      const costBasis = shares * entryPrice;
      return {
        ticker,
        company: ranking?.company ?? null,
        sector: ranking?.sector ?? null,
        shares,
        entryPrice,
        currentPrice,
        currentValue,
        pnl: currentValue - costBasis,
        score: ranking?.score == null ? null : Number(ranking.score),
        rank: ranking?.rank ?? null,
      };
    })
    .filter((holding) => holding.shares > 0);

  const holdingsValue = holdingSummaries.reduce((sum, holding) => sum + holding.currentValue, 0);
  const cashBalance = toNumber(portfolio.cash_balance, 0);
  const totalValue = holdingsValue + cashBalance;
  const costBasis = holdingSummaries.reduce((sum, holding) => sum + holding.shares * holding.entryPrice, 0);
  const pnl = holdingSummaries.reduce((sum, holding) => sum + holding.pnl, 0);
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const validScores = holdingSummaries
    .map((holding) => holding.score)
    .filter((score): score is number => Number.isFinite(score));
  const avgScore = validScores.length > 0 ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length) : null;
  const sectorCount = new Set(holdingSummaries.map((holding) => holding.sector).filter(Boolean)).size;
  const weakCount = holdingSummaries.filter(
    (holding) => (holding.score != null && holding.score < 5200) || (holding.rank != null && holding.rank > 300),
  ).length;
  const cashDrag = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;
  const diversificationScore = clamp(sectorCount * 4, 0, 16);
  const scoreContribution = avgScore == null ? 14 : clamp((avgScore / 10000) * 34, 8, 34);
  const cashPenalty = cashDrag > 35 ? 8 : cashDrag > 22 ? 4 : 0;
  const weakPenalty = weakCount * 7;
  const holdingPenalty = holdingSummaries.length === 0 ? 18 : holdingSummaries.length < 3 ? 6 : 0;
  const healthScore = Math.round(
    clamp(48 + scoreContribution + diversificationScore + (pnlPct > 0 ? 5 : 0) - cashPenalty - weakPenalty - holdingPenalty, 0, 100),
  );

  return {
    id: portfolio.id,
    name: cleanPortfolioName(portfolio.name),
    currency,
    riskTolerance: portfolio.risk_tolerance,
    totalValue,
    holdingsValue,
    cashBalance,
    pnl,
    pnlPct,
    healthScore,
    healthLabel: healthLabel(healthScore),
    avgScore,
    holdings: holdingSummaries.sort((a, b) => b.currentValue - a.currentValue),
    weakCount,
    sectorCount,
  };
}

function dailyMoveTone(value: number | null | undefined): DailyChangeItem["dailyMoveTone"] {
  if (!Number.isFinite(value)) return "neutral";
  if (Number(value) > 0) return "positive";
  if (Number(value) < 0) return "negative";
  return "neutral";
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
    hasSubscription = hasActiveSubscription(profile?.subscription_status);
  }

  const rankingsLocked = !hasSubscription;
  const [{ data: rankingsData }, { count: totalCount }, { count: bullishCount }] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(10),
    supabase.from("stock_rankings").select("*", { count: "exact", head: true }),
    supabase.from("stock_rankings").select("*", { count: "exact", head: true }).gte("score", 7000),
  ]);

  const rankings = (rankingsData ?? []) as Ranking[];
  const topRanked = rankings[0];

  let activePortfolio: PortfolioRow | null = null;
  let portfolioHoldings: HoldingRow[] = [];
  let portfolioRankingMap = new Map<string, HoldingRanking>();

  if (user) {
    const { data: portfolioData } = await supabase
      .from("user_portfolios")
      .select("id, name, risk_tolerance, time_horizon, investment_amount, cash_balance, currency, created_at")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    activePortfolio = (portfolioData ?? null) as PortfolioRow | null;

    if (activePortfolio) {
      const { data: holdingsData } = await supabase
        .from("portfolio_holdings")
        .select("ticker, shares, entry_price")
        .eq("portfolio_id", activePortfolio.id)
        .order("added_at", { ascending: false })
        .limit(20);

      portfolioHoldings = (holdingsData ?? []) as HoldingRow[];
      const heldTickers = portfolioHoldings
        .map((holding) => holding.ticker)
        .filter((ticker): ticker is string => Boolean(ticker))
        .map((ticker) => ticker.toUpperCase());

      if (heldTickers.length > 0) {
        const { data: holdingRankingData } = await supabase
          .from("stock_rankings")
          .select("ticker, company, sector, rank, score, price")
          .in("ticker", heldTickers);

        portfolioRankingMap = new Map(
          ((holdingRankingData ?? []) as HoldingRanking[])
            .filter((row) => row.ticker)
            .map((row) => [String(row.ticker).toUpperCase(), row]),
        );
      }
    }
  }

  const portfolioSummary = buildPortfolioSummary({
    portfolio: activePortfolio,
    holdings: portfolioHoldings,
    rankingMap: portfolioRankingMap,
  });

  const dashboardTickerList = Array.from(
    new Set([
      ...rankings.map((r) => r.ticker).filter((t): t is string => !!t),
      ...portfolioHoldings.map((h) => h.ticker).filter((t): t is string => !!t),
    ]),
  );

  const [sp500Data, snapshotMap, dailyMoveMap] = await Promise.all([
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getRankSnapshotMapAround24hAgo(supabase),
    getOneDayMoveMap(dashboardTickerList),
  ]);

  const bullishPct = totalCount && totalCount > 0 ? Math.round(((bullishCount ?? 0) / totalCount) * 100) : 0;
  const sentiment = bullishPct >= 50 ? "Strong market" : bullishPct >= 35 ? "Healthy market" : bullishPct >= 20 ? "Cautious market" : "Weak market";
  const sp500DailyChangePct = getChartChangePct(sp500Data, "1D");

  const whatChangedToday: DailyChangeItem[] = rankings.slice(0, 8).map((stock) => {
    const ticker = stock.ticker ?? "";
    const rankMove = getRankMove24h(stock.rank, snapshotMap.get(ticker));
    const dailyMove = dailyMoveMap.get(ticker)?.changePct;
    return {
      ticker: ticker || "—",
      company: stock.company ?? "—",
      sector: stock.sector ?? "—",
      price: formatPrice(stock.price),
      score: formatScore(stock.score),
      rankLabel: rankMove.label,
      rankTone: rankMove.tone,
      rankTitle: rankMove.title,
      dailyMoveLabel: Number.isFinite(dailyMove) ? `${Number(dailyMove) >= 0 ? "+" : ""}${Number(dailyMove).toFixed(1)}%` : "—",
      dailyMoveTone: dailyMoveTone(dailyMove),
    };
  });

  const dashboardRankingsGrid = "grid-cols-[34px_92px_minmax(0,1fr)_60px_104px_72px_74px]";

  return (
    <AppShell activePath="/dashboard">
      <main className="min-h-full overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden">
        <div className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-3">
          <section className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-rows-[126px_62px_146px_minmax(0,1fr)] lg:overflow-hidden">
            <WelcomeBanner name={firstName} />

            <div className="grid grid-cols-2 gap-2 lg:min-h-0 lg:grid-cols-4">
              <StatBlock icon="♛" label="Top Ranked" main={rankingsLocked ? "Locked" : topRanked?.ticker ?? "—"} sub={rankingsLocked ? "Subscribe to unlock" : topRanked?.company ?? "—"} />
              <StatBlock icon="↗︎" label="Bullish %" main={`${bullishPct}%`} sub={sentiment} />
              <StatBlock icon="▦" label="Total" main={(totalCount ?? rankings.length).toLocaleString()} sub="stocks ranked" />
              <StatBlock icon="◷" label="Updated" main={formatUpdatedTime(topRanked?.updated_at)} sub="latest model run" />
            </div>

            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.95fr)] lg:overflow-hidden">
              <WhatChangedToday items={whatChangedToday} />
              <PortfolioDashboardWidget summary={portfolioSummary} />
            </div>

            <RankingsPanel rankings={rankings} rankingsLocked={rankingsLocked} snapshotMap={snapshotMap} dailyMoveMap={dailyMoveMap} gridClass={dashboardRankingsGrid} />
          </section>

          <aside className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-rows-[168px_minmax(0,1fr)] lg:overflow-hidden lg:pb-1">
            <MarketOverviewCard sp500Data={sp500Data} changePct={sp500DailyChangePct} />
            <DailyResearchCard items={whatChangedToday} />
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function RankingsPanel({
  rankings,
  rankingsLocked,
  snapshotMap,
  dailyMoveMap,
  gridClass,
}: {
  rankings: Ranking[];
  rankingsLocked: boolean;
  snapshotMap: Map<string, number | null>;
  dailyMoveMap: Map<string, { changePct: number | null }>;
  gridClass: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 lg:min-h-0">
      <div className="flex h-[58px] items-center justify-between gap-3 border-b border-[#072116]/10 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ AI Rankings</p>
          <h2 className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.04em]">Top 10 Ranked Stocks</h2>
        </div>
        <Link href={rankingsLocked ? "/pricing?feature=rankings" : "/rankings"} className="shrink-0 rounded-full bg-[#ddb159] px-4 py-2 text-[10px] font-black text-[#072116] shadow-[0_6px_16px_rgba(221,177,89,0.26)] transition hover:brightness-105">
          {rankingsLocked ? "Unlock →" : "View All →"}
        </Link>
      </div>

      <RankingsLock isLocked={rankingsLocked} className="lg:hidden">
        <div>
          <div className="grid grid-cols-[32px_minmax(0,1fr)_72px_68px] bg-[#072116] px-3 py-2 text-[9px] font-black uppercase tracking-wide text-[#faf6f0]">
            <div>#</div><div>Ticker</div><div className="text-right">Price</div><div className="text-right">Score</div>
          </div>
          <div className="divide-y divide-[#072116]/8">
            {rankings.length > 0 ? rankings.map((stock) => (
              <RankingMobileRow key={stock.id} stock={stock} dailyMove={dailyMoveMap.get(stock.ticker ?? "")?.changePct ?? undefined} />
            )) : <EmptyRankings />}
          </div>
        </div>
      </RankingsLock>

      <RankingsLock isLocked={rankingsLocked} className="hidden h-[calc(100%-58px)] min-h-0 overflow-hidden lg:block">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            {rankings.length > 0 ? rankings.map((stock) => {
              const move = getRankMove24h(stock.rank, snapshotMap.get(stock.ticker ?? ""));
              return (
                <Link key={stock.id} href={`/stock/${stock.ticker}`} className={`group grid ${gridClass} h-[10%] min-h-0 items-center border-b border-[#072116]/8 text-[10px] text-[#072116] transition last:border-b-0 hover:bg-[#ddb159]/12 hover:shadow-[inset_3px_0_0_#ddb159]`}>
                  <div className="px-2 font-bold tabular-nums text-[#072116]/75">{stock.rank ?? "—"}</div>
                  <div className="flex min-w-0 items-center gap-2 px-2 font-black"><StockLogo ticker={stock.ticker} company={stock.company} size={17} /><span className="min-w-0 truncate tracking-[-0.01em]">{stock.ticker ?? "—"}</span></div>
                  <div className="flex min-w-0 items-center gap-2 px-2 font-semibold tracking-[-0.01em]"><span className="min-w-0 truncate">{stock.company ?? "—"}</span><DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} /></div>
                  <div className="px-2"><span title={move.title} className={["inline-flex h-5 min-w-[38px] items-center justify-center rounded-full border px-1 text-[8px] font-black tabular-nums", moveClassName(move.tone)].join(" ")}>{move.label}</span></div>
                  <div className="hidden min-w-0 truncate px-2 text-[#072116]/60 sm:block">{stock.sector ?? "—"}</div>
                  <div className="px-2 text-right font-semibold tabular-nums">{formatPrice(stock.price)}</div>
                  <div className="flex justify-end px-2"><span className="inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black tabular-nums text-[#072116]">{formatScore(stock.score)}</span></div>
                </Link>
              );
            }) : <EmptyRankings />}
          </div>
        </div>
      </RankingsLock>
    </div>
  );
}

function EmptyRankings() {
  return <div className="px-4 py-8 text-center text-[12px] font-semibold text-[#072116]/55">No ranking data available yet.</div>;
}

function RankingMobileRow({ stock, dailyMove }: { stock: Ranking; dailyMove?: number }) {
  return (
    <Link href={`/stock/${stock.ticker}`} className="grid min-h-[42px] grid-cols-[32px_minmax(0,1fr)_72px_68px] items-center gap-1 px-3 py-2 text-[11px] text-[#072116] transition hover:bg-[#ddb159]/10">
      <div className="font-bold tabular-nums text-[#072116]/65">{stock.rank ?? "—"}</div>
      <div className="flex min-w-0 items-center gap-2"><StockLogo ticker={stock.ticker} company={stock.company} size={18} /><div className="min-w-0"><p className="truncate text-[12px] font-black">{stock.ticker ?? "—"}</p><div className="mt-0.5 flex min-w-0 items-center gap-1.5"><p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">{stock.company ?? "—"}</p><DailyMovePill changePct={dailyMove} className="h-4 min-w-[38px] px-1 text-[7.5px]" /></div></div></div>
      <div className="text-right text-[10px] font-bold tabular-nums">{formatPrice(stock.price)}</div>
      <div className="flex justify-end"><span className="inline-flex min-w-[52px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black tabular-nums text-[#072116]">{formatScore(stock.score)}</span></div>
    </Link>
  );
}

function StatBlock({ icon, label, main, sub }: { icon: string; label: string; main: string; sub: string }) {
  return (
    <div className="group flex min-h-[64px] items-center gap-3 rounded-xl bg-[#faf6f0] px-3 py-2 text-[#072116] shadow-[0_6px_16px_rgba(0,0,0,0.14)] ring-1 ring-white/30 lg:min-h-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[15px] font-black text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] [font-variant-emoji:text]">{icon}</div>
      <div className="min-w-0"><p className="truncate text-[8.5px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">{label}</p><p className="mt-0.5 truncate text-[15px] font-black leading-tight tracking-[-0.02em] text-[#072116]">{main}</p><p className="truncate text-[9px] font-semibold text-[#072116]/55">{sub}</p></div>
    </div>
  );
}

function WhatChangedToday({ items }: { items: DailyChangeItem[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-3 text-[#072116] shadow-[0_12px_30px_rgba(0,0,0,0.18)] lg:min-h-0">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#072116]/55">✦ What changed today?</p><h2 className="mt-1 truncate text-[19px] font-black tracking-[-0.04em]">Daily research brief</h2></div><Link href="/rankings" className="shrink-0 rounded-full border border-[#072116]/10 px-3 py-1.5 text-[10px] font-black text-[#072116]/60 transition hover:border-[#ddb159]/55 hover:text-[#072116]">Rankings →</Link></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {items.slice(0, 4).map((item) => (
          <Link key={item.ticker} href={`/stock/${item.ticker}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-[#072116]/8 bg-white/72 px-3 py-2 transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/8">
            <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-[13px] font-black">{item.ticker}</p><span title={item.rankTitle} className={["inline-flex h-5 min-w-[38px] items-center justify-center rounded-full border px-1 text-[8px] font-black", moveClassName(item.rankTone)].join(" ")}>{item.rankLabel}</span></div><p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/48">{item.company}</p></div>
            <div className="text-right"><p className={["text-[12px] font-black tabular-nums", item.dailyMoveTone === "positive" ? "text-emerald-700" : item.dailyMoveTone === "negative" ? "text-red-700" : "text-[#072116]/55"].join(" ")}>{item.dailyMoveLabel}</p><p className="mt-0.5 text-[9px] font-bold text-[#072116]/42">score {item.score}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PortfolioDashboardWidget({ summary }: { summary: PortfolioSummary | null }) {
  if (!summary) {
    return (
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[linear-gradient(135deg,#0d3420,#082519_60%,#061b12)] p-4 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-[#ddb159]/20 blur-3xl" />
        <p className="relative text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">✦ Portfolio command centre</p>
        <h2 className="relative mt-2 text-[22px] font-black leading-none tracking-[-0.05em]">Build your first portfolio.</h2>
        <p className="relative mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/62">Add holdings or import Trading 212 CSVs so StockGPT can monitor exposure, risk and daily changes.</p>
        <Link href="/portfolio?builder=1" className="relative mt-3 inline-flex rounded-full bg-[#ddb159] px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105">Start portfolio →</Link>
      </div>
    );
  }

  const isPositive = summary.pnl >= 0;
  return (
    <Link href="/portfolio" className="relative min-w-0 overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061b12)] p-4 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:border-[#ddb159]/55">
      <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-[#ddb159]/18 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">✦ Portfolio health</p><h2 className="mt-1 truncate text-[20px] font-black leading-none tracking-[-0.05em]">{summary.name}</h2></div><span className="shrink-0 rounded-full bg-[#ddb159] px-3 py-1 text-[11px] font-black text-[#072116]">{summary.healthScore}/100</span></div>
      <div className="relative mt-3 grid grid-cols-[1fr_auto] items-end gap-3"><div><p className="text-[26px] font-black leading-none tracking-[-0.06em]">{money(summary.totalValue, summary.currency)}</p><p className={["mt-1 text-[12px] font-black tabular-nums", isPositive ? "text-emerald-300" : "text-red-200"].join(" ")}>{money(summary.pnl, summary.currency)} · {pct(summary.pnlPct)}</p></div><div className="text-right"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/42">Status</p><p className="text-[13px] font-black text-[#ddb159]">{summary.healthLabel}</p></div></div>
      <div className="relative mt-2 grid grid-cols-3 gap-2"><MiniMetric label="Holdings" value={String(summary.holdings.length)} /><MiniMetric label="Sectors" value={String(summary.sectorCount)} /><MiniMetric label="Avg score" value={summary.avgScore ? String(summary.avgScore) : "—"} /></div>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#ddb159]/14 bg-[#04180f]/58 px-2 py-1.5"><p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#ddb159]/70">{label}</p><p className="mt-0.5 truncate text-[14px] font-black text-[#faf6f0]">{value}</p></div>;
}

function MarketOverviewCard({ sp500Data, changePct }: { sp500Data: Partial<Record<string, Array<{ close: number }>>>; changePct: number | null }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur lg:min-h-0">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">✦ Market Overview</p><h3 className="mt-0.5 text-[15px] font-black tracking-[-0.02em] text-[#faf6f0]">S&amp;P 500</h3></div><div className="flex flex-col items-end gap-1"><p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">1D</p>{changePct != null && <p className={`rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${changePct >= 0 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</p>}</div></div>
      <div className="mt-2 overflow-hidden rounded-xl bg-[#072116]/35 lg:hidden"><StockChart ticker="S&P 500" data={sp500Data} initialRange="1D" height={150} compact /></div>
      <div className="mt-2 hidden h-[88px] overflow-hidden rounded-xl bg-[#072116]/35 lg:block"><StockChart ticker="S&P 500" data={sp500Data} initialRange="1D" height={88} compact /></div>
    </div>
  );
}

function DailyResearchCard({ items }: { items: DailyChangeItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.2)] lg:flex lg:min-h-0 lg:flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ Research queue</p><span className="rounded-full border border-[#072116]/10 px-2 py-0.5 text-[8px] font-black text-[#072116]/55">Today</span></div>
      <div className="mt-3 grid gap-2 overflow-hidden lg:min-h-0 lg:flex-1">
        {items.slice(0, 6).map((item) => (
          <Link key={item.ticker} href={`/stock/${item.ticker}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-[#072116]/8 bg-white/70 px-3 py-2 transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/8">
            <div className="min-w-0"><p className="truncate text-[12px] font-black">{item.ticker} · {item.company}</p><p className="mt-0.5 truncate text-[9px] font-bold text-[#072116]/42">{item.sector}</p></div>
            <div className="text-right"><p className={["text-[11px] font-black", item.dailyMoveTone === "positive" ? "text-emerald-700" : item.dailyMoveTone === "negative" ? "text-red-700" : "text-[#072116]/55"].join(" ")}>{item.dailyMoveLabel}</p><p className="text-[9px] font-bold text-[#072116]/42">rank {item.rankLabel}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
