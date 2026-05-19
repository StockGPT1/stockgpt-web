import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AddToPortfolioButton } from "@/components/AddToPortfolioButton";
import { AppShell } from "@/components/AppShell";
import { StockRelatedNews } from "@/components/StockRelatedNews";
import { TradeSetupCard } from "@/components/TradeSetupCard";
import { WatchlistToggle } from "@/components/WatchlistToggle";
import { StockChart } from "@/components/StockChart";
import { StockLogo } from "@/components/StockLogo";
import { calculateTradeLevels } from "@/lib/trading-levels";
import { createClient } from "@/utils/supabase/server";
import { getStockChart, getLatestPriceFromChart } from "@/lib/yahoo";
import { getDaysAtTop } from "@/lib/rank-history";
import {
  selectRelevantNewsForStock,
  type BaseNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";

type Stock = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
};

function formatDaysAtTop(days: number | null) {
  if (days == null) return "Tracking";
  if (days <= 0) return "0";
  return days.toLocaleString();
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
  children?: ReactNode;
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
    <div className="relative max-w-full overflow-hidden rounded-2xl border border-[#ddb159]/22 bg-[#04180f]/78 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#ddb159]/14 blur-3xl" />

      <div className="relative flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-2xl border border-[#ddb159]/28 bg-[#ddb159]/10 text-[#ddb159] shadow-[0_0_22px_rgba(221,177,89,0.12)]">
            <LockIcon className="size-4" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
              Subscriber research layer
            </p>

            <p className="mt-1 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/54">
              Titles and structure are visible, but ranking numbers, scores,
              trade levels, valuation data and model outputs are hidden until
              access is unlocked.
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
        "group relative min-w-0 rounded-xl px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/70 hover:shadow-[0_8px_20px_rgba(7,33,22,0.12)]",
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

function LockedTimelineBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-transparent p-1 text-left">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
        {label}
      </p>

      <p
        className={[
          "mt-0.5 font-black tracking-[-0.02em]",
          tone === "positive"
            ? "text-[18px] text-emerald-700"
            : "text-[16px] text-[#072116]",
        ].join(" ")}
      >
        <BlurredText unlocked={false} placeholder={value}>
          {value}
        </BlurredText>
      </p>
    </div>
  );
}

function LockedActionBox({
  title,
  detail,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const classes =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "negative"
        ? "border-red-200 bg-red-50"
        : "border-[#072116]/12 bg-[#072116]/4";

  const titleColor =
    tone === "positive"
      ? "text-emerald-900"
      : tone === "negative"
        ? "text-red-900"
        : "text-[#072116]";

  return (
    <div className={["min-w-0 rounded-lg border px-3 py-2.5", classes].join(" ")}>
      <p
        className={[
          "text-[12px] font-black tracking-[-0.01em]",
          titleColor,
        ].join(" ")}
      >
        {title}
      </p>

      <p className="mt-0.5 text-[11px] font-semibold leading-5 text-[#072116]/60">
        <BlurredText unlocked={false} placeholder={detail}>
          {detail}
        </BlurredText>
      </p>
    </div>
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
      className="group relative min-w-0 rounded-lg border border-[#072116]/8 bg-white/60 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/65 hover:bg-white hover:shadow-[0_8px_18px_rgba(7,33,22,0.1)]"
    >
      <ClickHint />

      <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#072116]/45">
        {label}
      </p>

      <p className="mt-0.5 truncate text-[12px] font-bold text-[#072116]">
        <BlurredText unlocked={false} placeholder={value}>
          {value}
        </BlurredText>
      </p>

      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/55">
        <BlurredText unlocked={false} placeholder={note}>
          {note}
        </BlurredText>
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
    <div className="relative max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            ✦ AI Trade Plan
          </p>

          <h3 className="mt-0.5 text-[20px] font-black tracking-[-0.03em]">
            Suggested Levels
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">
            <BlurredText unlocked={false} placeholder="Strong Buy">
              Strong Buy
            </BlurredText>
          </div>

          <div className="grid size-9 place-items-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[#ddb159] shadow-[0_0_22px_rgba(221,177,89,0.16)]">
            <LockIcon className="size-4" />
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
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

      <div className="relative mt-3 flex w-full min-w-0 items-center justify-between rounded-xl bg-[#072116] px-4 py-2.5 text-left">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#ddb159]/80">
          Risk / Reward
        </p>

        <p className="text-[14px] font-black text-[#ddb159]">
          <BlurredText unlocked={false} placeholder="1 : 5">
            1 : 5
          </BlurredText>
        </p>
      </div>

      <div className="relative mt-4 max-w-full overflow-hidden rounded-xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#fdf8ed,#faf6f0)] p-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ AI Projected Timeline
        </p>

        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <LockedTimelineBox
            label="Expected Return"
            value="24.7%/yr"
            tone="positive"
          />

          <LockedTimelineBox label="Target Date" value="Nov 2028" />

          <LockedTimelineBox label="Hold Period" value="20–38 months" />
        </div>

        <p className="mt-3 break-words text-[12px] font-medium leading-relaxed text-[#072116]/75">
          <BlurredText
            unlocked={false}
            placeholder={`Medium-term plan: ${ticker} has an exceptionally strong AI signal (rank #1, score 23,568), ${
              sector ?? "sector"
            } high volatility, and an asymmetric setup targeting $1135.25 against invalidation at $351.37. Risk/reward is about 1:5.0, with risk invalidated below the 50-day area around $358.55.`}
          >
            Medium-term plan: {ticker} has an exceptionally strong AI signal
            (rank #1, score 23,568), {sector ?? "sector"} high volatility, and
            an asymmetric setup targeting $1135.25 against invalidation at
            $351.37. Risk/reward is about 1:5.0, with risk invalidated below the
            50-day area around $358.55.
          </BlurredText>
        </p>

        <div className="mt-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
            ✦ AI Action Plan — If This, Then That
          </p>

          <div className="mt-2 grid min-w-0 gap-2">
            <LockedActionBox
              title="Take-profit scenario"
              detail={`If ${ticker} approaches $1135.25 → Medium-term take-profit zone. First checkpoint is prior resistance around $515.83, but the medium-term target uses a measured extension beyond it; +135.5%. Likely by Nov 2028.`}
              tone="positive"
            />

            <LockedActionBox
              title="Invalidation scenario"
              detail={`If ${ticker} breaks $351.37 → Cut or trim below the 50-day area around $358.55; −27.1%. This is the thesis invalidation level, not a short-term noise stop.`}
              tone="negative"
            />

            <LockedActionBox
              title="Model conviction"
              detail="If AI score drops by 25% from current → Reassess thesis. Model conviction has weakened."
            />

            <LockedActionBox
              title="Review cadence"
              detail="Every 3 months → Review price structure, AI rank, news, and whether support/resistance has shifted."
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">
          ✦ Built From
        </p>

        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
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
            note="High volatility"
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
      .limit(180),
  ]);

  const peers = (sectorPeers?.data ?? []) as Array<{
    ticker: string;
    company: string;
    rank: number;
    score: number;
    price: number;
  }>;

  const relevantNews = selectRelevantNewsForStock(
    (relatedNewsResponse.data ?? []) as BaseNewsArticle[],
    {
      ticker: stock.ticker,
      company: stock.company,
      sector: stock.sector,
      rank: stock.rank,
      score: stock.score,
      price: livePrice,
    } satisfies StockLike,
    8,
  ).filter((article) =>
    article.affectedStocks.some(
      (insight) =>
        insight.ticker.toUpperCase() === ticker && insight.impactRating >= 5,
    ),
  );

  const inWatchlist = !!watchlistEntry;

  return (
    <AppShell activePath="/rankings">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1">
        <div className="grid w-full min-w-0 max-w-full gap-3 overflow-x-hidden">
          <div className="relative max-w-full overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />

            <div className="relative flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-bold text-[#ddb159]/70">
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

                <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
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

              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center xl:justify-end">
                <WatchlistToggle
                  ticker={ticker}
                  initialInWatchlist={inWatchlist}
                  isAuthenticated={isAuthenticated}
                />

                <AddToPortfolioButton
                  ticker={ticker}
                  price={livePrice}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
          </div>

          {!canSeeRankAndScore && <SubscriberLockNotice />}

          <div className="max-w-full overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
              ✦ Price Chart
            </p>

            <div className="mt-2 min-w-0 max-w-full overflow-hidden">
              <StockChart
                ticker={ticker}
                data={chartData}
                initialRange="1Y"
                height={320}
              />
            </div>
          </div>

          <div className="min-w-0 max-w-full overflow-hidden">
            <StockRelatedNews ticker={ticker} articles={relevantNews} />
          </div>

          <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 max-w-full overflow-hidden">
              {canSeeRankAndScore ? (
                tradeLevels && <TradeSetupCard levels={tradeLevels} />
              ) : (
                <LockedTradePlanCard ticker={ticker} sector={stock.sector} />
              )}
            </div>

            {peers.length > 0 && (
              <aside className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
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

                <div className="mt-3 grid min-w-0 gap-1.5">
                  {peers.map((p) => (
                    <Link
                      key={p.ticker}
                      href={`/stock/${p.ticker}`}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:border-[#ddb159]"
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

                      <div className="shrink-0 text-right">
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
