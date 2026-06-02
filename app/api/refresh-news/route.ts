import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  analyseArticleForMarketRelevance,
  enrichArticleWithStockInsights,
  getDirectlyConfirmedAffectedTickers,
  inferImpact,
  isMarketRelevantArticle,
  type BaseNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExternalArticle = {
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string | null;
};

const NEWS_QUERIES = [
  "stock market earnings federal reserve inflation S&P 500",
  "S&P 500 Nasdaq market movers earnings guidance today",
  "technology stocks AI semiconductors cloud software earnings",
  "bank stocks interest rates credit lending earnings",
  "healthcare pharma biotech FDA stocks earnings",
  "energy oil gas OPEC stocks crude prices",
  "consumer retail ecommerce auto stocks earnings margins",
  "industrial aerospace defence manufacturing stocks earnings supply chain",
  "mega cap stocks earnings guidance analyst upgrade downgrade",
  "tariffs sanctions regulation stocks market impact",
];

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function between(value: string, start: string, end: string) {
  const startIndex = value.indexOf(start);

  if (startIndex === -1) return null;

  const from = startIndex + start.length;
  const endIndex = value.indexOf(end, from);

  if (endIndex === -1) return null;

  return value.slice(from, endIndex);
}

function makeGoogleNewsRssUrl(query: string) {
  const params = new URLSearchParams({
    q: `${query} when:1d`,
    hl: "en-GB",
    gl: "GB",
    ceid: "GB:en",
  });

  return `https://news.google.com/rss/search?${params.toString()}`;
}

function parseGoogleNewsRss(xml: string): ExternalArticle[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items.map((item) => {
    const title = between(item, "<title>", "</title>");
    const link = between(item, "<link>", "</link>");
    const pubDate = between(item, "<pubDate>", "</pubDate>");
    const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const description = between(item, "<description>", "</description>");

    return {
      title: title ? stripHtml(title) : null,
      summary: description ? stripHtml(description) : null,
      source: sourceMatch?.[1] ? stripHtml(sourceMatch[1]) : "Google News",
      url: link ? decodeHtml(link) : null,
      image_url: null,
      published_at: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
    };
  });
}

async function fetchGoogleNews(): Promise<ExternalArticle[]> {
  const results: ExternalArticle[] = [];

  for (const query of NEWS_QUERIES) {
    try {
      const response = await fetch(makeGoogleNewsRssUrl(query), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
          Accept: "application/rss+xml,text/xml,*/*",
        },
        cache: "no-store",
      });

      if (!response.ok) continue;

      const xml = await response.text();
      results.push(...parseGoogleNewsRss(xml).slice(0, 12));
    } catch (error) {
      console.warn("[refresh-news] Google RSS failed:", query, error);
    }
  }

  return results;
}

async function fetchNewsApi(): Promise<ExternalArticle[]> {
  const key = process.env.NEWS_API_KEY;

  if (!key) return [];

  const fromDate = new Date(Date.now() - 36 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const results: ExternalArticle[] = [];

  for (const query of NEWS_QUERIES) {
    const params = new URLSearchParams({
      q: query,
      language: "en",
      sortBy: "publishedAt",
      pageSize: "20",
      from: fromDate,
      apiKey: key,
    });

    try {
      const response = await fetch(`https://newsapi.org/v2/everything?${params}`, {
        headers: {
          "User-Agent": "StockGPT/1.0",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) continue;

      const json = (await response.json()) as {
        articles?: Array<{
          title?: string;
          description?: string;
          content?: string;
          source?: { name?: string };
          url?: string;
          urlToImage?: string;
          publishedAt?: string;
        }>;
      };

      for (const article of json.articles ?? []) {
        results.push({
          title: article.title ?? null,
          summary: article.description ?? article.content ?? null,
          source: article.source?.name ?? null,
          url: article.url ?? null,
          image_url: article.urlToImage ?? null,
          published_at: article.publishedAt ?? new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn("[refresh-news] NewsAPI failed:", query, error);
    }
  }

  return results;
}

function uniqueArticles(articles: ExternalArticle[]) {
  const seen = new Set<string>();
  const output: ExternalArticle[] = [];

  for (const article of articles) {
    const key = article.url || article.title;

    if (!key || seen.has(key)) continue;

    seen.add(key);

    if (!article.title || !article.url) continue;

    output.push(article);
  }

  return output.sort(
    (a, b) =>
      new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime(),
  );
}

function toBaseArticle(article: ExternalArticle): BaseNewsArticle {
  return {
    id: article.url ?? article.title ?? crypto.randomUUID(),
    title: article.title,
    summary: article.summary,
    source: article.source,
    url: article.url,
    image_url: article.image_url,
    affected_tickers: null,
    impact: null,
    impact_reason: null,
    published_at: article.published_at,
  };
}

function buildImpactReason(article: BaseNewsArticle, stocks: StockLike[]) {
  const relevance = analyseArticleForMarketRelevance(article, stocks);
  const enriched = enrichArticleWithStockInsights(article, stocks, 8);
  const impact = inferImpact(article);

  if (enriched.affectedStocks.length === 0) {
    return `StockGPT view: ${relevance.reason} No high-confidence S&P 500 stock link was detected, so this should be treated as broad market context only.`;
  }

  const top = enriched.affectedStocks[0];
  const tickers = enriched.affectedStocks
    .slice(0, 5)
    .map((stock) => `${stock.ticker} (${stock.impactRating}/10)`)
    .join(", ");

  const direction =
    impact === "positive"
      ? "positive"
      : impact === "negative"
        ? "negative"
        : "mixed/neutral";

  return `StockGPT view: ${direction} read-through. ${relevance.reason} Most relevant linked stocks: ${tickers}. Strongest link: ${top.ticker}, because ${top.matchReason}. ${top.scoreEffect}`;
}

function buildDbRow(article: ExternalArticle, stocks: StockLike[]) {
  const base = toBaseArticle(article);
  const directTickers = getDirectlyConfirmedAffectedTickers(base, stocks);
  const impact = inferImpact(base);

  return {
    title: article.title,
    summary: article.summary ?? "No summary available.",
    source: article.source ?? "Market news",
    url: article.url,
    image_url: article.image_url,
    affected_tickers: directTickers.length > 0 ? directTickers : null,
    impact,
    impact_reason: buildImpactReason(base, stocks),
    published_at: article.published_at ?? new Date().toISOString(),
  };
}

import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return unauthorizedCron();
  }

  const supabase = getAdminClient();

  const { data: stockData, error: stockError } = await supabase
    .from("stock_rankings")
    .select("ticker,company,sector,rank,score,price")
    .order("rank", { ascending: true })
    .limit(500);

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 });
  }

  const stocks = (stockData ?? []) as StockLike[];

  const [newsApiArticles, googleArticles] = await Promise.all([
    fetchNewsApi(),
    fetchGoogleNews(),
  ]);

  const allExternalArticles = uniqueArticles([
    ...newsApiArticles,
    ...googleArticles,
  ]);

  const relevanceAudits = allExternalArticles.map((article) => {
    const base = toBaseArticle(article);
    const decision = analyseArticleForMarketRelevance(base, stocks);

    return {
      article,
      decision,
    };
  });

  const relevantExternalArticles = relevanceAudits
    .filter(({ decision }) => decision.relevant)
    .sort((a, b) => b.decision.score - a.decision.score)
    .map(({ article }) => article)
    .slice(0, 90);

  const urls = relevantExternalArticles
    .map((article) => article.url)
    .filter((url): url is string => Boolean(url));

  let existingUrls = new Set<string>();

  if (urls.length > 0) {
    const { data: existing } = await supabase
      .from("news_articles")
      .select("url")
      .in("url", urls);

    existingUrls = new Set((existing ?? []).map((item) => String(item.url)));
  }

  const newRows = relevantExternalArticles
    .filter((article) => article.url && !existingUrls.has(article.url))
    .map((article) => buildDbRow(article, stocks));

  if (newRows.length > 0) {
    const { error: insertError } = await supabase
      .from("news_articles")
      .insert(newRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    fetched: allExternalArticles.length,
    relevant: relevantExternalArticles.length,
    inserted: newRows.length,
    skipped_irrelevant: allExternalArticles.length - relevantExternalArticles.length,
    skipped_existing: relevantExternalArticles.length - newRows.length,
    relevance_sample: relevanceAudits.slice(0, 10).map(({ article, decision }) => ({
      title: article.title,
      relevant: decision.relevant,
      score: decision.score,
      reason: decision.reason,
    })),
  });
}
