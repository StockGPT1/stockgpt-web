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
  if (value === null || value === undefined || value === "") return null;
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

function describeRsi(value: number | null) {
  if (value == null) return null;
  if (value < 30) return `RSI ${value.toFixed(1)} is oversold`;
  if (value < 40) return `RSI ${value.toFixed(1)} shows weak momentum`;
  if (value > 70) return `RSI ${value.toFixed(1)} is overbought`;
  if (value > 60) return `RSI ${value.toFixed(1)} shows strong momentum`;
  return `RSI ${value.toFixed(1)} is neutral`;
}

function describeMacd(value: FinancialMetrics["macdSignal"]) {
  if (value === "bullish_cross") return "MACD has crossed bullish";
  if (value === "bearish_cross") return "MACD has crossed bearish";
  if (value === "bullish") return "MACD is bullish";
  if (value === "bearish") return "MACD is bearish";
  if (value === "neutral") return "MACD is neutral";
  return null;
}

function rangePosition(metrics: FinancialMetrics | null) {
  const price = num(metrics?.regularMarketPrice);
  const low = num(metrics?.fiftyTwoWeekLow);
  const high = num(metrics?.fiftyTwoWeekHigh);
  if (price == null || low == null || high == null || high <= low) return null;
  if (low < price * 0.35 || high > price * 1.85) return null;
  return ((price - low) / (high - low)) * 100;
}

function metricSummary(metrics: FinancialMetrics | null) {
  if (!metrics) return "No quote or chart metrics were returned for this ticker.";

  const items: string[] = [];
  const rsi = describeRsi(num(metrics.rsi14));
  const macd = describeMacd(metrics.macdSignal);
  if (rsi) items.push(rsi);
  if (macd) items.push(macd);
  if (num(metrics.ma50) != null && num(metrics.regularMarketPrice) != null) {
    const price = num(metrics.regularMarketPrice)!;
    const ma50 = num(metrics.ma50)!;
    items.push(`price is ${price >= ma50 ? "above" : "below"} the 50-day average (${money(ma50)})`);
  }
  if (num(metrics.sixMonthChangePct) != null) items.push(`6M price change ${signedPct(num(metrics.sixMonthChangePct)!)} `);
  if (num(metrics.forwardPE) != null) items.push(`forward P/E ${multiple(num(metrics.forwardPE)!)} `);
  if (num(metrics.trailingPE) != null) items.push(`trailing P/E ${multiple(num(metrics.trailingPE)!)} `);
  if (num(metrics.epsForward) != null && num(metrics.epsTrailingTwelveMonths) != null) {
    items.push(`forward EPS ${num(metrics.epsForward)!.toFixed(2)} vs trailing EPS ${num(metrics.epsTrailingTwelveMonths)!.toFixed(2)}`);
  }
  if (num(metrics.priceToBook) != null) items.push(`price/book ${multiple(num(metrics.priceToBook)!)} `);
  const pos = rangePosition(metrics);
  if (pos != null) items.push(`range position ${pos.toFixed(0)}%`);

  const sourceNote = metrics.metricsSource === "chart"
    ? "Yahoo fundamentals were unavailable, so this uses fetched RSI/MACD/chart context."
    : metrics.metricsSource === "quote+chart"
      ? "This uses fetched RSI/MACD/chart context plus Yahoo fundamentals."
      : "This uses Yahoo quote fundamentals.";

  return items.length ? `${sourceNote} ${items.slice(0, 5).join(" · ")}.` : "No usable fundamentals or technical metrics were returned for this ticker.";
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
  const rsi = num(metrics.rsi14);
  const macd = describeMacd(metrics.macdSignal);
  const ma50 = num(metrics.ma50);
  const ma200 = num(metrics.ma200);
  const price = num(metrics.regularMarketPrice);
  const cards = [
    makeMetricCard("RSI", rsi != null ? rsi.toFixed(1) : "—", rsi != null ? `14-period RSI from fetched chart history is ${rsi.toFixed(1)}.` : "RSI unavailable."),
    makeMetricCard("MACD", macd ? macd.replace("MACD ", "") : "—", macd ?? "MACD unavailable."),
    makeMetricCard("Moving avg", ma50 != null ? money(ma50) : "—", `${ma50 != null ? `50-day average ${money(ma50)}.` : "50-day average unavailable."}${ma200 != null ? ` 200-day average ${money(ma200)}.` : " 200-day average unavailable."}${price != null && ma50 != null ? ` Price is ${price >= ma50 ? "above" : "below"} the 50-day average.` : ""}`),
    makeMetricCard("6M trend", num(metrics.sixMonthChangePct) != null ? signedPct(num(metrics.sixMonthChangePct)!) : "—", num(metrics.sixMonthChangePct) != null ? `Price change over the fetched six-month window is ${signedPct(num(metrics.sixMonthChangePct)!)}.` : "Six-month price change unavailable."),
    makeMetricCard("P/E", num(metrics.forwardPE) != null ? multiple(num(metrics.forwardPE)!) : num(metrics.trailingPE) != null ? multiple(num(metrics.trailingPE)!) : "—", `Forward P/E: ${num(metrics.forwardPE) != null ? multiple(num(metrics.forwardPE)!) : "unavailable"}; trailing P/E: ${num(metrics.trailingPE) != null ? multiple(num(metrics.trailingPE)!) : "unavailable"}.`),
    makeMetricCard("EPS", num(metrics.epsForward) != null ? metrics.epsForward!.toFixed(2) : num(metrics.epsTrailingTwelveMonths) != null ? metrics.epsTrailingTwelveMonths!.toFixed(2) : "—", `Forward EPS: ${num(metrics.epsForward) != null ? metrics.epsForward!.toFixed(2) : "unavailable"}; trailing EPS: ${num(metrics.epsTrailingTwelveMonths) != null ? metrics.epsTrailingTwelveMonths!.toFixed(2) : "unavailable"}.`),
    makeMetricCard("Price/book", num(metrics.priceToBook) != null ? multiple(num(metrics.priceToBook)!) : "—", num(metrics.priceToBook) != null ? `Price/book is ${multiple(num(metrics.priceToBook)!)}.` : "Price/book is unavailable."),
    makeMetricCard("Range", pos != null ? `${pos.toFixed(0)}%` : "—", pos != null ? `Current price is ${pos.toFixed(0)}% of the cleaned recent range.` : "Range omitted because the quote range looked unavailable or distorted."),
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
