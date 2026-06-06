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
import { buildResearchReport, lightConfidenceClassName } from "@/lib/research-explainability";
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

type PortfolioOption = {
  id: string;
  name: string;
  cashBalance: number;
  currency: string;
};

type Peer = {
  ticker: string;
  company: string;
  rank: number;
  score: number;
  price: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDaysAtTop(days: number | null) {
  if (days == null) return "Tracking";
  if (days <= 0) return "0";
  return days.toLocaleString();
}

function cleanPortfolioName(name: string | null | undefined, index: number) {
  const cleaned = String(name ?? "").trim();
  return cleaned || `Portfolio ${index + 1}`;
}

function formatScore(value: Stock["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatMoney(value: number) {
  return Number.isFinite(value) && value > 0 ? `$${value.toFixed(2)}` : "—";
}

function getChartChangePct(
  data: Partial<Record<string, Array<{ close: number }>>>,
  range = "1D",
) {
  const points = data[range];
  if (!points || points.length < 2) return null;
  const first = points.find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  const last = [...points].reverse().find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  if (!first || !last || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function LockIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  if (unlocked) return <span className={className}>{children}</span>;

  return (
    <span aria-label="Subscriber-only value" className={["relative inline-block select-none tabular-nums", light ? "text-[#072116]/80" : "text-current", className].join(" ")}>
      <span className="blur-[5px]">{placeholder}</span>
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
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Subscriber research layer</p>
            <p className="mt-1 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/54">
              Research structure is visible, but ranking numbers, scores, trade levels and model outputs are hidden until access is unlocked.
            </p>
          </div>
        </div>
        <Link href="/login" className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#072116] transition hover:brightness-105">
          Log in to unlock →
        </Link>
      </div>
    </div>
  );
}

function LockedResearchBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#072116]/8 bg-white px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/45">{title}</p>
      <p className="mt-2 select-none text-[12px] font-semibold leading-5 text-[#072116]/60 blur-[5px]">{detail}</p>
    </div>
  );
}

function LockedTradePlanCard({ ticker }: { ticker: string }) {
  return (
    <div className="relative max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="relative flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ AI Trade Plan</p>
          <h3 className="mt-0.5 text-[20px] font-black tracking-[-0.03em]">Suggested Levels</h3>
        </div>
        <div className="grid size-9 place-items-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[#ddb159] shadow-[0_0_22px_rgba(221,177,89,0.16)]">
          <LockIcon className="size-4" />
        </div>
      </div>
      <div className="relative mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Entry", "$482.02", "Suggested"],
          ["Stop Loss", "$351.37", "Thesis invalidation"],
          ["Take Profit", "$1135.25", "Medium-term target"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-xl border border-[#072116]/10 bg-white px-3 py-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/50">{label}</p>
            <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em] text-[#072116]">
              <BlurredNumber unlocked={false} placeholder={value} light />
            </p>
            <p className="mt-1 select-none text-[10px] font-semibold text-[#072116]/55 blur-[5px]">{note}</p>
          </div>
        ))}
      </div>
      <p className="relative mt-4 text-[10px] font-medium leading-relaxed text-[#072116]/45">
        {ticker} trade plan is generated from ranking strength, price structure and risk controls. Not financial advice.
      </p>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[#ddb159]/18 bg-[#ddb159]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#ddb159]">
      {children}
    </span>
  );
}

function ResearchCard({ title, detail, tone = "neutral" }: { title: string; detail: string; tone?: "neutral" | "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "border-emerald-500/20 bg-emerald-500/10" : tone === "negative" ? "border-red-500/20 bg-red-500/10" : "border-[#ddb159]/14 bg-[#faf6f0]/[0.035]";
  return (
    <div className={["rounded-2xl border p-4", toneClass].join(" ")}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">{title}</p>
      <p className="mt-2 text-[12px] font-semibold leading-6 text-[#faf6f0]/64">{detail}</p>
    </div>
  );
}

function StockResearchReport({ stock, dailyMovePct, unlocked }: { stock: Stock; dailyMovePct: number | null; unlocked: boolean }) {
  const report = buildResearchReport(stock, dailyMovePct);
  const confidenceClass = lightConfidenceClassName(report.confidence.label);

  if (!unlocked) {
    return (
      <section className="grid gap-3 rounded-2xl border border-[#ddb159]/20 bg-[#04180f]/70 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">✦ Research report</p>
            <h2 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[#faf6f0]">Bull case, bear case and risks</h2>
          </div>
          <span className="rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159]">Locked</span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <LockedResearchBox title="Bull case" detail="Top ranking and strong model confirmation suggest this name deserves priority research." />
          <LockedResearchBox title="Bear case" detail="A strong model score can still fail if valuation, earnings or news flow weaken." />
          <LockedResearchBox title="Key risks" detail="Review sector risk, position sizing, valuation and latest news before acting." />
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#04180f]/72 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#ddb159]/10 blur-3xl" />
      <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">✦ StockGPT research report</p>
          <h2 className="mt-1 text-[24px] font-black leading-none tracking-[-0.045em] text-[#faf6f0]">Bull case, bear case and score drivers</h2>
          <p className="mt-2 max-w-3xl text-[12px] font-semibold leading-6 text-[#faf6f0]/55">A beginner-friendly read of why the model currently ranks this stock where it does. Use this with valuation, news and your own risk limits.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className={["rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em]", confidenceClass].join(" ")}>{report.confidence.label} confidence</span>
          <span className="rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#ddb159]">{report.scoreBand} score band</span>
        </div>
      </div>
      <div className="relative mt-4 flex min-w-0 flex-wrap gap-2">{report.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div>
      <div className="relative mt-4 grid gap-3 lg:grid-cols-3">
        <ResearchCard title="Bull case" detail={report.bullCase} tone="positive" />
        <ResearchCard title="Bear case" detail={report.bearCase} tone="negative" />
        <div className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Key risks</p>
          <ul className="mt-2 grid gap-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/62">
            {report.keyRisks.map((risk) => <li key={risk} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#ddb159]" /><span>{risk}</span></li>)}
          </ul>
        </div>
      </div>
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {report.factors.map((factor) => (
          <div key={factor.label} className="rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] p-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]">{factor.label}</p>
              <span className="shrink-0 rounded-full bg-[#ddb159]/12 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#ddb159]">{factor.value}</span>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-[#faf6f0]/56">{factor.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickActions({ ticker, sector }: { ticker: string; sector: string | null }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-[#ddb159]/16 bg-[#04180f]/70 p-3 sm:grid-cols-3">
      <Link href="/dashboard" className="grid h-11 place-items-center rounded-2xl bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#072116] transition hover:brightness-105">Ask from dashboard</Link>
      <Link href={`/rankings?q=${encodeURIComponent(ticker)}`} className="grid h-11 place-items-center rounded-2xl border border-[#ddb159]/20 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10">View in rankings</Link>
      <Link href={sector ? `/rankings?sector=${encodeURIComponent(sector)}` : "/rankings"} className="grid h-11 place-items-center rounded-2xl border border-[#ddb159]/20 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Compare peers</Link>
    </div>
  );
}

function SectorPeersCard({ peers, sector, unlocked }: { peers: Peer[]; sector: string | null; unlocked: boolean }) {
  if (peers.length === 0) return null;
  return (
    <aside className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ Sector peers</p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Top 5 in {sector ?? "sector"}</p>
      <div className="mt-3 grid min-w-0 gap-1.5">
        {peers.map((p) => (
          <Link key={p.ticker} href={`/stock/${p.ticker}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:border-[#ddb159]">
            <div className="min-w-0"><p className="text-[12px] font-black tracking-[-0.01em] text-[#072116]">{p.ticker}</p><p className="truncate text-[10px] font-semibold text-[#072116]/55">{p.company}</p></div>
            <div className="shrink-0 text-right"><p className="flex items-center justify-end gap-1 text-[10px] font-bold text-[#072116]/65">#<BlurredNumber unlocked={unlocked} placeholder="128" light>{p.rank}</BlurredNumber></p><span className="mt-1 inline-flex justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black text-[#072116]"><BlurredNumber unlocked={unlocked} placeholder="29,429" light>{Number(p.score).toLocaleString()}</BlurredNumber></span></div>
          </Link>
        ))}
      </div>
    </aside>
  );
}

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: stockData } = await db.from("stock_rankings").select("id,rank,ticker,company,sector,score,price").eq("ticker", ticker).maybeSingle();
  if (!stockData) notFound();
  const stock = stockData as Stock;

  const chartData = await getStockChart(ticker, ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"]);
  const livePrice = getLatestPriceFromChart(chartData) ?? (Number(stock.price) || 0);
  const dailyMovePct = getChartChangePct(chartData, "1D");

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  const isAuthenticated = !!user;
  const canSeeRankAndScore = isAuthenticated;

  let portfolioOptions: PortfolioOption[] = [];
  let defaultPortfolioId: string | null = null;
  if (user) {
    const { data: portfoliosData } = await db.from("user_portfolios").select("id,name,cash_balance,currency,created_at").eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: true });
    portfolioOptions = ((portfoliosData ?? []) as Array<{ id: string; name: string | null; cash_balance: number | null; currency: string | null }>).map((portfolio, index) => ({ id: portfolio.id, name: cleanPortfolioName(portfolio.name, index), cashBalance: safeNumber(portfolio.cash_balance, 0), currency: portfolio.currency ?? "USD" }));
    defaultPortfolioId = portfolioOptions[0]?.id ?? null;
  }

  const tradeLevels = await calculateTradeLevels({ ticker, price: livePrice, score: canSeeRankAndScore ? Number(stock.score) || 0 : 0, rank: canSeeRankAndScore ? Number(stock.rank) || null : null, sector: stock.sector ?? null });
  const watchlistEntry = isAuthenticated && stock.ticker ? await db.from("user_watchlist").select("id").eq("user_id", user!.id).eq("ticker", stock.ticker).maybeSingle().then((r: { data: unknown }) => r.data) : null;
  const sectorPeersResponse = stock.sector ? await db.from("stock_rankings").select("ticker,company,rank,score,price").eq("sector", stock.sector).neq("ticker", ticker).order("rank", { ascending: true }).limit(5) : { data: [] };
  const daysAtTop = await getDaysAtTop(supabase, ticker);
  const relatedNewsResponse = await db.from("news_articles").select("id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at").order("published_at", { ascending: false }).limit(180);

  const peers = (sectorPeersResponse.data ?? []) as Peer[];
  const relevantNews = selectRelevantNewsForStock((relatedNewsResponse.data ?? []) as BaseNewsArticle[], { ticker: stock.ticker, company: stock.company, sector: stock.sector, rank: stock.rank, score: stock.score, price: livePrice } as StockLike, 8).filter((article) => article.affectedStocks.some((insight) => insight.ticker.toUpperCase() === ticker && insight.impactRating >= 5));
  const dailyMoveLabel = dailyMovePct == null ? "—" : `${dailyMovePct >= 0 ? "+" : ""}${dailyMovePct.toFixed(1)}% today`;

  return (
    <AppShell activePath="/rankings">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1 pb-8">
        <div className="grid w-full min-w-0 max-w-full gap-3 overflow-x-hidden">
          <section className="relative max-w-full overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
            <div className="relative flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-bold text-[#ddb159]/70">
                  <Link href="/rankings" className="hover:text-[#ddb159]">← Rankings</Link><span>·</span><span>Rank #<BlurredNumber unlocked={canSeeRankAndScore} placeholder="128">{stock.rank ?? "—"}</BlurredNumber></span>{stock.sector ? <><span>·</span><span>{stock.sector}</span></> : null}
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3"><StockLogo ticker={stock.ticker} company={stock.company} size={42} /><div className="min-w-0"><h1 className="text-[34px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">{stock.ticker}</h1><p className="mt-1 text-[16px] font-bold leading-snug text-[#faf6f0]/70">{stock.company ?? "—"}</p></div></div>
                <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3"><p className="text-[26px] font-black tabular-nums tracking-[-0.03em] text-[#faf6f0]">{formatMoney(livePrice)}</p><span className="inline-flex items-center gap-1.5 rounded-full bg-[#ddb159] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#072116]">AI Score · <BlurredNumber unlocked={canSeeRankAndScore} placeholder="29,429" light>{formatScore(stock.score)}</BlurredNumber></span><span className="inline-flex items-center gap-1.5 rounded-full border border-[#ddb159]/30 bg-[#072116]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#ddb159]">Days at top · <BlurredNumber unlocked={canSeeRankAndScore} placeholder="14">{formatDaysAtTop(daysAtTop)}</BlurredNumber></span><span className="inline-flex items-center gap-1.5 rounded-full border border-[#ddb159]/30 bg-[#072116]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#ddb159]">{dailyMoveLabel}</span></div>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center xl:justify-end"><WatchlistToggle ticker={ticker} initialInWatchlist={!!watchlistEntry} isAuthenticated={isAuthenticated} /><AddToPortfolioButton ticker={ticker} price={livePrice} isAuthenticated={isAuthenticated} portfolios={portfolioOptions} defaultPortfolioId={defaultPortfolioId} /></div>
            </div>
          </section>
          {!canSeeRankAndScore && <SubscriberLockNotice />}
          <QuickActions ticker={ticker} sector={stock.sector} />
          <StockResearchReport stock={stock} dailyMovePct={dailyMovePct} unlocked={canSeeRankAndScore} />
          <section className="max-w-full overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur"><p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">✦ Price Chart</p><div className="mt-2 min-w-0 max-w-full overflow-hidden"><StockChart ticker={ticker} data={chartData} initialRange="1Y" height={320} /></div></section>
          <div className="min-w-0 max-w-full overflow-hidden"><StockRelatedNews ticker={ticker} articles={relevantNews} /></div>
          <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 max-w-full overflow-hidden">{canSeeRankAndScore ? (tradeLevels && <TradeSetupCard levels={tradeLevels} />) : <LockedTradePlanCard ticker={ticker} />}</div><SectorPeersCard peers={peers} sector={stock.sector} unlocked={canSeeRankAndScore} /></div>
          <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">⚠️ StockGPT stock pages are research tools, not financial advice. Rankings, trade plans and reports can be wrong and should be checked against your own risk limits.</p>
        </div>
      </main>
    </AppShell>
  );
}
