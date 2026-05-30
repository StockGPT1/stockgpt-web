import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorldNewsClient } from "@/components/WorldNewsClient";
import { createClient } from "@/utils/supabase/server";
import {

export const metadata: Metadata = {
  title: "World News | StockGPT Market Intelligence",
  description:
    "Follow global market news, sentiment and AI-assisted summaries from StockGPT.",
};

  analyseArticleForMarketRelevance,
  enrichArticleWithStockInsights,
  type BaseNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";

export const dynamic = "force-dynamic";

export default async function WorldNewsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: newsData }, { data: stockData }] = await Promise.all([
    supabase
      .from("news_articles")
      .select(
        "id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at",
      )
      .order("published_at", { ascending: false })
      .limit(180),

    supabase
      .from("stock_rankings")
      .select("ticker,company,sector,rank,score,price")
      .order("rank", { ascending: true })
      .limit(500),
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
    <AppShell activePath="/world-news">
      <WorldNewsClient articles={enrichedArticles} />
    </AppShell>
  );
}
