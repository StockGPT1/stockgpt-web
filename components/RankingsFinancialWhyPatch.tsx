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

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function rangePosition(metrics: FinancialMetrics | null) {
  const price = num(metrics?.regularMarketPrice);
  const low = num(metrics?.fiftyTwoWeekLow);
  const high = num(metrics?.fiftyTwoWeekHigh);
  if (price == null || low == null || high == null || high <= low) return null;
  return ((price - low) / (high - low)) * 100;
}

function metricSummary(metrics: FinancialMetrics | null) {
  if (!metrics) return "No quote or chart metrics were returned for this ticker.";

  const items: string[] = [];
  if (num(metrics.forwardPE) != null) items.push(`forward P/E ${multiple(num(metrics.forwardPE)!)} `);
  if (num(metrics.trailingPE) != null) items.push(`trailing P/E ${multiple(num(metrics.trailingPE)!)} `);
  if (num(metrics.epsForward) != null) items.push(`forward EPS ${num(metrics.epsForward)!.toFixed(2)}`);
  if (num(metrics.epsTrailingTwelveMonths) != null) items.push(`trailing EPS ${num(metrics.epsTrailingTwelveMonths)!.toFixed(2)}`);
  if (num(metrics.priceToBook) != null) items.push(`price/book ${multiple(num(metrics.priceToBook)!)} `);
  if (num(metrics.dividendYieldPct) != null) items.push(`dividend yield ${num(metrics.dividendYieldPct)!.toFixed(1)}%`);
  if (num(metrics.marketCap) != null) items.push(`market cap ${money(num(metrics.marketCap)!)} `);
  if (num(metrics.rsi14) != null) items.push(`RSI ${num(metrics.rsi14)!.toFixed(1)}`);
  if (num(metrics.ma50) != null) items.push(`50-day average ${money(num(metrics.ma50)!)} `);
  if (num(metrics.ma200) != null) items.push(`200-day average ${money(num(metrics.ma200)!)} `);
  if (num(metrics.sixMonthChangePct) != null) items.push(`6M price change ${signedPct(num(metrics.sixMonthChangePct)!)} `);
  const pos = rangePosition(metrics);
  if (pos != null) items.push(`52-week range position ${pos.toFixed(0)}%`);

  const sourceNote = metrics.metricsSource === "chart"
    ? "Yahoo did not return fundamentals, so this uses fetched chart/technical context."
    : metrics.metricsSource === "quote+chart"
      ? "This uses Yahoo quote fundamentals plus fetched chart context."
      : "This uses Yahoo quote fundamentals.";

  return items.length ? `${sourceNote} ${items.join(" · ")}.` : "Yahoo returned the ticker but no usable fundamentals or chart metrics.";
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
  if (!metrics) return [makeMetricCard("Data", "Limited", "No quote or chart metrics were returned for this ticker.")];

  const pos = rangePosition(metrics);
  const cards = [
    makeMetricCard("P/E", num(metrics.forwardPE) != null ? multiple(num(metrics.forwardPE)!) : num(metrics.trailingPE) != null ? multiple(num(metrics.trailingPE)!) : "—", `Forward P/E: ${num(metrics.forwardPE) != null ? multiple(num(metrics.forwardPE)!) : "unavailable"}; trailing P/E: ${num(metrics.trailingPE) != null ? multiple(num(metrics.trailingPE)!) : "unavailable"}.`),
    makeMetricCard("EPS", num(metrics.epsForward) != null ? metrics.epsForward!.toFixed(2) : num(metrics.epsTrailingTwelveMonths) != null ? metrics.epsTrailingTwelveMonths!.toFixed(2) : "—", `Forward EPS: ${num(metrics.epsForward) != null ? metrics.epsForward!.toFixed(2) : "unavailable"}; trailing EPS: ${num(metrics.epsTrailingTwelveMonths) != null ? metrics.epsTrailingTwelveMonths!.toFixed(2) : "unavailable"}.`),
    makeMetricCard("RSI", num(metrics.rsi14) != null ? num(metrics.rsi14)!.toFixed(1) : "—", num(metrics.rsi14) != null ? `14-period RSI from fetched chart history is ${num(metrics.rsi14)!.toFixed(1)}.` : "RSI unavailable."),
    makeMetricCard("Moving avg", num(metrics.ma50) != null ? money(num(metrics.ma50)!) : "—", `${num(metrics.ma50) != null ? `50-day average ${money(num(metrics.ma50)!)}.` : "50-day average unavailable."}${num(metrics.ma200) != null ? ` 200-day average ${money(num(metrics.ma200)!)}.` : " 200-day average unavailable."}`),
    makeMetricCard("52-week", pos != null ? `${pos.toFixed(0)}%` : "—", pos != null ? `Current price is ${pos.toFixed(0)}% of the way from 52-week low to 52-week high.` : "52-week range data is unavailable."),
    makeMetricCard("6M trend", num(metrics.sixMonthChangePct) != null ? signedPct(num(metrics.sixMonthChangePct)!) : "—", num(metrics.sixMonthChangePct) != null ? `Price change over the fetched six-month window is ${signedPct(num(metrics.sixMonthChangePct)!)}.` : "Six-month price change unavailable."),
    makeMetricCard("Price/book", num(metrics.priceToBook) != null ? multiple(num(metrics.priceToBook)!) : "—", num(metrics.priceToBook) != null ? `Price/book is ${multiple(num(metrics.priceToBook)!)}.` : "Price/book is unavailable."),
    makeMetricCard("Size / yield", num(metrics.marketCap) != null ? money(num(metrics.marketCap)!) : "—", `${num(metrics.marketCap) != null ? `Market cap is ${money(num(metrics.marketCap)!)}.` : "Market cap unavailable."}${num(metrics.dividendYieldPct) != null ? ` Dividend yield is ${num(metrics.dividendYieldPct)!.toFixed(1)}%.` : " Dividend yield unavailable."}`),
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
