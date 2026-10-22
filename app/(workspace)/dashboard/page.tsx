import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  DesktopDashboardExperience,
  type DashboardRanking,
} from "@/components/DesktopDashboardExperience";
import {
  MobileDashboardExperience,
  type MobileDashboardNewsArticle,
  type DashboardMarketData,
  type DashboardNewsData,
} from "@/components/MobileDashboardExperience";
import { MobileMarketMoversPortal } from "@/components/MobileMarketMovers";
import { getServerViewer, getViewerProfile } from "@/lib/server-viewer";
import { InlinePagePending } from "@/components/InlinePagePending";
import { NativePageRegistration } from "@/components/NativePageRegistration";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  getLatestPriceFromChart,
  getSP500Chart,
} from "@/lib/yahoo";
import { getRankSnapshotMapAround24hAgo } from "@/lib/rank-history";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import {
  getDashboardMainPortfolio,
  type DashboardPortfolioOpportunity,
} from "@/lib/dashboard-portfolio";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getCachedWorldNewsFeed } from "@/lib/world-news-feed";

export const metadata: Metadata = {
  title: "Dashboard | StockGPT Portfolio Intelligence",
  description:
    "Private StockGPT dashboard for AI stock rankings, portfolio monitoring, daily market changes and S&P 500 insights.",
  robots: { index: false, follow: false },
};

function getChartChangePct(
  data: Partial<Record<string, Array<{ close: number }>>>,
  range = "1D",
) {
  const points = data[range];
  if (!points || points.length < 2) return null;
  const first = points.find(
    (point) => Number.isFinite(point.close) && point.close > 0,
  )?.close;
  const last = [...points]
    .reverse()
    .find((point) => Number.isFinite(point.close) && point.close > 0)?.close;
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

async function getDashboardWorldNewsSafe() {
  try {
    return await getCachedWorldNewsFeed();
  } catch (error) {
    console.error("[dashboard] world news feed read failed", error);
    return null;
  }
}

function toPublishedMs(value: string | null | undefined) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function dashboardArticles(feed: Awaited<ReturnType<typeof getDashboardWorldNewsSafe>>): MobileDashboardNewsArticle[] {
  return [...(feed?.articles ?? [])]
    .filter(article => Boolean(article.title && article.url))
    .sort((a, b) => toPublishedMs(b.published_at) - toPublishedMs(a.published_at))
    .slice(0, 3).map(article => ({
      id: String(article.id), title: String(article.title), summary: article.summary,
      source: article.source, url: article.url, imageUrl: article.image_url,
      publishedAt: article.published_at,
      affectedTickers: article.affectedStocks.slice(0, 3).map(stock => stock.ticker).filter(Boolean),
    }));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolio?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getServerViewer();

  if (!user) redirect("/login?next=/dashboard");

  const firstName = getFirstNameFromUserMetadata(user);
  const nativeApp = /StockGPTApp/i.test((await headers()).get("user-agent") ?? "");

  return <AppShell activePath="/dashboard" askContext={{ contextType: "dashboard" }}>
    <Suspense fallback={<div><div className="px-5 pt-6 text-xl font-semibold">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</div><InlinePagePending /></div>}>
      <DashboardContent supabase={supabase} userId={user.id} portfolio={params.portfolio} firstName={firstName} nativeApp={nativeApp} />
    </Suspense>
  </AppShell>;
}

async function DashboardContent({ supabase, userId, portfolio, firstName, nativeApp }: {
  supabase: Awaited<ReturnType<typeof getServerViewer>>["supabase"];
  userId: string;
  portfolio?: string;
  firstName?: string;
  nativeApp: boolean;
}) {
  const marketPromise: Promise<DashboardMarketData> = getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"])
    .then(chart => ({ chart, value: getLatestPriceFromChart(chart), changePct: getChartChangePct(chart, "1D") }))
    .catch(() => ({ chart: {}, value: null, changePct: null }));
  const newsPromise: Promise<DashboardNewsData> = getDashboardWorldNewsSafe()
    .then(feed => ({ articles: dashboardArticles(feed), status: feed ? "ok" : "error" }));
  const [
    profileResult,
    { data: rankingsData },
    { count: totalCount },
    { count: bullishCount },
    dashboardPortfolio,
    marketSnapshot,
    snapshotMap,
    newsSnapshot,
  ] = await Promise.all([
    getViewerProfile().then(data => ({ data })),
    supabase
      .from("stock_rankings")
      .select("id,rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(10),
    nativeApp ? Promise.resolve({ count: null }) : supabase.from("stock_rankings").select("*", { count: "exact", head: true }),
    nativeApp ? Promise.resolve({ count: null }) : supabase
      .from("stock_rankings")
      .select("*", { count: "exact", head: true })
      .gte("score", 7000),
    getDashboardMainPortfolio(supabase, userId, portfolio, { deferDetails: nativeApp }),
    nativeApp ? Promise.resolve({ chart: {}, value: null, changePct: null } as DashboardMarketData) : marketPromise,
    nativeApp ? Promise.resolve(new Map<string, number | null>()) : getRankSnapshotMapAround24hAgo(supabase),
    nativeApp ? Promise.resolve({ articles: [], status: "error" } as DashboardNewsData) : newsPromise,
  ]);

  const hasSubscription = hasActiveSubscription(
    (profileResult.data as { subscription_status?: string } | null)
      ?.subscription_status,
  );
  const rankingsLocked = !hasSubscription;
  const rankings = (rankingsData ?? []) as DashboardRanking[];

  const portfolioSummary: PortfolioHealthSummary | null =
    dashboardPortfolio?.summary ?? null;
  const portfolioChart: Partial<Record<TimeRange, ChartPoint[]>> =
    dashboardPortfolio?.chartData ?? {};
  const opportunities: DashboardPortfolioOpportunity[] = hasSubscription
    ? (dashboardPortfolio?.opportunities ?? []).slice(0, 8)
    : [];

  const resolvedTotalCount = totalCount ?? rankings.length;
  const bullishPct =
    resolvedTotalCount > 0
      ? Math.round(((bullishCount ?? 0) / resolvedTotalCount) * 100)
      : 0;
  const sentiment =
    bullishPct >= 50
      ? "Strong market"
      : bullishPct >= 35
        ? "Healthy market"
        : bullishPct >= 20
          ? "Cautious market"
          : "Weak market";

  const sp500Data = marketSnapshot.chart;
  const marketValue = marketSnapshot.value;
  const marketChangePct = marketSnapshot.changePct;
  const portfolioId = dashboardPortfolio?.portfolioId ?? null;
  const valuationState = dashboardPortfolio?.valuationState ?? "empty";
  const missingPriceTickers = dashboardPortfolio?.missingPriceTickers ?? [];
  const portfolioChartMeta = dashboardPortfolio?.chartMeta ?? null;
  const rawChartState = portfolioChartMeta?.health.displayState ?? null;
  const mobileChartState =
    rawChartState === "ready" ||
    rawChartState === "error_with_cache" ||
    rawChartState === "error_no_cache"
      ? rawChartState
      : rawChartState
        ? "limited"
        : null;

  const dashboardNews = hasSubscription ? newsSnapshot.articles : [];

  const newsStatus: "ok" | "error" | "locked" = !hasSubscription
    ? "locked"
    : newsSnapshot.status;

  const askContext = {
    contextType: "dashboard" as const,
    ...(portfolioId ? { portfolioId } : {}),
  };

  return (
    <>
      {nativeApp && <NativePageRegistration context={askContext} />}
      <main className="sg-dashboard-main min-h-full overflow-visible">
        <MobileDashboardExperience
          firstName={firstName}
          canUsePremium={hasSubscription}
          portfolioId={portfolioId}
          portfolios={dashboardPortfolio?.portfolios ?? []}
          summary={portfolioSummary}
          portfolioChart={portfolioChart}
          portfolioChartState={{
            displayState: mobileChartState,
            isFlat: portfolioChartMeta?.health.isFlat ?? false,
            latestSnapshotAt:
              portfolioChartMeta?.health.latestSnapshotAt ?? null,
          }}
          valuationState={valuationState}
          missingPriceTickers={missingPriceTickers}
          opportunities={opportunities.slice(0, 2)}
          rankings={rankings}
          rankingsLocked={rankingsLocked}
          marketChart={sp500Data}
          marketValue={marketValue}
          marketChangePct={marketChangePct}
          news={dashboardNews}
          newsStatus={newsStatus}
          deferredChart={dashboardPortfolio?.deferredChart}
          deferredOpportunities={hasSubscription ? dashboardPortfolio?.deferredOpportunities : undefined}
          deferredMarket={nativeApp ? marketPromise : undefined}
          deferredNews={nativeApp && hasSubscription ? newsPromise : undefined}
        />
        <MobileMarketMoversPortal canUsePremium={hasSubscription} />

        {!nativeApp && <DesktopDashboardExperience
          firstName={firstName}
          rankings={rankings}
          rankingsLocked={rankingsLocked}
          snapshotMap={snapshotMap}
          totalCount={resolvedTotalCount}
          bullishPct={bullishPct}
          sentiment={sentiment}
          opportunities={opportunities}
          portfolioSummary={portfolioSummary}
          portfolioChart={portfolioChart}
          portfolioChartMeta={portfolioChartMeta}
          portfolioId={portfolioId}
          portfolios={dashboardPortfolio?.portfolios ?? []}
          canUsePremium={hasSubscription}
          valuationState={valuationState}
          missingPriceTickers={missingPriceTickers}
          marketChart={sp500Data}
          marketValue={marketValue}
          marketChangePct={marketChangePct}
        />}
      </main>
    </>
  );
}
