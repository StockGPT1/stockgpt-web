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

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const hasSubscription = hasActiveSubscription(profile?.subscription_status);
  const feed = hasSubscription
    ? await getCachedWorldNewsFeed()
    : {
        articles: [],
        fetchedAt: new Date().toISOString(),
        latestPublishedAt: null,
        sourceArticleCount: 0,
        stockUniverseCount: 0,
      };

  return (
    <AppShell activePath="/world-news">
      <WorldNewsClient
        articles={feed.articles}
        fetchedAt={feed.fetchedAt}
        latestPublishedAt={feed.latestPublishedAt}
        sourceArticleCount={feed.sourceArticleCount}
        stockUniverseCount={feed.stockUniverseCount}
        locked={!hasSubscription}
      />
    </AppShell>
  );
}
