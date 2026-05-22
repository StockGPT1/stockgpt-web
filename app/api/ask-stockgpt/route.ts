import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  enrichHoldings,
  type EnrichedHolding,
  type RiskTolerance,
} from "@/lib/portfolio-alerts";
import { hasActiveSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

type PortfolioRow = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
};

type PortfolioHoldingRow = {
  ticker: string | null;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
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
  return value.trim().slice(0, 1600);
}

function cleanHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((m): m is ChatMessage => {
      return (
        m &&
        typeof m === "object" &&
        (m as ChatMessage).role !== undefined &&
        ((m as ChatMessage).role === "user" ||
          (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string"
      );
    })
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 1200),
    }))
    .filter((m) => m.content.length > 0);
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

function compactHolding(h: EnrichedHolding) {
  const stopTrigger = h.triggers.find((t) => t.type === "stop_loss");
  const takeProfitTrigger = h.triggers.find((t) => t.type === "take_profit");
  const reviewTrigger = h.triggers.find((t) => t.type === "review");

  return {
    ticker: h.ticker,
    company: h.company,
    sector: h.sector,
    rank: h.rank,
    rank_percentile: h.rankPercentile,
    score: h.score,
    recommendation: h.recommendation,
    current_price: h.currentPrice,
    entry_price: h.entryPrice,
    shares: h.shares,
    current_value: h.currentValue,
    cost_basis: h.costBasis,
    pnl_percent: h.pnlPercent,
    pnl_dollars: h.totalPnLDollars,
    current_allocation_pct: h.currentAllocationPct,
    target_allocation_pct: h.targetAllocationPct,
    score_at_entry: h.scoreAtEntry,
    rank_at_entry: h.rankAtEntry,
    score_change: h.scoreChange,
    rank_change: h.rankChange,
    days_held: h.daysHeld,
    days_since_review: h.daysSinceReview,
    added_at: h.addedAt,
    last_reviewed_at: h.lastReviewedAt,
    sector_momentum: h.sectorMomentum,
    sector_bullish_pct: h.sectorBullishPct,
    ai_summary: h.aiSummary,
    alerts: h.alerts.map((a) => ({
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      recommendation: a.recommendation,
    })),
    action_plan: {
      stop_or_exit: stopTrigger
        ? {
            condition: stopTrigger.condition,
            action: stopTrigger.action,
            tone: stopTrigger.tone,
          }
        : null,
      take_profit: takeProfitTrigger
        ? {
            condition: takeProfitTrigger.condition,
            action: takeProfitTrigger.action,
            tone: takeProfitTrigger.tone,
          }
        : null,
      review: reviewTrigger
        ? {
            condition: reviewTrigger.condition,
            action: reviewTrigger.action,
            tone: reviewTrigger.tone,
          }
        : null,
      all_triggers: h.triggers.map((t) => ({
        type: t.type,
        condition: t.condition,
        action: t.action,
        tone: t.tone,
      })),
    },
  };
}

function buildPortfolioSummary(holdings: EnrichedHolding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalPnL = holdings.reduce((sum, h) => sum + h.totalPnLDollars, 0);
  const pnlPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : null;

  const criticalAlerts = holdings.flatMap((h) =>
    h.alerts
      .filter((a) => a.severity === "critical")
      .map((a) => ({ ticker: h.ticker, title: a.title })),
  );

  const warningAlerts = holdings.flatMap((h) =>
    h.alerts
      .filter((a) => a.severity === "warning")
      .map((a) => ({ ticker: h.ticker, title: a.title })),
  );

  const sectorExposure: Record<string, number> = {};

  holdings.forEach((h) => {
    const sector = h.sector ?? "Unknown";
    sectorExposure[sector] =
      (sectorExposure[sector] ?? 0) + h.currentAllocationPct;
  });

  const best = [...holdings]
    .sort((a, b) => b.pnlPercent - a.pnlPercent)
    .slice(0, 3);

  const worst = [...holdings]
    .sort((a, b) => a.pnlPercent - b.pnlPercent)
    .slice(0, 3);

  const weakestRanked = [...holdings]
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .reverse()
    .slice(0, 3);

  const topRanked = [...holdings]
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .slice(0, 3);

  const reviewDue = holdings
    .filter((h) => h.daysSinceReview >= 75)
    .sort((a, b) => b.daysSinceReview - a.daysSinceReview)
    .map((h) => ({
      ticker: h.ticker,
      days_since_review: h.daysSinceReview,
    }));

  return {
    total_value: totalValue,
    total_cost_basis: totalCost,
    total_pnl_dollars: totalPnL,
    total_pnl_percent: pnlPct,
    holdings_count: holdings.length,
    critical_alerts: criticalAlerts,
    warning_alerts: warningAlerts,
    sector_exposure_pct: Object.fromEntries(
      Object.entries(sectorExposure)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, Number(v.toFixed(1))]),
    ),
    best_performers: best.map((h) => ({
      ticker: h.ticker,
      pnl_percent: h.pnlPercent,
      rank: h.rank,
      recommendation: h.recommendation,
    })),
    worst_performers: worst.map((h) => ({
      ticker: h.ticker,
      pnl_percent: h.pnlPercent,
      rank: h.rank,
      recommendation: h.recommendation,
    })),
    strongest_ranked_holdings: topRanked.map((h) => ({
      ticker: h.ticker,
      rank: h.rank,
      score: h.score,
      recommendation: h.recommendation,
    })),
    weakest_ranked_holdings: weakestRanked.map((h) => ({
      ticker: h.ticker,
      rank: h.rank,
      score: h.score,
      recommendation: h.recommendation,
    })),
    review_due_or_soon: reviewDue,
  };
}

function extractPossibleTickers(question: string) {
  const words = question.toUpperCase().match(/\b[A-Z]{1,5}\b/g) ?? [];
  const ignored = new Set([
    "AI",
    "THE",
    "AND",
    "FOR",
    "SELL",
    "BUY",
    "HOLD",
    "STOP",
    "LOSS",
    "TAKE",
    "PROFIT",
    "WHAT",
    "WHEN",
    "WHY",
    "HOW",
  ]);

  return Array.from(new Set(words.filter((w) => !ignored.has(w)))).slice(0, 12);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          answer:
            "Ask StockGPT is available to active subscribers. Please log in and subscribe to use it.",
        },
        { status: 401 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!hasActiveSubscription(profile?.subscription_status)) {
      return NextResponse.json(
        {
          answer:
            "Ask StockGPT is available to active subscribers only. Upgrade your plan to unlock portfolio intelligence, ranking context, and AI answers.",
        },
        { status: 403 },
      );
    }

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
    const history = cleanHistory(body?.messages);

    if (!question) {
      return NextResponse.json(
        { answer: "Ask me a stock, market, or portfolio question first." },
        { status: 400 },
      );
    }

    const possibleTickers = extractPossibleTickers(question);

    const [{ data: rankingsData }, { data: newsData }] = await Promise.all([
      supabase
        .from("stock_rankings")
        .select("rank,previous_rank,ticker,company,sector,score,price,updated_at")
        .order("rank", { ascending: true })
        .limit(100),

      supabase
        .from("news_articles")
        .select(
          "title,summary,source,affected_tickers,impact,impact_reason,published_at",
        )
        .order("published_at", { ascending: false })
        .limit(25),
    ]);

    const rankings = compactRankings((rankingsData ?? []) as RankingRow[]);
    const news = compactNews((newsData ?? []) as NewsRow[]);
    const latestRankingUpdate =
      rankings.map((r) => r.updated_at).find(Boolean) ?? null;

    let portfolio: null | {
      meta: PortfolioRow;
      summary: ReturnType<typeof buildPortfolioSummary>;
      holdings: ReturnType<typeof compactHolding>[];
    } = null;

    const { data: savedPortfolio } = await supabase
      .from("user_portfolios")
      .select("id,name,risk_tolerance,time_horizon,investment_amount")
      .eq("user_id", user.id)
      .maybeSingle();

    if (savedPortfolio) {
      const portfolioRow = savedPortfolio as PortfolioRow;

      const { data: holdingsData } = await supabase
        .from("portfolio_holdings")
        .select(
          "ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct",
        )
        .eq("portfolio_id", portfolioRow.id)
        .order("added_at", { ascending: false });

      const rawHoldings = ((holdingsData ?? []) as PortfolioHoldingRow[])
        .filter((h) => Boolean(h.ticker))
        .map((h) => ({
          ticker: h.ticker as string,
          entry_price: h.entry_price,
          score_at_entry: h.score_at_entry,
          rank_at_entry: h.rank_at_entry,
          shares: h.shares,
          allocation_pct: h.allocation_pct,
          added_at: h.added_at ?? new Date().toISOString(),
          last_reviewed_at:
            h.last_reviewed_at ?? h.added_at ?? new Date().toISOString(),
        }));

      const enriched = await enrichHoldings(
        rawHoldings,
        (portfolioRow.risk_tolerance as RiskTolerance) ?? null,
      );

      portfolio = {
        meta: portfolioRow,
        summary: buildPortfolioSummary(enriched),
        holdings: enriched.map(compactHolding),
      };
    }

    const mentionedRankings = rankings.filter(
      (r) => r.ticker && possibleTickers.includes(r.ticker),
    );

    const mentionedHoldings =
      portfolio?.holdings.filter((h) => possibleTickers.includes(h.ticker)) ?? [];

    const relevantNews = news.filter((n) => {
      const tickers = Array.isArray(n.affected_tickers)
        ? n.affected_tickers
        : [];
      return (
        possibleTickers.length === 0 ||
        tickers.some((ticker) => possibleTickers.includes(ticker))
      );
    });

    const context = {
      user_status: "signed_in_subscribed",
      latest_ranking_update: latestRankingUpdate,
      data_as_of: new Date().toISOString(),
      rankings_context: {
        total_rankings_supplied: rankings.length,
        top_rankings: rankings.slice(0, 30),
        mentioned_rankings: mentionedRankings,
        note: "Top rankings list is limited, but mentioned_rankings and portfolio holdings are prioritised when available.",
      },
      portfolio_context: portfolio
        ? {
            meta: portfolio.meta,
            summary: portfolio.summary,
            mentioned_holdings: mentionedHoldings,
            holdings: portfolio.holdings,
          }
        : {
            available: false,
            reason: "No saved portfolio found.",
          },
      news_context: {
        latest_news: news.slice(0, 15),
        relevant_news: relevantNews.slice(0, 10),
      },
      interpretation_rules: {
        rank_percentile:
          "100 means rank #1 / best. 0 means bottom of ranked universe.",
        pnl: "P&L values are based on saved entry price, shares, and current StockGPT price context.",
        action_plan:
          "Use each holding's action_plan triggers for stop-loss, take-profit, review dates, and sell/trim guidance.",
        missing_data:
          "If the answer requires data not supplied here, explicitly say what is missing.",
      },
    };

    const systemPrompt = `
You are Ask StockGPT, the built-in portfolio intelligence assistant for StockGPT.

Your job:
- Answer questions about the user's portfolio, holdings, rankings, AI scores, alerts, stop-loss/take-profit plans, review dates, sector exposure, P&L, and market/news context.
- Be specific. Use ticker names, ranks, prices, allocation, P&L, action-plan levels, alert titles, and review timing when supplied.
- When the user asks "should I sell", "should I trim", "when should I take profit", or "what should I do", give a practical decision framework using the supplied StockGPT action plan: Hold / Trim / Sell / Add / Review, with reasons.
- Use portfolio context first, then rankings, then news.
- Explain rank moves in places, not misleading percentages.
- If a holding has critical alerts, weak rank, oversized allocation, overdue review, or a stop/exit trigger, surface that clearly.
- If a holding is strong ranked, profitable, and has no critical alerts, avoid telling the user to panic sell.
- For key dates, use added_at, last_reviewed_at, days_since_review, review triggers, and expected review cadence from the context.

Strict rules:
- Use only the supplied app context. Do not invent prices, rankings, scores, dates, support/resistance levels, or news.
- If exact information is missing, say so and say what the app would need to know.
- Do not guarantee returns.
- Do not claim to be a regulated financial adviser.
- Do not give vague generic responses when portfolio context is available.
- Keep the answer concise but decisive: start with the conclusion, then the evidence.
- Use plain English and short sections.
`.trim();

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: `
User question:
${question}

Current StockGPT app context:
${JSON.stringify(context, null, 2)}
`.trim(),
      },
    ];

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
          messages,
          temperature: 0.15,
          max_tokens: 1100,
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
            "Ask StockGPT received an empty response. Try asking again with a more specific stock, portfolio, or market question.",
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
