"use client";

import { useEffect } from "react";
import type { FinancialMetrics } from "@/lib/yahoo-financials";

type FactorDiagnostic = {
  factor?: string;
  current?: number;
  change?: number;
};

type RankingDiagnostics = {
  diagnosis?: string | null;
  top_positive_factors?: FactorDiagnostic[] | null;
  top_negative_factors?: FactorDiagnostic[] | null;
  quality_score?: number | null;
  growth_score?: number | null;
  value_score?: number | null;
  momentum_score?: number | null;
  risk_score?: number | null;
  income_score?: number | null;
  factor_coverage?: number | null;
  data_confidence?: string | null;
};

const staleWhyRankPatterns = [
  "rank context from live financial metrics",
  "52-week range",
  "price is around",
];

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

function money(value: number) {
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toFixed(2)}`;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function friendlyFactorName(raw: string | undefined) {
  const factor = String(raw ?? "").replace(/_z$/, "");
  const names: Record<string, string> = {
    ROIC: "ROIC",
    ROE: "ROE",
    GrossMargin: "gross margin",
    OperatingMargin: "operating margin",
    FCFMargin: "free-cash-flow margin",
    RevenueGrowth: "revenue growth",
    EPSGrowth: "EPS growth",
    FCFGrowth: "free-cash-flow growth",
    PE_rel: "P/E versus sector",
    EVToEBITDA_rel: "EV/EBITDA versus sector",
    PS_rel: "price/sales versus sector",
    FCFYield: "free-cash-flow yield",
    Momentum12_1: "12-month momentum",
    Momentum6_1: "6-month momentum",
    MA_dist: "distance above moving average",
    MA_slope: "moving-average slope",
    DownsideVol: "downside volatility",
    MaxDrawdown: "max drawdown",
    Beta: "beta",
    DebtToEquity: "debt-to-equity",
    DividendYield: "dividend yield",
  };
  return names[factor] ?? factor.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function sleeveLabel(key: keyof RankingDiagnostics, value: unknown) {
  const n = num(value);
  if (n == null) return null;
  const label = key.replace("_score", "").replace(/^./, (char) => char.toUpperCase());
  return `${label} ${n >= 0 ? "+" : ""}${n.toFixed(3)}`;
}

function diagnosticSummary(diagnostics: RankingDiagnostics | null, metrics: FinancialMetrics | null) {
  const positives = (diagnostics?.top_positive_factors ?? []).slice(0, 3);
  const negatives = (diagnostics?.top_negative_factors ?? []).slice(0, 1);
  const parts: string[] = [];

  if (positives.length) {
    parts.push(
      `strongest ranking drivers are ${positives
        .map((item) => `${friendlyFactorName(item.factor)} (${num(item.current) != null ? `${num(item.current)! >= 0 ? "+" : ""}${num(item.current)!.toFixed(3)}` : "positive"})`)
        .join(", ")}`,
    );
  }

  const rsi = num(metrics?.rsi14);
  if (rsi != null) {
    if (rsi < 30) parts.push(`RSI is oversold at ${rsi.toFixed(1)}`);
    else if (rsi > 70) parts.push(`RSI is overbought at ${rsi.toFixed(1)}`);
  }

  if (metrics?.macdSignal === "bullish_cross") parts.push("MACD has crossed bullish");
  if (metrics?.macdSignal === "bearish_cross") parts.push("MACD has crossed bearish");

  if (negatives.length) {
    parts.push(`main drag is ${friendlyFactorName(negatives[0].factor)}`);
  }

  if (parts.length) return `This rank is explained by ${parts.slice(0, 4).join("; ")}.`;
  if (diagnostics?.diagnosis) return diagnostics.diagnosis;
  return "No factor diagnostics were available for this ticker yet.";
}

function metricSummary(metrics: FinancialMetrics | null) {
  if (!metrics) return "";

  const items: string[] = [];
  if (num(metrics.rsi14) != null) items.push(`RSI ${num(metrics.rsi14)!.toFixed(1)}`);
  if (metrics.macdSignal) items.push(`MACD ${String(metrics.macdSignal).replace(/_/g, " ")}`);
  if (num(metrics.ma50) != null && num(metrics.regularMarketPrice) != null) {
    const price = num(metrics.regularMarketPrice)!;
    const ma50 = num(metrics.ma50)!;
    items.push(`price is ${price >= ma50 ? "above" : "below"} the 50-day average (${money(ma50)})`);
  }
  if (num(metrics.sixMonthChangePct) != null) items.push(`6M price change ${signedPct(num(metrics.sixMonthChangePct)!)} `);
  if (num(metrics.forwardPE) != null) items.push(`forward P/E ${num(metrics.forwardPE)!.toFixed(1)}x`);
  if (num(metrics.epsForward) != null && num(metrics.epsTrailingTwelveMonths) != null) {
    items.push(`forward EPS ${num(metrics.epsForward)!.toFixed(2)} vs trailing EPS ${num(metrics.epsTrailingTwelveMonths)!.toFixed(2)}`);
  }

  return items.length ? ` Supporting chart context: ${items.slice(0, 4).join(" · ")}.` : "";
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

function diagnosticCards(diagnostics: RankingDiagnostics | null, metrics: FinancialMetrics | null) {
  const cards: HTMLElement[] = [];
  const positives = (diagnostics?.top_positive_factors ?? []).slice(0, 4);
  positives.forEach((item) => {
    const current = num(item.current);
    const change = num(item.change);
    cards.push(makeMetricCard(
      friendlyFactorName(item.factor),
      current != null ? `${current >= 0 ? "+" : ""}${current.toFixed(3)}` : "Positive",
      `This factor contributed positively to the current ranking${change != null ? ` and changed ${change >= 0 ? "+" : ""}${change.toFixed(3)} versus the previous diagnostic run.` : "."}`,
    ));
  });

  const rsi = num(metrics?.rsi14);
  if (rsi != null) cards.push(makeMetricCard("RSI", rsi.toFixed(1), `14-period RSI from fetched chart history is ${rsi.toFixed(1)}.`));
  if (metrics?.macdSignal) cards.push(makeMetricCard("MACD", String(metrics.macdSignal).replace(/_/g, " "), `MACD signal from fetched chart history is ${String(metrics.macdSignal).replace(/_/g, " ")}.`));
  if (num(metrics?.sixMonthChangePct) != null) cards.push(makeMetricCard("6M trend", signedPct(num(metrics?.sixMonthChangePct)!), `Six-month price change is ${signedPct(num(metrics?.sixMonthChangePct)!)}.`));

  const sleeves = [
    sleeveLabel("quality_score", diagnostics?.quality_score),
    sleeveLabel("growth_score", diagnostics?.growth_score),
    sleeveLabel("value_score", diagnostics?.value_score),
    sleeveLabel("momentum_score", diagnostics?.momentum_score),
    sleeveLabel("risk_score", diagnostics?.risk_score),
    sleeveLabel("income_score", diagnostics?.income_score),
  ].filter(Boolean);
  if (sleeves.length) cards.push(makeMetricCard("Sleeves", "Scores", sleeves.slice(0, 4).join(" · ")));

  return cards.length ? cards.slice(0, 8) : [makeMetricCard("Diagnostics", "Limited", "No ranking factor diagnostics were available for this ticker yet.")];
}

function detailsContainsStaleCopy(details: HTMLDetailsElement) {
  const text = details.textContent?.toLowerCase() ?? "";
  return staleWhyRankPatterns.some((pattern) => text.includes(pattern));
}

async function patchDetails(details: HTMLDetailsElement, force = false) {
  if (details.dataset.stockgptFinancialLoading === "true") return;
  if (!force && details.dataset.stockgptFinancialPatched === "true" && !detailsContainsStaleCopy(details)) return;

  const link = details.parentElement?.querySelector<HTMLAnchorElement>('a[href^="/stock/"]');
  const ticker = cleanTicker(link?.getAttribute("href")?.split("/stock/")[1] ?? link?.textContent);
  if (!ticker) return;

  details.dataset.stockgptFinancialLoading = "true";
  try {
    const response = await fetch(`/api/rankings/financial-metrics?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } });
    const data = response.ok ? await response.json() : null;
    const metrics = (data?.metrics ?? null) as FinancialMetrics | null;
    const diagnostics = (data?.diagnostics ?? null) as RankingDiagnostics | null;
    const summary = details.querySelector<HTMLParagraphElement>("summary + p");
    const grid = details.querySelector<HTMLElement>("summary + p + div");

    details.dataset.stockgptDiagnosticsOwner = "true";
    if (summary) summary.textContent = `${ticker}: ${diagnosticSummary(diagnostics, metrics)}${metricSummary(metrics)}`;
    if (grid) grid.replaceChildren(...diagnosticCards(diagnostics, metrics));
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
      void patchDetails(details, true);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const details = target?.closest?.("details") as HTMLDetailsElement | null;
        if (!details || !details.open) continue;
        const summary = details.querySelector("summary")?.textContent?.toLowerCase() ?? "";
        if (!summary.includes("why this rank")) continue;
        if (detailsContainsStaleCopy(details)) void patchDetails(details, true);
      }
    });

    document.addEventListener("toggle", onToggle, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      document.removeEventListener("toggle", onToggle, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
