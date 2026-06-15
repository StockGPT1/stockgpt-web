"use client";

import { useEffect } from "react";

type Metrics = {
  ticker: string;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  epsTrailingTwelveMonths: number | null;
  epsForward: number | null;
  dividendYieldPct: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  regularMarketPrice: number | null;
  targetMeanPrice: number | null;
};

type Factor = {
  label: string;
  value: "Strong" | "Positive" | "Neutral" | "Watch" | "Limited";
  detail: string;
};

const cache = new Map<string, { factors: Factor[] }>();

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function fmt(value: number | null, suffix = "") {
  return value == null ? "—" : `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;
}

function fmtMoney(value: number | null) {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(2)}`;
}

function weekRangePosition(metrics: Metrics) {
  const price = metrics.regularMarketPrice;
  const low = metrics.fiftyTwoWeekLow;
  const high = metrics.fiftyTwoWeekHigh;
  if (price == null || low == null || high == null || high <= low) return null;
  return Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
}

function buildFactors(metrics: Metrics | null): Factor[] {
  if (!metrics) return [];
  const factors: Factor[] = [];
  const pe = metrics.trailingPE;
  const fpe = metrics.forwardPE;

  if (pe != null || fpe != null) {
    const value = fpe != null && fpe < 18 ? "Positive" : fpe != null && fpe > 35 ? "Watch" : pe != null && pe > 40 ? "Watch" : "Neutral";
    const detail = pe != null && fpe != null
      ? fpe < pe * 0.9
        ? `Forward P/E ${fmt(fpe)} is below trailing P/E ${fmt(pe)}, suggesting expectations for stronger earnings ahead.`
        : fpe > pe * 1.1
          ? `Forward P/E ${fmt(fpe)} is above trailing P/E ${fmt(pe)}, so valuation is not getting cheaper on forward estimates.`
          : `Trailing P/E ${fmt(pe)} and forward P/E ${fmt(fpe)} are broadly similar.`
      : fpe != null
        ? `Forward P/E is ${fmt(fpe)}.`
        : `Trailing P/E is ${fmt(pe)}.`;
    factors.push({ label: "Valuation", value, detail });
  }

  const eps = metrics.epsTrailingTwelveMonths;
  const forwardEps = metrics.epsForward;
  if (eps != null || forwardEps != null) {
    const value = eps != null && forwardEps != null && forwardEps > eps ? "Positive" : eps != null && forwardEps != null && forwardEps < eps ? "Watch" : "Neutral";
    const detail = eps != null && forwardEps != null
      ? forwardEps > eps
        ? `Forward EPS ${fmtMoney(forwardEps)} is above trailing EPS ${fmtMoney(eps)}, giving the rank earnings support.`
        : forwardEps < eps
          ? `Forward EPS ${fmtMoney(forwardEps)} is below trailing EPS ${fmtMoney(eps)}, which is a caution.`
          : `Forward EPS and trailing EPS are both around ${fmtMoney(eps)}.`
      : forwardEps != null
        ? `Forward EPS is ${fmtMoney(forwardEps)}.`
        : `Trailing EPS is ${fmtMoney(eps)}.`;
    factors.push({ label: "Earnings", value, detail });
  }

  const price = metrics.regularMarketPrice;
  const target = metrics.targetMeanPrice;
  if (price != null && target != null && price > 0) {
    const gap = ((target - price) / price) * 100;
    factors.push({
      label: "Target gap",
      value: gap >= 15 ? "Strong" : gap >= 5 ? "Positive" : gap < 0 ? "Watch" : "Neutral",
      detail: `Mean target ${fmtMoney(target)} versus price ${fmtMoney(price)} leaves ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}% target gap.`,
    });
  }

  const rangePosition = weekRangePosition(metrics);
  if (rangePosition != null) {
    factors.push({
      label: "52-week range",
      value: rangePosition <= 30 ? "Positive" : rangePosition >= 85 ? "Watch" : "Neutral",
      detail: `Price is around ${rangePosition.toFixed(0)}% of its 52-week range (${fmtMoney(metrics.fiftyTwoWeekLow)}–${fmtMoney(metrics.fiftyTwoWeekHigh)}).`,
    });
  }

  if (metrics.priceToBook != null) {
    factors.push({
      label: "Price/book",
      value: metrics.priceToBook < 3 ? "Positive" : metrics.priceToBook > 10 ? "Watch" : "Neutral",
      detail: `Price/book is ${fmt(metrics.priceToBook)}${metrics.priceToBook < 3 ? ", giving book-value support." : metrics.priceToBook > 10 ? ", so book-value support is limited." : "."}`,
    });
  }

  if (metrics.dividendYieldPct != null) {
    factors.push({
      label: "Dividend yield",
      value: metrics.dividendYieldPct >= 2 ? "Positive" : "Neutral",
      detail: `Dividend yield is about ${fmt(metrics.dividendYieldPct, "%")}${metrics.dividendYieldPct >= 2 ? ", adding income support." : "."}`,
    });
  }

  if (metrics.marketCap != null) {
    factors.push({
      label: "Market cap",
      value: metrics.marketCap >= 50_000_000_000 ? "Positive" : "Neutral",
      detail: `Market cap is about ${fmtMoney(metrics.marketCap)}, giving size and liquidity context.`,
    });
  }

  return factors.slice(0, 6);
}

function findTicker(details: HTMLDetailsElement) {
  const row = details.closest("div.border-b, div.min-w-0.max-w-full.overflow-hidden");
  const link = row?.querySelector<HTMLAnchorElement>('a[href^="/stock/"]');
  const hrefTicker = link?.getAttribute("href")?.split("/stock/")[1]?.split(/[?#/]/)[0];
  const textTicker = link?.textContent?.trim().split(/\s+/)[0];
  return cleanTicker(decodeURIComponent(hrefTicker || textTicker || ""));
}

function patchDetails(details: HTMLDetailsElement, factors: Factor[]) {
  const summaryNode = details.querySelector("summary");
  const leadParagraph = summaryNode?.nextElementSibling instanceof HTMLParagraphElement ? summaryNode.nextElementSibling : null;
  const grid = leadParagraph?.nextElementSibling instanceof HTMLElement
    ? leadParagraph.nextElementSibling
    : summaryNode?.nextElementSibling instanceof HTMLElement
      ? summaryNode.nextElementSibling
      : null;
  if (leadParagraph) leadParagraph.remove();

  if (!grid || !factors.length) return;

  grid.innerHTML = factors
    .map((factor) => `
      <div class="rounded-xl border border-[#072116]/8 bg-[#072116]/[0.025] p-2.5">
        <div class="flex items-center justify-between gap-2">
          <p class="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/45">${factor.label}</p>
          <span class="shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-0.5 text-[8px] font-black text-[#8a641a]">${factor.value}</span>
        </div>
        <p class="mt-1 text-[10px] font-semibold leading-4 text-[#072116]/58">${factor.detail}</p>
      </div>
    `)
    .join("");
}

async function loadFinancialContext(ticker: string) {
  if (cache.has(ticker)) return cache.get(ticker)!;
  const response = await fetch(`/api/stock/metrics?ticker=${encodeURIComponent(ticker)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("metrics unavailable");
  const data = (await response.json()) as { metrics: Metrics | null };
  const factors = buildFactors(data.metrics);
  const payload = { factors };
  cache.set(ticker, payload);
  return payload;
}

function patchOpenRankExplanations() {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/rankings")) return;

  document.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
    const title = details.querySelector("summary")?.textContent?.trim().toLowerCase();
    if (title !== "why this rank?" || details.dataset.financialMetricsPatched === "true") return;

    const ticker = findTicker(details);
    if (!ticker) return;

    const load = () => {
      if (details.dataset.financialMetricsPatched === "true") return;
      details.dataset.financialMetricsPatched = "loading";
      loadFinancialContext(ticker)
        .then(({ factors }) => {
          patchDetails(details, factors);
          details.dataset.financialMetricsPatched = "true";
        })
        .catch(() => {
          details.dataset.financialMetricsPatched = "";
        });
    };

    if (details.open) load();
    else details.addEventListener("toggle", () => {
      if (details.open) load();
    }, { once: true });
  });
}

export function RankingsWhyMetricsPatch() {
  useEffect(() => {
    patchOpenRankExplanations();
    const observer = new MutationObserver(() => patchOpenRankExplanations());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
