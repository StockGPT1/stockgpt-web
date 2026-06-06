import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AddToPortfolioButton } from "@/components/AddToPortfolioButton";
import { AppShell } from "@/components/AppShell";
import { AskStockGPTButton } from "@/components/AskStockGPTButton";
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

function cleanPortfolioName(name: string | null | undefined, index: number) {
  return String(name ?? "").trim() || `Portfolio ${index + 1}`;
}

function formatMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatDays(days: number | null) {
  if (days == null) return "Tracking";
  if (days <= 0) return "0";
  return days.toLocaleString();
}

function LockedValue({ children, placeholder, unlocked }: { children: ReactNode; placeholder: string; unlocked: boolean }) {
  if (unlocked) return <>{children}</>;
  return <span className="select-none blur-[5px]">{placeholder}</span>;
}

function SubscriberLockNotice() {
  return (
    <div className="relative max-w-full overflow-hidden rounded-2xl border border-[#ddb159]/22 bg-[#04180f]/78 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      <div className="relative flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Subscriber research layer</p>
          <p className="mt-1 max-w-2xl text-[12px] font-semibold leading-5 text-[#faf6f0]/54">Rank, score and generated trade-plan outputs are hidden until access is unlocked.</p>
        </div>
        <Link href="/login" className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#072116] transition hover:brightness-105">Log in to unlock →</Link>
      </div>
    </div>
  );
}

function QuickActions({ ticker, sector, isAuthenticated }: { ticker: string; sector: string | null; isAuthenticated: boolean }) {
  return (
    <section className="grid min-w-0 gap-2 rounded-2xl border border-[#ddb159]/16 bg-[#04180f]/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] sm:grid-cols-3">
      <div className="min-w-0 [&>button]:h-11 [&>button]:w-full [&>button]:justify-center [&>button]:rounded-2xl [&>button]:bg-[#ddb159] [&>button]:px-4 [&>button]:text-center [&>button]:text-[11px] [&>button]:font-black [&>button]:uppercase [&>button]:tracking-[0.1em] [&>button]:text-[#072116]">
        <AskStockGPTButton canUseAskStockGPT={isAuthenticated} isAuthenticated={isAuthenticated} />
      </div>
      <Link href={`/compare?a=${encodeURIComponent(ticker)}`} className="grid h-11 min-w-0 place-items-center rounded-2xl border border-[#ddb159]/20 px-4 text-center text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10">Compare stock</Link>
      <Link href={sector ? `/rankings?sector=${encodeURIComponent(sector)}` : "/rankings"} className="grid h-11 min-w-0 place-items-center rounded-2xl border border-[#ddb159]/20 px-4 text-center text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:bg-[#ddb159]/10">View peers</Link>
    </section>
  );
}

function LockedTradePlanCard({ ticker }: { ticker: string }) {
  return (
    <div className="relative max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ AI Trade Plan</p>
      <h3 className="mt-0.5 text-[20px] font-black tracking-[-0.03em]">Suggested Levels</h3>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {[["Entry", "$482.02"], ["Stop Loss", "$351.37"], ["Take Profit", "$1135.25"]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#072116]/10 bg-white px-3 py-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/50">{label}</p>
            <p className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em]"><LockedValue unlocked={false} placeholder={value}>{value}</LockedValue></p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] font-medium leading-relaxed text-[#072116]/45">{ticker} trade levels are hidden until access is unlocked.</p>
    </div>
  );
}

function PeersCard({ peers, sector, unlocked }: { peers: Peer[]; sector: string | null; unlocked: boolean }) {
  if (peers.length === 0) return null;
  return (
    <aside className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#072116]/55">✦ Sector Peers</p>
      <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">Top 5 in {sector ?? "sector"}</p>
      <div className="mt-3 grid min-w-0 gap-1.5">
        {peers.map((peer) => (
          <Link key={peer.ticker} href={`/stock/${peer.ticker}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#072116]/8 bg-white px-2.5 py-1.5 transition hover:border-[#ddb159]">
            <div className="min-w-0"><p className="text-[12px] font-black tracking-[-0.01em] text-[#072116]">{peer.ticker}</p><p className="truncate text-[10px] font-semibold text-[#072116]/55">{peer.company}</p></div>
            <div className="shrink-0 text-right"><p className="text-[10px] font-bold text-[#072116]/65">#<LockedValue unlocked={unlocked} placeholder="128">{peer.rank}</LockedValue></p><span className="mt-1 inline-flex rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black text-[#072116]"><LockedValue unlocked={unlocked} placeholder="29,429">{formatScore(peer.score)}</LockedValue></span></div>
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
  const { data: stockData } = await supabase.from("stock_rankings").select("id,rank,ticker,company,sector,score,price").eq("ticker", ticker).maybeSingle();
  if (!stockData) notFound();
  const stock = stockData as Stock;
  const chartData = await getStockChart(ticker, ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"]);
  const livePrice = getLatestPriceFromChart(chartData) ?? (Number(stock.price) || 0);
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  const canSeeRankAndScore = isAuthenticated;
  let portfolioOptions: PortfolioOption[] = [];
  let defaultPortfolioId: string | null = null;

  if (user) {
    const { data: portfoliosData } = await (supabase as any).from("user_portfolios").select("id,name,cash_balance,currency,created_at").eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: true });
    portfolioOptions = ((portfoliosData ?? []) as Array<{ id: string; name: string | null; cash_balance: number | null; currency: string | null }>).map((portfolio, index) => ({ id: portfolio.id, name: cleanPortfolioName(portfolio.name, index), cashBalance: safeNumber(portfolio.cash_balance, 0), currency: portfolio.currency ?? "USD" }));
    defaultPortfolioId = portfolioOptions[0]?.id ?? null;
  }

  const [tradeLevels, watchlistEntry, sectorPeers, daysAtTop, relatedNewsResponse] = await Promise.all([
    calculateTradeLevels({ ticker, price: livePrice, score: canSeeRankAndScore ? Number(stock.score) || 0 : 0, rank: canSeeRankAndScore ? Number(stock.rank) || null : null, sector: stock.sector ?? null }),
    isAuthenticated && stock.ticker ? supabase.from("user_watchlist").select("id").eq("user_id", user!.id).eq("ticker", stock.ticker).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    stock.sector ? supabase.from("stock_rankings").select("ticker, company, rank, score, price").eq("sector", stock.sector).neq("ticker", ticker).order("rank", { ascending: true }).limit(5) : Promise.resolve({ data: [] }),
    canSeeRankAndScore ? getDaysAtTop(supabase, ticker, stock.rank) : Promise.resolve(null),
    supabase.from("news_articles").select("id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at").order("published_at", { ascending: false }).limit(180),
  ]);

  const peers = (sectorPeers?.data ?? []) as Peer[];
  const relevantNews = selectRelevantNewsForStock((relatedNewsResponse.data ?? []) as BaseNewsArticle[], { ticker: stock.ticker, company: stock.company, sector: stock.sector, rank: stock.rank, score: stock.score, price: livePrice } satisfies StockLike, 8).filter((article) => article.affectedStocks.some((insight) => insight.ticker.toUpperCase() === ticker && insight.impactRating >= 5));

  return (
    <AppShell activePath="/rankings">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1 pb-8">
        <div className="grid w-full min-w-0 max-w-full gap-3 overflow-x-hidden">
          <section className="relative max-w-full overflow-hidden rounded-3xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#082519,#0d3420,#082519)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/12 blur-3xl" />
            <div className="relative flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-bold text-[#ddb159]/70"><Link href="/rankings" className="hover:text-[#ddb159]">← Rankings</Link><span>·</span><span>Rank #<LockedValue unlocked={canSeeRankAndScore} placeholder="128">{stock.rank ?? "—"}</LockedValue></span>{stock.sector && <><span>·</span><span>{stock.sector}</span></>}</div>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3"><StockLogo ticker={stock.ticker} company={stock.company} size={42} /><div className="min-w-0"><h1 className="text-[34px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">{stock.ticker}</h1><p className="mt-1 break-words text-[16px] font-bold leading-snug text-[#faf6f0]/70">{stock.company ?? "—"}</p></div></div>
                <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3"><p className="text-[26px] font-black tabular-nums tracking-[-0.03em] text-[#faf6f0]">{formatMoney(livePrice)}</p><span className="inline-flex items-center gap-1.5 rounded-full bg-[#ddb159] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#072116]">AI Score · <LockedValue unlocked={canSeeRankAndScore} placeholder="29,429">{formatScore(stock.score)}</LockedValue></span><span className="inline-flex items-center gap-1.5 rounded-full border border-[#ddb159]/30 bg-[#072116]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#ddb159]">Days at top · <LockedValue unlocked={canSeeRankAndScore} placeholder="14">{formatDays(daysAtTop)}</LockedValue></span></div>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center xl:justify-end"><WatchlistToggle ticker={ticker} initialInWatchlist={!!watchlistEntry} isAuthenticated={isAuthenticated} /><AddToPortfolioButton ticker={ticker} price={livePrice} isAuthenticated={isAuthenticated} portfolios={portfolioOptions} defaultPortfolioId={defaultPortfolioId} /></div>
            </div>
          </section>
          {!canSeeRankAndScore && <SubscriberLockNotice />}
          <QuickActions ticker={ticker} sector={stock.sector} isAuthenticated={isAuthenticated} />
          <section className="max-w-full overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur"><p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">✦ Price Chart</p><div className="mt-2 min-w-0 max-w-full overflow-hidden"><StockChart ticker={ticker} data={chartData} initialRange="1Y" height={320} /></div></section>
          <div className="min-w-0 max-w-full overflow-hidden"><StockRelatedNews ticker={ticker} articles={relevantNews} /></div>
          <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 max-w-full overflow-hidden">{canSeeRankAndScore ? (tradeLevels && <TradeSetupCard levels={tradeLevels} />) : <LockedTradePlanCard ticker={ticker} />}</div><PeersCard peers={peers} sector={stock.sector} unlocked={canSeeRankAndScore} /></div>
          <p className="px-2 text-[10px] font-medium leading-relaxed text-[#faf6f0]/40 sm:text-[11px]">StockGPT stock pages are research tools. Rankings, trade plans and reports can be wrong and should be checked against your own risk limits.</p>
        </div>
      </main>
    </AppShell>
  );
}
