import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RankingRow = {
  rank: number | null;
  previous_rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

type NewsRow = {
  title: string | null;
  summary: string | null;
  source: string | null;
  affected_tickers: string[] | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function cleanQuestion(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 1200);
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compactRankings(rows: RankingRow[]) {
  return rows.map((row) => ({
    rank: row.rank,
    previous_rank: row.previous_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    score: safeNumber(row.score),
    price: safeNumber(row.price),
    updated_at: row.updated_at,
  }));
}

function compactNews(rows: NewsRow[]) {
  return rows.map((row) => ({
    title: row.title,
    summary: row.summary,
    source: row.source,
    affected_tickers: row.affected_tickers,
    impact: row.impact,
    impact_reason: row.impact_reason,
    published_at: row.published_at,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";

    if (!apiKey) {
      return NextResponse.json(
        {
          answer:
            "Ask StockGPT is not connected yet. Add OPENROUTER_API_KEY to your environment variables, then redeploy.",
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    const question = cleanQuestion(body?.question);

    if (!question) {
      return NextResponse.json(
        { answer: "Ask me a stock or market question first." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: rankingsData }, { data: newsData }] = await Promise.all([
      supabase
        .from("stock_rankings")
        .select(
          "rank,previous_rank,ticker,company,sector,score,price,updated_at",
        )
        .order("rank", { ascending: true })
        .limit(30),

      supabase
        .from("news_articles")
        .select(
          "title,summary,source,affected_tickers,impact,impact_reason,published_at",
        )
        .order("published_at", { ascending: false })
        .limit(15),
    ]);

    const rankings = compactRankings((rankingsData ?? []) as RankingRow[]);
    const news = compactNews((newsData ?? []) as NewsRow[]);

    const latestRankingUpdate =
      rankings.map((r) => r.updated_at).find(Boolean) ?? null;

    const context = {
      user_status: user ? "signed_in" : "signed_out",
      latest_ranking_update: latestRankingUpdate,
      rankings,
      news,
      data_limits: {
        rankings_supplied: rankings.length,
        news_articles_supplied: news.length,
        important:
          "Only use the supplied database context. Do not invent prices, scores, rankings, dates, rank movements, or news.",
      },
    };

    const systemPrompt = `
You are Ask StockGPT, the built-in AI assistant for a premium stock-ranking dashboard.

Rules:
- Use only the live context supplied by the app.
- Never invent prices, rankings, scores, movements, news, dates, companies, or ticker facts.
- If the supplied context does not contain enough information, say what is missing.
- Do not pretend to have real-time access beyond the supplied StockGPT database context.
- Keep answers practical, clear, and concise.
- You may explain what the rankings imply, but do not guarantee returns.
- Do not say "buy this now" or present personalised regulated financial advice.
- If the user asks what to do with a stock, give a balanced view: ranking, score, sector, recent news context, key risks, and what extra checks they should make.
- If a ticker is not present in the supplied context, say it is not currently available in the provided StockGPT dataset.
- For rank movement, only mention movement if previous_rank is present and different from rank.
`.trim();

    const userPrompt = `
User question:
${question}

Current StockGPT context:
${JSON.stringify(context, null, 2)}
`.trim();

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://stockgpt.pro",
          "X-Title": "StockGPT",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 700,
        }),
      },
    );

    const data = (await response.json().catch(() => null)) as
      | OpenRouterResponse
      | null;

    if (!response.ok) {
      console.error("[ask-stockgpt] OpenRouter error", data);

      return NextResponse.json(
        {
          answer:
            data?.error?.message ??
            "Ask StockGPT could not get an AI response. Check your OpenRouter API key, model name, rate limits, and Vercel environment variables.",
        },
        { status: 500 },
      );
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json(
        {
          answer:
            "Ask StockGPT received an empty response. Try asking again with a more specific stock or market question.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("[ask-stockgpt]", error);

    return NextResponse.json(
      {
        answer:
          "Ask StockGPT hit an unexpected server error. Check the Vercel function logs for details.",
      },
      { status: 500 },
    );
  }
}
