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

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AccessResult =
  | { userId: string; response: null }
  | { userId: null; response: NextResponse };

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

const CHAT_LOG_DAYS = 7;
const MAX_STORED_MESSAGES = 80;

function sevenDaysAgoIso() {
  return new Date(Date.now() - CHAT_LOG_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function cleanQuestion(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2400);
}

function cleanHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is ChatMessage => {
      return (
        message !== null &&
        typeof message === "object" &&
        ((message as ChatMessage).role === "user" ||
          (message as ChatMessage).role === "assistant") &&
        typeof (message as ChatMessage).content === "string"
      );
    })
    .slice(-14)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1600),
    }))
    .filter((message) => message.content.length > 0);
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function requireSubscribedUser(
  supabase: ServerSupabaseClient,
): Promise<AccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      response: NextResponse.json(
        {
          answer:
            "Ask StockGPT is available to active subscribers. Please log in to use the portfolio coach. For membership or billing help, contact sales@stockgpt.pro.",
        },
        { status: 401 },
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasActiveSubscription(profile?.subscription_status)) {
    return {
      userId: null,
      response: NextResponse.json(
        {
          answer:
            "Ask StockGPT is available to active subscribers only. Upgrade your plan to unlock portfolio coaching, rankings context, news interpretation and AI answers. For membership or billing help, contact sales@stockgpt.pro.",
        },
        { status: 403 },
      ),
    };
  }

  return { userId: user.id, response: null };
}

async function deleteOldChatMessages(
  supabase: ServerSupabaseClient,
  userId: string,
) {
  try {
    await supabase
      .from("ask_stockgpt_messages")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", sevenDaysAgoIso());
  } catch (error) {
    console.warn("[ask-stockgpt] Could not delete old chat messages", error);
  }
}

async function readRecentChatMessages(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from("ask_stockgpt_messages")
      .select("role,content,created_at")
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgoIso())
      .order("created_at", { ascending: true })
      .limit(MAX_STORED_MESSAGES);

    if (error) {
      console.warn("[ask-stockgpt] Could not read chat history", error);
      return [];
    }

    return ((data ?? []) as Array<{ role: unknown; content: unknown }>)
      .filter(
        (row) =>
          (row.role === "user" || row.role === "assistant") &&
          typeof row.content === "string" &&
          row.content.trim().length > 0,
      )
      .map((row) => ({
        role: row.role as "user" | "assistant",
        content: String(row.content).trim(),
      }));
  } catch (error) {
    console.warn("[ask-stockgpt] Chat history unavailable", error);
    return [];
  }
}

async function storeChatMessage(
  supabase: ServerSupabaseClient,
  userId: string,
  message: ChatMessage,
) {
  try {
    await supabase.from("ask_stockgpt_messages").insert({
      user_id: userId,
      role: message.role,
      content: message.content.slice(0, 6000),
    });
  } catch (error) {
    console.warn("[ask-stockgpt] Could not store chat message", error);
  }
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

function compactHolding(holding: EnrichedHolding) {
  const stopTrigger = holding.triggers.find(
    (trigger) => trigger.type === "stop_loss",
  );
  const takeProfitTrigger = holding.triggers.find(
    (trigger) => trigger.type === "take_profit",
  );
  const reviewTrigger = holding.triggers.find(
    (trigger) => trigger.type === "review",
  );

  return {
    ticker: holding.ticker,
    company: holding.company,
    sector: holding.sector,
    rank: holding.rank,
    rank_percentile: holding.rankPercentile,
    score: holding.score,
    score_percentile: holding.scorePercentile,
    recommendation: holding.recommendation,
    current_price: holding.currentPrice,
    entry_price: holding.entryPrice,
    shares: holding.shares,
    current_value: holding.currentValue,
    cost_basis: holding.costBasis,
    pnl_percent: holding.pnlPercent,
    pnl_dollars: holding.totalPnLDollars,
    current_allocation_pct: holding.currentAllocationPct,
    target_allocation_pct: holding.targetAllocationPct,
    score_at_entry: holding.scoreAtEntry,
    rank_at_entry: holding.rankAtEntry,
    score_change: holding.scoreChange,
    rank_change: holding.rankChange,
    days_held: holding.daysHeld,
    days_since_review: holding.daysSinceReview,
    added_at: holding.addedAt,
    last_reviewed_at: holding.lastReviewedAt,
    sector_momentum: holding.sectorMomentum,
    sector_bullish_pct: holding.sectorBullishPct,
    ai_summary: holding.aiSummary,
    action_alerts: holding.actionAlerts.map((alert) => ({
      type: alert.type,
      severity: alert.severity,
      action: alert.action,
      title: alert.title,
      message: alert.message,
      recommendation: alert.recommendation,
      evidence: alert.evidence,
      expires_when: alert.expiresWhen,
    })),
    event_alerts: holding.eventAlerts.map((alert) => ({
      type: alert.type,
      severity: alert.severity,
      action: alert.action,
      title: alert.title,
      message: alert.message,
      recommendation: alert.recommendation,
      evidence: alert.evidence,
      expires_when: alert.expiresWhen,
    })),
    alerts: holding.alerts.map((alert) => ({
      category: alert.category,
      type: alert.type,
      severity: alert.severity,
      action: alert.action,
      title: alert.title,
      message: alert.message,
      recommendation: alert.recommendation,
      evidence: alert.evidence,
      expires_when: alert.expiresWhen,
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
      all_triggers: holding.triggers.map((trigger) => ({
        type: trigger.type,
        condition: trigger.condition,
        action: trigger.action,
        tone: trigger.tone,
      })),
    },
  };
}

function buildPortfolioSummary(holdings: EnrichedHolding[]) {
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.currentValue,
    0,
  );
  const totalCost = holdings.reduce(
    (sum, holding) => sum + holding.costBasis,
    0,
  );
  const totalPnL = holdings.reduce(
    (sum, holding) => sum + holding.totalPnLDollars,
    0,
  );
  const pnlPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : null;

  const actionAlerts = holdings.flatMap((holding) =>
    holding.actionAlerts.map((alert) => ({
      ticker: holding.ticker,
      action: alert.action,
      severity: alert.severity,
      title: alert.title,
      recommendation: alert.recommendation,
    })),
  );

  const eventAlerts = holdings.flatMap((holding) =>
    holding.eventAlerts.map((alert) => ({
      ticker: holding.ticker,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
    })),
  );

  const sectorExposure: Record<string, number> = {};

  holdings.forEach((holding) => {
    const sector = holding.sector ?? "Unknown";
    sectorExposure[sector] =
      (sectorExposure[sector] ?? 0) + holding.currentAllocationPct;
  });

  const best = [...holdings]
    .sort((a, b) => b.pnlPercent - a.pnlPercent)
    .slice(0, 3);

  const worst = [...holdings]
    .sort((a, b) => a.pnlPercent - b.pnlPercent)
    .slice(0, 3);

  const weakestRanked = [...holdings]
    .sort((a, b) => (b.rank ?? 9999) - (a.rank ?? 9999))
    .slice(0, 3);

  const strongestRanked = [...holdings]
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .slice(0, 3);

  const reviewDue = holdings
    .filter((holding) => holding.daysSinceReview >= 75)
    .sort((a, b) => b.daysSinceReview - a.daysSinceReview)
    .map((holding) => ({
      ticker: holding.ticker,
      days_since_review: holding.daysSinceReview,
      recommendation: holding.recommendation,
    }));

  return {
    total_value: Number(totalValue.toFixed(2)),
    total_cost_basis: Number(totalCost.toFixed(2)),
    total_pnl_dollars: Number(totalPnL.toFixed(2)),
    total_pnl_percent: pnlPct === null ? null : Number(pnlPct.toFixed(2)),
    holdings_count: holdings.length,
    action_alerts: actionAlerts,
    event_alerts: eventAlerts,
    sector_exposure_pct: Object.fromEntries(
      Object.entries(sectorExposure)
        .sort((a, b) => b[1] - a[1])
        .map(([sector, value]) => [sector, Number(value.toFixed(1))]),
    ),
    best_performers: best.map((holding) => ({
      ticker: holding.ticker,
      pnl_percent: holding.pnlPercent,
      rank: holding.rank,
      recommendation: holding.recommendation,
    })),
    worst_performers: worst.map((holding) => ({
      ticker: holding.ticker,
      pnl_percent: holding.pnlPercent,
      rank: holding.rank,
      recommendation: holding.recommendation,
    })),
    strongest_ranked_holdings: strongestRanked.map((holding) => ({
      ticker: holding.ticker,
      rank: holding.rank,
      score: holding.score,
      rank_percentile: holding.rankPercentile,
      recommendation: holding.recommendation,
    })),
    weakest_ranked_holdings: weakestRanked.map((holding) => ({
      ticker: holding.ticker,
      rank: holding.rank,
      score: holding.score,
      rank_percentile: holding.rankPercentile,
      recommendation: holding.recommendation,
    })),
    review_due_or_soon: reviewDue,
  };
}

function extractPossibleTickers(question: string) {
  const words = question.toUpperCase().match(/\b[A-Z]{1,5}\b/g) ?? [];

  const ignored = new Set([
    "AI",
    "API",
    "APP",
    "THE",
    "AND",
    "FOR",
    "SELL",
    "BUY",
    "HOLD",
    "TRIM",
    "STOP",
    "LOSS",
    "TAKE",
    "PROFIT",
    "WHAT",
    "WHEN",
    "WHY",
    "HOW",
    "CAN",
    "YOU",
    "ARE",
    "DO",
    "MY",
    "ME",
    "IS",
    "IT",
    "A",
    "AN",
    "OR",
    "TO",
    "IN",
    "OF",
    "ON",
    "WITH",
    "NEWS",
    "RANK",
    "SCORE",
    "PRICE",
    "P",
    "L",
    "HI",
    "HEY",
    "HELLO",
  ]);

  return Array.from(new Set(words.filter((word) => !ignored.has(word)))).slice(
    0,
    12,
  );
}

function looksLikeMembershipQuestion(question: string) {
  const q = question.toLowerCase();

  return [
    "membership",
    "subscription",
    "subscribe",
    "billing",
    "bill",
    "payment",
    "refund",
    "cancel",
    "upgrade",
    "downgrade",
    "price",
    "pricing",
    "plan",
    "account",
    "invoice",
    "stripe",
  ].some((term) => q.includes(term));
}

function looksLikeGeneralLearningQuestion(question: string) {
  const q = question.toLowerCase();

  return [
    "explain",
    "teach",
    "what is",
    "what are",
    "how does",
    "how do",
    "meaning",
    "concept",
    "theory",
    "risk reward",
    "position sizing",
    "stop loss",
    "take profit",
    "diversification",
    "valuation",
    "momentum",
    "quality",
    "growth",
    "value",
  ].some((term) => q.includes(term));
}

async function buildAppContext(
  supabase: ServerSupabaseClient,
  userId: string,
  question: string,
) {
  const possibleTickers = extractPossibleTickers(question);
  const isMembershipQuestion = looksLikeMembershipQuestion(question);
  const isLearningQuestion = looksLikeGeneralLearningQuestion(question);

  const [{ data: topRankingsData }, { data: newsData }] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("rank,previous_rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(120),

    supabase
      .from("news_articles")
      .select("title,summary,source,affected_tickers,impact,impact_reason,published_at")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  let mentionedRankingsData: RankingRow[] = [];

  if (possibleTickers.length > 0) {
    const { data } = await supabase
      .from("stock_rankings")
      .select("rank,previous_rank,ticker,company,sector,score,price,updated_at")
      .in("ticker", possibleTickers);

    mentionedRankingsData = (data ?? []) as RankingRow[];
  }

  const topRankings = compactRankings((topRankingsData ?? []) as RankingRow[]);
  const rankingMap = new Map<string, RankingRow>();

  [...((topRankingsData ?? []) as RankingRow[]), ...mentionedRankingsData]
    .filter((row) => Boolean(row.ticker))
    .forEach((row) => {
      rankingMap.set(row.ticker as string, row);
    });

  const suppliedRankings = compactRankings([...rankingMap.values()]);
  const news = compactNews((newsData ?? []) as NewsRow[]);
  const latestRankingUpdate =
    suppliedRankings.map((row) => row.updated_at).find(Boolean) ?? null;

  let portfolio: null | {
    meta: PortfolioRow;
    summary: ReturnType<typeof buildPortfolioSummary>;
    holdings: ReturnType<typeof compactHolding>[];
  } = null;

  const { data: savedPortfolio } = await supabase
    .from("user_portfolios")
    .select("id,name,risk_tolerance,time_horizon,investment_amount")
    .eq("user_id", userId)
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
      .filter((holding) => Boolean(holding.ticker))
      .map((holding) => ({
        ticker: holding.ticker as string,
        entry_price: holding.entry_price,
        score_at_entry: holding.score_at_entry,
        rank_at_entry: holding.rank_at_entry,
        shares: holding.shares,
        allocation_pct: holding.allocation_pct,
        added_at: holding.added_at ?? new Date().toISOString(),
        last_reviewed_at:
          holding.last_reviewed_at ??
          holding.added_at ??
          new Date().toISOString(),
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

  const mentionedRankings = suppliedRankings.filter(
    (ranking) =>
      ranking.ticker !== null && possibleTickers.includes(ranking.ticker),
  );

  const mentionedHoldings =
    portfolio?.holdings.filter((holding) =>
      possibleTickers.includes(holding.ticker),
    ) ?? [];

  const relevantNews = news.filter((article) => {
    const tickers = Array.isArray(article.affected_tickers)
      ? article.affected_tickers
      : [];

    return (
      possibleTickers.length === 0 ||
      tickers.some((ticker) => possibleTickers.includes(ticker))
    );
  });

  return {
    user_status: "signed_in_subscribed",
    data_as_of: new Date().toISOString(),
    latest_ranking_update: latestRankingUpdate,
    question_intent: {
      possible_tickers: possibleTickers,
      membership_question: isMembershipQuestion,
      learning_question: isLearningQuestion,
    },
    rankings_context: {
      total_rankings_supplied: suppliedRankings.length,
      top_rankings: topRankings.slice(0, 40),
      mentioned_rankings: mentionedRankings,
      note: "Top rankings are limited for context. Mentioned tickers are separately supplied when available.",
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
      latest_news: news.slice(0, 20),
      relevant_news: relevantNews.slice(0, 12),
    },
    membership_context: {
      support_email: "sales@stockgpt.pro",
      subscription_management:
        "Users should use the StockGPT subscription/account page for self-service plan management when available.",
      billing_rule:
        "Do not invent billing, refund, coupon, or plan details. If the exact account answer is not available, direct the user to sales@stockgpt.pro.",
    },
    interpretation_rules: {
      rank_percentile:
        "100 means rank #1 / best. 0 means bottom of ranked universe.",
      score_percentile:
        "Higher is better. Scores are relative to the supplied StockGPT ranking universe.",
      pnl: "P&L values are based on saved entry price, shares, and current StockGPT price context.",
      action_alerts:
        "Action alerts are stronger than event alerts. Event alerts mean something changed. Action alerts mean the system sees enough evidence to buy more, trim, sell, or review.",
      action_plan:
        "Use each holding's action_plan triggers for stop-loss, take-profit, and review timing.",
      missing_data:
        "If exact information is missing, state what is missing. Never invent numbers.",
    },
  };
}

const systemPrompt = `
You are Ask StockGPT, the premium AI coach inside StockGPT.

Core identity:
- You are a calm, sharp, human-sounding market coach.
- You are not a basic support bot.
- You can handle imperfect grammar, vague prompts, short messages, follow-ups, and casual conversation.
- If the user says something like "hi", "what do you mean", "explain more", "what about that", or asks a follow-up, infer the likely context from the conversation history.
- Keep the conversation flowing naturally.

What you can discuss:
- Saved portfolio questions.
- StockGPT rankings, scores, sectors, alerts, stop-losses, take-profit levels, review dates, exposure and P&L.
- Recent news supplied by the app.
- General investing/trading concepts.
- General non-stock conversation, as long as it is safe and reasonable.
- Membership, subscription, billing and account-management questions.

Accuracy rules:
- For portfolio, ranking, price, news, alert, billing or account-specific details, use only the supplied app context.
- Do not invent prices, scores, ranks, allocations, dates, news, subscriptions, invoices, refunds or account status.
- If exact app data is missing, say what is missing.
- For general concepts, you may explain using normal financial education.
- For current market facts not supplied in context, say you do not have that data in the app context.
- Do not guarantee returns.
- Do not claim to be a regulated financial adviser.

Coaching rules:
- Start with the practical answer.
- Then give the evidence or reasoning.
- If there is no action alert, do not force a buy/sell answer.
- Action alerts are stronger than event alerts.
- Event alerts mean something changed.
- Action alerts mean the system sees enough evidence to buy more, trim, sell or review.
- If the user is learning a concept, explain it simply first, then give an example.
- If the user asks a follow-up about the same concept, continue from the prior explanation rather than restarting.

Membership rules:
- Give general guidance only.
- Do not invent pricing, refund eligibility, coupons, billing status or plan entitlements.
- For uncertain or account-specific membership questions, direct the user to sales@stockgpt.pro.
- Mention the subscription/account page when useful.

Style:
- Sound premium but natural.
- Use short headings when helpful.
- Use bullets for decisions.
- Avoid long disclaimers.
- Be concise, but not robotic.
`.trim();

export async function GET() {
  const supabase = await createClient();
  const access = await requireSubscribedUser(supabase);

  if (access.response) return access.response;

  await deleteOldChatMessages(supabase, access.userId);

  const messages = await readRecentChatMessages(supabase, access.userId);

  return NextResponse.json({
    messages,
    retained_days: CHAT_LOG_DAYS,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const access = await requireSubscribedUser(supabase);

  if (access.response) return access.response;

  const { error } = await supabase
    .from("ask_stockgpt_messages")
    .delete()
    .eq("user_id", access.userId);

  if (error) {
    console.error("[ask-stockgpt] Could not clear chat history", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not clear Ask StockGPT chat history.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const access = await requireSubscribedUser(supabase);

    if (access.response) return access.response;

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";

    if (!apiKey) {
      return NextResponse.json(
        {
          answer:
            "Ask StockGPT is not connected yet. Add OPENROUTER_API_KEY to your environment variables, then redeploy. For help setting this up, contact sales@stockgpt.pro.",
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    const question = cleanQuestion(body?.question);

    if (!question) {
      return NextResponse.json(
        {
          answer:
            "Ask me anything: your portfolio, a ranking, a trading concept, membership help, or even a rough question with imperfect wording.",
        },
        { status: 400 },
      );
    }

    await deleteOldChatMessages(supabase, access.userId);

    const storedHistory = await readRecentChatMessages(supabase, access.userId);

    const fallbackHistory = cleanHistory(body?.messages).filter((message, index, arr) => {
      const isLast = index === arr.length - 1;
      return !(
        isLast &&
        message.role === "user" &&
        message.content.trim().toLowerCase() === question.trim().toLowerCase()
      );
    });

    const history = storedHistory.length > 0 ? storedHistory : fallbackHistory;

    await storeChatMessage(supabase, access.userId, {
      role: "user",
      content: question,
    });

    const context = await buildAppContext(supabase, access.userId, question);

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-16).map((message) => ({
        role: message.role,
        content: message.content,
      })),
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
          temperature: 0.28,
          max_tokens: 1400,
        }),
      },
    );

    const data = (await response.json().catch(() => null)) as
      | OpenRouterResponse
      | null;

    if (!response.ok) {
      console.error("[ask-stockgpt] OpenRouter error", data);

      const answer =
        data?.error?.message ??
        "Ask StockGPT could not get an AI response. Check your OpenRouter API key, model name, rate limits and Vercel environment variables. For membership or billing questions, contact sales@stockgpt.pro.";

      await storeChatMessage(supabase, access.userId, {
        role: "assistant",
        content: answer,
      });

      return NextResponse.json({ answer }, { status: 500 });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      const fallback =
        "Ask StockGPT received an empty response. Try asking again with a more specific question, or rephrase it naturally.";

      await storeChatMessage(supabase, access.userId, {
        role: "assistant",
        content: fallback,
      });

      return NextResponse.json({ answer: fallback }, { status: 500 });
    }

    await storeChatMessage(supabase, access.userId, {
      role: "assistant",
      content: answer,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("[ask-stockgpt]", error);

    return NextResponse.json(
      {
        answer:
          "Ask StockGPT hit an unexpected server error. Check the Vercel function logs. For membership or billing questions, contact sales@stockgpt.pro.",
      },
      { status: 500 },
    );
  }
}
