"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AffectedStockInsight,
  EnrichedNewsArticle,
} from "@/lib/news-intelligence";
import {
  articleText,
  displaySummary,
  formatNewsDate,
  formatShortNewsDate,
  getNewsInsight,
  impactStyle,
  inferImpact,
} from "@/lib/news-intelligence";

export type WorldNewsArticle = EnrichedNewsArticle;

function inferCountry(article: WorldNewsArticle) {
  const text = articleText(article);

  if (
    /\b(us|u\.s\.|usa|america|american|washington|white house|fed|federal reserve)\b/i.test(
      text,
    )
  ) {
    return "United States";
  }

  if (
    /\b(uk|u\.k\.|britain|british|england|london|bank of england|boe)\b/i.test(
      text,
    )
  ) {
    return "United Kingdom";
  }

  if (/\b(china|chinese|beijing|hong kong|shanghai)\b/i.test(text)) {
    return "China";
  }

  if (
    /\b(europe|european|eurozone|ecb|germany|france|italy|spain)\b/i.test(
      text,
    )
  ) {
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
    /\b(election|government|policy|tariff|regulation|sanction|war|conflict|president|prime minister|congress|senate|tax|budget|geopolitical|parliament|central bank|rates|fed|federal reserve)\b/i.test(
      text,
    )
  ) {
    return "Politics / Macro";
  }

  if (article.affectedStocks.some((stock) => stock.impactRating >= 8)) {
    return "Company-specific";
  }

  if (article.affectedStocks.some((stock) => stock.impactRating >= 4)) {
    return "Sector read-through";
  }

  return "Market activity";
}

function SelectChevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-[#ddb159]/55"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const cls =
    direction === "Positive"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : direction === "Negative"
        ? "border-red-400/25 bg-red-400/10 text-red-300"
        : "border-[#faf6f0]/12 bg-[#faf6f0]/8 text-[#faf6f0]/55";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${cls}`}
    >
      {direction}
    </span>
  );
}

function ImpactRatingMeter({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(10, rating));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#faf6f0]/35">
          Relevance score
        </p>
        <p className="text-[11px] font-black text-[#ddb159]">
          {safeRating}/10
        </p>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#faf6f0]/8">
        <div
          className="h-full rounded-full bg-[#ddb159]"
          style={{ width: `${safeRating * 10}%` }}
        />
      </div>
    </div>
  );
}

function ArticleInsightPanel({ article }: { article: WorldNewsArticle }) {
  const topStock = article.affectedStocks[0];

  if (!topStock) {
    return (
      <div className="mt-3 rounded-xl border border-[#ddb159]/12 bg-[#ddb159]/8 p-3">
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
          StockGPT insight
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/62">
          No high-confidence stock link was detected. Treat this as broad market
          context rather than a direct catalyst.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#ddb159]/[0.07] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
          StockGPT insight
        </p>
        <DirectionBadge direction={topStock.impactDirection} />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px]">
        <div>
          <p className="text-[12px] font-black leading-5 text-[#faf6f0]/82">
            Most relevant stock:{" "}
            <span className="text-[#ddb159]">{topStock.ticker}</span>
          </p>

          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/62">
            {topStock.customerSummary}
          </p>
        </div>

        <ImpactRatingMeter rating={topStock.impactRating} />
      </div>
    </div>
  );
}

function StockImpactPopup({
  stock,
  onClose,
}: {
  stock: AffectedStockInsight;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#061b12]/78 p-3 backdrop-blur-xl">
      <div className="relative flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] border border-[#ddb159]/35 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.72)]">
        <div className="relative shrink-0 border-b border-[#ddb159]/14 bg-[#04180f]/92 p-4 pr-28 sm:p-5 sm:pr-32">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full border border-[#faf6f0]/12 bg-[#061b12]/95 px-3 py-1.5 text-[10px] font-black text-[#faf6f0]/70 shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition hover:border-[#ddb159]/50 hover:bg-[#0b2b1d] hover:text-[#ddb159]"
          >
            Close
          </button>

          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
            Stock impact briefing
          </p>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[28px] font-black leading-none tracking-[-0.04em] text-[#ddb159]">
                {stock.ticker}
              </h3>

              <p className="mt-1 truncate text-[13px] font-bold text-[#faf6f0]/62">
                {stock.company ?? "Company data unavailable"}
              </p>
            </div>

            <div className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[11px] font-black text-[#061b12]">
              {stock.impactRating}/10 relevance
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid gap-3">
            <section className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Plain-English read
                </p>
                <DirectionBadge direction={stock.impactDirection} />
              </div>

              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/75">
                {stock.customerSummary}
              </p>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Why it matters
                </p>

                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/70">
                  {stock.matchReason}
                </p>
              </div>

              <div className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                  Signal type
                </p>

                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/70">
                  {stock.impactType}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                Chain of events
              </p>

              <p className="mt-2 text-[13px] font-medium leading-6 text-[#faf6f0]/70">
                {stock.causalChain}
              </p>
            </section>

            <section className="rounded-2xl border border-[#ddb159]/16 bg-[#ddb159]/[0.07] p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                What this means for you
              </p>

              <p className="mt-2 text-[13px] font-medium leading-6 text-[#faf6f0]/70">
                {stock.modelReadThrough}
              </p>
            </section>

            <section className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#ddb159]/12 bg-[#0b2b1d] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/35">
                  Sector
                </p>

                <p className="mt-1 truncate text-[12px] font-black text-[#faf6f0]/80">
                  {stock.sector ?? "Unavailable"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#ddb159]/12 bg-[#0b2b1d] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/35">
                  AI score
                </p>

                <p className="mt-1 text-[12px] font-black text-[#faf6f0]/80">
                  {stock.score != null
                    ? Number(stock.score).toLocaleString()
                    : "Unavailable"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#ddb159]/12 bg-[#0b2b1d] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/35">
                  Rank
                </p>

                <p className="mt-1 text-[12px] font-black text-[#faf6f0]/80">
                  {stock.rank != null ? `#${stock.rank}` : "Unavailable"}
                </p>
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#ddb159]/14 bg-[#04180f]/92 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/stock/${stock.ticker}`}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.13em] text-[#061b12] transition hover:brightness-110"
            >
              View stock →
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#ddb159]/22 px-4 text-[11px] font-black uppercase tracking-[0.13em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
            >
              Back to article
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorldNewsClient({ articles }: { articles: WorldNewsArticle[] }) {
  const [selectedArticle, setSelectedArticle] =
    useState<WorldNewsArticle | null>(null);
  const [selectedStock, setSelectedStock] =
    useState<AffectedStockInsight | null>(null);

  const [search, setSearch] = useState("");
  const [impactFilter, setImpactFilter] = useState("All impacts");
  const [industryFilter, setIndustryFilter] = useState("All industries");
  const [countryFilter, setCountryFilter] = useState("All countries");
  const [topicFilter, setTopicFilter] = useState("All topics");

  const [draftSearch, setDraftSearch] = useState("");
  const [draftImpactFilter, setDraftImpactFilter] = useState("All impacts");
  const [draftIndustryFilter, setDraftIndustryFilter] =
    useState("All industries");
  const [draftCountryFilter, setDraftCountryFilter] =
    useState("All countries");
  const [draftTopicFilter, setDraftTopicFilter] = useState("All topics");

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
              .filter((sector): sector is string => Boolean(sector)),
          ),
        ),
        highestImpactRating: Math.max(
          ...article.affectedStocks.map((stock) => stock.impactRating),
          1,
        ),
      })),
    [articles],
  );

  const counts = useMemo(
    () =>
      articles.reduce(
        (acc, article) => {
          const impact = inferImpact(article);

          if (impact === "positive") acc.positive++;
          else if (impact === "negative") acc.negative++;
          else acc.neutral++;

          return acc;
        },
        { positive: 0, negative: 0, neutral: 0 },
      ),
    [articles],
  );

  const industries = useMemo(
    () => [
      "All industries",
      ...Array.from(
        new Set(enrichedArticles.flatMap((article) => article.industries)),
      ).sort(),
    ],
    [enrichedArticles],
  );

  const countries = useMemo(
    () => [
      "All countries",
      ...Array.from(
        new Set(enrichedArticles.map((article) => article.country)),
      ).sort(),
    ],
    [enrichedArticles],
  );

  const topics = useMemo(
    () => [
      "All topics",
      ...Array.from(
        new Set(enrichedArticles.map((article) => article.topic)),
      ).sort(),
    ],
    [enrichedArticles],
  );

  const filteredArticles = useMemo(() => {
    return enrichedArticles.filter((article) => {
      const text = [
        articleText(article),
        article.affectedStocks
          .map(
            (stock) =>
              `${stock.ticker} ${stock.company} ${stock.sector} ${stock.customerSummary} ${stock.matchReason}`,
          )
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search.trim() || text.includes(search.trim().toLowerCase());

      const matchesImpact =
        impactFilter === "All impacts" ||
        inferImpact(article) === impactFilter.toLowerCase();

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
  const selectedStyle = selectedArticle
    ? impactStyle(selectedArticle.impact)
    : null;

  function openArticle(article: WorldNewsArticle) {
    setSelectedArticle(article);
    setSelectedStock(null);
  }

  function closeArticle() {
    setSelectedArticle(null);
    setSelectedStock(null);
  }

  function applyFilters() {
    setSearch(draftSearch);
    setImpactFilter(draftImpactFilter);
    setIndustryFilter(draftIndustryFilter);
    setCountryFilter(draftCountryFilter);
    setTopicFilter(draftTopicFilter);
  }

  function resetFilters() {
    setSearch("");
    setImpactFilter("All impacts");
    setIndustryFilter("All industries");
    setCountryFilter("All countries");
    setTopicFilter("All topics");

    setDraftSearch("");
    setDraftImpactFilter("All impacts");
    setDraftIndustryFilter("All industries");
    setDraftCountryFilter("All countries");
    setDraftTopicFilter("All topics");
  }

  return (
    <main className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.03em] text-[#faf6f0] sm:text-[27px]">
            World News
          </h1>
          <p className="text-[11px] font-medium text-[#faf6f0]/50 sm:text-[12px]">
            {articles.length} articles · AI-linked stocks · impact rating /10
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

      <div className="shrink-0 rounded-[1.35rem] border border-[#ddb159]/18 bg-[#061b12]/85 px-2.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        <div className="grid gap-2">
          <label className="flex h-9 w-full items-center gap-2 rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] px-2.5 transition focus-within:border-[#ddb159]/45">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ddb159]/12 text-[#ddb159]">
              <svg
                viewBox="0 0 24 24"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>
            </span>

            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search news, ticker, company, source..."
              className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/32"
            />
          </label>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_88px_88px]">
            <label className="relative h-9 rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] px-3 transition focus-within:border-[#ddb159]/45">
              <span className="absolute left-3 top-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">
                Impact
              </span>
              <select
                value={draftImpactFilter}
                onChange={(event) => setDraftImpactFilter(event.target.value)}
                className="h-full w-full appearance-none bg-transparent pb-0.5 pt-3 text-[12px] font-black text-[#faf6f0] outline-none"
              >
                {["All impacts", "Positive", "Neutral", "Negative"].map(
                  (option) => (
                    <option key={option} className="bg-white text-black">
                      {option}
                    </option>
                  ),
                )}
              </select>
              <SelectChevron />
            </label>

            <label className="relative h-9 rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] px-3 transition focus-within:border-[#ddb159]/45">
              <span className="absolute left-3 top-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">
                Industry
              </span>
              <select
                value={draftIndustryFilter}
                onChange={(event) => setDraftIndustryFilter(event.target.value)}
                className="h-full w-full appearance-none bg-transparent pb-0.5 pt-3 text-[12px] font-black text-[#faf6f0] outline-none"
              >
                {industries.map((option) => (
                  <option key={option} className="bg-white text-black">
                    {option}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </label>

            <label className="relative h-9 rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] px-3 transition focus-within:border-[#ddb159]/45">
              <span className="absolute left-3 top-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">
                Country
              </span>
              <select
                value={draftCountryFilter}
                onChange={(event) => setDraftCountryFilter(event.target.value)}
                className="h-full w-full appearance-none bg-transparent pb-0.5 pt-3 text-[12px] font-black text-[#faf6f0] outline-none"
              >
                {countries.map((option) => (
                  <option key={option} className="bg-white text-black">
                    {option}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </label>

            <label className="relative h-9 rounded-2xl border border-[#ddb159]/12 bg-[#faf6f0]/[0.035] px-3 transition focus-within:border-[#ddb159]/45">
              <span className="absolute left-3 top-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">
                Topic
              </span>
              <select
                value={draftTopicFilter}
                onChange={(event) => setDraftTopicFilter(event.target.value)}
                className="h-full w-full appearance-none bg-transparent pb-0.5 pt-3 text-[12px] font-black text-[#faf6f0] outline-none"
              >
                {topics.map((option) => (
                  <option key={option} className="bg-white text-black">
                    {option}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </label>

            <button
              type="button"
              onClick={applyFilters}
              className="h-9 rounded-2xl bg-[#ddb159] px-3 text-[12px] font-black text-[#061b12] transition hover:brightness-110"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="h-9 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.035] px-3 text-[12px] font-black text-[#faf6f0] transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10"
            >
              Reset
            </button>
          </div>
        </div>

        <p className="mt-1.5 text-[8px] font-bold text-[#faf6f0]/30">
          Showing {filteredArticles.length} of {articles.length}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3">
          {filteredArticles.length > 0 ? (
            filteredArticles.map((article) => {
              const style = impactStyle(article.impact);
              const topStock = article.affectedStocks[0];

              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => openArticle(article)}
                  className="group flex gap-4 rounded-2xl border border-[#ddb159]/15 bg-[#0b2b1d]/60 p-4 text-left transition hover:border-[#ddb159]/40 hover:bg-[#0b2b1d]"
                >
                  {article.image_url && (
                    <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:block">
                      <img
                        src={article.image_url}
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

                      {topStock && (
                        <span className="rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#ddb159]">
                          {topStock.ticker} · {topStock.impactRating}/10
                        </span>
                      )}

                      {article.published_at && (
                        <span className="text-[10px] font-semibold text-[#faf6f0]/35">
                          {formatShortNewsDate(article.published_at)}
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
                      {getNewsInsight(article)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {article.affectedStocks.slice(0, 8).map((stock) => (
                        <span
                          key={stock.ticker}
                          className="rounded bg-[#ddb159]/15 px-1.5 py-0.5 text-[9px] font-black text-[#ddb159]"
                        >
                          {stock.ticker} · {stock.impactRating}/10
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
        <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[88px] z-[9999] overflow-hidden sm:bottom-0">
          <button
            type="button"
            aria-label="Close article popup"
            className="absolute inset-0 h-full w-full cursor-default bg-transparent backdrop-blur-[38px] backdrop-brightness-[0.42] backdrop-saturate-50"
            onClick={closeArticle}
          />

          <div className="relative z-10 flex h-full items-center justify-center px-2 py-2 sm:px-5 sm:py-4">
            <div
              className="grid max-h-full min-h-0 w-full max-w-[1140px] overflow-hidden rounded-[22px] border border-[#ddb159]/35 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.68)] sm:max-h-[calc(100dvh-120px)] sm:rounded-[28px] lg:grid-cols-[0.72fr_1.28fr]"
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

                <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/58 p-3 backdrop-blur">
                  <p className="line-clamp-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                    {selectedArticle.source ?? "News source"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/70">
                    {formatNewsDate(selectedArticle.published_at)}
                  </p>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-col overflow-hidden">
                {selectedStock && (
                  <StockImpactPopup
                    stock={selectedStock}
                    onClose={() => setSelectedStock(null)}
                  />
                )}

                <div className="relative shrink-0 border-b border-[#ddb159]/14 bg-[#061b12]/95 p-3 pr-24 sm:p-5 sm:pr-28">
                  <button
                    type="button"
                    onClick={closeArticle}
                    className="absolute right-3 top-3 z-10 rounded-full border border-[#faf6f0]/12 bg-[#061b12]/95 px-3 py-1.5 text-[10px] font-black text-[#faf6f0]/70 shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:border-[#ddb159]/50 hover:bg-[#0b2b1d] hover:text-[#ddb159]"
                  >
                    Close
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] ${selectedStyle.bg} ${selectedStyle.text} ${selectedStyle.border}`}
                    >
                      {selectedStyle.label} impact
                    </span>

                    <span className="line-clamp-1 max-w-[260px] text-[9px] font-bold text-[#faf6f0]/38 sm:max-w-none sm:text-[10px] lg:hidden">
                      {selectedArticle.source ?? "News source"} ·{" "}
                      {formatNewsDate(selectedArticle.published_at)}
                    </span>
                  </div>

                  <h2 className="mt-2 line-clamp-2 text-[17px] font-black leading-tight tracking-[-0.035em] text-[#faf6f0] sm:text-[23px] xl:text-[27px]">
                    {selectedArticle.title ?? "Untitled article"}
                  </h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
                  <div className="grid gap-3">
                    <section className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] p-3 sm:p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159] sm:text-[9px]">
                        Full description
                      </p>

                      <p className="mt-2 text-[11px] font-medium leading-5 text-[#faf6f0]/70 sm:text-[13px] sm:leading-6">
                        {displaySummary(selectedArticle)}
                      </p>

                      <ArticleInsightPanel article={selectedArticle} />
                    </section>

                    <section className="min-h-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159] sm:text-[9px]">
                          Affected stocks
                        </p>
                        <p className="hidden text-[9px] font-bold text-[#faf6f0]/35 sm:block">
                          Click a card for full impact text
                        </p>
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {selectedArticle.affectedStocks.length > 0 ? (
                          selectedArticle.affectedStocks.map((stock) => (
                            <button
                              key={stock.ticker}
                              type="button"
                              onClick={() => setSelectedStock(stock)}
                              className="group min-w-0 rounded-xl border border-[#ddb159]/16 bg-[#0b2b1d] p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/45 hover:bg-[#103522] hover:shadow-[0_12px_26px_rgba(0,0,0,0.22)]"
                            >
                              <div className="flex min-w-0 items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-black text-[#ddb159] sm:text-[13px]">
                                    {stock.ticker}
                                  </p>
                                  <p className="truncate text-[9px] font-bold text-[#faf6f0]/62 sm:text-[10px]">
                                    {stock.company ??
                                      "Company data unavailable"}
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  <span className="inline-flex rounded-full bg-[#ddb159] px-1.5 py-0.5 text-[8px] font-black text-[#061b12]">
                                    {stock.impactRating}/10
                                  </span>

                                  {stock.score != null && (
                                    <p className="mt-1 text-[8px] font-black text-[#faf6f0]/45">
                                      {Number(stock.score).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/30">
                                {stock.impactType}
                              </p>

                              <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-[#faf6f0]/50 group-hover:text-[#faf6f0]/65">
                                {stock.customerSummary}
                              </p>

                              <p className="mt-2 text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]/58">
                                Open impact briefing →
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.03] p-2.5 text-[10px] font-semibold text-[#faf6f0]/45 sm:col-span-2">
                            No specific tickers are linked to this article yet.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="shrink-0 border-t border-[#ddb159]/14 bg-[#061b12]/95 p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {selectedArticle.url ? (
                      <a
                        href={selectedArticle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-[#ddb159] px-4 text-[10px] font-black uppercase tracking-[0.13em] text-[#061b12] transition hover:brightness-110 sm:h-10 sm:text-[11px]"
                      >
                        Read source
                      </a>
                    ) : (
                      <span className="inline-flex h-9 items-center justify-center rounded-xl border border-[#faf6f0]/12 px-4 text-[10px] font-black uppercase tracking-[0.13em] text-[#faf6f0]/35 sm:h-10 sm:text-[11px]">
                        External link unavailable
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={closeArticle}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-[#ddb159]/22 px-4 text-[10px] font-black uppercase tracking-[0.13em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10 sm:h-10 sm:text-[11px]"
                    >
                      Back to feed
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
