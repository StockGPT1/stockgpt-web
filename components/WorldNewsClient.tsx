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

  if (
    /\b(us|u\.s\.|usa|america|american|washington|white house|fed|federal reserve)\b/i.test(
      text
    )
  ) {
    return "United States";
  }

  if (
    /\b(uk|u\.k\.|britain|british|england|london|bank of england|boe)\b/i.test(
      text
    )
  ) {
    return "United Kingdom";
  }

  if (/\b(china|chinese|beijing|hong kong|shanghai)\b/i.test(text)) {
    return "China";
  }

  if (
    /\b(europe|european|eurozone|ecb|germany|france|italy|spain)\b/i.test(text)
  ) {
    return "Europe";
  }

  if (/\b(japan|japanese|tokyo)\b/i.test(text)) {
    return "Japan";
  }

  if (
    /\b(middle east|israel|iran|saudi|qatar|uae|dubai|opec)\b/i.test(text)
  ) {
    return "Middle East";
  }

  return "Global";
}

function inferTopic(article: WorldNewsArticle) {
  const text = articleText(article);

  if (
    /\b(election|government|policy|tariff|regulation|sanction|war|conflict|president|prime minister|congress|senate|tax|budget|geopolitical|parliament|central bank|rates|fed|federal reserve)\b/i.test(
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

function getInsight(article: WorldNewsArticle) {
  const impact = (article.impact ?? "").toLowerCase().trim();

  const tickers = article.affectedStocks
    .map((stock) => stock.ticker)
    .filter(Boolean);

  const sectors = Array.from(
    new Set(
      article.affectedStocks
        .map((stock) => stock.sector)
        .filter((sector): sector is string => Boolean(sector))
    )
  );

  if (article.impact_reason) {
    return article.impact_reason;
  }

  if (tickers.length > 0) {
    const direction =
      impact === "positive"
        ? "could support sentiment around"
        : impact === "negative"
          ? "could create pressure or uncertainty for"
          : "should be monitored for";

    return `This story ${direction} ${tickers.slice(0, 3).join(", ")}${
      tickers.length > 3 ? ` and ${tickers.length - 3} other linked names` : ""
    }. The key question is whether the headline affects earnings expectations, valuation multiples, financing costs or short-term risk appetite.`;
  }

  if (sectors.length > 0) {
    return `This story is most relevant to the ${sectors
      .slice(0, 2)
      .join(" and ")} sector${
      sectors.length > 2 ? "s" : ""
    }. Watch for changes in demand, margins, regulation, funding costs or investor positioning.`;
  }

  return "This is a macro or geopolitical story worth monitoring because it may influence interest-rate expectations, sector rotation, risk appetite and broader market sentiment.";
}

function getCardInsight(article: WorldNewsArticle) {
  const impact = (article.impact ?? "").toLowerCase().trim();
  const tickers = article.affectedStocks.map((stock) => stock.ticker);
  const sectors = Array.from(
    new Set(
      article.affectedStocks
        .map((stock) => stock.sector)
        .filter((sector): sector is string => Boolean(sector))
    )
  );

  if (article.impact_reason) {
    return article.impact_reason;
  }

  if (tickers.length > 0) {
    const direction =
      impact === "positive"
        ? "Potential support for"
        : impact === "negative"
          ? "Potential pressure on"
          : "Worth monitoring for";

    return `${direction} ${tickers.slice(0, 3).join(", ")}${
      tickers.length > 3 ? ` and ${tickers.length - 3} more` : ""
    }.`;
  }

  if (sectors.length > 0) {
    return `Relevant to ${sectors.slice(0, 2).join(" and ")} sentiment.`;
  }

  return "Macro impact: watch rates, risk appetite and sector rotation.";
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
      ...Array.from(
        new Set(enrichedArticles.map((article) => article.country))
      ).sort(),
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
        (article.impact ?? "neutral").toLowerCase() ===
          impactFilter.toLowerCase();

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
  const selectedStyle = selectedArticle ? impactStyle(selectedArticle.impact) : null;

  return (
    <main className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.03em] text-[#faf6f0] sm:text-[27px]">
            World News
          </h1>
          <p className="text-[11px] font-medium text-[#faf6f0]/50 sm:text-[12px]">
            {articles.length} articles with AI sentiment analysis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold sm:gap-4 sm:text-[11px]">
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

      <div className="flex h-1 shrink-0 overflow-hidden rounded-full bg-[#faf6f0]/8">
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

      <div className="shrink-0 rounded-xl border border-[#ddb159]/15 bg-[#061b12] px-2 py-1.5">
        <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-[1.45fr_0.8fr_0.92fr_0.92fr_0.92fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search news, ticker, source..."
            className="h-7 rounded-lg border border-[#ddb159]/15 bg-[#0b2b1d] px-2.5 text-[11px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/30 focus:border-[#ddb159]/50"
          />

          <select
            value={impactFilter}
            onChange={(event) => setImpactFilter(event.target.value)}
            className="h-7 rounded-lg border border-[#ddb159]/15 bg-[#0b2b1d] px-2 text-[10px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {["All impacts", "Positive", "Neutral", "Negative"].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
            className="h-7 rounded-lg border border-[#ddb159]/15 bg-[#0b2b1d] px-2 text-[10px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {industries.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            className="h-7 rounded-lg border border-[#ddb159]/15 bg-[#0b2b1d] px-2 text-[10px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {countries.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <select
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            className="h-7 rounded-lg border border-[#ddb159]/15 bg-[#0b2b1d] px-2 text-[10px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/50"
          >
            {["All topics", "Politics", "Company activity"].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setImpactFilter("All impacts");
              setIndustryFilter("All industries");
              setCountryFilter("All countries");
              setTopicFilter("All topics");
            }}
            className="h-7 rounded-lg border border-[#ddb159]/20 px-2.5 text-[8px] font-black uppercase tracking-[0.1em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10 md:col-span-2 xl:col-span-1"
          >
            Reset
          </button>
        </div>

        <p className="mt-1 text-[8px] font-bold text-[#faf6f0]/30">
          Showing {filteredArticles.length} of {articles.length}
        </p>
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

                    <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/45">
                      {displaySummary(article)}
                    </p>

                    <p className="mt-1 line-clamp-1 text-[10px] font-semibold leading-relaxed text-[#ddb159]/65">
                      StockGPT view: {getCardInsight(article)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {article.affectedStocks.map((stock) => (
                        <span
                          key={stock.ticker}
                          className="rounded bg-[#ddb159]/15 px-1.5 py-0.5 text-[9px] font-black text-[#ddb159]"
                        >
                          {stock.ticker}
                        </span>
                      ))}
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

      {selectedArticle && selectedStyle && (
        <div
          className="fixed inset-x-0 bottom-4 top-[118px] z-[9999] flex items-start justify-center overflow-hidden bg-black/55 px-3 py-3 backdrop-blur-xl backdrop-saturate-50 sm:bottom-5 sm:top-[124px] sm:px-5 lg:top-[132px]"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="grid h-full min-h-0 w-full max-w-[1140px] overflow-hidden rounded-[28px] border border-[#ddb159]/35 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.68)] lg:grid-cols-[0.78fr_1.22fr]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative hidden min-h-0 overflow-hidden bg-[#0b2b1d] lg:block">
              {selectedArticle.image_url ? (
                <img
                  src={selectedArticle.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_40%_20%,rgba(221,177,89,0.22),transparent_35%),linear-gradient(135deg,#061b12,#0b2b1d)]">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]/60">
                    StockGPT Intelligence
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-[#061b12] via-transparent to-black/10" />

              <div className="absolute bottom-4 left-4 right-4">
                <p className="line-clamp-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                  {selectedArticle.source ?? "News source"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/70">
                  {formatFullDate(selectedArticle.published_at)}
                </p>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-col p-4 sm:p-5 lg:p-6">
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="absolute right-4 top-4 z-10 rounded-full border border-[#faf6f0]/12 bg-[#061b12]/90 px-3 py-1 text-[11px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/50 hover:text-[#ddb159]"
              >
                Close
              </button>

              <div className="shrink-0 pr-16">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] ${selectedStyle.bg} ${selectedStyle.text} ${selectedStyle.border}`}
                  >
                    {selectedStyle.label} impact
                  </span>

                  <span className="text-[10px] font-bold text-[#faf6f0]/38 lg:hidden">
                    {selectedArticle.source ?? "News source"} ·{" "}
                    {formatFullDate(selectedArticle.published_at)}
                  </span>
                </div>

                <h2 className="mt-2 line-clamp-2 text-[19px] font-black leading-tight tracking-[-0.035em] text-[#faf6f0] sm:text-[23px] xl:text-[27px]">
                  {selectedArticle.title ?? "Untitled article"}
                </h2>
              </div>

              <div className="mt-3 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-3">
                <div className="min-h-0 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] p-3 sm:p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                    Full description
                  </p>

                  <p className="mt-1.5 line-clamp-4 text-[12px] font-medium leading-5 text-[#faf6f0]/70 sm:line-clamp-5 sm:text-[13px] sm:leading-6 xl:line-clamp-6">
                    {displaySummary(selectedArticle)}
                  </p>

                  <div className="mt-3 rounded-xl border border-[#ddb159]/12 bg-[#ddb159]/8 p-2.5">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                      StockGPT insight
                    </p>
                    <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-5 text-[#faf6f0]/64 sm:text-[12px]">
                      {getInsight(selectedArticle)}
                    </p>
                  </div>
                </div>

                <div className="min-h-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                      Affected stocks
                    </p>
                    <p className="text-[9px] font-bold text-[#faf6f0]/35">
                      Click ticker to open page
                    </p>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {selectedArticle.affectedStocks.length > 0 ? (
                      selectedArticle.affectedStocks.slice(0, 4).map((stock) => (
                        <Link
                          key={stock.ticker}
                          href={`/stock/${stock.ticker}`}
                          className="rounded-xl border border-[#ddb159]/16 bg-[#0b2b1d] p-2 transition hover:border-[#ddb159]/45 hover:bg-[#103522]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-black text-[#ddb159]">
                                {stock.ticker}
                              </p>
                              <p className="truncate text-[10px] font-bold text-[#faf6f0]/62">
                                {stock.company ?? "Company data unavailable"}
                              </p>
                              {stock.sector && (
                                <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-[#faf6f0]/30">
                                  {stock.sector}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              {stock.rank != null && (
                                <p className="text-[9px] font-black text-[#faf6f0]/45">
                                  #{stock.rank}
                                </p>
                              )}

                              {stock.score != null && (
                                <span className="mt-0.5 inline-flex rounded-full bg-[#ddb159] px-1.5 py-0.5 text-[8px] font-black text-[#061b12]">
                                  {Number(stock.score).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.03] p-3 text-[11px] font-semibold text-[#faf6f0]/45 sm:col-span-2">
                        No specific tickers are linked to this article yet.
                      </div>
                    )}
                  </div>

                  {selectedArticle.affectedStocks.length > 4 && (
                    <p className="mt-1 text-[9px] font-bold text-[#faf6f0]/35">
                      +{selectedArticle.affectedStocks.length - 4} more linked stocks hidden to keep the briefing compact.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {selectedArticle.url ? (
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.13em] text-[#061b12] transition hover:brightness-110"
                    >
                      Read more
                    </a>
                  ) : (
                    <span className="inline-flex h-10 items-center justify-center rounded-xl border border-[#faf6f0]/12 px-4 text-[11px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/35">
                      External link unavailable
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-[#ddb159]/22 px-4 text-[11px] font-black uppercase tracking-[0.13em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
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
