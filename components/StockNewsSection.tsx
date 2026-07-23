"use client";

import Link from "next/link";
import { useState } from "react";
import type { EnrichedNewsArticle } from "@/lib/news-intelligence";
import {
  displaySummary,
  formatNewsDate,
  formatShortNewsDate,
  getNewsInsight,
  getStockNewsSummary,
  impactStyle,
  inferImpact,
} from "@/lib/news-intelligence";

export function StockNewsSection({
  ticker,
  articles,
}: {
  ticker: string;
  articles: EnrichedNewsArticle[];
}) {
  const [selectedArticle, setSelectedArticle] = useState<EnrichedNewsArticle | null>(
    null,
  );

  const selectedStyle = selectedArticle ? impactStyle(selectedArticle.impact) : null;

  return (
    <section className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
            World Events & Company Activity
          </p>

          <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#faf6f0]">
            News affecting {ticker}
          </h2>
        </div>

        <Link
          href="/world-news"
          prefetch={false}
          className="w-fit rounded-full border border-[#ddb159]/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
        >
          Open world news
        </Link>
      </div>

      <p className="mt-3 max-w-4xl text-[13px] font-medium leading-6 text-[#faf6f0]/58">
        {getStockNewsSummary(ticker, articles)}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {articles.length > 0 ? (
          articles.map((article) => {
            const style = impactStyle(article.impact);
            const insight = article.affectedStocks[0];

            return (
              <button
                key={article.id}
                type="button"
                onClick={() => setSelectedArticle(article)}
                className="group flex min-w-0 gap-3 rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d]/55 p-3 text-left transition hover:border-[#ddb159]/40 hover:bg-[#0b2b1d]"
              >
                {article.image_url && (
                  <div className="hidden h-20 w-24 shrink-0 overflow-hidden rounded-xl sm:block">
                    <img
                      src={article.image_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {article.source && (
                      <span className="text-[10px] font-black text-[#ddb159]">
                        {article.source}
                      </span>
                    )}

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
                    >
                      {style.label}
                    </span>

                    {insight && (
                      <span className="rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#ddb159]">
                        {insight.impactRating}/10 impact
                      </span>
                    )}

                    <span className="text-[9px] font-bold text-[#faf6f0]/32">
                      {formatShortNewsDate(article.published_at)}
                    </span>
                  </div>

                  <h3 className="mt-1.5 line-clamp-2 text-[14px] font-black leading-snug tracking-[-0.02em] text-[#faf6f0] group-hover:text-[#ddb159]">
                    {article.title ?? "Untitled article"}
                  </h3>

                  <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-5 text-[#faf6f0]/45">
                    {displaySummary(article)}
                  </p>

                  {insight && (
                    <p className="mt-1 line-clamp-1 text-[10px] font-bold text-[#ddb159]/70">
                      {insight.matchReason} · {insight.scoreEffect}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.025] p-4 lg:col-span-2">
            <p className="text-[13px] font-bold text-[#faf6f0]/50">
              No recent linked company or industry articles are available for {ticker} yet.
            </p>
          </div>
        )}
      </div>

      {selectedArticle && selectedStyle && (
        <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[88px] z-[9999] overflow-hidden sm:bottom-0">
          <button
            type="button"
            aria-label="Close article popup"
            className="absolute inset-0 h-full w-full cursor-default bg-transparent backdrop-blur-[34px] backdrop-brightness-[0.42]"
            onClick={() => setSelectedArticle(null)}
          />

          <div className="relative z-10 flex h-full items-start justify-center px-2 py-2 sm:px-5 sm:py-3">
            <div
              className="grid h-full min-h-0 w-full max-w-[980px] overflow-hidden rounded-[22px] border border-[#ddb159]/35 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.68)] sm:rounded-[28px] lg:grid-cols-[0.72fr_1.28fr]"
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
              </div>

              <div className="relative flex min-h-0 flex-col overflow-y-auto overscroll-contain p-3 pb-4 sm:p-5 lg:overflow-hidden lg:p-6">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="absolute right-3 top-3 z-10 rounded-full border border-[#faf6f0]/12 bg-[#061b12]/90 px-2.5 py-1 text-[10px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/50 hover:text-[#ddb159]"
                >
                  Close
                </button>

                <div className="shrink-0 pr-14">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] ${selectedStyle.bg} ${selectedStyle.text} ${selectedStyle.border}`}
                    >
                      {selectedStyle.label} impact
                    </span>

                    <span className="text-[9px] font-bold text-[#faf6f0]/38">
                      {selectedArticle.source ?? "News source"} ·{" "}
                      {formatNewsDate(selectedArticle.published_at)}
                    </span>
                  </div>

                  <h2 className="mt-2 line-clamp-2 text-[17px] font-black leading-tight tracking-[-0.035em] text-[#faf6f0] sm:text-[23px] xl:text-[27px]">
                    {selectedArticle.title ?? "Untitled article"}
                  </h2>
                </div>

                <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                  <div className="min-h-0 rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] p-3 sm:p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                      Full description
                    </p>

                    <div className="mt-2 max-h-[30dvh] overflow-y-auto pr-1 text-[12px] font-medium leading-6 text-[#faf6f0]/70 sm:max-h-[34dvh] sm:text-[13px]">
                      {displaySummary(selectedArticle)}
                    </div>

                    <div className="mt-3 rounded-xl border border-[#ddb159]/12 bg-[#ddb159]/8 p-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
                        StockGPT insight
                      </p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-[#faf6f0]/64 sm:text-[12px]">
                        {getNewsInsight(selectedArticle)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedArticle.affectedStocks.map((stock) => (
                      <Link
                        key={stock.ticker}
                        href={`/stock/${stock.ticker}`}
                        prefetch={false}
                        className="rounded-xl border border-[#ddb159]/16 bg-[#0b2b1d] p-3 transition hover:border-[#ddb159]/45 hover:bg-[#103522]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-black text-[#ddb159]">
                              {stock.ticker}
                            </p>
                            <p className="truncate text-[10px] font-bold text-[#faf6f0]/62">
                              {stock.company ?? "Company data unavailable"}
                            </p>
                          </div>

                          <span className="rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black text-[#061b12]">
                            {stock.impactRating}/10
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-[#faf6f0]/48">
                          {stock.scoreEffect}
                        </p>
                      </Link>
                    ))}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    {selectedArticle.url ? (
                      <a
                        href={selectedArticle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.13em] text-[#061b12] transition hover:brightness-110"
                      >
                        Read source
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
                      Back to stock
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
