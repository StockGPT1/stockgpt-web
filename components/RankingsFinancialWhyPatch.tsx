"use client";

import { useEffect } from "react";
import type { FinancialMetrics } from "@/lib/yahoo-financials";

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function multiple(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
}

function money(value: number) {
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toFixed(2)}`;
}

function rangePosition(metrics: FinancialMetrics | null) {
  const price = num(metrics?.regularMarketPrice);
  const low = num(metrics?.fiftyTwoWeekLow);
  const high = num(metrics?.fiftyTwoWeekHigh);
  if (price == null || low == null || high == null || high <= low) return null;
  return ((price - low) / (high - low)) * 100;
}

function metricSummary(metrics: FinancialMetrics | null) {
  if (!metrics) return "Financial metrics were not returned for this ticker.";

  const items: string[] = [];
  if (num(metrics.forwardPE) != null) items.push(`forward P/E ${multiple(num(metrics.forwardPE)!)} `);
  if (num(metrics.trailingPE) != null) items.push(`trailing P/E ${multiple(num(metrics.trailingPE)!)} `);
  if (num(metrics.epsForward) != null) items.push(`forward EPS ${num(metrics.epsForward)!.toFixed(2)}`);
  if (num(metrics.epsTrailingTwelveMonths) != null) items.push(`trailing EPS ${num(metrics.epsTrailingTwelveMonths)!.toFixed(2)}`);
  if (num(metrics.priceToBook) != null) items.push(`price/book ${multiple(num(metrics.priceToBook)!)} `);
  if (num(metrics.dividendYieldPct) != null) items.push(`dividend yield ${num(metrics.dividendYieldPct)!.toFixed(1)}%`);
  if (num(metrics.marketCap) != null) items.push(`market cap ${money(num(metrics.marketCap)!)} `);
  const pos = rangePosition(metrics);
  if (pos != null) items.push(`52-week range position ${pos.toFixed(0)}%`);

  return items.length ? `Fetched financial metrics: ${items.join(" · ")}.` : "Yahoo returned the ticker but not usable P/E, EPS, book, yield, market-cap or range metrics.";
}

function makeMetricCard(labelText: string, valueText: string, detailText: string) {
  const card = document.createElement("div");
  card.className = "rounded-xl border border-[#072116]/8 bg-[#072116]/[0.025] p-2.5";

  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-2";

  const label = document.createElement("p");
  label.className = "truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#072116]/45";
  label.textContent = labelText;

  const chip = document.createElement("span");
  chip.className = "shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-0.5 text-[8px] font-black text-[#8a641a]";
  chip.textContent = valueText;

  const detail = document.createElement("p");
  detail.className = "mt-1 text-[10px] font-semibold leading-4 text-[#072116]/58";
  detail.textContent = detailText;

  row.append(label, chip);
  card.append(row, detail);
  return card;
}

function metricCards(metrics: FinancialMetrics | null) {
  if (!metrics) return [makeMetricCard("Financial data", "Limited", "No financial metrics were returned for this ticker.")];

  const cards = [
    makeMetricCard("P/E", num(metrics.forwardPE) != null ? multiple(num(metrics.forwardPE)!) : num(metrics.trailingPE) != null ? multiple(num(metrics.trailingPE)!) : "—", `Forward P/E: ${num(metrics.forwardPE) != null ? multiple(num(metrics.forwardPE)!) : "unavailable"}; trailing P/E: ${num(metrics.trailingPE) != null ? multiple(num(metrics.trailingPE)!) : "unavailable"}.`),
    makeMetricCard("EPS", num(metrics.epsForward) != null ? metrics.epsForward!.toFixed(2) : num(metrics.epsTrailingTwelveMonths) != null ? metrics.epsTrailingTwelveMonths!.toFixed(2) : "—", `Forward EPS: ${num(metrics.epsForward) != null ? metrics.epsForward!.toFixed(2) : "unavailable"}; trailing EPS: ${num(metrics.epsTrailingTwelveMonths) != null ? metrics.epsTrailingTwelveMonths!.toFixed(2) : "unavailable"}.`),
    makeMetricCard("Price/book", num(metrics.priceToBook) != null ? multiple(num(metrics.priceToBook)!) : "—", num(metrics.priceToBook) != null ? `Price/book is ${multiple(num(metrics.priceToBook)!)}.` : "Price/book is unavailable."),
    makeMetricCard("Yield", num(metrics.dividendYieldPct) != null ? `${num(metrics.dividendYieldPct)!.toFixed(1)}%` : "—", num(metrics.dividendYieldPct) != null ? `Dividend yield is ${num(metrics.dividendYieldPct)!.toFixed(1)}%.` : "Dividend yield is unavailable."),
    makeMetricCard("Market cap", num(metrics.marketCap) != null ? money(num(metrics.marketCap)!) : "—", num(metrics.marketCap) != null ? `Market cap is ${money(num(metrics.marketCap)!)}.` : "Market cap is unavailable."),
    makeMetricCard("52-week", rangePosition(metrics) != null ? `${rangePosition(metrics)!.toFixed(0)}%` : "—", rangePosition(metrics) != null ? `Current price is ${rangePosition(metrics)!.toFixed(0)}% of the way from 52-week low to 52-week high.` : "52-week range data is unavailable."),
  ];

  return cards;
}

async function patchDetails(details: HTMLDetailsElement) {
  if (details.dataset.stockgptFinancialPatched === "true" || details.dataset.stockgptFinancialLoading === "true") return;

  const link = details.parentElement?.querySelector<HTMLAnchorElement>('a[href^="/stock/"]');
  const ticker = cleanTicker(link?.getAttribute("href")?.split("/stock/")[1] ?? link?.textContent);
  if (!ticker) return;

  details.dataset.stockgptFinancialLoading = "true";
  try {
    const response = await fetch(`/api/rankings/financial-metrics?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } });
    const data = response.ok ? await response.json() : null;
    const metrics = (data?.metrics ?? null) as FinancialMetrics | null;
    const summary = details.querySelector<HTMLParagraphElement>("summary + p");
    const grid = details.querySelector<HTMLElement>("summary + p + div");

    if (summary) summary.textContent = metricSummary(metrics);
    if (grid) grid.replaceChildren(...metricCards(metrics));
    details.dataset.stockgptFinancialPatched = "true";
  } finally {
    delete details.dataset.stockgptFinancialLoading;
  }
}

export function RankingsFinancialWhyPatch() {
  useEffect(() => {
    function onToggle(event: Event) {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      const summary = details.querySelector("summary")?.textContent?.toLowerCase() ?? "";
      if (!summary.includes("why this rank")) return;
      void patchDetails(details);
    }

    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  }, []);

  return null;
}
