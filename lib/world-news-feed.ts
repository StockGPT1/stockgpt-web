import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  analyseArticleForMarketRelevance,
  enrichArticleWithStockInsights,
  type BaseNewsArticle,
  type EnrichedNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";

const WORLD_NEWS_RAW_LIMIT = 120;
const WORLD_NEWS_DISPLAY_LIMIT = 48;
const WORLD_NEWS_STOCK_LIMIT = 500;
const WORLD_NEWS_CACHE_SECONDS = 3 * 60;

export type WorldNewsFeed = {
  articles: EnrichedNewsArticle[];
  fetchedAt: string;
  latestPublishedAt: string | null;
  sourceArticleCount: number;
  stockUniverseCount: number;
};

async function getWorldNewsFeedUncached(): Promise<WorldNewsFeed> {
  const supabase = createAdminClient();

  const [{ data: newsData, error: newsError }, { data: stockData, error: stockError }] =
    await Promise.all([
      supabase
        .from("news_articles")
        .select(
          "id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at",
        )
        .order("published_at", { ascending: false })
        .limit(WORLD_NEWS_RAW_LIMIT),

      supabase
        .from("stock_rankings")
        .select("ticker,company,sector,rank,score,price")
        .order("rank", { ascending: true })
        .limit(WORLD_NEWS_STOCK_LIMIT),
    ]);

  if (newsError) throw newsError;
  if (stockError) throw stockError;

  const articles = (newsData ?? []) as BaseNewsArticle[];
  const stocks = (stockData ?? []) as StockLike[];

  const enrichedArticles = articles
    .map((article) => ({
      article,
      decision: analyseArticleForMarketRelevance(article, stocks),
    }))
    .filter(({ decision }) => decision.relevant)
    .sort((a, b) => b.decision.score - a.decision.score)
    .slice(0, WORLD_NEWS_DISPLAY_LIMIT)
    .map(({ article }) => enrichArticleWithStockInsights(article, stocks, 8));

  return {
    articles: enrichedArticles,
    fetchedAt: new Date().toISOString(),
    latestPublishedAt: articles[0]?.published_at ?? null,
    sourceArticleCount: articles.length,
    stockUniverseCount: stocks.length,
  };
}

const getCachedWorldNewsFeedInternal = unstable_cache(
  getWorldNewsFeedUncached,
  ["stockgpt-world-news-feed-v1"],
  { revalidate: WORLD_NEWS_CACHE_SECONDS },
);

export async function getCachedWorldNewsFeed() {
  return getCachedWorldNewsFeedInternal();
}
