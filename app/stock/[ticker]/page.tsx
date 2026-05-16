import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { TradeSetupCard } from "@/components/TradeSetupCard";
import { WatchlistToggle } from "@/components/WatchlistToggle";
import { StockChart } from "@/components/StockChart";
import { StockLogo } from "@/components/StockLogo";
import { calculateTradeLevels } from "@/lib/trading-levels";
import { createClient } from "@/utils/supabase/server";
import { getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
import { getDaysAtTop } from "@/lib/rank-history";

type Stock = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

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

function formatDaysAtTop(days: number | null) {
  if (days == null) return "Tracking";
  if (days <= 0) return "0";
  return days.toLocaleString();
}

function formatNewsDate(dateStr: string | null) {
  if (!dateStr) return "Date unavailable";

  return new Date(dateStr).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normaliseTickers(value: NewsArticle["affected_tickers"]) {
  if (Array.isArray(value)) {
    return value.map((ticker) => String(ticker).trim().toUpperCase());
  }

  if (typeof value === "string") {
    return value.split(",").map((ticker) => ticker.trim().toUpperCase());
  }

  return [];
}

function impactBadgeClass(impact: string | null) {
  const value = (impact ?? "").toLowerCase().trim();

  if (value === "positive") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }

  if (value === "negative") {
    return "border-red-400/25 bg-red-400/10 text-red-300";
  }

  return "border-[#faf6f0]/12 bg-[#faf6f0]/6 text-[#faf6f0]/50";
}

function impactLabel(impact: string | null) {
  const value = (impact ?? "").toLowerCase().trim();

  if (value === "positive") return "Positive";
  if (value === "negative") return "Negative";
  return "Neutral";
}

function getEventSummary(stock: Stock, articles: NewsArticle[]) {
  if (articles.length === 0) {
    return `No linked world-event or company-activity coverage is currently stored for ${
      stock.ticker ?? "this stock"
    }. When relevant news is attached to this ticker, StockGPT will show the likely market impact here.`;
  }

  const positive = articles.filter(
    (article) => (article.impact ?? "").toLowerCase().trim() === "positive",
  ).length;

  const negative = articles.filter(
    (article) => (article.impact ?? "").toLowerCase().trim() === "negative",
  ).length;

  const neutral = articles.length - positive - negative;

  const direction =
    positive > negative
      ? "mostly positive"
      : negative > positive
        ? "mostly negative"
        : "mixed or neutral";

  return `StockGPT has linked ${articles.length} recent news ${
    articles.length === 1 ? "item" : "items"
  } to ${stock.ticker}. The current stored event impact is ${direction}: ${positive} positive, ${neutral} neutral and ${negative} negative.`;
}

function LockIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}

function BlurredNumber({
  unlocked,
  children,
  placeholder = "29,429",
  className = "",
  light = false,
}: {
  unlocked: boolean;
  children: ReactNode;
  placeholder?: string;
  className?: string;
  light?: boolean;
}) {
  if (unlocked) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      aria-label="Subscriber-only value"
      className={[
        "relative inline-block select-none tabular-nums",
        light ? "text-[#072116]/80" : "text-current",
        className,
      ].join(" ")}
    >
      <span className="blur-[5px]">{placeholder}</span>
    </span>
  );
}

function BlurredText({
  unlocked,
  children,
  placeholder,
  className = "",
}: {
  unlocked: boolean;
  children: ReactNode;
  placeholder: string;
  className?: string;
}) {
  if (unlocked) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      aria-label="Subscriber-only value"
      className={["inline-block select-none blur-[5px]", className].join(" ")}
    >
      {placeholder}
    </span>
  );
}

function SubscriberLockNotice() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ddb159]/22 bg-[#04180f]/78 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#ddb159]/14 blur-3xl" />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-2xl border border-[#ddb159]/28 bg-[#ddb159]/10 text-[#ddb159] shadow-[0_0_22px_rgba(221,177,89,0.12)]">
            <LockIcon className="size-4" />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Subscriber research layer
            </p>

            <p className="mt-1 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/54">
              The full page structure is visible, but ranking numbers, score
              values, trade levels and model metrics are hidden until access is
              unlocked.
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#072116] transition hover:brightness-105"
        >
          Log in to unlock →
        </Link>
      </div>
    </div>
  );
}

function ClickHint() {
  return (
    <span className="pointer-events-none absolute right-2 top-2 rounded-full border border-[#072116]/10 bg-white/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#072116]/40 opacity-0 transition group-hover:opacity-100">
      Explain
    </span>
  );
}

function LockedLevelBox({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const classes =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50/50 text-emerald-700"
      : tone === "negative"
        ? "border-red-200 bg-red-50/50 text-red-700"
        : "border-[#072116]/10 bg-white text-[#072116]";

  return (
    <button
      type="button"
      className={[
        "group relative rounded-xl px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/70 hover:shadow-[0_8px_20px_rgba(7,33,22,0.12)]",
        classes,
      ].join(" ")}
    >
      <ClickHint />
      <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>

      <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em]">
        <BlurredNumber unlocked={false} placeholder={value} light />
      </p>

      <p className="mt-1 text-[10px] font-semibold opacity-70">
        <BlurredText unlocked={false} placeholder={note}>
          {note}
        </BlurredText>
      </p>
    </button>
  );
}

function LockedFactorBox({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <button
      type="button"
      className="group relative rounded-lg border border-[#072116]/8 bg-white/60 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/65 hover:bg-white hover:shadow-[0_8px_18px_rgba(7,33,22,0.1)]"
    >
      <ClickHint />

      <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
        {label}
      </p>

      <p className="mt-0.5 truncate text-[12px] font-bold">
        {label === "Sector" || label === "Recent news" ? (
          value
        ) : (
          <BlurredText unlocked={false} placeholder={value}>
            {value}
          </BlurredText>
        )}
      </p>

      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/55">
        {label === "Sector" || label === "Recent news" ? (
          note
        ) : (
          <BlurredText unlocked={false} placeholder={note}>
            {note}
          </BlurredText>
        )}
      </p>
    </button>
  );
}

function LockedTradePlanCard({
  ticker,
  sector,
}: {
  ticker: string;
  sector: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            ✦ AI Trade Plan
          </p>

          <h3 className="mt-0.5 text-[20px] font-black tracking-[-0.03em]">
            Suggested Levels
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">
            Strong Buy
          </div>

          <div className="grid size-9 place-items-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[#ddb159] shadow-[0_0_22px_rgba(221,177,89,0.16)]">
            <LockIcon className="size-4" />
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        <LockedLevelBox label="Entry" value="$482.02" note="Suggested" />
        <LockedLevelBox
          label="Stop Loss"
          value="$351.37"
          note="−27.1%"
          tone="negative"
        />
        <LockedLevelBox
          label="Take Profit"
          value="$1135.25"
          note="+135.5%"
          tone="positive"
        />
      </div>

      <div className="relative mt-3 flex w-full items-center justify-between rounded-xl bg-[#072116] px-4 py-2.5 text-left">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#ddb159]/80">
          Risk / Reward
        </p>

        <p className="text-[14px] font-black text-[#ddb159]">
          <BlurredText unlocked={false} placeholder="1 : 5">
            1 : 5
          </BlurredText>
        </p>
      </div>

      <div className="relative mt-4 rounded-xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#fdf8ed,#faf6f0)] p-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ AI Projected Timeline
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-transparent p-1 text-left">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
              Expected Return
            </p>
            <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em] text-emerald-700">
              <BlurredText unlocked={false} placeholder="24.7%/yr">
                24.7%/yr
              </BlurredText>
            </p>
          </div>

          <div className="rounded-lg border border-transparent p-1 text-left">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
              Target Date
            </p>
            <p className="mt-0.5 text-[18px] font-black tracking-[-0.02em]">
              <BlurredText unlocked={false} placeholder="Nov 2028">
                Nov 2028
              </BlurredText>
            </p>
          </div>

          <div className="rounded-lg border border-transparent p-1 text-left">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
              Hold Period
            </p>
            <p className="mt-0.5 text-[14px] font-black tracking-[-0.02em]">
              <BlurredText unlocked={false} placeholder="20–38 months">
                20–38 months
              </BlurredText>
            </p>
          </div>
        </div>

        <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#072116]/75">
          Medium-term plan: {ticker} has an exceptionally strong AI signal
          {" ("}
          rank{" "}
          <BlurredText unlocked={false} placeholder="#1">
            #1
          </BlurredText>
          , score{" "}
          <BlurredText unlocked={false} placeholder="23,568">
            23,568
          </BlurredText>
          {")"}, {sector ?? "its sector"} high volatility, and an asymmetric
          setup targeting{" "}
          <BlurredText unlocked={false} placeholder="$1135.25">
            $1135.25
          </BlurredText>{" "}
          against invalidation at{" "}
          <BlurredText unlocked={false} placeholder="$351.37">
            $351.37
          </BlurredText>
          . Risk/reward is about{" "}
          <BlurredText unlocked={false} placeholder="1:5.0">
            1:5.0
          </BlurredText>
          , with risk invalidated below the 50-day area around{" "}
          <BlurredText unlocked={false} placeholder="$358.55">
            $358.55
          </BlurredText>
          .
        </p>

        <div className="mt-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            ✦ AI Action Plan — If This, Then That
          </p>

          <div className="mt-2 grid gap-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <p className="text-[12px] font-black tracking-[-0.01em] text-emerald-900">
                If {ticker} approaches{" "}
                <BlurredText unlocked={false} placeholder="$1135.25">
                  $1135.25
                </BlurredText>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/60">
                → Medium-term take-profit zone (first checkpoint is prior
                resistance around{" "}
                <BlurredText unlocked={false} placeholder="$515.83">
                  $515.83
                </BlurredText>
                , but the medium-term target uses a measured extension beyond
                it;{" "}
                <BlurredText unlocked={false} placeholder="+135.5%">
                  +135.5%
                </BlurredText>
                ) — likely by{" "}
                <BlurredText unlocked={false} placeholder="Nov 2028">
                  Nov 2028
                </BlurredText>
              </p>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-[12px] font-black tracking-[-0.01em] text-red-900">
                If {ticker} breaks{" "}
                <BlurredText unlocked={false} placeholder="$351.37">
                  $351.37
                </BlurredText>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/60">
                → Cut or trim (below the 50-day area around{" "}
                <BlurredText unlocked={false} placeholder="$358.55">
                  $358.55
                </BlurredText>
                ;{" "}
                <BlurredText unlocked={false} placeholder="−27.1%">
                  −27.1%
                </BlurredText>
                ). This is the thesis invalidation level, not a short-term noise
                stop.
              </p>
            </div>

            <div className="rounded-lg border border-[#072116]/12 bg-[#072116]/4 px-3 py-2.5">
              <p className="text-[12px] font-black tracking-[-0.01em] text-[#072116]">
                If AI score drops by{" "}
                <BlurredText unlocked={false} placeholder="25%">
                  25%
                </BlurredText>{" "}
                from current
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/60">
                → Reassess thesis — model conviction has weakened
              </p>
            </div>

            <div className="rounded-lg border border-[#072116]/12 bg-[#072116]/4 px-3 py-2.5">
              <p className="text-[12px] font-black tracking-[-0.01em] text-[#072116]">
                Every{" "}
                <BlurredText unlocked={false} placeholder="3 months">
                  3 months
                </BlurredText>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/60">
                → Review price structure, AI rank, news, and whether
                support/resistance has shifted
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ Built From
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <LockedFactorBox
            label="AI Score"
            value="23,568"
            note="Top-tier signal"
          />
          <LockedFactorBox label="Rank" value="#1 of 500" note="Top 10%" />
          <LockedFactorBox
            label="Risk/reward"
            value="1:5"
            note="Medium-term asymmetric target"
          />
          <LockedFactorBox
            label="Technical stop"
            value="$358.55"
            note="Qualified 50-day area"
          />
          <LockedFactorBox
            label="Technical target"
            value="$515.83+"
            note="Resistance checkpoint, then extension"
          />
          <LockedFactorBox
            label="P/E Ratio"
            value="24.6x"
            note="Valuation input"
          />
          <LockedFactorBox
            label="Sector"
            value={sector ?? "Sector unavailable"}
            note="high volatility"
          />
          <LockedFactorBox
            label="Recent news"
            value="No recent coverage"
            note="Neutral catalyst layer"
          />
        </div>
      </div>

      <p className="relative mt-4 text-[10px] font-medium leading-relaxed text-[#072116]/45">
        AI-generated trade plan based on quantitative factors. Not financial
        advice. Past performance does not guarantee future results.
      </p>
    </div>
  );
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const supabase = await createClient();

  const { data: stockData } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,sector,score,price")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!stockData) notFound();

  const stock = stockData as Stock;

  const chartData = await getStockChart(ticker, [
    "1D",
    "5D",
    "1M",
    "6M",
    "1Y",
    "5Y",
    "MAX",
  ]);

  const livePrice =
    getLatestPriceFromChart(chartData) ?? (Number(stock.price) || 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const canSeeRankAndScore = isAuthenticated;

  const [
    tradeLevels,
    watchlistEntry,
    sectorPeers,
    daysAtTop,
    relatedNewsResponse,
  ] = await Promise.all([
    calculateTradeLevels({
      ticker,
      price: livePrice,
      score: canSeeRankAndScore ? Number(stock.score) || 0 : 0,
      rank: canSeeRankAndScore ? Number(stock.rank) || null : null,
      sector: stock.sector ?? null,
    }),

    isAuthenticated && stock.ticker
      ? supabase
          .from("user_watchlist")
          .select("id")
          .eq("user_id", user!.id)
          .eq("ticker", stock.ticker)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),

    stock.sector
      ? supabase
          .from("stock_rankings")
          .select("ticker, company, rank, score, price")
          .eq("sector", stock.sector)
          .neq("ticker", ticker)
          .order("rank", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),

    canSeeRankAndScore
      ? getDaysAtTop(supabase, ticker, stock.rank)
      : Promise.resolve(null),

    supabase
      .from("news_articles")
      .select(
        "id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at",
      )
      .order("published_at", { ascending: false })
      .limit(100),
  ]);

  const peers = (sectorPeers?.data ?? []) as Array<{
    ticker: string;
    company: string;
    rank: number;
    score: number;
    price: number;
  }>;

  const relatedNews = ((relatedNewsResponse.data ?? []) as NewsArticle[])
    .filter((article) =>
      normaliseTickers(article.affected_tickers).includes(ticker),
    )
    .slice(0, 5);

  const inWatchlist = !!watchlistEntry;

  return (
    <AppShell activePath="/rankings">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-3">
          <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#ddb159]/70">
                  <Link href="/rankings" className="hover:text-[#ddb159]">
                    ← Rankings
                  </Link>

                  <span>·</span>

                  <span className="inline-flex items-center gap-1.5">
                    Rank #
                    <BlurredNumber
                      unlocked={canSeeRankAndScore}
                      placeholder="128"
                    >
                      {stock.rank ?? "—"}
                    </BlurredNumber>
                  </span>

                  {stock.sector && (
                    <>
                      <span>·</span>
                      <span>{stock.sector}</span>
                    </>
                  )}
                </div>

                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                  <StockLogo
                    ticker={stock.ticker}
                    company={stock.company}
                    size={42}
                  />

                  <div className="min-w-0">
                    <h1 className="text-[34px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">
                      {stock.ticker}
                    </h1>

                    <p className="mt-1 truncate text-[16px] font-bold text-[#faf6f0]/70">
                      {stock.company ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-[26px] font-black tabular-nums tracking-[-0.03em] text-[#faf6f0]">
                    ${livePrice.toFixed(2)}
                  </p>

                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: "#ddb159", color: "#072116" }}
                  >
                    AI Score ·{" "}
                    <BlurredNumber
                      unlocked={canSeeRankAndScore}
                      placeholder="29,429"
                      light
                    >
                      {Number(stock.score).toLocaleString()}
                    </BlurredNumber>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ddb159]/30 bg-[#072116]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#ddb159]">
                    Days at top ·{" "}
                    <BlurredNumber
                      unlocked={canSeeRankAndScore}
                      placeholder="14"
                    >
                      {formatDaysAtTop(daysAtTop)}
                    </BlurredNumber>
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <WatchlistToggle
                  ticker={ticker}
                  initialInWatchlist={inWatchlist}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
          </div>

          {!canSeeRankAndScore && <SubscriberLockNotice />}

          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              ✦ Price Chart
            </p>

            <div className="mt-2">
              <StockChart
                ticker={ticker}
                data={chartData}
                initialRange="1Y"
                height={320}
              />
            </div>
          </div>

          <section className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                  ✦ World Events & Company Activity
                </p>

                <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#faf6f0]">
                  How recent events may affect {stock.ticker}
                </h2>
              </div>

              <Link
                href="/world-news"
                className="w-fit rounded-full border border-[#ddb159]/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
              >
                Open world news
              </Link>
            </div>

            <p className="mt-3 max-w-4xl text-[13px] font-medium leading-6 text-[#faf6f0]/58">
              {getEventSummary(stock, relatedNews)}
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {relatedNews.length > 0 ? (
                relatedNews.map((article) => (
                  <a
                    key={article.id}
                    href={article.url ?? undefined}
                    target={article.url ? "_blank" : undefined}
                    rel={article.url ? "noopener noreferrer" : undefined}
                    className="group flex gap-3 rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d]/55 p-3 transition hover:border-[#ddb159]/40 hover:bg-[#0b2b1d]"
                  >
                    {article.image_url && (
                      <div className="hidden h-20 w-24 shrink-0 overflow-hidden rounded-xl sm:block">
                        <img
                          src={article.image_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {article.source && (
                          <span className="text-[10px] font-black text-[#ddb159]">
                            {article.source}
                          </span>
                        )}

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${impactBadgeClass(
                            article.impact,
                          )}`}
                        >
                          {impactLabel(article.impact)}
                        </span>

                        <span className="text-[9px] font-bold text-[#faf6f0]/32">
                          {formatNewsDate(article.published_at)}
                        </span>
                      </div>

                      <h3 className="mt-1.5 line-clamp-2 text-[14px] font-black leading-snug tracking-[-0.02em] text-[#faf6f0] group-hover:text-[#ddb159]">
                        {article.title ?? "Untitled article"}
                      </h3>

                      {(article.impact_reason || article.summary) && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-5 text-[#faf6f0]/45">
                          {article.impact_reason ||
                            article.summary ||
                            "No additional event detail available."}
                        </p>
                      )}
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.025] p-4 lg:col-span-2">
                  <p className="text-[13px] font-bold text-[#faf6f0]/50">
                    No recent linked articles are available for {stock.ticker} yet.
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            {canSeeRankAndScore ? (
              tradeLevels && <TradeSetupCard levels={tradeLevels} />
            ) : (
              <LockedTradePlanCard ticker={ticker} sector={stock.sector} />
            )}

            {peers.length > 0 && (
              <aside className="rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  ✦ Sector Peers
                </p>

                <p
                  className="mt-1 text-[11px] font-semibold"
                  style={{ color: "rgba(7,33,22,0.55)" }}
                >
                  Top 5 in {stock.sector}
                </p>

                <div className="mt-3 grid gap-1.5">
                  {peers.map((p) => (
                    <Link
                      key={p.ticker}
                      href={`/stock/${p.ticker}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:border-[#ddb159]"
                    >
                      <div className="min-w-0">
                        <p
                          className="text-[12px] font-black tracking-[-0.01em]"
                          style={{ color: "#072116" }}
                        >
                          {p.ticker}
                        </p>

                        <p
                          className="truncate text-[10px] font-semibold"
                          style={{ color: "rgba(7,33,22,0.55)" }}
                        >
                          {p.company}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className="flex items-center justify-end gap-1 text-[10px] font-bold"
                          style={{ color: "rgba(7,33,22,0.65)" }}
                        >
                          #
                          <BlurredNumber
                            unlocked={canSeeRankAndScore}
                            placeholder="128"
                            light
                          >
                            {p.rank}
                          </BlurredNumber>
                        </p>

                        <span
                          className="mt-1 inline-flex justify-center rounded-full px-2 py-0.5 text-[9px] font-black"
                          style={{
                            backgroundColor: "#ddb159",
                            color: "#072116",
                          }}
                        >
                          <BlurredNumber
                            unlocked={canSeeRankAndScore}
                            placeholder="29,429"
                            light
                          >
                            {Number(p.score).toLocaleString()}
                          </BlurredNumber>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
