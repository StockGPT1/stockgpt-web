import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  WorldNewsClient,
  type WorldNewsArticle,
} from "@/components/WorldNewsClient";
import { createClient } from "@/utils/supabase/server";

type NewsArticle = {
  id: string | number;
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  affected_tickers: string[] | string | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
};

type StockMatch = {
  ticker: string | null;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | string | null;
  price: number | string | null;
};

function normaliseTickers(value: NewsArticle["affected_tickers"]) {
  if (Array.isArray(value)) {
    return value
      .map((ticker) => String(ticker).trim().toUpperCase())
      .filter((ticker) => ticker && ticker !== "SECTOR-WIDE");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter((ticker) => ticker && ticker !== "SECTOR-WIDE");
  }

  return [];
}

export default async function WorldNewsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: newsData } = await supabase
    .from("news_articles")
    .select(
      "id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at",
    )
    .order("published_at", { ascending: false })
    .limit(50);

  const articles = (newsData ?? []) as NewsArticle[];

  const tickers = Array.from(
    new Set(articles.flatMap((article) => normaliseTickers(article.affected_tickers))),
  );

  let stocksByTicker = new Map<string, StockMatch>();

  if (tickers.length > 0) {
    const { data: stockData } = await supabase
      .from("stock_rankings")
      .select("ticker,company,sector,rank,score,price")
      .in("ticker", tickers);

    stocksByTicker = new Map(
      ((stockData ?? []) as StockMatch[])
        .filter((stock) => stock.ticker)
        .map((stock) => [String(stock.ticker).toUpperCase(), stock]),
    );
  }

  const enrichedArticles: WorldNewsArticle[] = articles.map((article) => {
    const affectedTickers = normaliseTickers(article.affected_tickers);

    return {
      id: String(article.id),
      title: article.title,
      summary: article.summary,
      source: article.source,
      url: article.url,
      image_url: article.image_url,
      impact: article.impact,
      impact_reason: article.impact_reason,
      published_at: article.published_at,
      affectedStocks: affectedTickers.map((ticker) => {
        const stock = stocksByTicker.get(ticker);

        return {
          ticker,
          company: stock?.company ?? null,
          sector: stock?.sector ?? null,
          rank: stock?.rank ?? null,
          score: stock?.score ?? null,
          price: stock?.price ?? null,
        };
      }),
    };
  });

  return (
    <AppShell activePath="/world-news">
      <WorldNewsClient articles={enrichedArticles} />
    </AppShell>
  );
}