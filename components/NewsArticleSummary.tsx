"use client";

import { useEffect, useState } from "react";
import { getUsableNewsSummary, type NewsSummaryArticle } from "@/lib/news-summary";

const recoveredSummaries = new Map<string, string>();

export function NewsArticleSummary({ article }: { article: NewsSummaryArticle & { id: string } }) {
  const existingSummary = getUsableNewsSummary(article);
  const [result, setResult] = useState({
    summary: existingSummary,
    loading: !existingSummary,
  });
  const articleId = article.id;
  const needsSummary = !existingSummary;

  useEffect(() => {
    if (!needsSummary) return;
    const controller = new AbortController();
    async function loadSummary() {
      try {
        let summary = recoveredSummaries.get(articleId) ?? null;
        if (!summary) {
          const response = await fetch(`/api/news/summary?id=${encodeURIComponent(articleId)}`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
          });
          if (response.ok) {
            const payload = await response.json();
            summary = getUsableNewsSummary({ summary: payload.summary });
            if (summary) {
              if (recoveredSummaries.size >= 100) recoveredSummaries.clear();
              recoveredSummaries.set(articleId, summary);
            }
          }
        }
        if (!controller.signal.aborted) setResult({ summary, loading: false });
      } catch {
        if (!controller.signal.aborted) setResult({ summary: null, loading: false });
      }
    }
    void loadSummary();
    return () => controller.abort();
  }, [articleId, needsSummary]);

  return (
    <p className="mt-2 text-[13px] font-semibold leading-6 text-[#faf6f0]/70" aria-live="polite" aria-busy={result.loading}>
      {result.summary ?? (result.loading
        ? "Getting the article summary…"
        : "This publisher’s summary couldn’t be retrieved. Open the full article below to read the story.")}
    </p>
  );
}
