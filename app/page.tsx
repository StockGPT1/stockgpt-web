import Link from "next/link";
import { AppShell } from "@/components/AppShell";
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

function StatIcon({ type }: { type: "chart" | "crown" | "megaphone" | "clock" }) {
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#072116] text-[#ddb159]">
      {type === "chart" && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-8" />
          <path d="M5 10l6-5 4 4 4-6" />
        </svg>
      )}
      {type === "crown" && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4 18h16l1-10-5 4-4-7-4 7-5-4 1 10Z" />
          <path d="M5 21h14" />
        </svg>
      )}
      {type === "megaphone" && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
          <path d="M14 8c1.5 1 1.5 7 0 8" />
          <path d="M18 5c3 2.5 3 11.5 0 14" />
        </svg>
      )}
      {type === "clock" && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
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
  icon: "chart" | "crown" | "megaphone" | "clock";
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

  // ✦ Compute "Most Mentioned" — ticker appearing most across recent news
  const { data: recentNewsForCount } = await supabase
    .from("news_articles")
    .select("affected_tickers")
    .order("published_at", { ascending: false })
    .limit(50);

  const tickerCounts: Record<string, number> = {};
  (recentNewsForCount ?? []).forEach((article) => {
    if (Array.isArray(article.affected_tickers)) {
      article.affected_tickers.forEach((t: string) => {
        if (t && t !== "Sector-wide") {
          tickerCounts[t] = (tickerCounts[t] || 0) + 1;
        }
      });
    }
  });
  const mostMentionedEntry = Object.entries(tickerCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const mostMentioned = mostMentionedEntry
    ? { ticker: mostMentionedEntry[0], count: mostMentionedEntry[1] }
    : null;

  const rankings = (rankingsData ?? []) as Ranking[];
  const news = (newsData ?? []) as NewsArticle[];
  const topRanked = rankings[0];

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
            {/* ✦ Replaced "Highest Score" with "Most Mentioned" */}
            <StatCard
              label="Most Mentioned"
              main={mostMentioned?.ticker ?? "—"}
              sub={
                mostMentioned
                  ? `In ${mostMentioned.count} recent article${mostMentioned.count === 1 ? "" : "s"}`
                  : "No news data yet"
              }
              icon="megaphone"
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
                <h2 className="text-[23px] font-black leading-none tracking-[-0.03em]">
                  Top 10 Ranked Stocks
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-[#072116]/55">
                  Live preview ranked by AI score
                </p>
              </div>
              <Link
                href="/rankings"
                className="rounded-full border border-[#ddb159] bg-[#072116] px-3 py-1.5 text-[11px] font-bold text-[#ddb159] transition hover:bg-[#0b2b1d]"
              >
                View Rankings
              </Link>
            </div>

            <div className="h-[calc(100%-50px)] overflow-hidden rounded-xl border border-[#072116]/10">
              <table className="h-full w-full table-fixed text-left text-[11px]">
                <thead className="bg-[#072116] text-[#faf6f0]">
                  <tr>
                    <th className="w-[50px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="w-[76px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Ticker
                    </th>
                    <th className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Company
                    </th>
                    <th className="w-[135px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Sector
                    </th>
                    <th className="w-[90px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      Price
                    </th>
                    <th className="w-[88px] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide">
                      AI Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.length > 0 ? (
                    rankings.map((stock) => (
                      <tr
                        key={stock.id}
                        className="h-[10%] border-b border-[#072116]/10 transition last:border-b-0 hover:bg-[#ddb159]/8"
                      >
                        <td className="px-2.5 py-1 font-bold">
                          {stock.rank ?? "—"}
                        </td>
                        <td className="px-2.5 py-1">
                          <Link
                            href={`/stock/${stock.ticker}`}
                            className="font-black text-[#072116] underline decoration-[#ddb159]/40 underline-offset-2 transition hover:text-[#0b2b1d] hover:decoration-[#ddb159]"
                          >
                            {stock.ticker ?? "—"}
                          </Link>
                        </td>
                        <td className="truncate px-2.5 py-1 font-semibold">
                          {stock.company ?? "—"}
                        </td>
                        <td className="truncate px-2.5 py-1 text-[#072116]/70">
                          {stock.sector ?? "—"}
                        </td>
                        <td className="px-2.5 py-1 font-semibold">
                          {formatPrice(stock.price)}
                        </td>
                        <td className="px-2.5 py-1">
                          <span className="inline-flex min-w-[58px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 text-[10px] font-black text-[#072116]">
                            {formatScore(stock.score)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center font-semibold text-[#072116]/60"
                      >
                        No ranking data available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[118px_minmax(0,1fr)] gap-3 overflow-hidden">
          <div className="rounded-2xl border border-[#ddb159]/25 bg-[#061b12] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              Latest Market News
            </p>
            <h2 className="mt-1.5 text-[25px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">
              World News
            </h2>
            <Link
              href="/world-news"
              className="mt-2 inline-block text-[11px] font-bold text-[#faf6f0]/55 transition hover:text-[#ddb159]"
            >
              See all articles →
            </Link>
          </div>

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
