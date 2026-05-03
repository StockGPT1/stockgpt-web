import Link from "next/link";
import { AppShell } from "@/components/AppShell";
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
};

function formatPrice(value: Ranking["price"]) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "—";
  }

  return `$${numberValue.toFixed(2)}`;
}

function formatScore(value: Ranking["score"]) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "—";
  }

  return numberValue.toLocaleString();
}

function formatUpdatedTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatIcon({ type }: { type: "chart" | "crown" | "arrow" | "clock" }) {
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#072116] text-[#ddb159]">
      {type === "chart" && (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-8" />
          <path d="M5 10l6-5 4 4 4-6" />
        </svg>
      )}

      {type === "crown" && (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4 18h16l1-10-5 4-4-7-4 7-5-4 1 10Z" />
          <path d="M5 21h14" />
        </svg>
      )}

      {type === "arrow" && (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M4 17 9 12l4 4 7-9" />
          <path d="M15 7h5v5" />
        </svg>
      )}

      {type === "clock" && (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
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
  icon: "chart" | "crown" | "arrow" | "clock";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-[#faf6f0] px-4 py-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.16)]">
      <StatIcon type={icon} />

      <div className="min-w-0">
        <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#072116]/55">
          {label}
        </p>

        <p className="mt-1 truncate text-[26px] font-black leading-none tracking-[-0.03em]">
          {main}
        </p>

        <p className="mt-1 truncate text-[11px] font-semibold text-[#072116]/55">
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
    .select("id,title")
    .order("published_at", { ascending: false })
    .limit(3);

  const rankings = (rankingsData ?? []) as Ranking[];
  const news = (newsData ?? []) as NewsArticle[];
  const topRanked = rankings[0];

  return (
    <AppShell activePath="/">
      <main className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_285px] gap-4 overflow-hidden">
        <section className="grid min-h-0 grid-rows-[130px_94px_minmax(0,1fr)] gap-4 overflow-hidden">
          <div className="min-h-0 rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(90deg,#082519,#123b25)] px-7 py-5 shadow-[0_14px_38px_rgba(0,0,0,0.18)]">
            <p className="text-[23px] font-semibold leading-none text-[#ddb159]">
              Welcome back,
            </p>

            <h1 className="mt-2 max-w-[900px] text-[46px] font-black leading-[0.95] tracking-[-0.045em] text-[#faf6f0]">
              Make smarter investment decisions.
            </h1>

            <p className="mt-3 max-w-[900px] truncate text-[18px] font-medium text-[#faf6f0]/65">
              AI-powered rankings and real-time insights to help you stay ahead of the market.
            </p>
          </div>

          <div className="grid min-h-0 grid-cols-4 gap-3">
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
              label="Top Gainer"
              main="Soon"
              sub="placeholder feature"
              icon="arrow"
            />

            <StatCard
              label="Last Updated"
              main={formatUpdatedTime(topRanked?.updated_at)}
              sub="latest refresh"
              icon="clock"
            />
          </div>

          <div className="min-h-0 overflow-hidden rounded-2xl bg-[#faf6f0] p-4 text-[#072116] shadow-[0_16px_45px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[26px] font-black leading-none tracking-[-0.03em]">
                  Top 10 Ranked Stocks
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#072116]/55">
                  Live preview ranked by AI score
                </p>
              </div>

              <Link
                href="/rankings"
                className="rounded-full border border-[#ddb159] bg-[#072116] px-4 py-2 text-xs font-bold text-[#ddb159] transition hover:bg-[#0b2b1d]"
              >
                View Rankings
              </Link>
            </div>

            <div className="h-[calc(100%-54px)] overflow-hidden rounded-xl border border-[#072116]/10">
              <table className="h-full w-full table-fixed text-left text-[12px]">
                <thead className="bg-[#072116] text-[#faf6f0]">
                  <tr>
                    <th className="w-[58px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="w-[88px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
                      Ticker
                    </th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
                      Company
                    </th>
                    <th className="w-[145px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
                      Sector
                    </th>
                    <th className="w-[100px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
                      Price
                    </th>
                    <th className="w-[100px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide">
                      AI Score
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rankings.length > 0 ? (
                    rankings.map((stock) => (
                      <tr
                        key={stock.id}
                        className="h-[10%] border-b border-[#072116]/10 last:border-b-0"
                      >
                        <td className="px-3 py-1.5 font-bold">
                          {stock.rank ?? "—"}
                        </td>

                        <td className="px-3 py-1.5 font-black">
                          {stock.ticker ?? "—"}
                        </td>

                        <td className="truncate px-3 py-1.5 font-semibold">
                          {stock.company ?? "—"}
                        </td>

                        <td className="truncate px-3 py-1.5 text-[#072116]/70">
                          {stock.sector ?? "—"}
                        </td>

                        <td className="px-3 py-1.5 font-semibold">
                          {formatPrice(stock.price)}
                        </td>

                        <td className="px-3 py-1.5">
                          <span className="inline-flex min-w-[64px] justify-center rounded-full bg-[#ddb159] px-2 py-0.5 font-black text-[#072116]">
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

        <aside className="grid min-h-0 grid-rows-[150px_minmax(0,1fr)] gap-4 overflow-hidden">
          <div className="rounded-2xl border border-[#ddb159]/25 bg-[#061b12] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.16)]">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              Latest Market News
            </p>

            <h2 className="mt-2 text-[31px] font-black leading-none tracking-[-0.04em] text-[#faf6f0]">
              World News
            </h2>

            <p className="mt-3 text-[13px] font-medium leading-snug text-[#faf6f0]/60">
              The three newest articles from your news feed.
            </p>
          </div>

          <div className="grid min-h-0 grid-rows-3 gap-4 overflow-hidden">
            {news.length > 0 ? (
              news.map((article, index) => (
                <Link
                  key={article.id}
                  href="/world-news"
                  className="group flex min-h-0 flex-col justify-between rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-4 text-[#072116] shadow-[0_10px_28px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:border-[#ddb159]"
                >
                  <div className="min-h-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
                      Article {index + 1}
                    </p>

                    <h3
                      className="mt-2 overflow-hidden text-[15px] font-black leading-tight tracking-[-0.02em]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {article.title ?? "Untitled article"}
                    </h3>
                  </div>

                  <p className="mt-3 text-[11px] font-bold text-[#072116]/55 group-hover:text-[#072116]">
                    Open World News →
                  </p>
                </Link>
              ))
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0] p-5 text-center text-sm font-semibold text-[#072116]/60">
                No news articles available yet.
              </div>
            )}
          </div>
        </aside>
      </main>
    </AppShell>
  );
}