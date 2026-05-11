"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type WorldNewsArticle = {
  id: string;
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  impact: string | null;
  impact_reason: string | null;
  published_at: string | null;
  affectedStocks: Array<{
    ticker: string;
    company: string | null;
    sector: string | null;
    rank: number | null;
    score: number | string | null;
    price: number | string | null;
  }>;
};

function impactStyle(impact: string | null) {
  const s = (impact ?? "").toLowerCase().trim();

  if (s === "positive") {
    return {
      bg: "bg-emerald-500/12",
      text: "text-emerald-400",
      border: "border-emerald-500/25",
      label: "Positive",
    };
  }

  if (s === "negative") {
    return {
      bg: "bg-red-500/12",
      text: "text-red-400",
      border: "border-red-500/25",
      label: "Negative",
    };
  }

  return {
    bg: "bg-[#faf6f0]/8",
    text: "text-[#faf6f0]/50",
    border: "border-[#faf6f0]/12",
    label: "Neutral",
  };
}

function formatFullDate(dateStr: string | null) {
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

function articleText(article: WorldNewsArticle) {
  return [
    article.title,
    article.summary,
    article.source,
    article.impact,
    article.impact_reason,
    ...article.affectedStocks.flatMap((stock) => [
      stock.ticker,
      stock.company,
      stock.sector,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferCountry(article: WorldNewsArticle) {
  const text = articleText(article);

  if (/\b(us|u\.s\.|usa|america|american|washington|white house|fed)\b/i.test(text)) {
    return "United States";
  }

  if (/\b(uk|u\.k\.|britain|british|england|london|bank of england|boe)\b/i.test(text)) {
    return "United Kingdom";
  }

  if (/\b(china|chinese|beijing|hong kong|shanghai)\b/i.test(text)) {
    return "China";
  }

  if (/\b(europe|european|eurozone|ecb|germany|france|italy|spain)\b/i.test(text)) {
    return "Europe";
  }

  if (/\b(japan|japanese|tokyo)\b/i.test(text)) {
    return "Japan";
  }

  if (/\b(middle east|israel|iran|saudi|qatar|uae|dubai|opec)\b/i.test(text)) {
    return "Middle East";
  }

  return "Global";
}

function inferTopic(article: WorldNewsArticle) {
  const text = articleText(article);

  if (
    /\b(election|government|policy|tariff|regulation|sanction|war|conflict|president|prime minister|congress|senate|tax|budget|geopolitical|parliament)\b/i.test(
      text
    )
  ) {
    return "Politics";
  }

  return "Company activity";
}

function displaySummary(article: WorldNewsArticle) {
  if (article.summary && article.summary !== "No summary available.") {
    return article.summary;
  }

  if (article.impact_reason) {
    return article.impact_reason;
  }

  return "No full description is currently available for this article.";
}

export function WorldNewsClient({ articles }: { articles: WorldNewsArticle[] }) {
  const [selectedArticle, setSelectedArticle] =
    useState<WorldNewsArticle | null>(null);

  const [search, setSearch] = useState("");
  const [impactFilter, setImpactFilter] = useState("All impacts");
  const [industryFilter, setIndustryFilter] = useState("All industries");
  const [countryFilter, setCountryFilter] = useState("All countries");
  const [topicFilter, setTopicFilter] = useState("All topics");

  const enrichedArticles = useMemo(
    () =>
      articles.map((article) => ({
        ...article,
        country: inferCountry(article),
        topic: inferTopic(article),
        industries: Array.from(
          new Set(
            article.affectedStocks
              .map((stock) => stock.sector)
              .filter((sector): sector is string => Boolean(sector))
          )
        ),
      })),
    [articles]
  );

  const counts = useMemo(
    () =>
      articles.reduce(
        (acc, article) => {
          const s = (article.impact ?? "").toLowerCase().trim();

          if (s === "positive") acc.positive++;
          else if (s === "negative") acc.negative++;
          else acc.neutral++;

          return acc;
        },
        { positive: 0, negative: 0, neutral: 0 }
      ),
    [articles]
  );

  const industries = useMemo(
    () => [
      "All industries",
      ...Array.from(
        new Set(enrichedArticles.flatMap((article) => article.industries))
      ).sort(),
    ],
    [enrichedArticles]
  );

  const countries = useMemo(
    () => [
      "All countries",
      ...Array.from(new Set(enrichedArticles.map((article) => article.country))).sort(),
    ],
    [enrichedArticles]
  );

  const filteredArticles = useMemo(() => {
    return enrichedArticles.filter((article) => {
      const text = articleText(article);

      const matchesSearch =
        !search.trim() || text.includes(search.trim().toLowerCase());

      const matchesImpact =
        impactFilter === "All impacts" ||
        (article.impact ?? "neutral").toLowerCase() === impactFilter.toLowerCase();

      const matchesIndustry =
        industryFilter === "All industries" ||
        article.industries.includes(industryFilter);

      const matchesCountry =
        countryFilter === "All countries" || article.country === countryFilter;

      const matchesTopic =
        topicFilter === "All topics" || article.topic === topicFilter;

      return (
        matchesSearch &&
        matchesImpact &&
        matchesIndustry &&
        matchesCountry &&
        matchesTopic
      );
    });
  }, [
    enrichedArticles,
    search,
    impactFilter,
    industryFilter,
    countryFilter,
    topicFilter,
  ]);

  const total = counts.positive + counts.negative + counts.neutral || 1;

  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]">
            World News
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[#faf6f0]/50">
            {articles.length} articles with AI sentiment analysis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
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

      <div className="shrink-0 rounded-2xl border border-[#ddb159]/15 bg-[#061b12] p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search news, ticker, source..."
            className="h-10 rounded-xl border border-[#ddb159]/15 bg-[#0b2b1d] px-3 text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/30 focus:border-[#ddb159]/50"
          />

          <select
            value={impactFilter}
            onChange={(event) => setImpactFilter(event.target.value)}
            className="h-10 rounded-xl border border-[#ddb159]/15 bg-[#0b2b1d] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {["All impacts", "Positive", "Neutral", "Negative"].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
            className="h-10 rounded-xl border border-[#ddb159]/15 bg-[#0b2b1d] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {industries.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            className="h-10 rounded-xl border border-[#ddb159]/15 bg-[#0b2b1d] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {countries.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            className="h-10 rounded-xl border border-[#ddb159]/15 bg-[#0b2b1d] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {["All topics", "Politics", "Company activity"].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold text-[#faf6f0]/35">
            Showing {filteredArticles.length} of {articles.length} articles
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setImpactFilter("All impacts");
              setIndustryFilter("All industries");
              setCountryFilter("All countries");
              setTopicFilter("All topics");
            }}
            className="rounded-full border border-[#ddb159]/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3">
          {filteredArticles.length > 0 ? (
            filteredArticles.map((article) => {
              const style = impactStyle(article.impact);
              const hasImage = !!article.image_url;

              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setSelectedArticle(article)}
                  className="group flex gap-4 rounded-2xl border border-[#ddb159]/15 bg-[#0b2b1d]/60 p-4 text-left transition hover:border-[#ddb159]/40 hover:bg-[#0b2b1d]"
                >
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

                  <div className="min-w-0 flex-1">
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
                        <span className="text-[10px] font-semibold text-[#faf6f0]/35">
                          {formatFullDate(article.published_at)}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1.5 text-[14px] font-black leading-snug tracking-[-0.02em] text-[#faf6f0] group-hover:text-[#ddb159]">
                      {article.title ?? "Untitled article"}
                    </h3>

                    {article.summary &&
                      article.summary !== "No summary available." && (
                        <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/45">
                          {article.summary}
                        </p>
                      )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {article.affectedStocks.map((stock) => (
                        <span
                          key={stock.ticker}
                          className="rounded bg-[#ddb159]/15 px-1.5 py-0.5 text-[9px] font-black text-[#ddb159]"
                        >
                          {stock.ticker}
                        </span>
                      ))}

                      {article.impact_reason && (
                        <span className="line-clamp-1 text-[10px] font-medium text-[#faf6f0]/25">
                          {article.impact_reason}
                        </span>
                      )}
                    </div>
                  </div>

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
                </button>
              );
            })
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-[#ddb159]/20 bg-[#061b12] py-16 text-[14px] font-semibold text-[#faf6f0]/40">
              No articles match those filters.
            </div>
          )}
        </div>
      </div>

      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[#ddb159]/35 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid lg:grid-cols-[0.95fr_1.2fr]">
              <div className="relative min-h-[240px] overflow-hidden bg-[#0b2b1d]">
                {selectedArticle.image_url ? (
                  <img
                    src={selectedArticle.image_url}
                    alt=""
                    className="h-full min-h-[240px] w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[240px] items-center justify-center bg-[radial-gradient(circle_at_40%_20%,rgba(221,177,89,0.22),transparent_35%),linear-gradient(135deg,#061b12,#0b2b1d)]">
                    <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ddb159]/60">
                      StockGPT Intelligence
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#061b12] via-transparent to-black/10" />

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                    {selectedArticle.source ?? "News source"}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/70">
                    {formatFullDate(selectedArticle.published_at)}
                  </p>
                </div>
              </div>

              <div className="relative p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="absolute right-4 top-4 rounded-full border border-[#faf6f0]/12 bg-[#faf6f0]/8 px-3 py-1 text-[12px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/50 hover:text-[#ddb159]"
                >
                  Close
                </button>

                <div className="pr-16">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${
                      impactStyle(selectedArticle.impact).bg
                    } ${impactStyle(selectedArticle.impact).text} ${
                      impactStyle(selectedArticle.impact).border
                    }`}
                  >
                    {impactStyle(selectedArticle.impact).label} impact
                  </span>

                  <h2 className="mt-4 text-[26px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0]">
                    {selectedArticle.title ?? "Untitled article"}
                  </h2>
                </div>

                <div className="mt-5 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Full description
                  </p>

                  <p className="mt-2 text-[14px] font-medium leading-7 text-[#faf6f0]/68">
                    {displaySummary(selectedArticle)}
                  </p>

                  {selectedArticle.impact_reason && (
                    <div className="mt-4 rounded-2xl border border-[#ddb159]/12 bg-[#ddb159]/8 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                        Why this matters
                      </p>
                      <p className="mt-1 text-[13px] font-semibold leading-6 text-[#faf6f0]/62">
                        {selectedArticle.impact_reason}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Stocks that could be affected
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedArticle.affectedStocks.length > 0 ? (
                      selectedArticle.affectedStocks.map((stock) => (
                        <Link
                          key={stock.ticker}
                          href={`/stock/${stock.ticker}`}
                          className="rounded-2xl border border-[#ddb159]/16 bg-[#0b2b1d] p-3 transition hover:border-[#ddb159]/45 hover:bg-[#103522]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[16px] font-black text-[#ddb159]">
                                {stock.ticker}
                              </p>
                              <p className="truncate text-[12px] font-bold text-[#faf6f0]/62">
                                {stock.company ?? "Company data unavailable"}
                              </p>
                              {stock.sector && (
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#faf6f0]/30">
                                  {stock.sector}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              {stock.rank != null && (
                                <p className="text-[10px] font-black text-[#faf6f0]/45">
                                  #{stock.rank}
                                </p>
                              )}

                              {stock.score != null && (
                                <span className="mt-1 inline-flex rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black text-[#061b12]">
                                  {Number(stock.score).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.03] p-4 text-[13px] font-semibold text-[#faf6f0]/45 sm:col-span-2">
                        No specific tickers are linked to this article yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  {selectedArticle.url ? (
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl bg-[#ddb159] px-5 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#061b12] transition hover:brightness-110"
                    >
                      Read more
                    </a>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-2xl border border-[#faf6f0]/12 px-5 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/35">
                      External link unavailable
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    className="inline-flex items-center justify-center rounded-2xl border border-[#ddb159]/22 px-5 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                  >
                    Back to feed
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
