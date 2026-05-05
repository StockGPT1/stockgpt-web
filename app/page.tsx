import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StockLogo } from "@/components/StockLogo";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { createClient } from "@/utils/supabase/server";

type Ranking = {
  id: string | number;
  rank: number | null;
  ticker: string | null;
  company: string | null;
  sector: string | null;
  score: number | string | null;
  price: number | string | null;
  updated_at: string | null;
};

type NewsArticle = {
  id: string | number;
  title: string | null;
  url: string | null;
  source: string | null;
  impact: string | null;
  affected_tickers: string[] | null;
};

function formatPrice(value: Ranking["price"]) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatScore(value: Ranking["score"]) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function formatUpdatedTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function impactDot(impact: string | null) {
  const s = (impact ?? "").toLowerCase().trim();
  if (s === "positive") return "bg-emerald-500";
  if (s === "negative") return "bg-red-500";
  return "bg-[#072116]/30";
}

function StatIcon({
  type,
}: {
  type: "chart" | "crown" | "trending" | "clock";
}) {
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#072116] text-[#ddb159]">
      {type === "chart" && (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-8" />
          <path d="M5 10l6-5 4 4 4-6" />
        </svg>
      )}

      {type === "crown" && (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M4 18h16l1-10-5 4-4-7-4 7-5-4 1 10Z" />
          <path d="M5 21h14" />
        </svg>
      )}

      {type === "trending" && (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
        >
          <path d="M4 17 9 12l4 4 7-9" />
          <path d="M15 7h5v5" />
        </svg>
      )}

      {type === "clock" && (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l4 2" />
        </svg>
      )}
    </div>
  );
}

function StatCard({
  label,
  main,
  sub,
  icon,
}: {
  label: string;
  main: string;
  sub: string;
  icon: "chart" | "crown" | "trending" | "clock";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-[#faf6f0] px-3 py-2.5 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <StatIcon type={icon} />
      <div className="min-w-0">
        <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#072116]/55">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[22px] font-black leading-none tracking-[-0.03em]">
          {main}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#072116]/55">
          {sub}
        </p>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();

  const { data: rankingsData } = await supabase
    .from("stock_rankings")
    .select("id,rank,ticker,company,sector,score,price,updated_at")
    .order("rank", { ascending: true })
    .limit(10);

  const { data: newsData } = await supabase
    .from("news_articles")
    .select("id,title,url,source,impact,affected_tickers")
    .order("published_at", { ascending: false })
    .limit(3);

  const { count: totalCount } = await supabase
    .from("stock_rankings")
    .select("*", { count: "exact", head: true });

  const { count: bullishCount } = await supabase
    .from("stock_rankings")
    .select("*", { count: "exact", head: true })
    .gte("score", 7000);

  const bullishPct =
    totalCount && totalCount > 0
      ? Math.round(((bullishCount ?? 0) / totalCount) * 100)
      : 0;

  const sentiment =
    bullishPct >= 50
      ? "Strong market"
      : bullishPct >= 35
        ? "Healthy market"
        : bullishPct >= 20
          ? "Cautious market"
          : "Weak market";

  const rankings = (rankingsData ?? []) as Ranking[];
  const news = (newsData ?? []) as NewsArticle[];
  const topRanked = rankings[0];

  const gridCols = "grid-cols-[50px_92px_minmax(0,1fr)_135px_90px_88px]";

  return (
    <AppShell activePath="/">
      <main className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_230px] gap-3 overflow-hidden">
        <section className="grid min-h-0 grid-rows-[106px_74px_minmax(0,1fr)] gap-3 overflow-hidden">
          <WelcomeBanner />

          <div className="grid min-h-0 grid-cols-4 gap-2.5">
            <StatCard
              label="Total Stocks"
              main="500"
              sub="ranked by AI score"
              icon="chart"
            />
            <StatCard
              label="Top Ranked"
              main={topRanked?.ticker ?? "—"}
              sub={topRanked?.company ?? "No ranking data"}
              icon="crown"
            />
            <StatCard
              label="Bullish Stocks"
              main={`${bullishPct}%`}
              sub={sentiment}
              icon="trending"
            />
            <StatCard
              label="Last Updated"
              main={formatUpdatedTime(topRanked?.updated_at)}
              sub="latest refresh"
              icon="clock"
            />
          </div>

          <div className="min-h-0 overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
            <div className="mb-2 flex h-[42px] items-start justify-between">
              <div>
                <h2 className="luxury-heading text-[23px] leading-none">
                  Top 10 Ranked Stocks
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">
                  Live preview · click any row for full AI analysis
                </p>
              </div>

              <Link
                href="/rankings"
                style={{
                  backgroundColor: "#ddb159",
                  color: "#072116",
                }}
                className="rounded-full px-4 py-1.5 text-[11px] font-black transition hover:opacity-90"
              >
                View All Rankings →
              </Link>
            </div>

            <div className="h-[calc(100%-50px)] overflow-hidden rounded-xl border border-[#072116]/10">
              <div className={`grid ${gridCols} bg-[#072116] text-[#faf6f0]`}>
                <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                  Rank
                </div>
                <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                  Ticker
                </div>
                <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                  Company
                </div>
                <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                  Sector
                </div>
                <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                  Price
                </div>
                <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                  AI Score
                </div>
              </div>

              <div
                className="overflow-hidden"
                style={{ height: "calc(100% - 26px)" }}
              >
                {rankings.length > 0 ? (
                  rankings.map((stock) => (
                    <Link
                      key={stock.id}
                      href={`/stock/${stock.ticker}`}
                      className={`grid ${gridCols} h-[10%] items-center border-b border-[#072116]/10 text-[11px] transition last:border-b-0 hover:bg-[#ddb159]/8`}
                    >
                      <div className="px-2.5 font-bold">
                        {stock.rank ?? "—"}
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 font-black">
                        <StockLogo
                          ticker={stock.ticker}
                          company={stock.company}
                          size={18}
                        />
                        <span>{stock.ticker ?? "—"}</span>
                      </div>

                      <div className="truncate px-2.5 font-semibold">
                        {stock.company ?? "—"}
                      </div>

                      <div className="truncate px-2.5 text-[#072116]/70">
                        {stock.sector ?? "—"}
                      </div>

                      <div className="px-2.5 font-semibold tabular-nums">
                        {formatPrice(stock.price)}
                      </div>

                      <div className="px-2.5">
                        <span className="inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116]">
                          {formatScore(stock.score)}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center font-semibold text-[#072116]/60">
                    No ranking data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[118px_minmax(0,1fr)] gap-3 overflow-hidden">
          <Link
            href="/portfolio"
            className="group relative overflow-hidden rounded-2xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#0d3420,#082519)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition hover:border-[#ddb159]"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-[#ddb159]/15 blur-2xl transition group-hover:bg-[#ddb159]/25" />
            <div className="relative">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                ✦ AI-Powered
              </p>
              <h2 className="luxury-heading mt-1 text-[18px] leading-tight text-[#faf6f0]">
                Build a Portfolio
              </h2>
              <p className="mt-1.5 text-[10px] font-medium leading-snug text-[#faf6f0]/60">
                Get an AI-built portfolio in 30 seconds.
              </p>
              <p className="mt-2 text-[10px] font-bold text-[#ddb159] transition group-hover:translate-x-0.5">
                Start now →
              </p>
            </div>
          </Link>

          <div className="grid min-h-0 grid-rows-3 gap-3 overflow-hidden">
            {news.length > 0 ? (
              news.map((article) => {
                const href = article.url || "/world-news";
                const isExternal = !!article.url;
                const tickers = Array.isArray(article.affected_tickers)
                  ? article.affected_tickers.filter(
                      (t) => t && t !== "Sector-wide"
                    )
                  : [];

                return (
                  <a
                    key={article.id}
                    href={href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="group flex min-h-0 flex-col gap-2 rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-3 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:border-[#ddb159]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block size-1.5 shrink-0 rounded-full ${impactDot(article.impact)}`}
                      />
                      <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#ddb159]">
                        {article.source ?? "News"}
                      </p>
                    </div>

                    <h3
                      className="overflow-hidden text-[12px] font-black leading-tight tracking-[-0.02em] text-[#072116]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {article.title ?? "Untitled article"}
                    </h3>

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {tickers.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="rounded bg-[#072116] px-1.5 py-0.5 text-[8px] font-black text-[#ddb159]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      <p className="shrink-0 text-[10px] font-bold text-[#072116]/55 group-hover:text-[#072116]">
                        {isExternal ? "Read →" : "Open →"}
                      </p>
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-4 text-center text-xs font-semibold text-[#072116]/60">
                No news articles available yet.
              </div>
            )}
          </div>
        </aside>
      </main>
    </AppShell>
  );
}
