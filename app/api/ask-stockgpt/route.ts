import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type RiskTolerance } from "@/lib/portfolio-alerts";
import { hasActiveSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AccessResult =
  | { userId: string; response: null }
  | { userId: null; response: NextResponse };

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
  cash_balance: number | null;
  cash_deposited_total: number | null;
  currency: string | null;
  created_at: string | null;
};

type PortfolioHoldingRow = {
  portfolio_id: string;
  ticker: string | null;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date: string | null;
  source: string | null;
  notes: string | null;
};

const CHAT_LOG_DAYS = 7;
const MAX_STORED_MESSAGES = 80;

const DEFAULT_OPENROUTER_MODELS = [
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
];

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

function finiteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanTicker(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function cleanPortfolioName(name: string | null | undefined, index: number) {
  const cleaned = String(name ?? "").trim();
  return cleaned || `Portfolio ${index + 1}`;
}

function openRouterModels() {
  const configured = [
    process.env.OPENROUTER_MODEL,
    ...(process.env.OPENROUTER_FALLBACK_MODELS ?? "")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean),
  ].filter((model): model is string => Boolean(model));

  return Array.from(new Set([...configured, ...DEFAULT_OPENROUTER_MODELS]));
}

function compactRanking(row: RankingRow) {
  const rank = safeNumber(row.rank);
  const previousRank = safeNumber(row.previous_rank);
  const score = safeNumber(row.score);

  return {
    rank,
    previous_rank: previousRank,
    ticker: cleanTicker(row.ticker),
    company: row.company,
    sector: row.sector,
    score,
    price: safeNumber(row.price),
    updated_at: row.updated_at,
    rank_move: rank !== null && previousRank !== null ? previousRank - rank : null,
  };
}

function compactNews(row: NewsRow) {
  return {
    title: row.title,
    summary: row.summary,
    source: row.source,
    affected_tickers: Array.isArray(row.affected_tickers) ? row.affected_tickers : [],
    impact: row.impact,
    impact_reason: row.impact_reason,
    published_at: row.published_at,
  };
}

function extractPossibleTickers(question: string) {
  const words = question.toUpperCase().match(/\b[A-Z]{1,5}\b/g) ?? [];
  const ignored = new Set([
    "AI", "API", "APP", "THE", "AND", "FOR", "SELL", "BUY", "HOLD",
    "TRIM", "STOP", "LOSS", "TAKE", "PROFIT", "WHAT", "WHEN", "WHY",
    "HOW", "CAN", "YOU", "ARE", "DO", "MY", "ME", "IS", "IT", "A",
    "AN", "OR", "TO", "IN", "OF", "ON", "WITH", "NEWS", "RANK",
    "SCORE", "PRICE", "HI", "HEY", "HELLO",
  ]);

  return Array.from(new Set(words.filter((word) => !ignored.has(word)))).slice(0, 12);
}

function looksLikeMembershipQuestion(question: string) {
  const q = question.toLowerCase();
  return [
    "membership", "subscription", "subscribe", "billing", "bill", "payment",
    "refund", "cancel", "upgrade", "downgrade", "price", "pricing", "plan",
    "account", "invoice", "stripe",
  ].some((term) => q.includes(term));
}

function looksLikeGeneralLearningQuestion(question: string) {
  const q = question.toLowerCase();
  return [
    "explain", "teach", "what is", "what are", "how does", "how do", "meaning",
    "concept", "theory", "risk reward", "position sizing", "stop loss",
    "take profit", "diversification", "valuation", "momentum", "quality",
    "growth", "value",
  ].some((term) => q.includes(term));
}

async function requireSubscribedUser(supabase: ServerSupabaseClient): Promise<AccessResult> {
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

async function deleteOldChatMessages(supabase: ServerSupabaseClient, userId: string) {
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

async function readRecentChatMessages(supabase: ServerSupabaseClient, userId: string): Promise<ChatMessage[]> {
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

async function storeChatMessage(supabase: ServerSupabaseClient, userId: string, message: ChatMessage) {
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

function compactHolding(holding: any) {
  const stopTrigger = Array.isArray(holding.triggers)
    ? holding.triggers.find((trigger: any) => trigger.type === "stop_loss")
    : null;
  const takeProfitTrigger = Array.isArray(holding.triggers)
    ? holding.triggers.find((trigger: any) => trigger.type === "take_profit")
    : null;

  return {
    ticker: holding.ticker,
    company: holding.company,
    sector: holding.sector,
    rank: holding.rank,
    score: holding.score,
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
    sector_momentum: holding.sectorMomentum,
    ai_summary: holding.aiSummary,
    action_alerts: (holding.actionAlerts ?? []).slice(0, 5).map((alert: any) => ({
      action: alert.action,
      severity: alert.severity,
      title: alert.title,
      recommendation: alert.recommendation,
      evidence: alert.evidence,
    })),
    event_alerts: (holding.eventAlerts ?? []).slice(0, 5).map((alert: any) => ({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      recommendation: alert.recommendation,
    })),
    action_plan: {
      stop_or_exit: stopTrigger
        ? { condition: stopTrigger.condition, action: stopTrigger.action, tone: stopTrigger.tone }
        : null,
      take_profit: takeProfitTrigger
        ? { condition: takeProfitTrigger.condition, action: takeProfitTrigger.action, tone: takeProfitTrigger.tone }
        : null,
    },
  };
}

function buildPortfolioSummary(holdings: any[], portfolio: PortfolioRow) {
  const holdingsValue = holdings.reduce((sum, holding) => sum + finiteNumber(holding.currentValue, 0), 0);
  const totalCost = holdings.reduce((sum, holding) => sum + finiteNumber(holding.costBasis, 0), 0);
  const unrealisedPnL = holdings.reduce((sum, holding) => sum + finiteNumber(holding.totalPnLDollars, 0), 0);
  const cashBalance = finiteNumber(portfolio.cash_balance, 0);
  const totalValue = holdingsValue + cashBalance;
  const cashDepositedTotal = finiteNumber(portfolio.cash_deposited_total, finiteNumber(portfolio.investment_amount, totalCost + cashBalance));
  const pnlPct = cashDepositedTotal > 0 ? (unrealisedPnL / cashDepositedTotal) * 100 : null;
  const avgScore = holdings.length > 0 ? holdings.reduce((sum, holding) => sum + finiteNumber(holding.score, 0), 0) / holdings.length : null;

  return {
    total_value: Number(totalValue.toFixed(2)),
    holdings_value: Number(holdingsValue.toFixed(2)),
    cash_balance: Number(cashBalance.toFixed(2)),
    total_cost_basis: Number(totalCost.toFixed(2)),
    cash_deposited_total: Number(cashDepositedTotal.toFixed(2)),
    unrealised_pnl_dollars: Number(unrealisedPnL.toFixed(2)),
    unrealised_pnl_percent: pnlPct === null ? null : Number(pnlPct.toFixed(2)),
    holdings_count: holdings.length,
    average_score: avgScore === null ? null : Number(avgScore.toFixed(0)),
    strongest_ranked_holdings: [...holdings]
      .sort((a, b) => finiteNumber(a.rank, 9999) - finiteNumber(b.rank, 9999))
      .slice(0, 5)
      .map((holding) => ({ ticker: holding.ticker, rank: holding.rank, score: holding.score, recommendation: holding.recommendation })),
    weakest_ranked_holdings: [...holdings]
      .sort((a, b) => finiteNumber(b.rank, -1) - finiteNumber(a.rank, -1))
      .slice(0, 5)
      .map((holding) => ({ ticker: holding.ticker, rank: holding.rank, score: holding.score, recommendation: holding.recommendation })),
  };
}

async function buildAppContext(supabase: ServerSupabaseClient, userId: string, question: string) {
  const possibleTickers = extractPossibleTickers(question);

  const [{ data: topRankingsData }, { data: newsData }, { data: portfoliosData }] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("rank,previous_rank,ticker,company,sector,score,price,updated_at")
      .order("rank", { ascending: true })
      .limit(60),
    supabase
      .from("news_articles")
      .select("title,summary,source,affected_tickers,impact,impact_reason,published_at")
      .order("published_at", { ascending: false })
      .limit(30),
    (supabase as any)
      .from("user_portfolios")
      .select("id,name,risk_tolerance,time_horizon,investment_amount,cash_balance,cash_deposited_total,currency,created_at")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
  ]);

  let mentionedRankingsData: RankingRow[] = [];
  if (possibleTickers.length > 0) {
    const { data } = await supabase
      .from("stock_rankings")
      .select("rank,previous_rank,ticker,company,sector,score,price,updated_at")
      .in("ticker", possibleTickers);
    mentionedRankingsData = (data ?? []) as RankingRow[];
  }

  const rankingMap = new Map<string, RankingRow>();
  [...((topRankingsData ?? []) as RankingRow[]), ...mentionedRankingsData]
    .filter((row) => row.ticker)
    .forEach((row) => rankingMap.set(cleanTicker(row.ticker), row));

  const portfolios = ((portfoliosData ?? []) as PortfolioRow[]).map((portfolio) => ({
    ...portfolio,
    currency: portfolio.currency ?? "USD",
    cash_balance: finiteNumber(portfolio.cash_balance, 0),
    cash_deposited_total: finiteNumber(portfolio.cash_deposited_total, finiteNumber(portfolio.investment_amount, 0)),
    investment_amount: finiteNumber(portfolio.investment_amount, 0),
  }));

  const portfolioIds = portfolios.map((portfolio) => portfolio.id);
  const { data: holdingsData } = portfolioIds.length > 0
    ? await (supabase as any)
        .from("portfolio_holdings")
        .select("portfolio_id,ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes")
        .in("portfolio_id", portfolioIds)
        .order("added_at", { ascending: false })
    : { data: [] };

  const allRawHoldings = (holdingsData ?? []) as PortfolioHoldingRow[];

  const portfolioContexts = await Promise.all(
    portfolios.map(async (portfolio, index) => {
      const rawHoldings = allRawHoldings
        .filter((holding) => holding.portfolio_id === portfolio.id && holding.ticker)
        .map((holding) => ({
          ticker: cleanTicker(holding.ticker),
          entry_price: holding.entry_price,
          score_at_entry: holding.score_at_entry,
          rank_at_entry: holding.rank_at_entry,
          shares: holding.shares,
          allocation_pct: holding.allocation_pct,
          added_at: holding.added_at ?? new Date().toISOString(),
          last_reviewed_at: holding.last_reviewed_at ?? holding.added_at ?? new Date().toISOString(),
          purchase_date: holding.purchase_date ?? null,
          source: holding.source ?? null,
          notes: holding.notes ?? null,
        }));

      const enriched = await enrichHoldings(rawHoldings, (portfolio.risk_tolerance as RiskTolerance) ?? null);
      const compactHoldings = enriched.map(compactHolding);

      return {
        meta: {
          id: portfolio.id,
          name: cleanPortfolioName(portfolio.name, index),
          risk_tolerance: portfolio.risk_tolerance,
          time_horizon: portfolio.time_horizon,
          investment_amount: safeNumber(portfolio.investment_amount),
          cash_balance: safeNumber(portfolio.cash_balance),
          cash_deposited_total: safeNumber(portfolio.cash_deposited_total),
          currency: portfolio.currency ?? "USD",
          created_at: portfolio.created_at,
        },
        summary: buildPortfolioSummary(enriched, portfolio),
        holdings: compactHoldings.slice(0, 80),
      };
    }),
  );

  const suppliedRankings = [...rankingMap.values()].map(compactRanking);
  const news = ((newsData ?? []) as NewsRow[]).map(compactNews);
  const mentionedRankings = suppliedRankings.filter((ranking) => possibleTickers.includes(ranking.ticker));
  const allHoldings = portfolioContexts.flatMap((portfolio) => portfolio.holdings.map((holding) => ({ ...holding, portfolio_name: portfolio.meta.name })));
  const mentionedHoldings = allHoldings.filter((holding) => possibleTickers.includes(holding.ticker));
  const relevantNews = news.filter((article) =>
    possibleTickers.length === 0 || article.affected_tickers.some((ticker) => possibleTickers.includes(cleanTicker(ticker))),
  );

  return {
    user_status: "signed_in_subscribed",
    data_as_of: new Date().toISOString(),
    model_routing: {
      provider: "OpenRouter",
      attempted_models_in_order: openRouterModels(),
      rule: "Try the configured model first, then free high-quality fallback models if OpenRouter returns an error.",
    },
    question_intent: {
      possible_tickers: possibleTickers,
      membership_question: looksLikeMembershipQuestion(question),
      learning_question: looksLikeGeneralLearningQuestion(question),
    },
    rankings_context: {
      top_rankings: suppliedRankings.slice(0, 40),
      mentioned_rankings: mentionedRankings,
      note: "The visible Ask StockGPT rankings panel lazy-loads ranking rows separately so the chat interface stays fast.",
    },
    portfolio_context: portfolioContexts.length > 0
      ? {
          available: true,
          portfolios_count: portfolioContexts.length,
          portfolios: portfolioContexts,
          mentioned_holdings: mentionedHoldings,
        }
      : { available: false, reason: "No saved portfolio found." },
    news_context: {
      latest_news: news.slice(0, 16),
      relevant_news: relevantNews.slice(0, 10),
    },
    membership_context: {
      support_email: "sales@stockgpt.pro",
      billing_rule: "Do not invent billing, refund, coupon, or plan details. If exact account data is unavailable, direct the user to sales@stockgpt.pro.",
    },
    interpretation_rules: {
      rank: "Rank #1 is best.",
      score: "Higher StockGPT AI score is better inside the supplied ranking universe.",
      missing_data: "If exact information is missing, state what is missing. Never invent numbers.",
      financial_guidance: "Give research-based decision support, not guarantees or regulated financial advice.",
    },
  };
}

const systemPrompt = `
You are Ask StockGPT, the premium AI coach inside StockGPT.

Core identity:
- You help users understand StockGPT rankings, portfolio alerts, market news and investing concepts.
- You can answer natural, imperfectly written questions.
- You can handle follow-ups and continue the thread from recent chat history.
- You are not a regulated financial adviser.
- You give research-based decision support, not guaranteed instructions.

Portfolio rules:
- Users can have multiple portfolios.
- If the user has multiple portfolios, clearly say which portfolio you are analysing.
- Do not silently merge portfolios unless the user asks for an overall view.
- If a ticker appears in multiple portfolios, compare the position across portfolios.
- Use portfolio-specific cash, holdings, P&L, alerts and action plan levels where supplied.
- Cash is part of portfolio value but deposits are not profit.
- If a portfolio has no holdings, say so directly.

StockGPT data rules:
- Use the supplied app context first.
- Do not invent ranks, prices, scores, holdings, cash balances, subscription details or news.
- If a value is missing, say what is missing.
- Rank #1 is best.
- Higher score is better.
- Action alerts are stronger than event alerts.
- If there is no action alert, do not force a buy/sell answer.
- When useful, distinguish between hold, review, trim, sell and buy more.

Safety and financial guidance:
- Do not guarantee returns.
- Do not claim certainty.
- Do not tell the user that they will definitely make money.
- Avoid blanket instructions like "buy this now" unless phrased as research-based and conditional.

Coaching rules:
- Start with the practical answer.
- Then give the evidence or reasoning.
- Use short headings when helpful.
- Use bullets for decisions.
- Be direct and beginner-friendly.
- If the user asks what to do with a holding, use action alerts, rank, score, P&L, allocation and news together.

Membership rules:
- Give general guidance only.
- Do not invent pricing, refund eligibility, coupons, billing status or plan entitlements.
- For uncertain or account-specific membership questions, direct the user to sales@stockgpt.pro.

Style:
- Sound premium but natural.
- Be concise, but not robotic.
- Avoid long disclaimers.
`.trim();

async function callOpenRouter({
  apiKey,
  messages,
}: {
  apiKey: string;
  messages: OpenRouterMessage[];
}) {
  const failures: Array<{ model: string; status?: number; message: string }> = [];

  for (const model of openRouterModels()) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      });

      const data = (await response.json().catch(() => null)) as OpenRouterResponse | null;
      const answer = data?.choices?.[0]?.message?.content?.trim();

      if (response.ok && answer) {
        return { answer, model, failures };
      }

      failures.push({
        model,
        status: response.status,
        message: data?.error?.message ?? "OpenRouter returned no answer.",
      });
    } catch (error) {
      failures.push({
        model,
        message: error instanceof Error ? error.message : "OpenRouter request failed.",
      });
    }
  }

  return { answer: null, model: null, failures };
}

export async function GET() {
  const supabase = await createClient();
  const access = await requireSubscribedUser(supabase);
  if (access.response) return access.response;

  await deleteOldChatMessages(supabase, access.userId);
  const messages = await readRecentChatMessages(supabase, access.userId);

  return NextResponse.json({ messages, retained_days: CHAT_LOG_DAYS });
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
    return NextResponse.json({ success: false, error: "Could not clear Ask StockGPT chat history." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const access = await requireSubscribedUser(supabase);
    if (access.response) return access.response;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          answer:
            "Ask StockGPT is not connected yet. Add OPENROUTER_API_KEY to your Vercel environment variables, then redeploy. For help setting this up, contact sales@stockgpt.pro.",
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
      return !(isLast && message.role === "user" && message.content.trim().toLowerCase() === question.trim().toLowerCase());
    });

    const history = storedHistory.length > 0 ? storedHistory : fallbackHistory;

    await storeChatMessage(supabase, access.userId, { role: "user", content: question });

    const context = await buildAppContext(supabase, access.userId, question);
    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-16).map((message) => ({ role: message.role, content: message.content })),
      {
        role: "user",
        content: `User question:\n${question}\n\nCurrent StockGPT app context:\n${JSON.stringify(context, null, 2)}`,
      },
    ];

    const result = await callOpenRouter({ apiKey, messages });

    if (!result.answer) {
      console.error("[ask-stockgpt] OpenRouter all models failed", result.failures);
      const answer =
        "Ask StockGPT could not get an AI response from the OpenRouter model stack. Check OPENROUTER_API_KEY, free-model availability, rate limits and Vercel environment variables.";

      await storeChatMessage(supabase, access.userId, { role: "assistant", content: answer });
      return NextResponse.json({ answer, attempted_models: openRouterModels(), failures: result.failures }, { status: 500 });
    }

    await storeChatMessage(supabase, access.userId, { role: "assistant", content: result.answer });

    return NextResponse.json({
      answer: result.answer,
      model_used: result.model,
      attempted_models: [result.model, ...result.failures.map((failure) => failure.model)].filter(Boolean),
    });
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
