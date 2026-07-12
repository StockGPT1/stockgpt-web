import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  DesktopDashboardExperience,
  type DashboardRanking,
} from "@/components/DesktopDashboardExperience";
import { MobileDashboardExperience } from "@/components/MobileDashboardExperience";
import { createClient } from "@/utils/supabase/server";
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

export default async function DashboardPage({
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

  const [
    profileResult,
    { data: rankingsData },
    { count: totalCount },
    { count: bullishCount },
    dashboardPortfolio,
    sp500Data,
    snapshotMap,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle(),
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
    getDashboardMainPortfolio(supabase, user.id, params.portfolio),
    getSP500Chart(["1D", "1M", "6M", "1Y", "5Y"]),
    getRankSnapshotMapAround24hAgo(supabase),
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

  const marketValue = getLatestPriceFromChart(sp500Data);
  const marketChangePct = getChartChangePct(sp500Data, "1D");
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

  const askContext = {
    contextType: "dashboard" as const,
    ...(portfolioId ? { portfolioId } : {}),
  };

  return (
    <AppShell
      activePath="/dashboard"
      askLabel="Ask StockGPT"
      askContext={askContext}
    >
      <main className="sg-dashboard-main min-h-full overflow-visible">
        <MobileDashboardExperience
          firstName={firstName}
          isAuthenticated
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
        />

        <DesktopDashboardExperience
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
        />
      </main>
    </AppShell>
  );
}
