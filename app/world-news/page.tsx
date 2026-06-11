import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorldNewsClient } from "@/components/WorldNewsClient";
import { createClient } from "@/utils/supabase/server";
import {
  analyseArticleForMarketRelevance,
  enrichArticleWithStockInsights,
  type BaseNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";
import {
  getCachedPortfolioNews,
  getCachedPortfolioStockUniverse,
} from "@/lib/portfolio-speed-cache";

export const metadata: Metadata = {
  title: "World News | StockGPT Market Intelligence",
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

  const [newsData, stockData] = await Promise.all([
    getCachedPortfolioNews(),
    getCachedPortfolioStockUniverse(),
  ]);

  const articles = (newsData ?? []) as BaseNewsArticle[];
  const stocks = (stockData ?? []) as StockLike[];

  const enrichedArticles = articles
    .map((article) => ({
      article,
      decision: analyseArticleForMarketRelevance(article, stocks),
    }))
    .filter(({ decision }) => decision.relevant)
    .sort((a, b) => b.decision.score - a.decision.score)
    .map(({ article }) => enrichArticleWithStockInsights(article, stocks, 8));

  return (
    <AppShell activePath="/world-news" user={user}>
      <WorldNewsClient articles={enrichedArticles} />
    </AppShell>
  );
}
