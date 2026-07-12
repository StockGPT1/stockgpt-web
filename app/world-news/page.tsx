import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorldNewsClient } from "@/components/WorldNewsClient";
import { hasActiveSubscription } from "@/lib/subscription";
import { getCachedWorldNewsFeed } from "@/lib/world-news-feed";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Market Briefing | StockGPT Market Intelligence",
  description:
    "Follow global market news, sentiment and AI-assisted summaries from StockGPT.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorldNewsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: portfolioRows }, { data: watchlistRows }] = await Promise.all([
    supabase.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle(),
    supabase.from("user_portfolios").select("id").eq("user_id", user.id).is("archived_at", null),
    supabase.from("watchlist").select("ticker").eq("user_id", user.id),
  ]);

  const hasSubscription = hasActiveSubscription(profile?.subscription_status);
  const portfolioIds = (portfolioRows ?? []).map((row) => String(row.id));
  const { data: holdingRows } = portfolioIds.length > 0
    ? await supabase.from("portfolio_holdings").select("ticker").in("portfolio_id", portfolioIds)
    : { data: [] as Array<{ ticker: string | null }> };

  let feedStatus: "ok" | "error" | "locked" = hasSubscription ? "ok" : "locked";
  let feed = {
    articles: [],
    fetchedAt: new Date().toISOString(),
    latestPublishedAt: null,
    sourceArticleCount: 0,
    stockUniverseCount: 0,
  } as Awaited<ReturnType<typeof getCachedWorldNewsFeed>>;

  if (hasSubscription) {
    try {
      feed = await getCachedWorldNewsFeed();
    } catch (error) {
      console.error("[world-news] feed read failed", error);
      feedStatus = "error";
    }
  }

  return (
    <AppShell activePath="/world-news" askLabel="Ask about market news" askContext={{ contextType: "dashboard", activeFilters: { section: "news" } }}>
      <WorldNewsClient
        articles={feed.articles}
        fetchedAt={feed.fetchedAt}
        latestPublishedAt={feed.latestPublishedAt}
        sourceArticleCount={feed.sourceArticleCount}
        stockUniverseCount={feed.stockUniverseCount}
        holdingTickers={Array.from(new Set((holdingRows ?? []).map((row) => String(row.ticker ?? "").toUpperCase()).filter(Boolean)))}
        watchlistTickers={Array.from(new Set((watchlistRows ?? []).map((row) => String(row.ticker ?? "").toUpperCase()).filter(Boolean)))}
        feedStatus={feedStatus}
        locked={!hasSubscription}
      />
    </AppShell>
  );
}
