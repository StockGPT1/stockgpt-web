"use client";

import { useState } from "react";
import type {
  AffectedStockInsight,
  EnrichedNewsArticle,
} from "@/lib/news-intelligence";
import {
  displaySummary,
  formatNewsDate,
  getStockNewsSummary,
  impactStyle,
} from "@/lib/news-intelligence";

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

function ImpactMeter({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(10, rating));

  return (
    <div className="rounded-2xl border border-[#ddb159]/14 bg-[#ddb159]/[0.07] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/38">
          Relevance
        </p>
        <p className="text-[12px] font-black text-[#ddb159]">
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

function ArticleModal({
  article,
  ticker,
  onClose,
}: {
  article: EnrichedNewsArticle;
  ticker: string;
  onClose: () => void;
}) {
  const insight = article.affectedStocks.find(
    (stock) => stock.ticker.toUpperCase() === ticker.toUpperCase(),
  ) as AffectedStockInsight | undefined;

  const style = impactStyle(article.impact);

  return (
    <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[88px] z-[9999] overflow-hidden sm:bottom-0">
      <button
        type="button"
        aria-label="Close news article"
        className="absolute inset-0 h-full w-full cursor-default bg-transparent backdrop-blur-[34px] backdrop-brightness-[0.42] backdrop-saturate-50"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full items-center justify-center px-3 py-4">
        <div className="grid max-h-full min-h-0 w-full max-w-[980px] overflow-hidden rounded-[26px] border border-[#ddb159]/35 bg-[#061b12] shadow-[0_30px_90px_rgba(0,0,0,0.72)] lg:grid-cols-[0.7fr_1.3fr]">
          <div className="relative hidden min-h-0 overflow-hidden bg-[#0b2b1d] lg:block">
            {article.image_url ? (
              <img
                src={article.image_url}
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

            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#ddb159]/18 bg-[#061b12]/62 p-3 backdrop-blur">
              <p className="line-clamp-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                {article.source ?? "News source"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#faf6f0]/70">
                {formatNewsDate(article.published_at)}
              </p>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-[#ddb159]/14 bg-[#061b12]/95 p-4 pr-24 sm:p-5 sm:pr-28">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-full border border-[#faf6f0]/12 bg-[#061b12]/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/70 shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:border-[#ddb159]/50 hover:bg-[#0b2b1d] hover:text-[#ddb159]"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] ${style.bg} ${style.text} ${style.border}`}
                >
                  {style.label} impact
                </span>

                {insight && (
                  <span className="inline-flex rounded-full border border-[#ddb159]/24 bg-[#ddb159]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
                    {insight.impactRating}/10 relevance
                  </span>
                )}
              </div>

              <h2 className="mt-2 line-clamp-2 text-[19px] font-black leading-tight tracking-[-0.035em] text-[#faf6f0] sm:text-[25px]">
                {article.title ?? "Untitled article"}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div className="grid gap-3">
                <section className="rounded-2xl border border-[#ddb159]/14 bg-[#faf6f0]/[0.04] p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                    Article summary
                  </p>

                  <p className="mt-2 text-[13px] font-medium leading-6 text-[#faf6f0]/72">
                    {displaySummary(article)}
                  </p>
                </section>

                {insight ? (
                  <>
                    <section className="rounded-2xl border border-[#ddb159]/16 bg-[#ddb159]/[0.07] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                          What this means for {ticker}
                        </p>
                        <DirectionBadge direction={insight.impactDirection} />
                      </div>

                      <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/76">
                        {insight.customerSummary}
                      </p>
                    </section>

                    <section className="grid gap-3 sm:grid-cols-[1fr_150px]">
                      <div className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                          Chain of events
                        </p>

                        <p className="mt-2 text-[13px] font-medium leading-6 text-[#faf6f0]/70">
                          {insight.causalChain}
                        </p>
                      </div>

                      <ImpactMeter rating={insight.impactRating} />
                    </section>

                    <section className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                        What to watch next
                      </p>

                      <p className="mt-2 text-[13px] font-medium leading-6 text-[#faf6f0]/70">
                        {insight.modelReadThrough}
                      </p>
                    </section>
                  </>
                ) : (
                  <section className="rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.04] p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                      StockGPT view
                    </p>

                    <p className="mt-2 text-[13px] font-medium leading-6 text-[#faf6f0]/70">
                      This article is market-relevant, but StockGPT has not
                      detected a strong enough direct link to {ticker}.
                    </p>
                  </section>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#ddb159]/14 bg-[#061b12]/95 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                {article.url ? (
                  <a
                    href={article.url}
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
                  onClick={onClose}
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
  );
}

export function StockRelatedNews({
  ticker,
  articles,
}: {
  ticker: string;
  articles: EnrichedNewsArticle[];
}) {
  const [selectedArticle, setSelectedArticle] =
    useState<EnrichedNewsArticle | null>(null);

  const filteredArticles = articles.filter((article) =>
    article.affectedStocks.some(
      (stock) =>
        stock.ticker.toUpperCase() === ticker.toUpperCase() &&
        stock.impactRating >= 5,
    ),
  );

  return (
    <section className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.03] p-4 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
            ✦ World Events & Company Activity
          </p>

          <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#faf6f0]">
            Relevant news affecting {ticker}
          </h2>
        </div>

        <a
          href="/world-news"
          className="w-fit rounded-full border border-[#ddb159]/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
        >
          Open world news
        </a>
      </div>

      <p className="mt-3 max-w-4xl text-[13px] font-medium leading-6 text-[#faf6f0]/58">
        {getStockNewsSummary(ticker, filteredArticles)}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => {
            const insight = article.affectedStocks.find(
              (stock) => stock.ticker.toUpperCase() === ticker.toUpperCase(),
            );

            const style = impactStyle(article.impact);

            return (
              <button
                key={article.id}
                type="button"
                onClick={() => setSelectedArticle(article)}
                className="group flex gap-3 rounded-2xl border border-[#ddb159]/14 bg-[#0b2b1d]/55 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#ddb159]/40 hover:bg-[#0b2b1d] hover:shadow-[0_12px_28px_rgba(0,0,0,0.2)]"
              >
                {article.image_url && (
                  <div className="hidden h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:block">
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
                      <span className="rounded-full border border-[#ddb159]/20 bg-[#ddb159]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#ddb159]">
                        {insight.impactRating}/10 relevance
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1.5 line-clamp-2 text-[14px] font-black leading-snug tracking-[-0.02em] text-[#faf6f0] group-hover:text-[#ddb159]">
                    {article.title ?? "Untitled article"}
                  </h3>

                  {insight ? (
                    <p className="mt-1.5 line-clamp-3 text-[11px] font-medium leading-5 text-[#faf6f0]/50">
                      {insight.customerSummary}
                    </p>
                  ) : (
                    <p className="mt-1.5 line-clamp-3 text-[11px] font-medium leading-5 text-[#faf6f0]/50">
                      {displaySummary(article)}
                    </p>
                  )}

                  <p className="mt-2 text-[8px] font-black uppercase tracking-[0.12em] text-[#ddb159]/55">
                    Open impact briefing →
                  </p>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.025] p-4 lg:col-span-2">
            <p className="text-[13px] font-bold text-[#faf6f0]/50">
              No 5/10+ relevant articles are currently linked to {ticker}. When
              StockGPT detects a strong company, sector or macro read-through,
              it will appear here.
            </p>
          </div>
        )}
      </div>

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          ticker={ticker}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </section>
  );
}
