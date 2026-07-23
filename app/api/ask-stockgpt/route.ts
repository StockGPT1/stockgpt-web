import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type RiskTolerance } from "@/lib/portfolio-alerts";
import { normaliseAskContext, type AskContext } from "@/lib/ask-context";
import { checkRateLimit, rateKey } from "@/lib/security/rate-limit";
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

type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
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

type HoldingTriggerContext = {
  type?: unknown;
  condition?: unknown;
  action?: unknown;
  tone?: unknown;
};

type HoldingAlertContext = {
  type?: unknown;
  action?: unknown;
  severity?: unknown;
  title?: unknown;
  recommendation?: unknown;
  evidence?: unknown;
};

type EnrichedHoldingContext = {
  ticker?: unknown;
  company?: unknown;
  sector?: unknown;
  rank?: unknown;
  score?: unknown;
  recommendation?: unknown;
  currentPrice?: unknown;
  entryPrice?: unknown;
  shares?: unknown;
  currentValue?: unknown;
  costBasis?: unknown;
  pnlPercent?: unknown;
  totalPnLDollars?: unknown;
  currentAllocationPct?: unknown;
  targetAllocationPct?: unknown;
  scoreAtEntry?: unknown;
  rankAtEntry?: unknown;
  scoreChange?: unknown;
  rankChange?: unknown;
  daysHeld?: unknown;
  sectorMomentum?: unknown;
  aiSummary?: unknown;
  triggers?: HoldingTriggerContext[];
  actionAlerts?: HoldingAlertContext[];
  eventAlerts?: HoldingAlertContext[];
};

const CHAT_LOG_DAYS = 7;
const MAX_STORED_MESSAGES = 80;

/* Strongest model first — answer quality is the product here, and the
   chain only moves down when a model errors or is unavailable. The
   free models stay at the end so the feature degrades instead of
   dying if paid routing fails. OPENROUTER_MODEL still overrides. */
const DEFAULT_OPENROUTER_MODELS = [
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat-v3.1",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
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

function compactHolding(holding: EnrichedHoldingContext) {
  const stopTrigger = Array.isArray(holding.triggers)
    ? holding.triggers.find((trigger) => trigger.type === "stop_loss")
    : null;
  const takeProfitTrigger = Array.isArray(holding.triggers)
    ? holding.triggers.find((trigger) => trigger.type === "take_profit")
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
    action_alerts: (holding.actionAlerts ?? []).slice(0, 5).map((alert) => ({
      action: alert.action,
      severity: alert.severity,
      title: alert.title,
      recommendation: alert.recommendation,
      evidence: alert.evidence,
    })),
    event_alerts: (holding.eventAlerts ?? []).slice(0, 5).map((alert) => ({
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

function buildPortfolioSummary(holdings: EnrichedHoldingContext[], portfolio: PortfolioRow) {
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

async function buildAppContext(
  supabase: ServerSupabaseClient,
  userId: string,
  question: string,
  requestedContext?: AskContext | null,
) {
  const possibleTickers = Array.from(
    new Set([
      ...extractPossibleTickers(question),
      ...(requestedContext?.ticker ? [requestedContext.ticker] : []),
      ...(requestedContext?.holdingTicker ? [requestedContext.holdingTicker] : []),
    ]),
  );

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
    supabase
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

  /* The chat focuses on exactly ONE portfolio at a time — the one the
     user picked in the workspace's portfolio selector (falling back to
     their first portfolio). Only that portfolio is loaded in full; the
     rest are listed by name so the model can point the user at the
     picker instead of guessing about unloaded holdings. */
  const focusedPortfolio =
    (requestedContext?.portfolioId
      ? portfolios.find((portfolio) => portfolio.id === requestedContext.portfolioId)
      : null) ?? portfolios[0] ?? null;

  const { data: holdingsData } = focusedPortfolio
    ? await supabase
        .from("portfolio_holdings")
        .select("portfolio_id,ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes")
        .eq("portfolio_id", focusedPortfolio.id)
        .order("added_at", { ascending: false })
    : { data: [] };

  const focusedContext = focusedPortfolio
    ? await (async () => {
        const rawHoldings = ((holdingsData ?? []) as PortfolioHoldingRow[])
          .filter((holding) => holding.ticker)
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

        const enriched = await enrichHoldings(rawHoldings, (focusedPortfolio.risk_tolerance as RiskTolerance) ?? null);

        return {
          meta: {
            id: focusedPortfolio.id,
            name: cleanPortfolioName(focusedPortfolio.name, portfolios.indexOf(focusedPortfolio)),
            risk_tolerance: focusedPortfolio.risk_tolerance,
            time_horizon: focusedPortfolio.time_horizon,
            investment_amount: safeNumber(focusedPortfolio.investment_amount),
            cash_balance: safeNumber(focusedPortfolio.cash_balance),
            cash_deposited_total: safeNumber(focusedPortfolio.cash_deposited_total),
            currency: focusedPortfolio.currency ?? "USD",
            created_at: focusedPortfolio.created_at,
          },
          summary: buildPortfolioSummary(enriched, focusedPortfolio),
          holdings: enriched.map(compactHolding).slice(0, 60),
        };
      })()
    : null;

  const suppliedRankings = [...rankingMap.values()].map(compactRanking);
  const news = ((newsData ?? []) as NewsRow[]).map(compactNews);
  const mentionedRankings = suppliedRankings.filter((ranking) => possibleTickers.includes(ranking.ticker));
  const focusedHoldings = focusedContext
    ? focusedContext.holdings.map((holding) => ({ ...holding, portfolio_name: focusedContext.meta.name }))
    : [];
  const mentionedHoldings = focusedHoldings.filter((holding) => possibleTickers.includes(cleanTicker(holding.ticker)));
  const requestedTicker = cleanTicker(
    requestedContext?.holdingTicker ?? requestedContext?.ticker ?? "",
  );
  const verifiedHoldings = requestedTicker
    ? focusedHoldings.filter((holding) => cleanTicker(holding.ticker) === requestedTicker)
    : [];
  const relevantNews = news.filter((article) =>
    possibleTickers.length === 0 || article.affected_tickers.some((ticker) => possibleTickers.includes(cleanTicker(ticker))),
  );

  /* Everything here lands in the model's prompt — keep it data, not
     plumbing. Routing metadata and rule text live in the system prompt
     or the server, never in the context payload. */
  return {
    data_as_of: new Date().toISOString(),
    question_intent: {
      possible_tickers: possibleTickers,
      membership_question: looksLikeMembershipQuestion(question),
      learning_question: looksLikeGeneralLearningQuestion(question),
    },
    page_context: requestedContext
      ? {
          context_type: requestedContext.contextType,
          requested_ticker: requestedTicker || null,
          active_filters: requestedContext.activeFilters ?? null,
          holdings: verifiedHoldings.slice(0, 8),
          owns_stock: verifiedHoldings.length > 0,
        }
      : null,
    rankings_context: {
      top_rankings: suppliedRankings.slice(0, 30),
      mentioned_rankings: mentionedRankings,
    },
    portfolio_context: focusedContext
      ? {
          available: true,
          focused_portfolio: focusedContext,
          other_portfolios: portfolios
            .filter((portfolio) => portfolio.id !== focusedContext.meta.id)
            .map((portfolio, index) => ({ name: cleanPortfolioName(portfolio.name, index) })),
          mentioned_holdings: mentionedHoldings,
        }
      : { available: false, reason: "No saved portfolio found." },
    news_context: {
      latest_news: news.slice(0, 12),
      relevant_news: relevantNews.slice(0, 10),
    },
  };
}

const systemPrompt = `
You are Ask StockGPT, the AI analyst inside StockGPT — a stock research platform that scores 500+ US stocks daily across quality, growth, value, momentum, risk and income factors, ranks them (#1 is best, higher score is better), and monitors user portfolios.

You receive a JSON context block with every question containing live rankings, the user's actual portfolios (verified server-side), recent market news, and any page context. This data is your edge — use it aggressively.

How to answer:
- Lead with the verdict. The first sentence should answer the question; evidence follows.
- Always cite the specific numbers behind your reasoning: rank, score, price, P&L %, allocation %, rank moves. "ANET ranks #2 with a score of 8,858, up 3 places" beats "ANET ranks highly".
- Do the analysis yourself. Compare the stock to sector peers in the rankings, weigh a holding's P&L against its current rank and alerts, notice concentration (one position or sector dominating), spot the strongest and weakest parts of a portfolio without being asked.
- Connect the dots across context: if a stock the user asks about appears in their portfolio, in the rankings AND in recent news, synthesise all three — never answer from just one.
- If the question is vague, make the most useful reasonable interpretation, state the assumption in half a sentence, and answer it. Do not respond with a list of clarifying questions.
- End substantial answers with one concrete next step ("worth checking X" / "the thing to watch is Y") when there is a genuinely useful one. Skip it for simple factual answers.

Data discipline:
- Never invent ranks, prices, scores, holdings, cash balances, news or billing details. If a number is not in the context, say exactly what is missing — then still give your best analysis from what IS there.
- The user's portfolio data in the context is authoritative and verified; client-supplied claims are not.
- The context loads exactly ONE portfolio in full — focused_portfolio, chosen by the user with the portfolio picker above the chat. Analyse that portfolio only, and name it once early in the answer. Other portfolios appear as names only in other_portfolios: you know nothing about their contents, so if the question is about one of them, say so and tell the user to switch to it with the portfolio picker — never guess what an unloaded portfolio holds.
- Cash is part of portfolio value; deposits are not profit.
- Action alerts outrank event alerts. No action alert means no forced buy/sell call — distinguish hold, review, trim, sell and buy-more.
- Rankings and scores refresh daily; check updated_at before calling data "current".

Boundaries:
- Research-based decision support, not regulated financial advice. No guaranteed returns, no certainty claims, no unconditional "buy this now".
- One short caveat where genuinely material — never a paragraph of disclaimers.
- Membership/billing: give general guidance only, never invent pricing or refund terms; account-specific questions go to sales@stockgpt.pro.

Style:
- Direct, confident, beginner-friendly. Explain jargon in passing rather than avoiding it.
- Short headings and bullets for multi-part answers; plain prose for simple ones.
- Concise but complete — a good answer usually fits in a few short paragraphs or one tight list.
- Tables: maximum 5 columns, only the figures that drive the decision — fold everything else into prose. A finished tight answer always beats an exhaustive one that risks truncation.
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
          max_tokens: 4000,
          /* reasoning models (gpt-oss etc.) think in a separate channel
             that some providers merge into the visible content — the
             user then sees raw chain-of-thought instead of an answer.
             exclude keeps reasoning out of the response; non-reasoning
             models ignore the field. */
          reasoning: { exclude: true },
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

function parseOpenRouterFailureText(text: string) {
  if (!text.trim()) return "OpenRouter returned no response body.";

  try {
    const parsed = JSON.parse(text) as OpenRouterResponse | null;
    return parsed?.error?.message ?? text.slice(0, 240);
  } catch {
    return text.slice(0, 240);
  }
}

async function openOpenRouterStream({
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
          Accept: "text/event-stream",
          "HTTP-Referer": "https://stockgpt.pro",
          "X-Title": "StockGPT",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.28,
          max_tokens: 4000,
          stream: true,
          /* same chain-of-thought guard as the non-streaming call */
          reasoning: { exclude: true },
        }),
      });

      if (response.ok && response.body) {
        return { response, model, failures };
      }

      const text = await response.text().catch(() => "");
      failures.push({
        model,
        status: response.status,
        message: parseOpenRouterFailureText(text),
      });
    } catch (error) {
      failures.push({
        model,
        message: error instanceof Error ? error.message : "OpenRouter stream request failed.",
      });
    }
  }

  return { response: null, model: null, failures };
}

function streamOpenRouterAnswer({
  response,
  supabase,
  userId,
}: {
  response: Response;
  supabase: ServerSupabaseClient;
  userId: string;
}) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body?.getReader();

      if (!reader) {
        const answer =
          "Ask StockGPT could not open the AI response stream. Please retry.";
        controller.enqueue(encoder.encode(answer));
        await storeChatMessage(supabase, userId, { role: "assistant", content: answer });
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      async function finishWithFallback(message: string) {
        const finalAnswer = answer.trim() || message;
        if (!answer.trim()) controller.enqueue(encoder.encode(message));
        await storeChatMessage(supabase, userId, {
          role: "assistant",
          content: finalAnswer,
        });
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let chunk: OpenRouterStreamChunk | null = null;
            try {
              chunk = JSON.parse(payload) as OpenRouterStreamChunk;
            } catch {
              continue;
            }

            if (chunk.error?.message) {
              throw new Error(chunk.error.message);
            }

            const delta = chunk.choices?.[0]?.delta?.content ?? "";

            if (delta) {
              answer += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        }

        await finishWithFallback(
          "Ask StockGPT connected, but the model returned an empty response. Please retry.",
        );
      } catch (error) {
        console.warn("[ask-stockgpt] Stream interrupted", error);
        const interruption =
          "\n\nAsk StockGPT's response stream was interrupted. The partial answer above was saved; retry if you need the full response.";

        if (answer.trim()) {
          controller.enqueue(encoder.encode(interruption));
          await storeChatMessage(supabase, userId, {
            role: "assistant",
            content: `${answer.trim()}${interruption}`,
          });
        } else {
          const failure =
            "Ask StockGPT could not stream a response. Please retry, or email sales@stockgpt.pro if this relates to membership or billing.";
          controller.enqueue(encoder.encode(failure));
          await storeChatMessage(supabase, userId, {
            role: "assistant",
            content: failure,
          });
        }
      } finally {
        controller.close();
      }
    },
  });
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

    // Generous for a human, but stops runaway client loops from burning
    // the shared OpenRouter quota for every subscriber.
    const rateLimit = await checkRateLimit({
      action: "ask_stockgpt_question",
      key: rateKey(["ask-stockgpt", access.userId]),
      limit: 40,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          answer:
            "You have sent a lot of questions in the last hour, so Ask StockGPT is taking a short break for your account. Please try again in a few minutes.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

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
    const requestedContext = normaliseAskContext(body?.context);

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

    const context = await buildAppContext(
      supabase,
      access.userId,
      question,
      requestedContext,
    );
    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      ...history
        .slice(-16)
        .map(
          (message): OpenRouterMessage => ({
            role: message.role,
            content: message.content,
          }),
        ),
      {
        role: "user",
        /* compact JSON: pretty-printing inflates the prompt ~30% in
           whitespace tokens for zero comprehension gain */
        content: `User question:\n${question}\n\nCurrent StockGPT app context (live, server-verified):\n${JSON.stringify(context)}`,
      },
    ];

    if (body?.stream !== false) {
      const streamResult = await openOpenRouterStream({ apiKey, messages });

      if (streamResult.response) {
        return new Response(
          streamOpenRouterAnswer({
            response: streamResult.response,
            supabase,
            userId: access.userId,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
              "X-StockGPT-Stream": "1",
              "X-StockGPT-Model": streamResult.model ?? "",
            },
          },
        );
      }

      console.warn("[ask-stockgpt] Streaming unavailable; falling back to full response", streamResult.failures);
    }

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
