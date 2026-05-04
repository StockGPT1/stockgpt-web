import { AppShell } from "@/components/AppShell";
import { createClient } from "@/utils/supabase/server";

type NewsArticle = {
  id: string | number;
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  affected_tickers: string[] | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
};

function impactStyle(impact: string | null) {
  const s = (impact ?? "").toLowerCase().trim();
  if (s === "positive")
    return {
      bg: "bg-emerald-500/12",
      text: "text-emerald-400",
      border: "border-emerald-500/25",
      label: "Positive",
    };
  if (s === "negative")
    return {
      bg: "bg-red-500/12",
      text: "text-red-400",
      border: "border-red-500/25",
      label: "Negative",
    };
  return {
    bg: "bg-[#faf6f0]/8",
    text: "text-[#faf6f0]/50",
    border: "border-[#faf6f0]/12",
    label: "Neutral",
  };
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatFullDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function WorldNewsPage() {
  const supabase = await createClient();

  const { data: newsData } = await supabase
    .from("news_articles")
    .select(
      "id,title,summary,source,url,image_url,affected_tickers,impact,impact_reason,published_at"
    )
    .order("published_at", { ascending: false })
    .limit(50);

  const articles = (newsData ?? []) as NewsArticle[];

  // Sentiment summary counts
  const counts = articles.reduce(
    (acc, a) => {
      const s = (a.impact ?? "").toLowerCase().trim();
      if (s === "positive") acc.positive++;
      else if (s === "negative") acc.negative++;
      else acc.neutral++;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );
  const total = counts.positive + counts.negative + counts.neutral || 1;

  return (
    <AppShell activePath="/world-news">
      <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
        {/* ── Header ── */}
        <div className="flex shrink-0 items-end justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
              World News
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-[#faf6f0]/50">
              {articles.length} articles with AI sentiment analysis
            </p>
          </div>

          {/* Sentiment counts */}
          <div className="flex items-center gap-4 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              {counts.positive} positive
            </span>
            <span className="flex items-center gap-1.5 text-[#faf6f0]/50">
              <span className="inline-block h-2 w-2 rounded-full bg-[#faf6f0]/40" />
              {counts.neutral} neutral
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              {counts.negative} negative
            </span>
          </div>
        </div>

        {/* ── Sentiment progress bar ── */}
        <div className="flex h-1.5 shrink-0 overflow-hidden rounded-full bg-[#faf6f0]/8">
          <div
            className="bg-emerald-400 transition-all"
            style={{ width: `${(counts.positive / total) * 100}%` }}
          />
          <div
            className="bg-[#faf6f0]/30 transition-all"
            style={{ width: `${(counts.neutral / total) * 100}%` }}
          />
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${(counts.negative / total) * 100}%` }}
          />
        </div>

        {/* ── Articles ── */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3">
            {articles.length > 0 ? (
              articles.map((article) => {
                const style = impactStyle(article.impact);
                const hasImage = !!article.image_url;

                // Parse affected tickers
                let tickers: string[] = [];
                try {
                  if (Array.isArray(article.affected_tickers)) {
                    tickers = article.affected_tickers.filter(
                      (t) => t && t !== "Sector-wide"
                    );
                  }
                } catch {}

                return (
                  <a
                    key={article.id}
                    href={article.url ?? "#"}
                    target={article.url ? "_blank" : undefined}
                    rel={article.url ? "noopener noreferrer" : undefined}
                    className="group flex gap-4 rounded-2xl border border-[#ddb159]/15 bg-[#0b2b1d]/60 p-4 transition hover:border-[#ddb159]/40 hover:bg-[#0b2b1d]"
                  >
                    {/* Thumbnail */}
                    {hasImage && (
                      <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:block">
                        <img
                          src={article.image_url!}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {/* Source + sentiment badge + time */}
                      <div className="flex flex-wrap items-center gap-2">
                        {article.source && (
                          <span className="text-[11px] font-bold text-[#ddb159]">
                            {article.source}
                          </span>
                        )}
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${style.bg} ${style.text} ${style.border}`}
                        >
                          {style.label}
                        </span>
                        {article.published_at && (
                          <span
                            className="text-[10px] font-semibold text-[#faf6f0]/35"
                            title={formatFullDate(article.published_at)}
                          >
                            {timeAgo(article.published_at)}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="mt-1.5 text-[14px] font-black leading-snug tracking-[-0.02em] text-[#faf6f0] group-hover:text-[#ddb159]">
                        {article.title ?? "Untitled article"}
                      </h3>

                      {/* Summary */}
                      {article.summary &&
                        article.summary !== "No summary available." && (
                          <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/45">
                            {article.summary}
                          </p>
                        )}

                      {/* Affected tickers + impact reason */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {tickers.map((ticker) => (
                          <span
                            key={ticker}
                            className="rounded bg-[#ddb159]/15 px-1.5 py-0.5 text-[9px] font-black text-[#ddb159]"
                          >
                            {ticker}
                          </span>
                        ))}
                        {article.impact_reason && (
                          <span className="line-clamp-1 text-[10px] font-medium text-[#faf6f0]/25">
                            {article.impact_reason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex shrink-0 items-center text-[#faf6f0]/20 transition group-hover:text-[#ddb159]">
                      <svg
                        viewBox="0 0 24 24"
                        className="size-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-[#ddb159]/20 bg-[#061b12] py-16 text-[14px] font-semibold text-[#faf6f0]/40">
                No news articles available yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
