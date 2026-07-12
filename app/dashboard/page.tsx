import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DashboardPortfolioHoverWidget } from "@/components/DashboardPortfolioHoverWidget";
import { PortfolioOpportunitiesWidget as SharedPortfolioOpportunitiesWidget } from "@/components/PortfolioOpportunitiesWidget";
import { StockLogo } from "@/components/StockLogo";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import {
  StockChart,
  type ChartPoint,
  type TimeRange,
} from "@/components/StockChart";
import { RankingsLock } from "@/components/RankingsLock";
import { createClient } from "@/utils/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  getLatestPriceFromChart,
  getSP500Chart,
} from "@/lib/yahoo";
import {
  getRankMove24h,
  getRankSnapshotMapAround24hAgo,
  moveClassName,
} from "@/lib/rank-history";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import {
  getDashboardMainPortfolio,
  type DashboardPortfolioOpportunity,
} from "@/lib/dashboard-portfolio";
import { ActivationChecklist } from "@/components/ActivationChecklist";
import { StockIcon, type StockIconName } from "@/components/StockIcon";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
import { ModuleState } from "@/components/ModuleState";
import { FreshnessLabel } from "@/components/FreshnessLabel";
import { DashboardPortfolioSelector } from "@/components/DashboardPortfolioSelector";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";

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

function formatPrice(value: Ranking["price"] | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"] | null | undefined) {
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
  const first = points.find(
    (p) => Number.isFinite(p.close) && p.close > 0,
  )?.close;
  const last = [...points]
    .reverse()
    .find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  if (!first || !last || first <= 0) return null;
  return ((last - first) / first) * 100;
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ portfolio?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const firstName = getFirstNameFromUserMetadata(user);

  // Run profile subscription check, all rankings queries, and portfolio fetch
  // concurrently — previously profile blocked rankings, and portfolio blocked sp500/snapshots.
  const [
    profileResult,
    { data: rankingsData },
    { count: totalCount },
    { count: bullishCount },
    dashboardPortfolio,
    sp500Data,
    snapshotMap,
  ] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("subscription_status")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(10),
    supabase.from("stock_rankings").select("*", { count: "exact", head: true }),
    supabase
      .from("stock_rankings")
      .select("*", { count: "exact", head: true })
      .gte("score", 7000),
    user ? getDashboardMainPortfolio(supabase, user.id, params.portfolio) : Promise.resolve(null),
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getRankSnapshotMapAround24hAgo(supabase),
  ]);

  const hasSubscription = hasActiveSubscription(
    (profileResult.data as { subscription_status?: string } | null)
      ?.subscription_status,
  );
  const rankingsLocked = !hasSubscription;

  const rankings = (rankingsData ?? []) as Ranking[];
  const topRanked = rankings[0];
  const portfolioSummary: PortfolioHealthSummary | null =
    dashboardPortfolio?.summary ?? null;
  const portfolioValueChart: Partial<Record<TimeRange, ChartPoint[]>> =
    dashboardPortfolio?.chartData ?? {};
  const portfolioOpportunities: DashboardPortfolioOpportunity[] =
    hasSubscription ? (dashboardPortfolio?.opportunities ?? []).slice(0, 2) : [];

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
  const sp500DailyChangePct = getChartChangePct(sp500Data, "1D");

  const dashboardRankingsGrid =
    "grid-cols-[34px_minmax(76px,0.55fr)_minmax(120px,1.25fr)_58px_minmax(88px,0.85fr)_70px_70px]";

  return (
    <AppShell activePath="/dashboard" askLabel="Ask StockGPT" askContext={{ contextType: "dashboard", ...(dashboardPortfolio?.portfolioId ? { portfolioId: dashboardPortfolio.portfolioId } : {}) }}>
      <main className="sg-dashboard-main min-h-full overflow-visible">
        <div className="grid gap-3 lg:hidden">
          <WelcomeBanner name={firstName} />
          <div className="flex justify-start">
            <AskStockGPTButton canUseAskStockGPT={hasSubscription} isAuthenticated={!!user} label="Ask StockGPT" context={{ contextType: "dashboard", ...(dashboardPortfolio?.portfolioId ? { portfolioId: dashboardPortfolio.portfolioId } : {}) }} />
          </div>
          <PortfolioDashboardWidget
            summary={portfolioSummary}
            chartData={portfolioValueChart}
            chartMeta={dashboardPortfolio?.chartMeta ?? null}
            portfolioId={dashboardPortfolio?.portfolioId ?? null}
            portfolios={dashboardPortfolio?.portfolios ?? []}
            canUsePremium={hasSubscription}
            valuationState={dashboardPortfolio?.valuationState ?? "empty"}
            missingPriceTickers={dashboardPortfolio?.missingPriceTickers ?? []}
          />
          {!portfolioSummary && <ActivationChecklist planComplete={hasSubscription} portfolioComplete={false} />}
          {hasSubscription ? <SharedPortfolioOpportunitiesWidget opportunities={portfolioOpportunities} /> : <ModuleState eyebrow="Portfolio-fit opportunities" title="Premium analysis locked" description="Build or import a portfolio now; unlock StockGPT intelligence to see portfolio-fit research." tone="locked" />}
          <DashboardBriefing summary={portfolioSummary} topRanked={topRanked} canUsePremium={hasSubscription} valuationState={dashboardPortfolio?.valuationState ?? "empty"} />
          <RankingsPanel rankings={rankings} rankingsLocked={rankingsLocked} snapshotMap={snapshotMap} gridClass={dashboardRankingsGrid} />
          <MarketOverviewCard sp500Data={sp500Data} changePct={sp500DailyChangePct} />
        </div>

        <div className="hidden gap-3 lg:grid lg:min-h-[calc(100dvh-118px)] lg:grid-cols-[minmax(0,1fr)_clamp(318px,29vw,430px)]">
          <section className="grid min-h-0 gap-3 lg:grid-rows-[clamp(108px,15dvh,138px)_auto_clamp(54px,7dvh,62px)_minmax(420px,1fr)]">
            <WelcomeBanner name={firstName} />
            <div className="min-h-0 min-w-0">
              <ActivationChecklist
                planComplete={hasSubscription}
                portfolioComplete={Boolean(portfolioSummary)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 lg:min-h-0 lg:grid-cols-4">
              <StatBlock
                icon="rankings"
                label="Top Ranked"
                main={rankingsLocked ? "Locked" : (topRanked?.ticker ?? "—")}
                sub={
                  rankingsLocked
                    ? "Subscribe to unlock"
                    : (topRanked?.company ?? "—")
                }
              />
              <StatBlock
                icon="trend-up"
                label="Bullish %"
                main={`${bullishPct}%`}
                sub={sentiment}
              />
              <StatBlock
                icon="total"
                label="Total"
                main={(totalCount ?? rankings.length).toLocaleString()}
                sub="stocks ranked"
              />
              <StatBlock
                icon="clock"
                label="Updated"
                main={formatUpdatedTime(topRanked?.updated_at)}
                sub="latest model run"
              />
            </div>

            <RankingsPanel
              rankings={rankings}
              rankingsLocked={rankingsLocked}
              snapshotMap={snapshotMap}
              gridClass={dashboardRankingsGrid}
            />
          </section>

          <aside className="grid content-start gap-3 lg:min-h-0">
            <PortfolioDashboardWidget
              summary={portfolioSummary}
              chartData={portfolioValueChart}
              chartMeta={dashboardPortfolio?.chartMeta ?? null}
              portfolioId={dashboardPortfolio?.portfolioId ?? null}
              portfolios={dashboardPortfolio?.portfolios ?? []}
              canUsePremium={hasSubscription}
              valuationState={dashboardPortfolio?.valuationState ?? "empty"}
              missingPriceTickers={dashboardPortfolio?.missingPriceTickers ?? []}
            />
            {hasSubscription ? <SharedPortfolioOpportunitiesWidget opportunities={portfolioOpportunities} /> : <ModuleState title="Premium opportunities locked" description="Unlock portfolio-fit research and health analysis." tone="locked" />}
            <DashboardBriefing summary={portfolioSummary} topRanked={topRanked} canUsePremium={hasSubscription} valuationState={dashboardPortfolio?.valuationState ?? "empty"} />
            <MarketOverviewCard
              sp500Data={sp500Data}
              changePct={sp500DailyChangePct}
            />
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
  gridClass,
}: {
  rankings: Ranking[];
  rankingsLocked: boolean;
  snapshotMap: Map<string, number | null>;
  gridClass: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 lg:min-h-0">
      <div className="flex h-[54px] items-center justify-between gap-3 border-b border-[#072116]/10 px-4 py-2 xl:h-[58px]">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            AI Rankings
          </p>
          <h2 className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.04em]">
            Top 10 Ranked Stocks
          </h2>
        </div>

        <Link
          href={rankingsLocked ? "/pricing?feature=rankings" : "/rankings"}
          className="shrink-0 rounded-full bg-[#ddb159] px-4 py-2 text-[10px] font-black text-[#072116] shadow-[0_6px_16px_rgba(221,177,89,0.26)] transition hover:brightness-105"
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
                <RankingMobileRow key={stock.id} stock={stock} />
              ))
            ) : (
              <EmptyRankings />
            )}
          </div>
        </div>
      </RankingsLock>

      <RankingsLock
        isLocked={rankingsLocked}
        className="hidden h-[calc(100%-54px)] min-h-0 overflow-hidden lg:block xl:h-[calc(100%-58px)]"
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

                    className={`group grid ${gridClass} h-[10%] min-h-0 items-center border-b border-[#072116]/8 text-[clamp(10px,0.72vw,12px)] text-[#072116] transition last:border-b-0 hover:bg-[#ddb159]/12 hover:shadow-[inset_3px_0_0_#ddb159]`}
                  >
                    <div className="min-w-0 px-2 font-bold tabular-nums text-[#072116]/75">
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
                      <span className="min-w-0 truncate">
                        {stock.company ?? "—"}
                      </span>
                    </div>
                    <div className="min-w-0 px-2">
                      <span
                        title={move.title}
                        className={[
                          "inline-flex h-5 min-w-[38px] items-center justify-center rounded-full border px-1 text-[8px] font-black tabular-nums",
                          moveClassName(move.tone),
                        ].join(" ")}
                      >
                        {move.label}
                      </span>
                    </div>
                    <div className="hidden min-w-0 truncate px-2 text-[#072116]/60 sm:block">
                      {stock.sector ?? "—"}
                    </div>
                    <div className="min-w-0 px-2 text-right font-semibold tabular-nums">
                      {formatPrice(stock.price)}
                    </div>
                    <div className="flex min-w-0 justify-end px-2">
                      <span className="inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black tabular-nums text-[#072116]">
                        {formatScore(stock.score)}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyRankings />
            )}
          </div>
        </div>
      </RankingsLock>
    </div>
  );
}

function EmptyRankings() {
  return (
    <div className="px-4 py-8 text-center text-[12px] font-semibold text-[#072116]/55">
      No ranking data available yet.
    </div>
  );
}

function RankingMobileRow({ stock }: { stock: Ranking }) {
  return (
    <Link
      href={`/stock/${stock.ticker}`}

      className="grid min-h-[42px] grid-cols-[32px_minmax(0,1fr)_72px_68px] items-center gap-1 px-3 py-2 text-[11px] text-[#072116] transition hover:bg-[#ddb159]/10"
    >
      <div className="font-bold tabular-nums text-[#072116]/65">
        {stock.rank ?? "—"}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <StockLogo ticker={stock.ticker} company={stock.company} size={18} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black">
            {stock.ticker ?? "—"}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-[9px] font-semibold text-[#072116]/45">
              {stock.company ?? "—"}
            </p>
          </div>
        </div>
      </div>
      <div className="text-right text-[10px] font-bold tabular-nums">
        {formatPrice(stock.price)}
      </div>
      <div className="flex justify-end">
        <span className="inline-flex min-w-[52px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black tabular-nums text-[#072116]">
          {formatScore(stock.score)}
        </span>
      </div>
    </Link>
  );
}

function StatBlock({
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
    <div className="group flex min-h-[58px] items-center gap-3 rounded-xl bg-[#faf6f0] px-3 py-2 text-[#072116] shadow-[0_6px_16px_rgba(0,0,0,0.14)] ring-1 ring-white/30 lg:min-h-0 lg:overflow-hidden">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <StockIcon name={icon} className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[8.5px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[14px] font-black leading-none tracking-[-0.02em] xl:text-[15px]">
          {main}
        </p>
        <p className="mt-1 truncate text-[9.5px] font-semibold text-[#072116]/45">
          {sub}
        </p>
      </div>
    </div>
  );
}

function PortfolioDashboardWidget({
  summary,
  chartData,
  chartMeta,
  portfolioId,
  portfolios,
  canUsePremium,
  valuationState,
  missingPriceTickers,
}: {
  summary: PortfolioHealthSummary | null;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta: PortfolioChartMeta | null;
  portfolioId: string | null;
  portfolios: Array<{ id: string; name: string }>;
  canUsePremium: boolean;
  valuationState: "exact" | "partial" | "unavailable" | "empty";
  missingPriceTickers: string[];
}) {
  if (!summary) {
    return (
      <div className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[linear-gradient(135deg,#0d3420,#082519_60%,#061b12)] p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.18)] lg:h-full lg:min-h-0">
        <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-[#ddb159]/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Portfolio
            </p>
            <h2 className="mt-1 truncate text-[19px] font-black leading-none tracking-[-0.05em]">
              Build your first portfolio
            </h2>
          </div>
          <Link
            href="/portfolio?builder=1"
            className="shrink-0 rounded-full bg-[#ddb159] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#072116] transition hover:brightness-105"
          >
            Start →
          </Link>
        </div>
        <p className="relative mt-2 line-clamp-2 text-[11px] font-semibold leading-4 text-[#faf6f0]/58">
          Add holdings or import Trading 212 CSVs so StockGPT can monitor value,
          risk and alerts.
        </p>
      </div>
    );
  }

  const portfolioHref = portfolioId
    ? `/portfolio?portfolio=${encodeURIComponent(portfolioId)}`
    : "/portfolio";

  return (
    <section className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#ddb159]/24 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061b12)] p-3 text-[#faf6f0] transition hover:border-[#ddb159]/55">
      <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-[#ddb159]/18 blur-3xl" />
      <div className="relative flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8.5px] font-black uppercase tracking-[0.15em] text-[#ddb159]">
            Portfolio
          </p>
          <h2 className="mt-1 truncate text-[16px] font-black leading-none tracking-[-0.05em] xl:text-[18px]">
            {summary.name}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#ddb159] px-2.5 py-1 text-[10px] font-black text-[#072116]">
          {canUsePremium ? `Health ${summary.score}/100` : "Health locked"}
        </span>
      </div>

      {portfolioId && <div className="relative mt-2 flex items-center justify-between gap-2"><DashboardPortfolioSelector value={portfolioId} portfolios={portfolios} /><FreshnessLabel value={chartMeta?.health.latestSnapshotAt} compact /></div>}

      <Link href={portfolioHref} className="relative block min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159]">
        <DashboardPortfolioHoverWidget summary={summary} chartData={chartData} valuationState={valuationState} />
      </Link>

      {(chartMeta?.health.displayState !== "ready" || chartMeta?.health.isFlat) && <p className="relative mt-1 text-[10px] font-semibold text-[#e7c56c]">{chartMeta?.health.isFlat ? "Limited movement history; value is unchanged across confirmed snapshots." : chartMeta?.health.displayState === "error_with_cache" ? "Showing last-known chart while refresh is delayed." : chartMeta?.health.displayState === "error_no_cache" ? "Chart temporarily unavailable." : "Limited chart history; tracking is still building."}</p>}
      {missingPriceTickers.length > 0 && valuationState !== "unavailable" && <p className="relative mt-1 truncate text-[9px] font-semibold text-[#e7c56c]">Latest prices missing: {missingPriceTickers.join(", ")}</p>}

      <div className="relative mt-2 flex shrink-0 items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.11em] text-[#faf6f0]/45 lg:mt-0">
        <span className="truncate">
          Since created · {summary.holdingsCount} holdings
        </span>
        <Link href={portfolioHref} className="shrink-0 text-[#ddb159]">Open →</Link>
      </div>
    </section>
  );
}

function DashboardBriefing({
  summary,
  topRanked,
  canUsePremium,
  valuationState,
}: {
  summary: PortfolioHealthSummary | null;
  topRanked?: Ranking;
  canUsePremium: boolean;
  valuationState: "exact" | "partial" | "unavailable" | "empty";
}) {
  const items = summary
    ? [
        valuationState === "unavailable"
          ? "Portfolio value is temporarily unavailable because the latest prices could not be verified."
          : valuationState === "partial"
            ? "Portfolio value is estimated while StockGPT waits for missing prices."
            : `Portfolio total return is ${summary.totalPnl >= 0 ? "+" : ""}${summary.totalPnlPct.toFixed(1)}%.`,
        canUsePremium
          ? summary.actionAlerts > 0
            ? `${summary.actionAlerts} holding review${summary.actionAlerts === 1 ? " is" : "s are"} available; none is presented as urgent.`
            : "No major portfolio review alerts are active right now."
          : "Portfolio health and review priorities are available with an active subscription.",
        `Your portfolio currently contains ${summary.holdingsCount} holding${summary.holdingsCount === 1 ? "" : "s"} across ${summary.sectorCount} sector${summary.sectorCount === 1 ? "" : "s"}.`,
        topRanked?.ticker ? `${topRanked.ticker} remains the highest-ranked stock in the current StockGPT table.` : "The latest rankings are not available yet.",
      ]
    : [
        "Build or import your first portfolio to receive a personal daily briefing.",
        topRanked?.ticker ? `${topRanked.ticker} is currently the leading StockGPT-ranked stock.` : "Rankings are still loading.",
      ];

  return (
    <section className="rounded-2xl border border-[#ddb159]/18 bg-[#0a2a1d] p-4 text-[#faf6f0]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Daily briefing</p><h2 className="mt-1 text-[20px] font-black tracking-[-0.04em]">What changed today</h2></div>
        <FreshnessLabel value={topRanked?.updated_at} compact />
      </div>
      <ul className="mt-3 divide-y divide-[#ddb159]/10">
        {items.slice(0, 4).map((item) => <li key={item} className="py-2.5 text-[12px] font-semibold leading-5 text-[#faf6f0]/68">{item}</li>)}
      </ul>
    </section>
  );
}

function formatIndexValue(value: number | null) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MarketOverviewCard({
  sp500Data,
  changePct,
}: {
  sp500Data: Partial<Record<TimeRange, ChartPoint[]>>;
  changePct: number | null;
}) {
  const latestPrice = getLatestPriceFromChart(sp500Data);

  return (
    <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 text-[#faf6f0] shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
            Market Overview
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1">
            <h3 className="truncate text-[22px] font-black leading-none tracking-[-0.05em]">
              S&amp;P 500
            </h3>
            <span className="text-[13px] font-black tabular-nums text-[#faf6f0]/72">
              {formatIndexValue(latestPrice)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
            1D
          </p>
          {changePct != null && (
            <p
              className={`rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${
                changePct >= 0
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-400/30 bg-red-500/10 text-red-300"
              }`}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 min-h-0 overflow-hidden rounded-xl bg-[#072116]/35 lg:hidden">
        <StockChart
          ticker="S&P 500"
          data={sp500Data}
          initialRange="1D"
          height={150}
          compact
        />
      </div>
      <div className="mt-3 hidden min-h-0 overflow-hidden rounded-xl bg-[#072116]/35 lg:block">
        <StockChart
          ticker="S&P 500"
          data={sp500Data}
          initialRange="1D"
          height={118}
          compact
        />
      </div>
    </div>
  );
}
